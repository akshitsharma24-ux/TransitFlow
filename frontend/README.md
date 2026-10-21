# TransitFlow frontend

The React single-page app for TransitFlow. This is the interface that `vercel.json` builds and deploys.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run lint
```

By default it calls the API at `http://127.0.0.1:8000/api`. Set `VITE_API_URL` (for example in `.env.local`) to use a different backend.

## Source layout

```
src/
  App.jsx                    all page state, URL parameters, Ctrl+K, geolocation
  api.js                     fetchStations, fetchNetwork, calculateRoute
  components/
    HeroCanvasAnimation.jsx  scroll-scrubbed frame sequence behind the search board
    SearchBoard.jsx          origin and destination, priority, hour, day type, rain
    StationAutocomplete.jsx  typeahead with line tags
    SavedRoutes.jsx          saved commutes and recent searches
    BentoResultsGrid.jsx     comparison chart, route cards, map, timeline, crowd chart
    RouteComparisonChart.jsx time, fare and comfort bars
    MapPanel.jsx             MapLibre map for the selected route
    NetworkMap.jsx           all five lines with per-line toggles
    JourneyTimeline.jsx      board, ride, transfer, arrive steps
    BestTimeToTravel.jsx     24-hour crowd chart
    CommandPalette.jsx       Ctrl+K quick actions
    StatusStates.jsx         loading, empty and error states
  hooks/useLenis.js          smooth scrolling (respects reduced motion)
  utils/lineColors.js        line colours, crowd levels, ticket links
  utils/haversine.js         nearest station for the Near Me button
public/ezgif-jpg/            the 270 hero frames
```

## Things worth knowing

- `vite.config.js` excludes `maplibre-gl` from dependency pre-bundling. Without that, Vite rewrites the MapLibre worker URL, the worker 404s and the map stays on "Loading".
- The hero backdrop is `fixed` with `z-0`. Anything in the results area that is not positioned has to sit in a `relative z-10` container or it is painted underneath it.
- `src/components/RouteCard.jsx` is not imported anywhere.
