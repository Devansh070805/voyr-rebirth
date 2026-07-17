import { createLogger } from '../../infra/index.js';

const logger = createLogger('inquiry-service');

export type InquiryState = 'New' | 'Assigned' | 'Contacted' | 'Quoted' | 'Converted' | 'Lost';

export interface Inquiry {
  id: string;
  customer_name: string;
  email: string;
  phone?: string;
  destination: string;
  budget?: number;
  status: InquiryState;
  assigned_agent_id?: string;
  created_at: Date;
}

export interface InquiryService {
  createInquiry(data: Partial<Inquiry>): Promise<Inquiry>;
  assignAgent(inquiryId: string, agentId: string): Promise<Inquiry | null>;
  updateStatus(inquiryId: string, status: InquiryState): Promise<Inquiry | null>;
}

export function createInquiryService(): InquiryService {
  // Mock DB in memory for demonstration
  const db: Map<string, Inquiry> = new Map();

  return {
    async createInquiry(data: Partial<Inquiry>): Promise<Inquiry> {
      const inquiry: Inquiry = {
        id: `inq-${Date.now()}`,
        customer_name: data.customer_name || 'Unknown',
        email: data.email || '',
        phone: data.phone,
        destination: data.destination || '',
        budget: data.budget,
        status: 'New',
        created_at: new Date()
      };
      db.set(inquiry.id, inquiry);
      logger.info('New Inquiry Created', { id: inquiry.id });
      return inquiry;
    },

    async assignAgent(inquiryId: string, agentId: string): Promise<Inquiry | null> {
      const inquiry = db.get(inquiryId);
      if (!inquiry) return null;

      inquiry.assigned_agent_id = agentId;
      inquiry.status = 'Assigned';
      db.set(inquiryId, inquiry);
      logger.info('Agent Assigned to Inquiry', { inquiryId, agentId });
      return inquiry;
    },

    async updateStatus(inquiryId: string, status: InquiryState): Promise<Inquiry | null> {
      const inquiry = db.get(inquiryId);
      if (!inquiry) return null;

      inquiry.status = status;
      db.set(inquiryId, inquiry);
      logger.info('Inquiry Status Updated', { inquiryId, status });
      return inquiry;
    }
  };
}
