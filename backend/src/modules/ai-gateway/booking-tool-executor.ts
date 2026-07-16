import { createLogger } from '../../infra/index.js';
import type { CuratedListingsService } from '../curated-listings/curated-listings.service.js';
import { createConversationService } from '../conversation/conversation.service.js';
import { createPackageService } from '../package/package.service.js';
import { createDefaultPaymentService } from '../payment/payment.factory.js';
import { createQuoteService } from '../quote/quote.service.js';
import type { TripPlan } from '../trip-plan/trip-plan.types.js';
import {
  brokerSnapshotForPackageLine,
  planHasSelections,
  planToPackageItems,
} from '../trip-plan/plan-to-package.js';

const logger = createLogger('booking-tool-executor');
const packageService = createPackageService();
const quoteService = createQuoteService();
const paymentService = createDefaultPaymentService();
const conversationService = createConversationService();

export interface BookingToolResult {
  success: boolean;
  data: Record<string, unknown>;
}

export async function executeBookingTool(
  userId: string,
  conversationId: string | undefined,
  toolName: string,
  args: Record<string, unknown>,
  plan: TripPlan,
  curatedListings: CuratedListingsService,
): Promise<BookingToolResult> {
  try {
    switch (toolName) {
      case 'create_package': {
        const packageResult = await planToPackageItems(plan, { curatedListings });

        if (!planHasSelections(plan)) {
          return {
            success: false,
            data: {
              error: 'no_selections',
              message:
                'Please select at least one hotel, activity, flight, or ticket before creating a package.',
            },
          };
        }

        if (packageResult.lines.length === 0) {
          return {
            success: false,
            data: {
              error: 'cannot_create_package_yet',
              message:
                'Your selections need Voyr curated listings linked to inventory before we can build a package. '
                + 'Please choose Voyr Pick options or ask your broker to link inventory.',
              skipped: packageResult.skipped,
            },
          };
        }

        const result = await packageService.createPackage(userId, {
          destination: (args.destination as string) || plan.destination || 'trip',
          nights: (args.nights as number) || plan.nights || 3,
          people: (args.people as number) || plan.travelers || 2,
        });

        for (const line of packageResult.lines) {
          await packageService.addItem(result.package_id, {
            option_id: line.option_id,
            quantity: line.quantity,
            selected_date: line.selected_date,
            broker_snapshot: brokerSnapshotForPackageLine(line.broker),
          });
        }

        if (conversationId) {
          await conversationService.linkPackage(conversationId, result.package_id);
          await conversationService.updateStatus(conversationId, 'package_created');
        }

        logger.info('Package created via AI tool', {
          packageId: result.package_id,
          lineCount: packageResult.lines.length,
          skippedCount: packageResult.skipped.length,
        });

        return {
          success: true,
          data: {
            package_id: result.package_id,
            items_added: packageResult.lines.length,
            skipped: packageResult.skipped,
          },
        };
      }
      case 'generate_quote': {
        const result = await quoteService.generateQuote({
          package_id: args.package_id as string,
        });
        if (conversationId) {
          await conversationService.updateStatus(conversationId, 'quote_ready');
        }
        logger.info('Quote generated via AI tool', { quoteId: result.quote_id });
        return {
          success: true,
          data: {
            quote_id: result.quote_id,
            final_amount: result.final_amount,
            valid_until: result.valid_until,
          },
        };
      }
      case 'start_checkout': {
        const idempotencyKey = `checkout-${args.quote_id}-${Date.now()}`;
        const result = await paymentService.createSession(
          { quote_id: args.quote_id as string },
          idempotencyKey,
        );
        if (conversationId) {
          await conversationService.updateStatus(conversationId, 'checkout_ready');
        }
        logger.info('Checkout started via AI tool', { paymentId: result.payment_id });
        return {
          success: true,
          data: {
            checkout_url: result.checkout_url,
            payment_id: result.payment_id,
            return_url: result.return_url,
          },
        };
      }
      default:
        return { success: false, data: { error: `Unknown booking tool: ${toolName}` } };
    }
  } catch (error) {
    logger.error('Booking tool execution failed', {
      tool: toolName,
      error: (error as Error).message,
    });
    return { success: false, data: { error: (error as Error).message } };
  }
}

export const BOOKING_TOOLS = new Set(['create_package', 'generate_quote', 'start_checkout']);
