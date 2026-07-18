# WORLDMINTOR — Military & Political Intelligence Dashboard

Real-time military and political intelligence dashboard inspired by [World Monitor](https://github.com/koala73/worldmonitor).

## Features

- **High-Speed Ingestion**: Continuous 30-second polling cycle across all sources with intelligent caching
- **Smart Deduplication**: Jaccard similarity algorithm merges articles >45% similar, showing one card with all source links
- **Live TV (HLS)**: 11 news channels streamed via HLS.js — Al Jazeera, France 24, DW, TRT World, CGTN, NHK, Sky News Arabia, RT
- **5 News Sources**: GDELT (free), NewsData.io (optional), GNews.io (optional), RSS feeds (10 feeds), ACLED conflict data
- **Bilingual**: Arabic RTL + English
- **Interactive Map**: Dark Leaflet map with severity-coded markers
- **Filtering**: By category (Military/Political/Conflicts) and region

## Deploy to Vercel

1. Push to GitHub
2. Import in [vercel.com](https://vercel.com)
3. Framework preset: **Vite**
4. Optionally add `VITE_NEWSDATA_API_KEY` and `VITE_GNEWS_API_KEY` as env vars
5. Deploy

No build config needed — `vercel.json` handles SPA routing.

## Local Dev

```bash
npm install
npm run dev
```

## News Sources

| Source | Cost | Key Required | Coverage |
|--------|------|-------------|----------|
| GDELT | Free | No | Global real-time news |
| RSS (10 feeds) | Free | No | Reuters, BBC, NYT, Al Jazeera, DoD, etc. |
| ACLED | Free | No | Global conflict events with coordinates |
| NewsData.io | Free (200/day) | Optional | 70+ countries |
| GNews.io | Free (100/day) | Optional | Global |

## License

Inspired by [World Monitor](https://github.com/koala73/worldmonitor) (AGPL-3.0).
