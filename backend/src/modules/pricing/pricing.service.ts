import { queryRows, queryOne } from '../../db/index.js';
import { NotFoundError } from '../../infra/index.js';
import { normalizeDestinationSlug } from '../curated-listings/curated-listings.types.js';
import type {
  ApplyMarginInput,
  ApplyMarginResult,
  CreateMarginRuleDto,
  MarginRule,
  UpdateMarginRuleDto,
} from './pricing.types.js';

const CACHE_TTL_MS = 60_000;
let rulesCache: { rules: MarginRule[]; loadedAt: number } | null = null;

function mapRule(row: Record<string, unknown>): MarginRule {
  return {
    id: row.id as string,
    provider: row.provider as string,
    listing_type: (row.listing_type as string) ?? null,
    destination_slug: (row.destination_slug as string) ?? null,
    customer_segment: row.customer_segment as MarginRule['customer_segment'],
    margin_type: row.margin_type as MarginRule['margin_type'],
    margin_value: Number(row.margin_value),
    min_margin_amount: row.min_margin_amount != null ? Number(row.min_margin_amount) : null,
    is_active: row.is_active as boolean,
  };
}

function ruleSpecificity(rule: MarginRule, input: ApplyMarginInput): number {
  let score = 0;
  if (rule.provider !== 'all' && rule.provider === input.provider) score += 8;
  if (rule.provider === 'all') score += 1;
  if (rule.listing_type && rule.listing_type === input.listingType) score += 4;
  if (rule.destination_slug && input.destinationSlug && rule.destination_slug === normalizeDestinationSlug(input.destinationSlug)) score += 4;
  const seg = input.customerSegment ?? 'b2c';
  if (rule.customer_segment === seg) score += 2;
  if (rule.customer_segment === 'all') score += 1;
  return score;
}

async function loadActiveRules(): Promise<MarginRule[]> {
  if (rulesCache && Date.now() - rulesCache.loadedAt < CACHE_TTL_MS) {
    return rulesCache.rules;
  }
  const rows = await queryRows<Record<string, unknown>>(
    `SELECT * FROM provider_margin_rules WHERE is_active = true ORDER BY updated_at DESC`,
  );
  const rules = rows.map(mapRule);
  rulesCache = { rules, loadedAt: Date.now() };
  return rules;
}

function invalidateCache(): void {
  rulesCache = null;
}

export function createPricingService() {
  return {
    invalidateCache,

    async listRules(): Promise<MarginRule[]> {
      const rows = await queryRows<Record<string, unknown>>(
        `SELECT * FROM provider_margin_rules ORDER BY provider, customer_segment, updated_at DESC`,
      );
      return rows.map(mapRule);
    },

    async createRule(dto: CreateMarginRuleDto): Promise<MarginRule> {
      const row = await queryOne<Record<string, unknown>>(
        `INSERT INTO provider_margin_rules (
          provider, listing_type, destination_slug, customer_segment,
          margin_type, margin_value, min_margin_amount, is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          dto.provider,
          dto.listing_type ?? null,
          dto.destination_slug ? normalizeDestinationSlug(dto.destination_slug) : null,
          dto.customer_segment ?? 'all',
          dto.margin_type ?? 'percent',
          dto.margin_value,
          dto.min_margin_amount ?? null,
          dto.is_active ?? true,
        ],
      );
      invalidateCache();
      return mapRule(row!);
    },

    async updateRule(id: string, dto: UpdateMarginRuleDto): Promise<MarginRule> {
      const existing = await queryOne<Record<string, unknown>>(
        `SELECT * FROM provider_margin_rules WHERE id = $1`,
        [id],
      );
      if (!existing) throw new NotFoundError('Margin rule not found');

      const row = await queryOne<Record<string, unknown>>(
        `UPDATE provider_margin_rules SET
          provider = $1, listing_type = $2, destination_slug = $3, customer_segment = $4,
          margin_type = $5, margin_value = $6, min_margin_amount = $7, is_active = $8, updated_at = NOW()
        WHERE id = $9 RETURNING *`,
        [
          dto.provider ?? existing.provider,
          dto.listing_type !== undefined ? dto.listing_type : existing.listing_type,
          dto.destination_slug !== undefined
            ? dto.destination_slug ? normalizeDestinationSlug(dto.destination_slug) : null
            : existing.destination_slug,
          dto.customer_segment ?? existing.customer_segment,
          dto.margin_type ?? existing.margin_type,
          dto.margin_value ?? existing.margin_value,
          dto.min_margin_amount !== undefined ? dto.min_margin_amount : existing.min_margin_amount,
          dto.is_active ?? existing.is_active,
          id,
        ],
      );
      invalidateCache();
      return mapRule(row!);
    },

    async deleteRule(id: string): Promise<void> {
      const row = await queryOne<{ id: string }>(
        `DELETE FROM provider_margin_rules WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!row) throw new NotFoundError('Margin rule not found');
      invalidateCache();
    },

    async applyMargin(input: ApplyMarginInput): Promise<ApplyMarginResult> {
      return this.applyMarginSync(input);
    },

    applyMarginSync(input: ApplyMarginInput): ApplyMarginResult {
      const rules = rulesCache?.rules;
      if (!rules) {
        return {
          costPrice: input.basePrice,
          displayPrice: input.basePrice,
          marginAmount: 0,
          ruleId: null,
        };
      }

      const segment = input.customerSegment ?? 'b2c';
      const applicable = rules
        .filter((r) => r.provider === input.provider || r.provider === 'all')
        .filter((r) => r.customer_segment === segment || r.customer_segment === 'all')
        .filter((r) => !r.listing_type || r.listing_type === input.listingType)
        .filter((r) => !r.destination_slug || !input.destinationSlug || r.destination_slug === normalizeDestinationSlug(input.destinationSlug))
        .sort((a, b) => ruleSpecificity(b, input) - ruleSpecificity(a, input));

      const rule = applicable[0];
      if (!rule) {
        return {
          costPrice: input.basePrice,
          displayPrice: input.basePrice,
          marginAmount: 0,
          ruleId: null,
        };
      }

      let marginAmount =
        rule.margin_type === 'flat'
          ? rule.margin_value
          : (input.basePrice * rule.margin_value) / 100;

      if (rule.min_margin_amount != null && marginAmount < rule.min_margin_amount) {
        marginAmount = rule.min_margin_amount;
      }

      return {
        costPrice: input.basePrice,
        displayPrice: Math.round((input.basePrice + marginAmount) * 100) / 100,
        marginAmount: Math.round(marginAmount * 100) / 100,
        ruleId: rule.id,
      };
    },

    /** Warm cache — call before sync margin in display builders. */
    async ensureRulesLoaded(): Promise<void> {
      await loadActiveRules();
    },

    previewMargin(basePrice: number, rule: MarginRule): ApplyMarginResult {
      let marginAmount =
        rule.margin_type === 'flat'
          ? rule.margin_value
          : (basePrice * rule.margin_value) / 100;
      if (rule.min_margin_amount != null && marginAmount < rule.min_margin_amount) {
        marginAmount = rule.min_margin_amount;
      }
      return {
        costPrice: basePrice,
        displayPrice: Math.round((basePrice + marginAmount) * 100) / 100,
        marginAmount: Math.round(marginAmount * 100) / 100,
        ruleId: rule.id,
      };
    },
  };
}

export type PricingService = ReturnType<typeof createPricingService>;
