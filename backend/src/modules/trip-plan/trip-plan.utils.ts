export { capitalize, parsePrice } from '../../utils/format.js';

export function getTripDates(nights: number): { checkin: string; checkout: string } {
  const today = new Date();
  const checkin = new Date(today);
  checkin.setDate(checkin.getDate() + 30);
  const checkout = new Date(checkin);
  checkout.setDate(checkout.getDate() + nights);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { checkin: fmt(checkin), checkout: fmt(checkout) };
}

export function defaultStartDate(offsetDays = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

export function marginBetween(sell: number, cost: number): number {
  return Math.round((sell - cost) * 100) / 100;
}
