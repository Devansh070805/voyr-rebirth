import type { TripPlan } from '../trip-plan/trip-plan.types.js';
import { guardAssistantResponse } from './response-guard.service.js';

/** Applies response guard incrementally so streamed SSE matches persisted text. */
export class StreamingResponseGuard {
  private raw = '';
  private sent = '';

  constructor(private plan: TripPlan) {}

  append(chunk: string): string {
    if (!chunk) return '';
    this.raw += chunk;
    const guarded = guardAssistantResponse(this.raw, this.plan);
    const delta = guarded.text.slice(this.sent.length);
    this.sent = guarded.text;
    return delta;
  }

  finalText(): string {
    if (this.sent) return this.sent;
    if (!this.raw) return '';
    return guardAssistantResponse(this.raw, this.plan).text;
  }
}
