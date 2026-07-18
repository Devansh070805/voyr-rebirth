/**
 * Document Service — Queue-based document generation and R2 upload.
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import PDFDocument from 'pdfkit';
import { queryOne, queryRows, query } from '../../db/index.js';
import {
  createIdempotencyService,
  createLogger,
  RETRY_QUEUE_CONSUMER,
  NotFoundError,
  ValidationError,
  withRetry,
  isHttpRetryable,
} from '../../infra/index.js';
import { logAudit } from '../../infra/audit.service.js';

const logger = createLogger('document-service');
const idempotencyService = createIdempotencyService();



const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000; // 1 second base for exponential backoff


export interface DocumentResult {
  type: 'invoice' | 'itinerary' | 'voucher';
  file_url: string;
  status: 'generated' | 'failed';
}

export interface Document {
  id: string;
  booking_id: string;
  type: string;
  file_url: string | null;
  status: string;
}

export interface DocumentJob {
  id: string;
  booking_id: string;
  status: string;
  attempts?: number;
}

export interface QueueMessage {
  bookingId: string;
  jobId: string;
  attempt: number;
}

export interface DocumentService {
  enqueueGeneration(bookingId: string, idempotencyKey: string): Promise<void>;
  generateDocuments(bookingId: string): Promise<DocumentResult[]>;
  uploadToR2(document: Buffer, key: string): Promise<string>;
  getDocuments(bookingId: string): Promise<Document[]>;
  processQueueMessage(message: QueueMessage): Promise<void>;
}


/**
 * R2 storage client interface.
 * In production, this connects to Cloudflare R2.
 * Can be replaced with a mock for testing.
 */
export interface R2Client {
  put(key: string, body: Buffer, options?: { contentType?: string }): Promise<{ url: string }>;
}

/**
 * Queue client interface.
 * In production, this publishes to Cloudflare Queues.
 * Can be replaced with a mock for testing.
 */
export interface QueueClient {
  publish(message: QueueMessage): Promise<void>;
  publishToDeadLetter(message: QueueMessage, error: string): Promise<void>;
}


function createDefaultR2Client(): R2Client {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const bucketName = process.env.R2_BUCKET_NAME || 'voyr';
  const endpoint = process.env.R2_ENDPOINT?.replace(/\/$/, '');
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const publicUrl =
    process.env.R2_PUBLIC_URL?.replace(/\/$/, '') ||
    (accountId ? `https://${bucketName}.${accountId}.r2.cloudflarestorage.com` : '');

  const s3Client =
    endpoint && accessKeyId && secretAccessKey
      ? new S3Client({
          region: 'auto',
          endpoint,
          credentials: { accessKeyId, secretAccessKey },
        })
      : null;

  return {
    async put(key: string, body: Buffer, options?: { contentType?: string }): Promise<{ url: string }> {
      const contentType = options?.contentType || 'application/pdf';

      if (s3Client) {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
          }),
        );
        return { url: `${publicUrl}/${key}` };
      }

      logger.warn('R2 S3 credentials not configured, returning constructed URL only', { key });
      return { url: `${publicUrl}/${key}` };
    },
  };
}


function createDefaultQueueClient(): QueueClient {
  const queueUrl = process.env.QUEUE_URL || '';

  return {
    async publish(message: QueueMessage): Promise<void> {
      if (queueUrl) {
        const response = await fetch(queueUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });

        if (!response.ok) {
          throw new Error(`Queue publish failed: ${response.status} ${response.statusText}`);
        }
      } else {
        // In development/test, log the message
        logger.info('Queue message published (no queue configured)', { message });
      }
    },

    async publishToDeadLetter(message: QueueMessage, error: string): Promise<void> {
      const dlqUrl = process.env.DEAD_LETTER_QUEUE_URL || '';

      if (dlqUrl) {
        const response = await fetch(dlqUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...message, error, movedAt: new Date().toISOString() }),
        });

        if (!response.ok) {
          throw new Error(`DLQ publish failed: ${response.status} ${response.statusText}`);
        }
      } else {
        logger.warn('Dead-letter queue message (no DLQ configured)', { message, error });
      }
    },
  };
}


export function createDocumentService(
  r2Client?: R2Client,
  queueClient?: QueueClient,
): DocumentService {
  const r2 = r2Client || createDefaultR2Client();
  const queue = queueClient || createDefaultQueueClient();

  return {
    /**
     * Enqueue document generation for a booking.
     * - Checks idempotency to prevent duplicate jobs
     * - Inserts a document_jobs row with QUEUED status
     * - Publishes a message to Cloudflare Queue
     */
    async enqueueGeneration(bookingId: string, idempotencyKey: string): Promise<void> {
      // 1. Check idempotency
      const requestHash = JSON.stringify({ bookingId });
      const idempotencyResult = await idempotencyService.start(
        idempotencyKey,
        'document.enqueue',
        requestHash,
      );

      if (idempotencyResult.alreadyCompleted) {
        logger.info('Document generation already enqueued', { idempotencyKey, bookingId });
        return;
      }

      try {
        // 2. Validate booking exists and is in correct state
        const booking = await queryOne<{ id: string; status: string }>(
          `SELECT id, status FROM bookings WHERE id = $1`,
          [bookingId],
        );

        if (!booking) {
          throw new NotFoundError(`Booking ${bookingId} not found`);
        }

        if (booking.status !== 'Ticketed/booked') {
          throw new ValidationError(
            `Booking ${bookingId} is in state ${booking.status}, expected Ticketed/booked`,
          );
        }

        // 3. Insert document_jobs row
        const jobResult = await queryOne<{ id: string }>(
          `INSERT INTO document_jobs (booking_id, status)
           VALUES ($1, 'QUEUED')
           RETURNING id`,
          [bookingId],
        );

        const jobId = jobResult!.id;

        // 4. Publish message to queue
        const message: QueueMessage = {
          bookingId,
          jobId,
          attempt: 1,
        };

        await queue.publish(message);

        // When no queue consumer is configured, process inline so PDFs still generate.
        if (!process.env.QUEUE_URL) {
          void this.processQueueMessage(message).catch((err: Error) => {
            logger.error('Inline document processing failed', {
              bookingId,
              jobId,
              error: err.message,
            });
          });
        }

        // 5. Complete idempotency
        await idempotencyService.complete(idempotencyKey, { jobId, bookingId });

        // 6. Audit log
        await logAudit('system', 'document.enqueued', 'document_job', jobId, {
          booking_id: bookingId,
        });

        logger.info('Document generation enqueued', { bookingId, jobId });
      } catch (error) {
        await idempotencyService.fail(idempotencyKey);
        throw error;
      }
    },

    /**
     * Generate documents for a booking.
     * Produces invoice, itinerary, and voucher documents.
     */
    async generateDocuments(bookingId: string): Promise<DocumentResult[]> {
      // 1. Fetch booking and related data
      const booking = await queryOne<{ id: string; quote_id: string; status: string }>(
        `SELECT id, quote_id, status FROM bookings WHERE id = $1`,
        [bookingId],
      );

      if (!booking) {
        throw new NotFoundError(`Booking ${bookingId} not found`);
      }

      // 2. Fetch booking items (snapshots of services)
      const bookingItems = await queryRows<{ id: string; snapshot: Record<string, unknown> }>(
        `SELECT id, snapshot FROM booking_items WHERE booking_id = $1`,
        [bookingId],
      );

      // 3. Fetch quote for pricing details
      const quote = await queryOne<{
        id: string;
        currency: string;
        base_amount: number;
        tax_amount: number;
        markup_amount: number;
        fee_amount: number;
        discount_amount: number;
        final_amount: number;
      }>(
        `SELECT id, currency, base_amount, tax_amount, markup_amount,
                fee_amount, discount_amount, final_amount
         FROM quotes WHERE id = $1`,
        [booking.quote_id],
      );

      if (!quote) {
        throw new NotFoundError(`Quote ${booking.quote_id} not found for booking ${bookingId}`);
      }

      const results: DocumentResult[] = [];

      // 4. Generate Invoice PDF
      try {
        const invoiceBuffer = await generateInvoicePdf(booking, quote, bookingItems);
        const invoiceKey = `bookings/${bookingId}/invoice-${Date.now()}.pdf`;
        const invoiceUrl = await r2.put(invoiceKey, invoiceBuffer, { contentType: 'application/pdf' });

        // Store in documents table
        await query(
          `INSERT INTO documents (booking_id, type, file_url, status)
           VALUES ($1, 'invoice', $2, 'GENERATED')`,
          [bookingId, invoiceUrl.url],
        );

        results.push({ type: 'invoice', file_url: invoiceUrl.url, status: 'generated' });
        logger.info('Invoice generated', { bookingId, url: invoiceUrl.url });
      } catch (error) {
        logger.error('Invoice generation failed', { bookingId, error: (error as Error).message });
        results.push({ type: 'invoice', file_url: '', status: 'failed' });
      }

      // 5. Generate Itinerary PDF
      try {
        const itineraryBuffer = await generateItineraryPdf(booking, bookingItems);
        const itineraryKey = `bookings/${bookingId}/itinerary-${Date.now()}.pdf`;
        const itineraryUrl = await r2.put(itineraryKey, itineraryBuffer, { contentType: 'application/pdf' });

        await query(
          `INSERT INTO documents (booking_id, type, file_url, status)
           VALUES ($1, 'itinerary', $2, 'GENERATED')`,
          [bookingId, itineraryUrl.url],
        );

        results.push({ type: 'itinerary', file_url: itineraryUrl.url, status: 'generated' });
        logger.info('Itinerary generated', { bookingId, url: itineraryUrl.url });
      } catch (error) {
        logger.error('Itinerary generation failed', { bookingId, error: (error as Error).message });
        results.push({ type: 'itinerary', file_url: '', status: 'failed' });
      }

      // 6. Generate Voucher document
      try {
        const voucherBuffer = await generateVoucherPdf(booking, bookingItems);
        const voucherKey = `bookings/${bookingId}/voucher-${Date.now()}.pdf`;
        const voucherUrl = await r2.put(voucherKey, voucherBuffer, { contentType: 'application/pdf' });

        await query(
          `INSERT INTO documents (booking_id, type, file_url, status)
           VALUES ($1, 'voucher', $2, 'GENERATED')`,
          [bookingId, voucherUrl.url],
        );

        results.push({ type: 'voucher', file_url: voucherUrl.url, status: 'generated' });
        logger.info('Voucher generated', { bookingId, url: voucherUrl.url });
      } catch (error) {
        logger.error('Voucher generation failed', { bookingId, error: (error as Error).message });
        results.push({ type: 'voucher', file_url: '', status: 'failed' });
      }

      return results;
    },

    /**
     * Upload a document buffer to Cloudflare R2.
     * Returns the public URL of the uploaded file.
     * Retries up to 3 times with exponential backoff for transient failures.
     */
    async uploadToR2(document: Buffer, key: string): Promise<string> {
      const retryResult = await withRetry(
        () => r2.put(key, document, { contentType: 'application/pdf' }),
        {
          ...RETRY_QUEUE_CONSUMER,
          maxAttempts: 3, // R2 uploads use 3 retries (external API profile)
          operationName: 'r2-upload',
          isRetryable: isHttpRetryable,
        },
      );

      if (!retryResult.success) {
        throw retryResult.error || new Error(`R2 upload failed for key: ${key}`);
      }

      logger.info('Document uploaded to R2', { key, url: retryResult.result!.url });
      return retryResult.result!.url;
    },

    /**
     * Get all documents for a booking.
     */
    async getDocuments(bookingId: string): Promise<Document[]> {
      const documents = await queryRows<Document>(
        `SELECT id, booking_id, type, file_url, status
         FROM documents
         WHERE booking_id = $1
         ORDER BY type`,
        [bookingId],
      );
      return documents;
    },

    /**
     * Process a queue message — the queue consumer entry point.
     *
     * Flow:
     * 1. Update job status to PROCESSING
     * 2. Generate all documents
     * 3. If all succeed: transition booking to DOCUMENTS_GENERATED
     * 4. If any fail and retries remain: re-enqueue with incremented attempt
     * 5. If max retries exceeded: move to dead-letter queue, transition to FAILED
     */
    async processQueueMessage(message: QueueMessage): Promise<void> {
      const { bookingId, jobId, attempt } = message;

      logger.info('Processing document generation job', { bookingId, jobId, attempt });

      try {
        // 1. Update job status to PROCESSING
        await query(
          `UPDATE document_jobs SET status = 'PROCESSING' WHERE id = $1`,
          [jobId],
        );

        // 2. Generate documents
        const results = await this.generateDocuments(bookingId);

        // 3. Check if all documents were generated successfully
        const allSucceeded = results.every((r) => r.status === 'generated');
        const anyFailed = results.some((r) => r.status === 'failed');

        if (allSucceeded) {
          // Success: update job status and transition booking
          await query(
            `UPDATE document_jobs SET status = 'COMPLETED' WHERE id = $1`,
            [jobId],
          );

          // Transition booking: (State unchanged in the new 8-state model)

          await logAudit('system', 'document.generation_complete', 'booking', bookingId, {
            job_id: jobId,
            documents: results.map((r) => ({ type: r.type, url: r.file_url })),
          });

          logger.info('Document generation completed successfully', { bookingId, jobId });
        } else if (anyFailed) {
          // Some documents failed — retry or move to DLQ
          throw new Error(
            `Document generation partially failed: ${results
              .filter((r) => r.status === 'failed')
              .map((r) => r.type)
              .join(', ')}`,
          );
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error('Document generation job failed', {
          bookingId,
          jobId,
          attempt,
          error: errorMessage,
        });

        if (attempt >= MAX_RETRIES) {
          // Max retries exceeded — move to dead-letter queue and transition to FAILED
          await query(
            `UPDATE document_jobs SET status = 'FAILED' WHERE id = $1`,
            [jobId],
          );

          await queue.publishToDeadLetter(message, errorMessage);

          // Transition booking to FAILED (Removed in the new 8-state model)

          await logAudit('system', 'document.generation_failed', 'booking', bookingId, {
            job_id: jobId,
            attempts: attempt,
            error: errorMessage,
          });

          logger.error('Document generation moved to dead-letter queue', {
            bookingId,
            jobId,
            attempts: attempt,
          });
        } else {
          // Retry with exponential backoff
          const nextAttempt = attempt + 1;
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);

          await query(
            `UPDATE document_jobs SET status = 'RETRY_PENDING' WHERE id = $1`,
            [jobId],
          );

          // Schedule retry (in production, the queue handles delay)
          const retryMessage: QueueMessage = {
            bookingId,
            jobId,
            attempt: nextAttempt,
          };

          // Delay before re-enqueue (simulated — in production, use queue visibility timeout)
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          await queue.publish(retryMessage);

          logger.info('Document generation job scheduled for retry', {
            bookingId,
            jobId,
            nextAttempt,
            backoffMs,
          });
        }
      }
    },
  };
}


/**
 * Generate an invoice PDF buffer using pdfkit.
 * Produces a proper, print-ready PDF with Voyr branding, line items, and pricing summary.
 */
function generateInvoicePdf(
  booking: { id: string; quote_id: string },
  quote: {
    id: string;
    currency: string;
    base_amount: number;
    tax_amount: number;
    markup_amount: number;
    fee_amount: number;
    discount_amount: number;
    final_amount: number;
  },
  items: { id: string; snapshot: Record<string, unknown> }[],
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Branding Header ──
    doc.fontSize(24).font('Helvetica-Bold').text('VOYR', 50, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text('Travel Operations • Invoice', 50, 78);

    // Horizontal rule
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#ddd').stroke();

    // ── Invoice Title ──
    doc.fillColor('#111').fontSize(18).font('Helvetica-Bold')
      .text('INVOICE', 50, 120);

    // ── Booking / Quote Reference ──
    doc.fontSize(9).font('Helvetica').fillColor('#555')
      .text(`Booking ID: ${booking.id.slice(0, 8)}…`, 50, 150)
      .text(`Quote ID: ${quote.id.slice(0, 8)}…`, 50, 165)
      .text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, 180);

    // ── Line Items Table Header ──
    const tableTop = 220;
    doc.fillColor('#333').fontSize(10).font('Helvetica-Bold');
    doc.text('#', 50, tableTop, { width: 30 });
    doc.text('Description', 80, tableTop, { width: 250 });
    doc.text('Amount', 400, tableTop, { width: 100, align: 'right' });

    doc.moveTo(50, tableTop + 18).lineTo(545, tableTop + 18).strokeColor('#eee').stroke();

    // ── Line Items ──
    let yPos = tableTop + 28;
    doc.font('Helvetica').fontSize(9).fillColor('#444');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const name = (item.snapshot.name as string) || `Service ${i + 1}`;
      const price =
        typeof item.snapshot.price === 'number'
          ? item.snapshot.price
          : typeof item.snapshot.amount === 'number'
            ? (item.snapshot.amount as number)
            : 0;
      const qty = (item.snapshot.quantity as number) || 1;
      const total = price * qty;

      doc.fillColor('#333').text(`${i + 1}`, 50, yPos, { width: 30 });
      doc.fillColor('#444').text(name, 80, yPos, { width: 250 });
      doc.fillColor('#333').text(
        `${quote.currency} ${total.toFixed(2)}`,
        400, yPos, { width: 100, align: 'right' },
      );

      if ((item.snapshot.description as string) || item.snapshot.type) {
        const sub = item.snapshot.description as string || item.snapshot.type as string;
        yPos += 14;
        doc.fontSize(8).fillColor('#888').text(sub, 80, yPos, { width: 250 });
        doc.fontSize(9).fillColor('#444');
      }

      yPos += 22;
    }

    // ── Pricing Summary ──
    const summaryTop = Math.max(yPos + 20, 350);
    doc.moveTo(350, summaryTop).lineTo(545, summaryTop).strokeColor('#ddd').stroke();

    const summaryY = summaryTop + 10;
    doc.fontSize(9).font('Helvetica').fillColor('#555');
    doc.text('Base Amount', 355, summaryY, { width: 190, align: 'right' });
    doc.fillColor('#333').text(`${quote.currency} ${quote.base_amount.toFixed(2)}`, 355, summaryY, { width: 190, align: 'right' });

    doc.fillColor('#555').text('Tax (18%)', 355, summaryY + 16, { width: 190, align: 'right' });
    doc.fillColor('#333').text(`${quote.currency} ${quote.tax_amount.toFixed(2)}`, 355, summaryY + 16, { width: 190, align: 'right' });

    doc.fillColor('#555').text('Markup', 355, summaryY + 32, { width: 190, align: 'right' });
    doc.fillColor('#333').text(`${quote.currency} ${quote.markup_amount.toFixed(2)}`, 355, summaryY + 32, { width: 190, align: 'right' });

    if (quote.fee_amount > 0) {
      doc.fillColor('#555').text('Fee', 355, summaryY + 48, { width: 190, align: 'right' });
      doc.fillColor('#333').text(`${quote.currency} ${quote.fee_amount.toFixed(2)}`, 355, summaryY + 48, { width: 190, align: 'right' });
    }

    if (quote.discount_amount > 0) {
      const discountY = quote.fee_amount > 0 ? summaryY + 64 : summaryY + 48;
      doc.fillColor('#2a9d8f').text('Discount', 355, discountY, { width: 190, align: 'right' });
      doc.fillColor('#2a9d8f').text(`-${quote.currency} ${quote.discount_amount.toFixed(2)}`, 355, discountY, { width: 190, align: 'right' });
    }

    // Total
    const totalY = (quote.fee_amount > 0 ? summaryY + 64 : summaryY + 48) +
      (quote.discount_amount > 0 ? 16 : 0) + 10;
    doc.moveTo(350, totalY - 5).lineTo(545, totalY - 5).strokeColor('#333').stroke();
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111');
    doc.text('TOTAL', 355, totalY, { width: 100 });
    doc.text(`${quote.currency} ${quote.final_amount.toFixed(2)}`, 400, totalY, { width: 145, align: 'right' });

    // ── Footer ──
    doc.fontSize(8).font('Helvetica').fillColor('#999');
    doc.text(
      'Voyr Travel Operations • Thank you for your business',
      50, 780, { align: 'center', width: 495 },
    );

    doc.end();
  });
}

/**
 * Generate an itinerary PDF buffer using pdfkit.
 */
function generateItineraryPdf(
  booking: { id: string },
  items: { id: string; snapshot: Record<string, unknown> }[],
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Title ──
    doc.fontSize(24).font('Helvetica-Bold').text('VOYR', 50, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text('Travel Itinerary', 50, 78);
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#ddd').stroke();

    doc.fillColor('#111').fontSize(18).font('Helvetica-Bold')
      .text('YOUR TRAVEL ITINERARY', 50, 120);

    doc.fontSize(9).font('Helvetica').fillColor('#555')
      .text(`Booking: ${booking.id.slice(0, 8)}…`, 50, 150)
      .text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, 165);

    // ── Itinerary Items ──
    let yPos = 210;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111');
    doc.text('Daily Plan', 50, yPos);
    yPos += 25;

    doc.font('Helvetica').fontSize(10).fillColor('#444');

    if (items.length === 0) {
      doc.text('No itinerary details available.', 50, yPos);
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const name = (item.snapshot.name as string) || `Activity ${i + 1}`;
      const type = (item.snapshot.type as string) || 'activity';
      const description = (item.snapshot.description as string) || '';

      // Check if we need a new page
      if (yPos > 720) {
        doc.addPage();
        yPos = 50;
      }

      // Day header
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a73e8');
      doc.text(`Day ${i + 1}: ${name}`, 50, yPos);
      yPos += 20;

      // Type badge
      doc.fontSize(8).font('Helvetica').fillColor('#888');
      doc.text(type.toUpperCase(), 60, yPos);
      yPos += 16;

      // Description
      if (description) {
        doc.fontSize(9).fillColor('#555');
        doc.text(description, 60, yPos, { width: 450 });
        yPos += doc.y - yPos + 8;
      }

      // Details
      if (item.snapshot.duration_hours) {
        doc.fontSize(9).fillColor('#777');
        doc.text(`Duration: ${item.snapshot.duration_hours}h`, 60, yPos);
        yPos += 14;
      }
      if (item.snapshot.location) {
        doc.fontSize(9).fillColor('#777');
        doc.text(`Location: ${item.snapshot.location as string}`, 60, yPos);
        yPos += 14;
      }

      yPos += 12;

      // Separator
      if (i < items.length - 1) {
        doc.moveTo(60, yPos).lineTo(545, yPos).strokeColor('#eee').stroke();
        yPos += 10;
      }
    }

    // ── Footer ──
    doc.fontSize(8).font('Helvetica').fillColor('#999');
    doc.text(
      'Voyr Travel Operations • Have a great trip!',
      50, 780, { align: 'center', width: 495 },
    );

    doc.end();
  });
}

/**
 * Generate a voucher PDF buffer using pdfkit.
 */
function generateVoucherPdf(
  booking: { id: string },
  items: { id: string; snapshot: Record<string, unknown> }[],
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Title ──
    doc.fontSize(24).font('Helvetica-Bold').text('VOYR', 50, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text('Travel Vouchers', 50, 78);
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#ddd').stroke();

    let yPos = 130;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const name = (item.snapshot.name as string) || `Service ${i + 1}`;
      const type = (item.snapshot.type as string) || 'general';
      const voucherNum = `V-${booking.id.slice(0, 8)}-${(i + 1).toString().padStart(3, '0')}`;

      // Check page break
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      // Voucher box
      doc.roundedRect(50, yPos, 495, 130, 8).strokeColor('#1a73e8').lineWidth(1.5).stroke();

      // Voucher header inside box
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a73e8');
      doc.text('VOUCHER', 65, yPos + 10);

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#111');
      doc.text(voucherNum, 65, yPos + 28);

      doc.fontSize(10).font('Helvetica').fillColor('#333');
      doc.text(name, 300, yPos + 10, { width: 230 });

      doc.fontSize(8).fillColor('#888');
      doc.text(type.toUpperCase(), 300, yPos + 28, { width: 230 });

      doc.fontSize(10).fillColor('#555');
      doc.text('Status: VALID', 65, yPos + 50);
      doc.text(`Booking: ${booking.id.slice(0, 8)}…`, 65, yPos + 68);

      // Description
      if (item.snapshot.description) {
        doc.fontSize(9).fillColor('#777');
        doc.text((item.snapshot.description as string), 65, yPos + 86, { width: 430 });
      }

      yPos += 160;
    }

    // ── Footer ──
    doc.fontSize(8).font('Helvetica').fillColor('#999');
    doc.text(
      'Voyr Travel Operations • Present this voucher at check-in',
      50, 780, { align: 'center', width: 495 },
    );

    doc.end();
  });
}
