import { Train, TrainFront, Bus, Car, Footprints } from 'lucide-react';

/**
 * Verified Official Ticket Booking Links
 */
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
 * Metadata & design configurations per line / transit mode (Jewel Tones, no neon)
 */
export const LINE_CONFIGS = {
  'Western Line': {
    name: 'Western Line',
    mode: 'train',
    color: '#2D8B6F', // Western Line exact
    bgClass: 'bg-[#2D8B6F]/15 text-[#3ea888] border-[#2D8B6F]/40',
    badgeClass: 'bg-[#2D8B6F] text-slate-100 font-bold',
    accentBorder: 'border-l-[#2D8B6F]',
    ticket: OFFICIAL_TICKET_LINKS.train,
    icon: Train,
  },
  'Central Line': {
    name: 'Central Line',
    mode: 'train',
    color: '#7D5BA6', // Central Railway — jewel violet, distinct from every other line
    bgClass: 'bg-[#7D5BA6]/15 text-[#a986d4] border-[#7D5BA6]/40',
    badgeClass: 'bg-[#7D5BA6] text-slate-100 font-bold',
    accentBorder: 'border-l-[#7D5BA6]',
    ticket: OFFICIAL_TICKET_LINKS.train,
    icon: Train,
  },
  'Yellow Line': {
    name: 'Yellow Line',
    mode: 'metro',
    color: '#C9971F', // Yellow Line exact
    bgClass: 'bg-[#C9971F]/15 text-[#e5b138] border-[#C9971F]/40',
    badgeClass: 'bg-[#C9971F] text-slate-950 font-bold',
    accentBorder: 'border-l-[#C9971F]',
    ticket: OFFICIAL_TICKET_LINKS.metro,
    icon: TrainFront,
  },
  'Red Line': {
    name: 'Red Line',
    mode: 'metro',
    color: '#B33A44', // Red Line exact
    bgClass: 'bg-[#B33A44]/15 text-[#d95561] border-[#B33A44]/40',
    badgeClass: 'bg-[#B33A44] text-slate-100 font-bold',
    accentBorder: 'border-l-[#B33A44]',
    ticket: OFFICIAL_TICKET_LINKS.metro,
    icon: TrainFront,
  },
  'Aqua Line': {
    name: 'Aqua Line',
    mode: 'metro',
    color: '#3D5FA3', // Aqua Line exact
    bgClass: 'bg-[#3D5FA3]/15 text-[#5e84d4] border-[#3D5FA3]/40',
    badgeClass: 'bg-[#3D5FA3] text-slate-100 font-bold',
    accentBorder: 'border-l-[#3D5FA3]',
    ticket: OFFICIAL_TICKET_LINKS.metro,
    icon: TrainFront,
  },
  'Bus': {
    name: 'Bus',
    mode: 'bus',
    color: '#E0A94E', // Bus exact
    bgClass: 'bg-[#E0A94E]/15 text-[#f0c071] border-[#E0A94E]/40',
    badgeClass: 'bg-[#E0A94E] text-slate-950 font-bold',
    accentBorder: 'border-l-[#E0A94E]',
    ticket: OFFICIAL_TICKET_LINKS.bus,
    icon: Bus,
  },
  'Road': {
    name: 'Road',
    mode: 'road',
    color: '#C25B36', // Road exact
    bgClass: 'bg-[#C25B36]/15 text-[#df7954] border-[#C25B36]/40',
    badgeClass: 'bg-[#C25B36] text-slate-100 font-bold',
    accentBorder: 'border-l-[#C25B36]',
    ticket: null,
    icon: Car,
  },
  'Walk': {
    name: 'Walk',
    mode: 'walk',
    color: '#64748b', // Slate
    bgClass: 'bg-slate-900/60 text-slate-400 border-slate-700/50',
    badgeClass: 'bg-slate-700 text-slate-200 font-medium',
    accentBorder: 'border-l-slate-600',
    ticket: null,
    icon: Footprints,
  }
};

/**
 * Get line config safely with fallbacks
 */
export function getLineConfig(lineName, modeName) {
  if (lineName && LINE_CONFIGS[lineName]) {
    return LINE_CONFIGS[lineName];
  }
  if (modeName === 'train') return LINE_CONFIGS['Western Line'];
  if (modeName === 'metro') return LINE_CONFIGS['Yellow Line'];
  if (modeName === 'bus') return LINE_CONFIGS['Bus'];
  if (modeName === 'road' || modeName === 'car' || modeName === 'auto') return LINE_CONFIGS['Road'];
  if (modeName === 'walk' || modeName === null) return LINE_CONFIGS['Walk'];

  return {
    name: lineName || modeName || 'Transit',
    mode: modeName || 'transit',
    color: '#0284c7',
    bgClass: 'bg-sky-950/60 text-sky-300 border-sky-800/50',
    badgeClass: 'bg-sky-700 text-slate-100 font-bold',
    accentBorder: 'border-l-sky-600',
    ticket: null,
    icon: Train,
  };
}

/**
 * Crowd-forecast styling per predicted level.
 */
export const CROWD_CONFIGS = {
  Comfortable: { label: 'Comfortable', color: '#2D8B6F', bgClass: 'bg-[#2D8B6F]/15 text-[#4bbd97] border-[#2D8B6F]/40', bars: 1 },
  Moderate: { label: 'Moderate', color: '#C9971F', bgClass: 'bg-[#C9971F]/15 text-[#e5b138] border-[#C9971F]/40', bars: 2 },
  Busy: { label: 'Busy', color: '#D9770B', bgClass: 'bg-[#D9770B]/15 text-[#f0912e] border-[#D9770B]/40', bars: 3 },
  Packed: { label: 'Packed', color: '#B33A44', bgClass: 'bg-[#B33A44]/15 text-[#d95561] border-[#B33A44]/40', bars: 4 },
};

export function getCrowdConfig(level) {
  return CROWD_CONFIGS[level] || CROWD_CONFIGS.Moderate;
}

/**
 * Helper to derive journey complexity summary
 */
export function getJourneyComplexity(legs = []) {
  if (!legs || legs.length === 0) return 'Direct';
  const totalLegs = legs.length;
  const rideLegs = legs.filter((l) => l.type === 'ride').length;
  const walkLegs = legs.filter((l) => l.type === 'walk').length;

  const transfers = Math.max(0, rideLegs - 1);

  if (transfers === 0) {
    return `${totalLegs} step${totalLegs > 1 ? 's' : ''} • Direct`;
  }
  return `${totalLegs} steps • ${transfers} transfer${transfers > 1 ? 's' : ''}`;
}
