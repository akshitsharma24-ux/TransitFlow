// Time helpers for the planner. The API sends ISO strings with a +05:30 offset
// (Mumbai time). We read the clock digits straight out of the string instead
// of converting through Date, so the times shown are Mumbai times for every
// viewer, wherever their device is.

const pad = (n) => String(n).padStart(2, '0');

export const clock = (iso) => (iso ? iso.slice(11, 16) : '');
export const isoDay = (iso) => (iso ? iso.slice(0, 10) : '');

export function minutesLabel(total) {
  if (total == null) return '';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Current Mumbai date and time as { date: 'YYYY-MM-DD', time: 'HH:MM', seconds: 'HH:MM:SS' }. */
export function istNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    seconds: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + n));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayLabel(dateStr, todayStr = istNow().date) {
  if (!dateStr) return '';
  if (dateStr === todayStr) return 'Today';
  if (dateStr === addDays(todayStr, 1)) return 'Tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[dow]} ${d} ${MONTHS[m - 1]}`;
}

export function isWeekend(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Round a HH:MM string up to the next multiple of five minutes. */
export function roundUpFive(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m;
  const rounded = Math.ceil(total / 5) * 5 % 1440;
  return `${pad(Math.floor(rounded / 60))}:${pad(rounded % 60)}`;
}

export function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// --- Sharing --------------------------------------------------------------

function stepSentence(step) {
  if (step.kind === 'wait') return `${clock(step.start)} Wait at ${step.from_station.name} (${step.minutes} min)`;
  if (step.kind === 'walk') return `${clock(step.start)} ${step.note}`;
  const label = step.line || step.mode;
  const crowd = step.crowd ? ` - ${step.crowd.level} crowd` : '';
  return `${clock(step.start)} ${label}: ${step.from_station.name} to ${step.to_station.name} (${step.minutes} min, \u20b9${step.cost_rupees})${crowd}`;
}

/** Plain-text itinerary, ready to paste into WhatsApp or notes. */
export function itineraryToText(it, originName, destinationName) {
  const lines = [
    `TransitFlow: ${originName} to ${destinationName}`,
    `${dayLabel(isoDay(it.depart))}, ${clock(it.depart)} - ${clock(it.arrive)} (${minutesLabel(it.duration_minutes)}, \u20b9${it.cost_rupees}, ${it.crowd.level} crowd)`,
    '',
    ...it.steps.map(stepSentence),
    `${clock(it.arrive)} Arrive at ${destinationName}`,
  ];
  if (it.tips?.length) lines.push('', ...it.tips.map((t) => `Tip: ${t}`));
  lines.push('', 'Crowd levels are model estimates, not live passenger counts.');
  return lines.join('\n');
}

const icsStamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEscape = (text) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Build an .ics calendar file with one event per trip. */
export function tripsToIcs(trips) {
  const events = trips.map(({ itinerary: it, origin, destination }, i) => [
    'BEGIN:VEVENT',
    `UID:transitflow-${icsStamp(it.depart)}-${i}@transitflow`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(it.depart)}`,
    `DTEND:${icsStamp(it.arrive)}`,
    `SUMMARY:${icsEscape(`${origin} to ${destination} (${it.label})`)}`,
    `DESCRIPTION:${icsEscape(itineraryToText(it, origin, destination))}`,
    'END:VEVENT',
  ].join('\r\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TransitFlow//Planner//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
}

export function downloadText(filename, text, type = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
