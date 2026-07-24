/*
  SavedRoutes — lets the user bookmark an origin/destination pair and
  re-run it with one click. Stored in localStorage (fine for a real
  deployed app like this — the "no localStorage" rule only applies to
  Claude's sandboxed Artifacts preview, not a normal React app like this one).
*/

import { useState, useEffect } from "react";
import { Bookmark, BookmarkPlus, X } from "lucide-react";

const STORAGE_KEY = "transitflow_saved_routes";

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function persistSaved(routes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}

export default function SavedRoutes({ stations, origin, destination, onSelect }) {
  const [saved, setSaved] = useState([]);

  useEffect(() => {
    setSaved(loadSaved());
  }, []);

  const currentAlreadySaved = saved.some((r) => r.origin === origin && r.destination === destination);
  const canSaveCurrent = origin && destination && origin !== destination && stations[origin] && stations[destination];

  function saveCurrent() {
    if (!canSaveCurrent || currentAlreadySaved) return;
    const updated = [...saved, { origin, destination }];
    setSaved(updated);
    persistSaved(updated);
  }

  function remove(index, e) {
    e.stopPropagation();
    const updated = saved.filter((_, i) => i !== index);
    setSaved(updated);
    persistSaved(updated);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {saved.map((route, i) => {
        const originName = stations[route.origin]?.name || route.origin;
        const destName = stations[route.destination]?.name || route.destination;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(route.origin, route.destination)}
            className="group flex items-center gap-1.5 text-[11px] font-mono bg-paper/8 hover:bg-paper/15 text-paper/70 hover:text-paper px-2.5 py-1 rounded-full transition-colors"
          >
            <Bookmark size={10} />
            {originName} → {destName}
            <X
              size={11}
              onClick={(e) => remove(i, e)}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
            />
          </button>
        );
      })}

      {canSaveCurrent && !currentAlreadySaved && (
        <button
          type="button"
          onClick={saveCurrent}
          className="flex items-center gap-1.5 text-[11px] font-mono text-amber/80 hover:text-amber px-2.5 py-1 rounded-full border border-amber/30 hover:border-amber/60 transition-colors"
        >
          <BookmarkPlus size={11} />
          Save this route
        </button>
      )}
    </div>
  );
}
