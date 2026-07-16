import { query, queryOne, queryRows, transaction } from '../../db/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../../infra/index.js';
import type {
  B2BPartner,
  B2BPartnerMember,
  B2BPartnerWithMembers,
  PartnerAccessInfo,
  CreatePartnerDto,
  UpdatePartnerDto,
} from './partner.types.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeCompanyCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '-');
}

export function createPartnerService() {
  return {
    async syncUserSegment(userId: string, email?: string | null): Promise<'b2c' | 'b2b'> {
      const normalizedEmail = email ? normalizeEmail(email) : null;

      const activeMember = await queryOne<{ partner_id: string; partner_status: string }>(
        `SELECT m.partner_id, p.status AS partner_status
         FROM b2b_partner_members m
         JOIN b2b_partners p ON p.id = m.partner_id
         WHERE m.status = 'active' AND p.status = 'active'
           AND (m.user_id = $1 OR ($2::text IS NOT NULL AND LOWER(m.email) = $2))
         ORDER BY m.granted_at DESC
         LIMIT 1`,
        [userId, normalizedEmail],
      );

      const segment: 'b2c' | 'b2b' =
        activeMember && activeMember.partner_status === 'active' ? 'b2b' : 'b2c';

      await queryOne(
        `INSERT INTO user_travel_profiles (user_id, customer_segment)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET
           customer_segment = $2,
           updated_at = NOW()
         RETURNING user_id`,
        [userId, segment],
      );

      if (normalizedEmail) {
        await query(
          `UPDATE b2b_partner_members
           SET user_id = $1, updated_at = NOW()
           WHERE LOWER(email) = $2 AND user_id IS NULL`,
          [userId, normalizedEmail],
        );
      }

      return segment;
    },

    async getPartnerAccess(userId: string, email?: string | null): Promise<PartnerAccessInfo> {
      const segment = await this.syncUserSegment(userId, email);

      if (segment !== 'b2b') {
        return { has_access: false, customer_segment: 'b2c', partner: null };
      }

      const row = await queryOne<{ id: string; name: string; company_code: string }>(
        `SELECT p.id, p.name, p.company_code
         FROM b2b_partner_members m
         JOIN b2b_partners p ON p.id = m.partner_id
         WHERE m.status = 'active' AND p.status = 'active'
           AND (m.user_id = $1 OR ($2::text IS NOT NULL AND LOWER(m.email) = $2))
         ORDER BY m.granted_at DESC
         LIMIT 1`,
        [userId, email ? normalizeEmail(email) : null],
      );

      return {
        has_access: !!row,
        customer_segment: 'b2b',
        partner: row ?? null,
      };
    },

    async listPartners(): Promise<B2BPartnerWithMembers[]> {
      const partners = await queryRows<B2BPartner>(
        `SELECT * FROM b2b_partners ORDER BY name ASC`,
      );

      const members = await queryRows<B2BPartnerMember>(
        `SELECT * FROM b2b_partner_members ORDER BY granted_at DESC`,
      );

      return partners.map((p) => {
        const partnerMembers = members.filter((m) => m.partner_id === p.id);
        return {
          ...p,
          members: partnerMembers,
          active_member_count: partnerMembers.filter((m) => m.status === 'active').length,
        };
      });
    },

    async getPartner(partnerId: string): Promise<B2BPartnerWithMembers> {
      const partner = await queryOne<B2BPartner>(
        `SELECT * FROM b2b_partners WHERE id = $1`,
        [partnerId],
      );
      if (!partner) throw new NotFoundError('Partner not found');

      const members = await queryRows<B2BPartnerMember>(
        `SELECT * FROM b2b_partner_members WHERE partner_id = $1 ORDER BY granted_at DESC`,
        [partnerId],
      );

      return {
        ...partner,
        members,
        active_member_count: members.filter((m) => m.status === 'active').length,
      };
    },

    async createPartner(dto: CreatePartnerDto): Promise<B2BPartner> {
      const name = dto.name?.trim();
      const companyCode = normalizeCompanyCode(dto.company_code || '');
      if (!name) throw new ValidationError('Partner name is required');
      if (!companyCode) throw new ValidationError('Company code is required');

      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM b2b_partners WHERE company_code = $1`,
        [companyCode],
      );
      if (existing) throw new ConflictError('Company code already exists');

      const row = await queryOne<B2BPartner>(
        `INSERT INTO b2b_partners (name, company_code, contact_email, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, companyCode, dto.contact_email?.trim() || null, dto.notes?.trim() || null],
      );
      if (!row) throw new Error('Failed to create partner');
      return row;
    },

    async updatePartner(partnerId: string, dto: UpdatePartnerDto): Promise<B2BPartner> {
      const existing = await queryOne<B2BPartner>(
        `SELECT * FROM b2b_partners WHERE id = $1`,
        [partnerId],
      );
      if (!existing) throw new NotFoundError('Partner not found');

      const row = await queryOne<B2BPartner>(
        `UPDATE b2b_partners SET
           name = COALESCE($2, name),
           contact_email = COALESCE($3, contact_email),
           notes = COALESCE($4, notes),
           status = COALESCE($5, status),
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          partnerId,
          dto.name?.trim() || null,
          dto.contact_email !== undefined ? (dto.contact_email?.trim() || null) : null,
          dto.notes !== undefined ? (dto.notes?.trim() || null) : null,
          dto.status || null,
        ],
      );
      if (!row) throw new NotFoundError('Partner not found');

      if (dto.status === 'revoked') {
        await this.revokeAllPartnerMembers(partnerId);
      }

      return row;
    },

    async grantMemberAccess(partnerId: string, email: string): Promise<B2BPartnerMember> {
      const normalizedEmail = normalizeEmail(email);
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new ValidationError('Invalid email format');
      }

      const partner = await queryOne<B2BPartner>(
        `SELECT * FROM b2b_partners WHERE id = $1`,
        [partnerId],
      );
      if (!partner) throw new NotFoundError('Partner not found');
      if (partner.status !== 'active') {
        throw new ValidationError('Cannot grant access on a revoked partner');
      }

      const existingActive = await queryOne<{ id: string; partner_id: string }>(
        `SELECT id, partner_id FROM b2b_partner_members
         WHERE LOWER(email) = $1 AND status = 'active'`,
        [normalizedEmail],
      );
      if (existingActive && existingActive.partner_id !== partnerId) {
        throw new ConflictError('This email already has active B2B access with another partner');
      }

      const user = await queryOne<{ id: string }>(
        `SELECT id FROM users WHERE LOWER(email) = $1`,
        [normalizedEmail],
      );

      const existingMember = await queryOne<B2BPartnerMember>(
        `SELECT * FROM b2b_partner_members WHERE partner_id = $1 AND LOWER(email) = $2`,
        [partnerId, normalizedEmail],
      );

      if (existingMember) {
        if (existingMember.status === 'active') {
          return existingMember;
        }
        const reactivated = await queryOne<B2BPartnerMember>(
          `UPDATE b2b_partner_members SET
             status = 'active',
             user_id = COALESCE($2, user_id),
             granted_at = NOW(),
             revoked_at = NULL,
             updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [existingMember.id, user?.id ?? null],
        );
        if (!reactivated) throw new Error('Failed to grant access');
        if (user?.id) await this.syncUserSegment(user.id, normalizedEmail);
        return reactivated;
      }

      const member = await queryOne<B2BPartnerMember>(
        `INSERT INTO b2b_partner_members (partner_id, user_id, email, status, granted_at, revoked_at)
         VALUES ($1, $2, $3, 'active', NOW(), NULL)
         RETURNING *`,
        [partnerId, user?.id ?? null, normalizedEmail],
      );
      if (!member) throw new Error('Failed to grant access');

      if (user?.id) await this.syncUserSegment(user.id, normalizedEmail);
      return member;
    },

    async revokeMemberAccess(partnerId: string, memberId: string): Promise<B2BPartnerMember> {
      const member = await queryOne<B2BPartnerMember>(
        `SELECT * FROM b2b_partner_members WHERE id = $1 AND partner_id = $2`,
        [memberId, partnerId],
      );
      if (!member) throw new NotFoundError('Member not found');

      const updated = await queryOne<B2BPartnerMember>(
        `UPDATE b2b_partner_members SET
           status = 'revoked',
           revoked_at = NOW(),
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [memberId],
      );
      if (!updated) throw new NotFoundError('Member not found');

      if (member.user_id) {
        await this.syncUserSegment(member.user_id, member.email);
      }

      return updated;
    },

    async revokeAllPartnerMembers(partnerId: string): Promise<void> {
      const members = await queryRows<{ user_id: string | null; email: string }>(
        `UPDATE b2b_partner_members SET
           status = 'revoked',
           revoked_at = NOW(),
           updated_at = NOW()
         WHERE partner_id = $1 AND status = 'active'
         RETURNING user_id, email`,
        [partnerId],
      );

      for (const m of members) {
        if (m.user_id) {
          await this.syncUserSegment(m.user_id, m.email);
        }
      }
    },

    async deletePartner(partnerId: string): Promise<void> {
      await transaction(async (client) => {
        const members = await client.query(
          `SELECT user_id, email FROM b2b_partner_members WHERE partner_id = $1`,
          [partnerId],
        );
        await client.query(`DELETE FROM b2b_partners WHERE id = $1`, [partnerId]);

        for (const m of members.rows) {
          if (m.user_id) {
            await client.query(
              `INSERT INTO user_travel_profiles (user_id, customer_segment)
               VALUES ($1, 'b2c')
               ON CONFLICT (user_id) DO UPDATE SET customer_segment = 'b2c', updated_at = NOW()`,
              [m.user_id],
            );
          }
        }
      });
    },
  };
}

export type PartnerService = ReturnType<typeof createPartnerService>;
