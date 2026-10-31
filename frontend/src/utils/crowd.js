/** Crowd level name for a 0-100 index (same thresholds as the backend). */
export function levelForIndex(index) {
  if (index < 30) return 'Comfortable';
  if (index < 52) return 'Moderate';
  if (index < 75) return 'Busy';
  return 'Packed';
}

export function seatText(chance) {
  if (chance >= 0.6) return 'Good chance of a seat';
  if (chance >= 0.25) return 'A seat is possible';
  return 'Expect to stand';
}
