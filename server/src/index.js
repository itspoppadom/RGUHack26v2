import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*"
  })
);
app.use(express.json());

const sessions = new Map();
const leaderboard = [];

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

  if (mode === "efficiency") {
    return Math.round(
      Math.max(payload.totalDistanceMeters, 0) +
        Math.max(payload.moveCount, 0) * movePenalty +
        Math.max(payload.clickCount, 0) * clickPenalty
    );
  }

  return Math.round(
    Math.max(elapsedSeconds, 0) +
      Math.max(payload.moveCount, 0) * movePenalty +
      Math.max(payload.clickCount, 0) * clickPenalty
  );
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/sessions/start", (req, res) => {
  const { startLocation, goalLocation, mode, winRadiusMeters } = req.body ?? {};

  if (!startLocation || !goalLocation) {
    res.status(400).json({ error: "startLocation and goalLocation are required." });
    return;
  }

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    sessionId,
    startLocation,
    goalLocation,
    mode: mode || "speed-run",
    winRadiusMeters:
      Number(winRadiusMeters) || Number(process.env.DEFAULT_WIN_RADIUS_METERS || 15),
    startedAt: Date.now(),
    completed: false
  });

  res.status(201).json({ sessionId });
});

app.post("/api/sessions/:sessionId/complete", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }

  if (session.completed) {
    res.status(409).json({ error: "Session already completed." });
    return;
  }

  const { currentPosition, elapsedMs, moveCount, clickCount, totalDistanceMeters } = req.body ?? {};
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
    totalDistanceMeters: Number(totalDistanceMeters || 0)
  };

  const score = computeScore(payload, session.mode);

  session.completed = true;
  session.completedAt = Date.now();

  leaderboard.push({
    sessionId: session.sessionId,
    mode: session.mode,
    elapsedMs: payload.elapsedMs,
    moveCount: payload.moveCount,
    clickCount: payload.clickCount,
    totalDistanceMeters: payload.totalDistanceMeters,
    score,
    createdAt: Date.now()
  });

  leaderboard.sort((a, b) => a.score - b.score || a.elapsedMs - b.elapsedMs);
  if (leaderboard.length > 100) {
    leaderboard.length = 100;
  }

  res.json({
    win: true,
    score,
    distanceToGoalMeters: Math.round(distanceToGoalMeters)
  });
});

app.get("/api/leaderboard", (req, res) => {
  const mode = req.query.mode;
  const rows = mode
    ? leaderboard.filter((entry) => entry.mode === mode)
    : leaderboard;

  res.json(rows.slice(0, 10));
});

app.listen(port, () => {
  console.log(`Street View Challenge backend listening on http://localhost:${port}`);
});
