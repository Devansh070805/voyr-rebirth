import { createBookingService } from '../booking/booking.service.js';
import { createPaymentService, type PaymentService } from './payment.service.js';

export function createDefaultPaymentService(): PaymentService {
  const bookingService = createBookingService();
  return createPaymentService(
    bookingService.createBooking,
    bookingService.createPaymentTrackingBooking,
  );
}
