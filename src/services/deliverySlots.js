/**
 * FreshRoute delivery batches (Overland Park Indian grocery delivery)
 *
 * Two daily batches:
 * - SAME-DAY batch: order between 7:00 AM – 12:00 PM → delivered same day 4:00 – 9:00 PM
 * - NEXT-DAY batch: order between 4:00 PM – 9:00 PM → delivered next morning 8:00 AM – 12:00 PM
 *
 * Orders placed outside batch windows join the next upcoming batch:
 * - 12:00 PM – 4:00 PM → missed today's cutoff, rolls into the next-day morning batch
 * - 9:00 PM – 7:00 AM → joins the next morning's order batch, delivered that day 4:00 – 9:00 PM
 */

export const SLOT_SAME_DAY = 'same-day';
export const SLOT_NEXT_DAY = 'next-day';

function atDay(date, h, m = 0) {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function dayLabel(date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((startOfDate - startOfToday) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'long' });
}

/**
 * Returns the active/upcoming delivery batch for a given moment.
 * {
 *   id, batchLabel, orderWindowLabel, deliveryDate,
 *   deliveryLabel, cutoffAt (Date|null), isLive, note?
 * }
 */
export function getDeliverySlot(from = new Date()) {
  const h = from.getHours() + from.getMinutes() / 60;
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  // 7:00 AM – 12:00 PM → same-day batch, delivered today 4–9 PM
  if (h >= 7 && h < 12) {
    return {
      id: SLOT_SAME_DAY,
      batchLabel: 'Same-day batch',
      orderWindowLabel: '7:00 AM – 12:00 PM',
      deliveryDate: today,
      deliveryLabel: `${dayLabel(today)}, 4:00 – 9:00 PM`,
      cutoffAt: atDay(from, 12),
      isLive: true
    };
  }

  // 4:00 PM – 9:00 PM → next-day batch, delivered tomorrow morning 8 AM – 12 PM
  if (h >= 16 && h < 21) {
    return {
      id: SLOT_NEXT_DAY,
      batchLabel: 'Next-day batch',
      orderWindowLabel: '4:00 PM – 9:00 PM',
      deliveryDate: tomorrow,
      deliveryLabel: `${dayLabel(tomorrow)} morning, 8:00 AM – 12:00 PM`,
      cutoffAt: atDay(from, 21),
      isLive: true
    };
  }

  // 12:00 PM – 4:00 PM → missed today's cutoff, rolls into next-day morning batch
  if (h >= 12 && h < 16) {
    return {
      id: SLOT_NEXT_DAY,
      batchLabel: 'Next-day batch',
      orderWindowLabel: '4:00 PM – 9:00 PM',
      deliveryDate: tomorrow,
      deliveryLabel: `${dayLabel(tomorrow)} morning, 8:00 AM – 12:00 PM`,
      cutoffAt: atDay(from, 21),
      isLive: true,
      note: "Today's 12:00 PM same-day cutoff has passed"
    };
  }

  // 9:00 PM – 7:00 AM → joins the next morning order batch → delivered that day 4–9 PM
  const batchDay = h >= 21 ? tomorrow : today;
  return {
    id: SLOT_SAME_DAY,
    batchLabel: 'Same-day batch',
    orderWindowLabel: '7:00 AM – 12:00 PM',
    deliveryDate: batchDay,
    deliveryLabel: `${dayLabel(batchDay)}, 4:00 – 9:00 PM`,
    cutoffAt: atDay(batchDay, 12),
    isLive: false
  };
}

/** "2h 14m" style countdown label */
export function formatCountdown(ms) {
  if (ms == null || ms <= 0) return 'closing soon';
  const totalMin = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

/** Serializable snapshot stored on each order */
export function slotSnapshot(date = new Date()) {
  const s = getDeliverySlot(date);
  return {
    id: s.id,
    batchLabel: s.batchLabel,
    orderWindowLabel: s.orderWindowLabel,
    deliveryLabel: s.deliveryLabel,
    deliveryDate: s.deliveryDate.toISOString(),
    orderedAt: date.toISOString()
  };
}
