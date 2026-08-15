import { Train, TrainFront, Bus, Car, Footprints } from 'lucide-react';

export const OFFICIAL_TICKET_LINKS = {
  train: {
    label: 'Book via RailOne ↗',
    url: 'https://play.google.com/store/apps/details?id=org.cris.aikyam',
    appName: 'RailOne (Indian Railways)',
  },
  metro: {
    label: 'Book via Mumbai Metro ↗',
    url: 'https://www.mmrcl.com/en',
    appName: 'MMRCL / Metro Ticket',
  },
  bus: {
    label: 'Book via BEST Bus ↗',
    url: 'https://www.bestundertaking.com',
    appName: 'BEST Undertaking',
  },
};

/**
 * Real transit line identity — subject-accurate colors, not decorative
 * accents. Used on the manifest rows, the map, and the board.
 */
export const LINE_CONFIGS = {
  'Western Line': {
    name: 'Western Line', mode: 'train', color: '#2F6B4F',
    bgClass: 'bg-[#2F6B4F]/10 text-[#24523C] border-[#2F6B4F]/40',
    ticket: OFFICIAL_TICKET_LINKS.train, icon: Train,
  },
  'Central Line': {
    name: 'Central Line', mode: 'train', color: '#8B3A3A',
    bgClass: 'bg-[#8B3A3A]/10 text-[#6E2E2E] border-[#8B3A3A]/40',
    ticket: OFFICIAL_TICKET_LINKS.train, icon: Train,
  },
  'Yellow Line': {
    name: 'Yellow Line', mode: 'metro', color: '#C4941F',
    bgClass: 'bg-[#C4941F]/12 text-[#8C6816] border-[#C4941F]/40',
    ticket: OFFICIAL_TICKET_LINKS.metro, icon: TrainFront,
  },
  'Red Line': {
    name: 'Red Line', mode: 'metro', color: '#AF3A32',
    bgClass: 'bg-[#AF3A32]/10 text-[#8C2E28] border-[#AF3A32]/40',
    ticket: OFFICIAL_TICKET_LINKS.metro, icon: TrainFront,
  },
  'Aqua Line': {
    name: 'Aqua Line', mode: 'metro', color: '#3E6491',
    bgClass: 'bg-[#3E6491]/10 text-[#2F4D70] border-[#3E6491]/40',
    ticket: OFFICIAL_TICKET_LINKS.metro, icon: TrainFront,
  },
  'Bus': {
    name: 'Bus', mode: 'bus', color: '#B9832E',
    bgClass: 'bg-[#B9832E]/12 text-[#8C6220] border-[#B9832E]/40',
    ticket: OFFICIAL_TICKET_LINKS.bus, icon: Bus,
  },
  'Road': {
    name: 'Road', mode: 'road', color: '#8C5A3C',
    bgClass: 'bg-[#8C5A3C]/10 text-[#6E462F] border-[#8C5A3C]/40',
    ticket: null, icon: Car,
  },
  'Walk': {
    name: 'Walk', mode: 'walk', color: '#848175',
    bgClass: 'bg-[#848175]/10 text-[#5E5C52] border-[#848175]/40',
    ticket: null, icon: Footprints,
  },
};

export function getLineConfig(lineName, modeName) {
  if (lineName && LINE_CONFIGS[lineName]) return LINE_CONFIGS[lineName];
  if (modeName === 'train') return LINE_CONFIGS['Western Line'];
  if (modeName === 'metro') return LINE_CONFIGS['Yellow Line'];
  if (modeName === 'bus') return LINE_CONFIGS['Bus'];
  if (modeName === 'road' || modeName === 'car' || modeName === 'auto') return LINE_CONFIGS['Road'];
  if (modeName === 'walk' || modeName === null) return LINE_CONFIGS['Walk'];
  return {
    name: lineName || modeName || 'Transit', mode: modeName || 'transit', color: '#54524A',
    bgClass: 'bg-[#54524A]/10 text-[#3B3A34] border-[#54524A]/35', ticket: null, icon: Train,
  };
}

/**
 * Crowd forecast → railway signal semantics (green/amber/red), the same
 * vocabulary a real signal aspect uses. Always paired with a text label —
 * severity is never conveyed by color alone.
 */
export const CROWD_CONFIGS = {
  Comfortable: { label: 'On time', color: '#2E7D4F', bgClass: 'bg-signal-green-wash text-[#215A39] border-[#2E7D4F]/30', bars: 1 },
  Moderate: { label: 'Moderate', color: '#C4941F', bgClass: 'bg-[#C4941F]/12 text-[#8C6816] border-[#C4941F]/35', bars: 2 },
  Busy: { label: 'Busy', color: '#E8A33D', bgClass: 'bg-signal-amber-wash text-[#8A661F] border-[#E8A33D]/35', bars: 3 },
  Packed: { label: 'Packed', color: '#C23B2E', bgClass: 'bg-signal-red-wash text-[#8F2C22] border-[#C23B2E]/35', bars: 4 },
};

export function getCrowdConfig(level) {
  return CROWD_CONFIGS[level] || CROWD_CONFIGS.Moderate;
}

export function getJourneyComplexity(legs = []) {
  if (!legs || legs.length === 0) return 'Direct';
  const totalLegs = legs.length;
  const rideLegs = legs.filter((l) => l.type === 'ride').length;
  const transfers = Math.max(0, rideLegs - 1);
  if (transfers === 0) return `${totalLegs} step${totalLegs > 1 ? 's' : ''} • Direct`;
  return `${totalLegs} steps • ${transfers} transfer${transfers > 1 ? 's' : ''}`;
}
