import { EventEmitter } from 'events';
import { createLogger } from '../../infra/index.js';

const logger = createLogger('notification-emitter');

type Language = 'EN' | 'HI' | 'PA';

interface NotificationPayload {
  recipient_phone: string;
  recipient_email: string;
  template_type: 'BOOKING_CONFIRMED' | 'INQUIRY_ALERT' | 'LEAD_UPDATE';
  language: Language;
  data: Record<string, string>;
}

const TEMPLATES: Record<Language, Record<string, string>> = {
  EN: {
    BOOKING_CONFIRMED: 'Your booking to {destination} is confirmed!',
    INQUIRY_ALERT: 'New inquiry received from {name}.',
    LEAD_UPDATE: 'Lead status updated to {status}.'
  },
  HI: {
    BOOKING_CONFIRMED: 'आपकी {destination} की बुकिंग पक्की हो गई है!',
    INQUIRY_ALERT: '{name} से नई पूछताछ प्राप्त हुई।',
    LEAD_UPDATE: 'लीड की स्थिति {status} में अपडेट की गई।'
  },
  PA: {
    BOOKING_CONFIRMED: 'ਤੁਹਾਡੀ {destination} ਦੀ ਬੁਕਿੰਗ ਪੱਕੀ ਹੋ ਗਈ ਹੈ!',
    INQUIRY_ALERT: '{name} ਤੋਂ ਨਵੀਂ ਪੁੱਛਗਿੱਛ ਪ੍ਰਾਪਤ ਹੋਈ।',
    LEAD_UPDATE: 'ਲੀਡ ਦੀ ਸਥਿਤੀ {status} ਵਿੱਚ ਅੱਪਡੇਟ ਕੀਤੀ ਗਈ।'
  }
};

export class NotificationEmitterService extends EventEmitter {
  constructor() {
    super();
    this.on('send_notification', this.handleNotification.bind(this));
  }

  private handleNotification(payload: NotificationPayload) {
    const template = TEMPLATES[payload.language][payload.template_type];
    if (!template) {
      logger.error('Template not found', { lang: payload.language, type: payload.template_type });
      return;
    }

    let message = template;
    for (const [key, value] of Object.entries(payload.data)) {
      message = message.replace(`{${key}}`, value);
    }

    // Mock sending via WhatsApp/Email API
    logger.info(`[MOCK NOTIFICATION] To: ${payload.recipient_phone} / ${payload.recipient_email} | Message: ${message}`);
  }

  public notify(payload: NotificationPayload) {
    this.emit('send_notification', payload);
  }
}

export const globalEmitter = new NotificationEmitterService();
