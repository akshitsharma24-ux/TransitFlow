# frontend_new

An alternative "indicator board" interface for TransitFlow, built against the same backend API. It was explored as a second design candidate and is kept for reference.

It is not the interface deployed by `vercel.json` (that is `../frontend`) and it has not been tested as thoroughly as the main one.

```bash
npm install
npm run dev
```

It expects the API at `http://127.0.0.1:8000/api` unless `VITE_API_URL` is set.
