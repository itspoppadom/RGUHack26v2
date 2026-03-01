# Street View Challenge (Starter Project)

Full-stack starter for a Street View navigation game.

## Stack

- Frontend: Vanilla JS + Google Maps JavaScript API (Street View + Geometry library)
- Backend: Node.js + Express (session tracking, basic anti-cheat validation, leaderboard)

## Prerequisites

- Node.js 20+ and npm
- A Google Cloud project with billing enabled
- Maps JavaScript API enabled
- Google Maps API key

## 1) Configure API access

Street View docs: https://developers.google.com/maps/documentation/javascript/streetview

1. Enable **Maps JavaScript API** in Google Cloud
2. Enable billing
3. Create an API key
4. Restrict the key to your web origins where possible

## 2) Configure environment

### Frontend

Copy `client/config.example.js` to `client/config.js` and set your key:

- `GOOGLE_MAPS_API_KEY`
- Optional `API_BASE_URL` (defaults to `http://localhost:3001`)

### Backend

Copy `server/.env.example` to `server/.env` and adjust values if needed.

## 3) Install dependencies

```bash
cd server
npm install
```

## 4) Run

### Backend (port 3001)

```bash
cd server
npm run dev
```

### Frontend (static files)

From project root:

```bash
python3 -m http.server 5173 -d client
```

Open: `http://localhost:5173`

## Gameplay behavior implemented

- Embed Street View at start location
- Distance-to-goal tracking using Geometry library
- Move + click counters
- Timer and score calculation
- Win condition by radius (`WIN_RADIUS_METERS`)
- Basic lock-down controls (address hidden, no close button, no pan control)
- Session start/complete reporting to backend
- Leaderboard by game mode

## Modes

- `speed-run`: fastest time favored
- `efficiency`: shortest movement favored
- `blind`: same rules as speed, no directional hints

## Legal / Terms note

Follow Google Maps Platform Terms: https://cloud.google.com/maps-platform/terms

- Do not cache Street View imagery
- Do not scrape imagery
- Keep attribution visible

## Optional next improvements

- Daily seeded routes
- Checkpoints / mandatory waypoints
- Better anti-cheat via event history + server-side heuristics
- PostgreSQL persistence instead of in-memory storage