# Escape Fae Deen game (RGUHack 26 Project by SOCET Redemption)


A Point and Click escape game which utilizes the Google Street View API, to drop you in the city of Aberdeen. 
Many locals admit, that sometimes navigating the city of Aberdeen, can lead to strange social interactions. 
Some may be attacked by a seagull in pursuit of its dinner, while others may bump into someone dodgy trying to score a couple quid.
These types of interactions have inspired some of the mechanics in this game. 

3 Rounds 
Simple Goal – Reach a form of escape from Aberdeen which is set as your finish line 
Navigate through tricky interactions in City Centre 
Reach your goal with lowest number of moves, and lowest score. 
Compete against the leaderboard to be the best! 


[Demo](https://youtu.be/oD-TQe0ldrY)

## Stack

- **Frontend**: Vanilla JS + Google Maps JavaScript API (Street View, Geometry Library)
  - Interactive Street View navigation with click-to-move mechanics
  - Real-time distance tracking and scoring system
  - Fog-of-war discovery map with persistent trail tracking
  - Dynamic encounter system with decision-based consequences
  - Quick-time event (QTE) mechanics for interactive challenges
  - Responsive UI with leaderboard and player stats

- **Backend**: Node.js + Express (port 3001)
  - Session management and game state persistence
  - Anti-cheat validation and event tracking
  - Leaderboard ranking by game mode
  - User profile and score history endpoints
  - Runs database migration and initialization on startup

- **Database**: Optional PostgreSQL (falls back to in-memory if `DATABASE_URL` is not set)
  - Session records with scoring data
  - User profiles and historical runs
  - Fog trail geometry for discovery visualization

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

Optional PostgreSQL:

- Set `DATABASE_URL` in `server/.env`
- Set `PG_SSL=true` if your provider requires TLS

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

- Landing page with username entry
- Embed Street View at start location
- Distance-to-goal tracking using Geometry library
- Move + click counters
- Timer and score calculation
- Win condition by radius (`WIN_RADIUS_METERS`)
- Basic lock-down controls (address hidden, no close button, no pan control)
- Session start/complete reporting to backend
- Leaderboard by game mode
- User score history endpoint (`/api/users/:username/profile`)
- Fog-of-war discovery tracking and persistence per session


## Legal / Terms note

Follow Google Maps Platform Terms: https://cloud.google.com/maps-platform/terms

- Do not cache Street View imagery
- Do not scrape imagery
- Keep attribution visible

## Optional next improvements

- Daily seeded routes
- Checkpoints / mandatory waypoints
- Better anti-cheat via event history + server-side heuristics
- Render full discovered-area replay from stored fog trail geometry