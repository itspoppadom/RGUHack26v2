import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import pg from "pg";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);

const configuredOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultLocalOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://0.0.0.0:5173"
];

const allowedOrigins = new Set(
  configuredOrigins.length ? configuredOrigins : defaultLocalOrigins
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json());

const sessions = new Map();
const leaderboard = [];
const { Pool } = pg;
let pool = null;
let postgresReady = false;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
}

async function initializeDatabase() {
  if (!pool) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      mode TEXT NOT NULL,
      start_lat DOUBLE PRECISION NOT NULL,
      start_lng DOUBLE PRECISION NOT NULL,
      goal_lat DOUBLE PRECISION NOT NULL,
      goal_lng DOUBLE PRECISION NOT NULL,
      win_radius_meters DOUBLE PRECISION NOT NULL,
      started_at BIGINT NOT NULL,
      completed_at BIGINT,
      elapsed_ms INTEGER,
      move_count INTEGER,
      click_count INTEGER,
      total_distance_meters DOUBLE PRECISION,
      score INTEGER,
      discovered_points INTEGER,
      fog_trail JSONB
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS sessions_mode_score_idx
    ON sessions (mode, score, elapsed_ms)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS sessions_username_completed_idx
    ON sessions (username, completed_at DESC)
  `);

  postgresReady = true;
  console.log("PostgreSQL storage enabled");
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function computeScore(payload, mode) {
  const elapsedSeconds = Math.floor(payload.elapsedMs / 1000);
  const movePenalty = 4;
  const clickPenalty = 2;
  const qteScoreReduction = Math.max(0, Number(payload.qteScoreReduction || 0));

  if (mode === "efficiency") {
    return Math.max(0, Math.round(
      Math.max(payload.totalDistanceMeters, 0) +
        Math.max(payload.moveCount, 0) * movePenalty +
        Math.max(payload.clickCount, 0) * clickPenalty -
        qteScoreReduction
    ));
  }

  return Math.max(0, Math.round(
    Math.max(elapsedSeconds, 0) +
      Math.max(payload.moveCount, 0) * movePenalty +
      Math.max(payload.clickCount, 0) * clickPenalty -
      qteScoreReduction
  ));
}

function sanitizeUsername(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

function sanitizeFogTrail(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .slice(0, 1500)
    .map((point) => ({
      lat: Number(point?.lat),
      lng: Number(point?.lng)
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

async function persistSessionStart(session) {
  if (!postgresReady || !pool) {
    return;
  }

  await pool.query(
    `
      INSERT INTO sessions (
        session_id,
        username,
        mode,
        start_lat,
        start_lng,
        goal_lat,
        goal_lng,
        win_radius_meters,
        started_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `,
    [
      session.sessionId,
      session.username,
      session.mode,
      session.startLocation.lat,
      session.startLocation.lng,
      session.goalLocation.lat,
      session.goalLocation.lng,
      session.winRadiusMeters,
      session.startedAt
    ]
  );
}

async function persistSessionComplete(entry, sessionId) {
  if (!postgresReady || !pool) {
    return;
  }

  await pool.query(
    `
      UPDATE sessions
      SET
        completed_at = $2,
        elapsed_ms = $3,
        move_count = $4,
        click_count = $5,
        total_distance_meters = $6,
        score = $7,
        discovered_points = $8,
        fog_trail = $9
      WHERE session_id = $1
    `,
    [
      sessionId,
      entry.createdAt,
      entry.elapsedMs,
      entry.moveCount,
      entry.clickCount,
      entry.totalDistanceMeters,
      entry.score,
      entry.discoveredPoints,
      JSON.stringify(entry.fogTrail)
    ]
  );
}

async function getLeaderboardRows(mode) {
  if (postgresReady && pool) {
    if (mode) {
      const result = await pool.query(
        `
          SELECT
            username,
            mode,
            SUM(score)::int AS score,
            COUNT(*)::int AS "roundsPlayed",
            SUM(elapsed_ms)::int AS "totalElapsedMs",
            SUM(move_count)::int AS "totalMoveCount",
            SUM(click_count)::int AS "totalClickCount",
            MAX(completed_at)::bigint AS "createdAt"
          FROM sessions
          WHERE completed_at IS NOT NULL AND mode = $1
          GROUP BY username, mode
          ORDER BY score ASC, "totalElapsedMs" ASC
          LIMIT 10
        `,
        [mode]
      );
      return result.rows;
    }

    const result = await pool.query(`
      SELECT
        username,
        'all' AS mode,
        SUM(score)::int AS score,
        COUNT(*)::int AS "roundsPlayed",
        SUM(elapsed_ms)::int AS "totalElapsedMs",
        SUM(move_count)::int AS "totalMoveCount",
        SUM(click_count)::int AS "totalClickCount",
        MAX(completed_at)::bigint AS "createdAt"
      FROM sessions
      WHERE completed_at IS NOT NULL
      GROUP BY username
      ORDER BY score ASC, "totalElapsedMs" ASC
      LIMIT 10
    `);
    return result.rows;
  }

  const rows = mode
    ? leaderboard.filter((entry) => entry.mode === mode)
    : leaderboard;

  const combinedByUser = new Map();
  rows.forEach((entry) => {
    const key = entry.username || "anon";
    const current = combinedByUser.get(key) || {
      username: key,
      mode: mode || "all",
      score: 0,
      roundsPlayed: 0,
      totalElapsedMs: 0,
      totalMoveCount: 0,
      totalClickCount: 0,
      createdAt: 0
    };

    current.score += Number(entry.score || 0);
    current.roundsPlayed += 1;
    current.totalElapsedMs += Number(entry.elapsedMs || 0);
    current.totalMoveCount += Number(entry.moveCount || 0);
    current.totalClickCount += Number(entry.clickCount || 0);
    current.createdAt = Math.max(current.createdAt, Number(entry.createdAt || 0));
    combinedByUser.set(key, current);
  });

  return [...combinedByUser.values()]
    .sort((a, b) => a.score - b.score || a.totalElapsedMs - b.totalElapsedMs)
    .slice(0, 10);
}

async function getUserProfile(username) {
  if (postgresReady && pool) {
    const latestResult = await pool.query(
      `
        SELECT
          session_id AS "sessionId",
          username,
          mode,
          elapsed_ms AS "elapsedMs",
          move_count AS "moveCount",
          click_count AS "clickCount",
          total_distance_meters AS "totalDistanceMeters",
          score,
          discovered_points AS "discoveredPoints",
          fog_trail AS "fogTrail",
          completed_at AS "createdAt"
        FROM sessions
        WHERE username = $1 AND completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 1
      `,
      [username]
    );

    const bestResult = await pool.query(
      `
        SELECT MIN(score) AS best_score
        FROM sessions
        WHERE username = $1 AND completed_at IS NOT NULL
      `,
      [username]
    );

    const latest = latestResult.rows[0] || null;
    return {
      username,
      bestScore: bestResult.rows[0]?.best_score ? Number(bestResult.rows[0].best_score) : null,
      latestSession: latest
    };
  }

  const entries = leaderboard.filter((entry) => entry.username === username);
  const latest = entries[0] || null;
  const bestScore = entries.length
    ? entries.reduce((best, item) => Math.min(best, item.score), entries[0].score)
    : null;

  return {
    username,
    bestScore,
    latestSession: latest
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/sessions/start", async (req, res) => {
  const { username, startLocation, goalLocation, mode, winRadiusMeters } = req.body ?? {};
  const safeUsername = sanitizeUsername(username);

  if (!safeUsername) {
    res.status(400).json({ error: "username is required." });
    return;
  }

  if (!startLocation || !goalLocation) {
    res.status(400).json({ error: "startLocation and goalLocation are required." });
    return;
  }

  const sessionId = crypto.randomUUID();
  const session = {
    sessionId,
    username: safeUsername,
    startLocation,
    goalLocation,
    mode: mode || "speed-run",
    winRadiusMeters:
      Number(winRadiusMeters) || Number(process.env.DEFAULT_WIN_RADIUS_METERS || 15),
    startedAt: Date.now(),
    completed: false
  };

  sessions.set(sessionId, session);

  try {
    await persistSessionStart(session);
  } catch (error) {
    console.error("Failed to persist session start:", error.message);
  }

  res.status(201).json({ sessionId });
});

app.post("/api/sessions/:sessionId/complete", async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }

  if (session.completed) {
    res.status(409).json({ error: "Session already completed." });
    return;
  }

  const {
    currentPosition,
    elapsedMs,
    moveCount,
    clickCount,
    totalDistanceMeters,
    fogTrail,
    discoveredPoints,
    qteScoreReduction
  } = req.body ?? {};
  if (!currentPosition || typeof elapsedMs !== "number") {
    res.status(400).json({ error: "currentPosition and elapsedMs are required." });
    return;
  }

  const serverElapsedMs = Date.now() - session.startedAt;
  if (elapsedMs < 0 || elapsedMs > serverElapsedMs + 15000) {
    res.status(400).json({ error: "Invalid elapsed time." });
    return;
  }

  const distanceToGoalMeters = haversineMeters(currentPosition, session.goalLocation);
  const win = distanceToGoalMeters <= session.winRadiusMeters;
  if (!win) {
    res.status(400).json({ error: "Goal not reached within win radius." });
    return;
  }

  const payload = {
    elapsedMs,
    moveCount: Number(moveCount || 0),
    clickCount: Number(clickCount || 0),
    totalDistanceMeters: Number(totalDistanceMeters || 0),
    qteScoreReduction: Number(qteScoreReduction || 0)
  };
  const safeFogTrail = sanitizeFogTrail(fogTrail);
  const safeDiscoveredPoints = Number(discoveredPoints || safeFogTrail.length || 0);

  const score = computeScore(payload, session.mode);

  session.completed = true;
  session.completedAt = Date.now();

  const entry = {
    sessionId: session.sessionId,
    username: session.username,
    mode: session.mode,
    elapsedMs: payload.elapsedMs,
    moveCount: payload.moveCount,
    clickCount: payload.clickCount,
    totalDistanceMeters: payload.totalDistanceMeters,
    score,
    discoveredPoints: Math.max(0, safeDiscoveredPoints),
    fogTrail: safeFogTrail,
    createdAt: Date.now()
  };

  leaderboard.push(entry);

  leaderboard.sort((a, b) => a.score - b.score || a.elapsedMs - b.elapsedMs);
  if (leaderboard.length > 100) {
    leaderboard.length = 100;
  }

  try {
    await persistSessionComplete(entry, session.sessionId);
  } catch (error) {
    console.error("Failed to persist session completion:", error.message);
  }

  res.json({
    win: true,
    score,
    distanceToGoalMeters: Math.round(distanceToGoalMeters),
    discoveredPoints: entry.discoveredPoints
  });
});

app.get("/api/leaderboard", async (req, res) => {
  const mode = req.query.mode;

  try {
    const rows = await getLeaderboardRows(mode);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Unable to load leaderboard." });
  }
});

app.get("/api/users/:username/profile", async (req, res) => {
  const username = sanitizeUsername(req.params.username);
  if (!username) {
    res.status(400).json({ error: "Invalid username." });
    return;
  }

  try {
    const profile = await getUserProfile(username);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Unable to load user profile." });
  }
});

initializeDatabase()
  .catch((error) => {
    console.warn("PostgreSQL init failed; falling back to in-memory storage:", error.message);
    postgresReady = false;
  })
  .finally(() => {
    app.listen(port, () => {
      console.log(`Street View Challenge backend listening on http://localhost:${port}`);
    });
  });
