/*
  StationAutocomplete — replaces the native <datalist> input.
  Native datalists can't show extra info per option (like "which line"),
  so this is a small controlled dropdown: typing filters by name, each
  result shows a colored tag for its line(s), and picking one stores the
  station ID in the parent while displaying the friendly name here.
*/

import { useState, useRef, useEffect } from "react";
import { MapPin } from "lucide-react";

const LINE_TAG_STYLES = {
  "Western Line": "bg-signal/15 text-signal",
  "Yellow Line": "bg-gold/15 text-gold",
  "Red Line": "bg-scarlet/15 text-scarlet",
  "Aqua Line": "bg-monsoon/15 text-monsoon",
};

function tagsFor(station) {
  if (!station?.serves) return [];
  const seen = new Set();
  const tags = [];
  for (const s of station.serves) {
    const label = s.line ? s.line : s.mode === "bus" ? "Bus" : s.mode === "road" ? "Road" : s.mode;
    if (!seen.has(label)) {
      seen.add(label);
      tags.push(label);
    }
  }
  return tags;
}

export default function StationAutocomplete({ stations, value, onChange, placeholder }) {
  const [query, setQuery] = useState(stations[value]?.name || "");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Keep the displayed text in sync if the parent changes `value` externally
  // (e.g. the "Use my location" button setting origin programmatically)
  useEffect(() => {
    setQuery(stations[value]?.name || "");
  }, [value, stations]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        // Snap back to the last valid selection's name if they typed junk and clicked away
        setQuery(stations[value]?.name || "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, stations]);

  const matches = query.trim()
    ? Object.entries(stations)
        .filter(([, s]) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : Object.entries(stations).slice(0, 8);

  function select(id) {
    onChange(id);
    setQuery(stations[id].name);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="board-input"
        autoComplete="off"
      />

      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-ink border border-paper/15 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {matches.map(([id, station]) => (
            <button
              type="button"
              key={id}
              onClick={() => select(id)}
              className="w-full text-left px-3 py-2 hover:bg-paper/10 flex items-center justify-between gap-2 transition-colors"
            >
              <span className="flex items-center gap-2 text-paper text-[13px] font-mono">
                <MapPin size={12} className="text-paper/40 shrink-0" />
                {station.name}
              </span>
              <span className="flex gap-1 shrink-0">
                {tagsFor(station).map((tag) => (
                  <span
                    key={tag}
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${LINE_TAG_STYLES[tag] || "bg-paper/10 text-paper/60"}`}
                  >
                    {tag}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
