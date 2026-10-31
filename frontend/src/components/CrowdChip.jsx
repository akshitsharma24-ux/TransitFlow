import { Users } from 'lucide-react';
import { getCrowdConfig } from '../utils/lineColors';

/** Crowd level as a pill with a four-bar meter; optionally the 0-100 index. */
export default function CrowdChip({ level, index, size = 'md', title }) {
  const conf = getCrowdConfig(level);
  const small = size === 'sm';
  return (
    <span
      title={title || `${conf.label} crowd (model estimate)`}
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono whitespace-nowrap ${conf.bgClass} ${
        small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-0.5'
      }`}
    >
      <Users className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      <span>{conf.label}</span>
      {index != null && <span className="opacity-70">{index}</span>}
      <span className="flex items-end gap-[1.5px] h-2.5">
        {[1, 2, 3, 4].map((b) => (
          <span
            key={b}
            className="w-[3px] rounded-sm"
            style={{
              height: `${b * 25}%`,
              backgroundColor: b <= conf.bars ? conf.color : 'currentColor',
              opacity: b <= conf.bars ? 1 : 0.25,
            }}
          />
        ))}
      </span>
    </span>
  );
}

/** A thin bar showing the 0-100 crowd index in the level's colour. */
export function CrowdBar({ level, index }) {
  const conf = getCrowdConfig(level);
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden" role="presentation">
      <div className="h-full rounded-full" style={{ width: `${Math.max(4, index)}%`, backgroundColor: conf.color }} />
    </div>
  );
}
