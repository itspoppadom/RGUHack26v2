const config = window.GAME_CONFIG;

const elements = {
  splash: document.getElementById("splash"),
  splashImage: document.getElementById("splashImage"),
  splashTitle: document.getElementById("splashTitle"),
  splashSubtitle: document.getElementById("splashSubtitle"),
  splashContinue: document.getElementById("splashContinue"),
  landing: document.getElementById("landing"),
  usernameInput: document.getElementById("usernameInput"),
  startGameBtn: document.getElementById("startGameBtn"),
  landingStatus: document.getElementById("landingStatus"),
  playerSummary: document.getElementById("playerSummary"),
  summaryScore: document.getElementById("summaryScore"),
  summaryMode: document.getElementById("summaryMode"),
  summaryDiscover: document.getElementById("summaryDiscover"),
  playerName: document.getElementById("playerName"),
  levelValue: document.getElementById("levelValue"),
  roundFlash: document.getElementById("roundFlash"),
  flashTitle: document.getElementById("flashTitle"),
  flashLevel: document.getElementById("flashLevel"),
  flashScore: document.getElementById("flashScore"),
  flashTime: document.getElementById("flashTime"),
  flashMoves: document.getElementById("flashMoves"),
  flashDiscover: document.getElementById("flashDiscover"),
  flashContinue: document.getElementById("flashContinue"),
  qteOverlay: document.getElementById("qteOverlay"),
  qteTitle: document.getElementById("qteTitle"),
  qteMessage: document.getElementById("qteMessage"),
  qteCountdown: document.getElementById("qteCountdown"),
  qteProgress: document.getElementById("qteProgress"),
  qteClose: document.getElementById("qteClose"),
  distance: document.getElementById("distance"),
  timer: document.getElementById("timer"),
  moves: document.getElementById("moves"),
  clicks: document.getElementById("clicks"),
  score: document.getElementById("score"),
  discovered: document.getElementById("discovered"),
  status: document.getElementById("status"),
  mode: document.getElementById("mode"),
  restartBtn: document.getElementById("restartBtn"),
  hud: document.getElementById("hud"),
  leaderboardPanel: document.getElementById("leaderboardPanel"),
  leaderboard: document.getElementById("leaderboard"),
  pano: document.getElementById("pano"),
  fogPanel: document.getElementById("fogPanel"),
  fogToggle: document.getElementById("fogToggle"),
  fogBody: document.getElementById("fogBody"),
  fogMap: document.getElementById("fogMap"),
  fogCanvas: document.getElementById("fogCanvas")
};

const state = {
  panorama: null,
  goal: null,
  sessionId: null,
  currentRunId: "",
  username: "",
  gameInitialized: false,
  levels: [],
  currentLevelIndex: 0,
  startedAt: 0,
  timerTick: null,
  moveCount: 0,
  clickCount: 0,
  totalDistanceMeters: 0,
  distanceToGoalMeters: Number.POSITIVE_INFINITY,
  score: 0,
  lastPosition: null,
  won: false,
  miniMap: null,
  startMarker: null,
  finishMarker: null,
  playerMarker: null,
  fogCtx: null,
  fogExpanded: false,
  visitedPositions: [],
  roundFlashTimer: null,
  roundPreviewTimer: null,
  roundPreviewTick: null,
  previewRunId: 0,
  qteTriggered: false,
  qteActive: false,
  qtePressCount: 0,
  qteScoreReduction: 0,
  qteTimer: null,
  qteCountdownTick: null,
  qteDeadlineMs: 0
};

const FOG_ZOOM_LEVEL = 17;
const FOG_ALPHA = 0.85;
const FOG_REVEAL_RADIUS_PX = 32;
const MAX_VISITED_POINTS = 2500;
const MAX_FOG_PAYLOAD_POINTS = 1200;
const DEFAULT_QTE_CONFIG = {
  interceptLocation: { lat: 57.14696712569186, lng: -2.097676156362164 },
  triggerRadiusMeters: 5,
  requiredPresses: 18,
  durationMs: 7000,
  scoreReduction: 20,
  successTitle: "Dominance asserted",
  successMessage: "You T-posed hard. The seagull dropped your chips and flew off. Score reduced.",
  introTitle: "Seagull Alert!",
  introMessage:
    "The Carry-on at St Nics has distracted you, and a seagull is trying to steal your chips! Press <T>, to T pose to assert dominance",
  failTitle: "Seagull wins this round",
  failMessage: "Too slow. The seagull nicked your chips and escaped."
};

const DEFAULT_SPLASH_CONFIG = {
  enabled: true,
  imageUrl: "",
  title: "Street View Challenge",
  subtitle: "Press continue to begin",
  continueLabel: "Continue"
};

function getSplashConfig() {
  const source = config.SPLASH || {};
  return {
    enabled: source.enabled !== false,
    imageUrl: source.imageUrl || DEFAULT_SPLASH_CONFIG.imageUrl,
    title: source.title || DEFAULT_SPLASH_CONFIG.title,
    subtitle: source.subtitle || DEFAULT_SPLASH_CONFIG.subtitle,
    continueLabel: source.continueLabel || DEFAULT_SPLASH_CONFIG.continueLabel
  };
}

function setLandingVisible(visible) {
  elements.landing.classList.toggle("hidden", !visible);
}

function showSplash() {
  setGameVisible(false);
  setLandingVisible(false);
  elements.splash.classList.remove("hidden");
}

function hideSplashShowLanding() {
  elements.splash.classList.add("hidden");
  setGameVisible(false);
  setLandingVisible(true);
  elements.usernameInput.focus();
}

function initializeSplash() {
  const splash = getSplashConfig();
  elements.splashTitle.textContent = splash.title;
  elements.splashSubtitle.textContent = splash.subtitle;
  elements.splashContinue.textContent = splash.continueLabel;

  if (splash.imageUrl) {
    elements.splashImage.src = splash.imageUrl;
    elements.splashImage.classList.remove("hidden");
  } else {
    elements.splashImage.removeAttribute("src");
    elements.splashImage.classList.add("hidden");
  }

  if (splash.enabled) {
    showSplash();
  } else {
    hideSplashShowLanding();
  }
}

function getQteConfig() {
  const source = config.QTE || {};
  const location = source.interceptLocation || source.location || DEFAULT_QTE_CONFIG.interceptLocation;

  return {
    interceptLocation: {
      lat: Number.isFinite(location?.lat) ? location.lat : DEFAULT_QTE_CONFIG.interceptLocation.lat,
      lng: Number.isFinite(location?.lng) ? location.lng : DEFAULT_QTE_CONFIG.interceptLocation.lng
    },
    triggerRadiusMeters: Number.isFinite(source.triggerRadiusMeters)
      ? source.triggerRadiusMeters
      : DEFAULT_QTE_CONFIG.triggerRadiusMeters,
    requiredPresses: Number.isFinite(source.requiredPresses)
      ? Math.max(1, Math.floor(source.requiredPresses))
      : DEFAULT_QTE_CONFIG.requiredPresses,
    durationMs: Number.isFinite(source.durationMs)
      ? Math.max(500, Math.floor(source.durationMs))
      : DEFAULT_QTE_CONFIG.durationMs,
    scoreReduction: Number.isFinite(source.scoreReduction)
      ? Math.max(0, Math.floor(source.scoreReduction))
      : DEFAULT_QTE_CONFIG.scoreReduction,
    successTitle: source.successTitle || DEFAULT_QTE_CONFIG.successTitle,
    successMessage: source.successMessage || DEFAULT_QTE_CONFIG.successMessage,
    introTitle: source.introTitle || DEFAULT_QTE_CONFIG.introTitle,
    introMessage: source.introMessage || DEFAULT_QTE_CONFIG.introMessage,
    failTitle: source.failTitle || DEFAULT_QTE_CONFIG.failTitle,
    failMessage: source.failMessage || DEFAULT_QTE_CONFIG.failMessage
  };
}

function assertConfig() {
  if (!config || !config.GOOGLE_MAPS_API_KEY) {
    throw new Error("Missing window.GAME_CONFIG or GOOGLE_MAPS_API_KEY.");
  }
  if (config.GOOGLE_MAPS_API_KEY === "REPLACE_ME") {
    elements.status.textContent = "Set client/config.js with your Google API key.";
  }
}

function normalizeLevels() {
  const levels = Array.isArray(config.LEVELS) && config.LEVELS.length
    ? config.LEVELS
    : [{
        name: "Level 1",
        start: config.START_LOCATION,
        goal: config.GOAL_LOCATION
      }];

  const validLevels = levels.filter((level) => {
    const hasStart = level?.start && Number.isFinite(level.start.lat) && Number.isFinite(level.start.lng);
    const hasGoal = level?.goal && Number.isFinite(level.goal.lat) && Number.isFinite(level.goal.lng);
    return hasStart && hasGoal;
  });

  if (!validLevels.length) {
    throw new Error("No valid levels configured.");
  }

  state.levels = validLevels.map((level, index) => ({
    name: level.name || `Level ${index + 1}`,
    start: level.start,
    goal: level.goal
  }));
}

function getCurrentLevel() {
  return state.levels[state.currentLevelIndex] || state.levels[0];
}

function renderLevelMeta() {
  const total = state.levels.length || 1;
  const current = Math.min(state.currentLevelIndex + 1, total);
  elements.levelValue.textContent = `${current} / ${total}`;
}

function setGameVisible(visible) {
  elements.hud.classList.toggle("hidden", !visible);
  elements.leaderboardPanel.classList.toggle("hidden", !visible);
  elements.fogPanel.classList.toggle("hidden", !visible);
  elements.pano.classList.toggle("hidden", !visible);
  elements.landing.classList.toggle("hidden", visible);
}

function sanitizeUsername(rawValue) {
  return rawValue.trim().replace(/\s+/g, " ").slice(0, 24);
}

function generateRunId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `run-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function setLandingStatus(message) {
  elements.landingStatus.textContent = message;
}

function clearRoundPreviewTimers() {
  state.previewRunId += 1;
  if (state.roundPreviewTimer) {
    clearTimeout(state.roundPreviewTimer);
    state.roundPreviewTimer = null;
  }
  if (state.roundPreviewTick) {
    clearInterval(state.roundPreviewTick);
    state.roundPreviewTick = null;
  }
}

function previewWait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function waitForMapIdleOrTimeout(map, timeoutMs = 2000) {
  return new Promise((resolve) => {
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      resolve();
    };

    const listener = map.addListener("idle", () => {
      listener.remove();
      finish();
    });

    setTimeout(() => {
      listener.remove();
      finish();
    }, timeoutMs);
  });
}

async function animateMarkerAttention(marker, basePosition, durationMs, runId) {
  if (!marker || !basePosition || runId !== state.previewRunId) {
    return;
  }

  marker.setAnimation(google.maps.Animation.BOUNCE);
  const startedAt = Date.now();

  while (Date.now() - startedAt < durationMs && runId === state.previewRunId) {
    const elapsed = Date.now() - startedAt;
    const oscillation = Math.sin(elapsed / 90) * 2.3;
    const heading = oscillation >= 0 ? 90 : 270;
    const offset = google.maps.geometry.spherical.computeOffset(
      basePosition,
      Math.abs(oscillation),
      heading
    );
    marker.setPosition(offset);
    await previewWait(100);
  }

  marker.setAnimation(null);
  marker.setPosition(basePosition);
}

function clearRoundMarkers() {
  if (state.startMarker) {
    state.startMarker.setMap(null);
    state.startMarker = null;
  }
  if (state.finishMarker) {
    state.finishMarker.setMap(null);
    state.finishMarker = null;
  }
  if (state.playerMarker) {
    state.playerMarker.setMap(null);
    state.playerMarker = null;
  }
}

function showRoundMapPreview(durationMs = 10000) {
  clearRoundPreviewTimers();
  const runId = ++state.previewRunId;
  let remainingSeconds = Math.ceil(durationMs / 1000);
  const level = getCurrentLevel();
  const startLatLng = new google.maps.LatLng(level.start.lat, level.start.lng);
  const finishLatLng = new google.maps.LatLng(level.goal.lat, level.goal.lng);
  const startAttentionMs = 3000;
  const panAndCenterMs = 2200;
  const finishAttentionMs = 3000;
  const remainingHoldMs = Math.max(
    0,
    durationMs - startAttentionMs - panAndCenterMs - finishAttentionMs
  );

  elements.fogPanel.classList.add("map-preview");
  setFogExpanded(true);
  state.miniMap?.setCenter(startLatLng);
  elements.status.textContent = `Round briefing: ${remainingSeconds}s`;

  return new Promise((resolve) => {
    state.roundPreviewTick = setInterval(() => {
      if (runId !== state.previewRunId) {
        clearRoundPreviewTimers();
        return;
      }
      remainingSeconds = Math.max(0, remainingSeconds - 1);
      elements.status.textContent = `Round briefing: ${remainingSeconds}s`;
    }, 1000);

    state.roundPreviewTimer = setTimeout(() => {
      if (runId !== state.previewRunId) {
        return;
      }
      clearRoundPreviewTimers();
      elements.fogPanel.classList.remove("map-preview");
      setFogExpanded(false);
      resolve();
    }, durationMs);

    (async () => {
      await animateMarkerAttention(state.startMarker, startLatLng, startAttentionMs, runId);
      if (runId !== state.previewRunId || !state.miniMap) {
        return;
      }

      elements.status.textContent = `Round briefing: moving to finish...`;
      state.miniMap.panTo(finishLatLng);
      await waitForMapIdleOrTimeout(state.miniMap, panAndCenterMs);

      if (runId !== state.previewRunId) {
        return;
      }

      await animateMarkerAttention(state.finishMarker, finishLatLng, finishAttentionMs, runId);
      if (runId !== state.previewRunId) {
        return;
      }

      if (remainingHoldMs > 0) {
        await previewWait(remainingHoldMs);
      }
    })();
  });
}

function renderQteCountdown() {
  if (!state.qteActive || !state.qteDeadlineMs) {
    return;
  }

  const remainingMs = Math.max(0, state.qteDeadlineMs - Date.now());
  const remainingSeconds = (remainingMs / 1000).toFixed(1);
  elements.qteCountdown.textContent = `Time Left: ${remainingSeconds}s`;
}

function stopQteCountdownTick() {
  if (state.qteCountdownTick) {
    clearInterval(state.qteCountdownTick);
    state.qteCountdownTick = null;
  }
}

function startQteCountdownTick() {
  stopQteCountdownTick();
  renderQteCountdown();
  state.qteCountdownTick = setInterval(() => {
    renderQteCountdown();
  }, 100);
}

function hideQteOverlay() {
  if (state.qteTimer) {
    clearTimeout(state.qteTimer);
    state.qteTimer = null;
  }
  stopQteCountdownTick();
  state.qteDeadlineMs = 0;
  state.qteActive = false;
  elements.qteOverlay.classList.add("hidden");
  elements.qteClose.classList.add("hidden");
}

function showQteSuccess() {
  const qte = getQteConfig();
  elements.qteTitle.textContent = qte.successTitle;
  elements.qteMessage.textContent = qte.successMessage;
  elements.qteProgress.textContent = `Score reduction applied: -${qte.scoreReduction}`;
  elements.qteClose.classList.remove("hidden");
}

function completeQteSuccess() {
  if (!state.qteActive) {
    return;
  }

  const qte = getQteConfig();
  state.qteActive = false;
  stopQteCountdownTick();
  state.qteScoreReduction += qte.scoreReduction;
  renderStats();
  showQteSuccess();
}

function startQte() {
  if (state.qteTriggered || state.qteActive || state.won) {
    return;
  }

  state.qteTriggered = true;
  state.qteActive = true;
  state.qtePressCount = 0;
  const qte = getQteConfig();
  elements.qteTitle.textContent = qte.introTitle;
  elements.qteMessage.textContent = qte.introMessage;
  state.qteDeadlineMs = Date.now() + qte.durationMs;
  startQteCountdownTick();
  elements.qteProgress.textContent = `T Presses: 0 / ${qte.requiredPresses}`;
  elements.qteClose.classList.add("hidden");
  elements.qteOverlay.classList.remove("hidden");

  state.qteTimer = setTimeout(() => {
    if (!state.qteActive) {
      return;
    }
    state.qteActive = false;
    stopQteCountdownTick();
    elements.qteCountdown.textContent = "Time Left: 0.0s";
    elements.qteTitle.textContent = qte.failTitle;
    elements.qteMessage.textContent = qte.failMessage;
    elements.qteProgress.textContent = "No score reduction awarded.";
    elements.qteClose.classList.remove("hidden");
  }, qte.durationMs);
}

function maybeTriggerQte(currentPosition) {
  if (state.qteTriggered || state.won) {
    return;
  }

  const qte = getQteConfig();

  const distance = google.maps.geometry.spherical.computeDistanceBetween(
    currentPosition,
    new google.maps.LatLng(qte.interceptLocation.lat, qte.interceptLocation.lng)
  );

  if (distance <= qte.triggerRadiusMeters) {
    startQte();
  }
}

function hideRoundFlash() {
  if (state.roundFlashTimer) {
    clearTimeout(state.roundFlashTimer);
    state.roundFlashTimer = null;
  }
  elements.roundFlash.classList.add("hidden");
}

function showRoundFlash(summary) {
  hideRoundFlash();

  elements.flashTitle.textContent = `Level ${summary.levelNumber} Complete`;
  elements.flashLevel.textContent = `Level: ${summary.levelNumber}`;
  elements.flashScore.textContent = `Score: ${summary.score}`;
  elements.flashTime.textContent = `Time: ${formatDuration(summary.elapsedMs)}`;
  elements.flashMoves.textContent = `Moves: ${summary.moveCount}`;
  elements.flashDiscover.textContent = `Discovered: ${summary.discoveredPoints}`;
  elements.roundFlash.classList.remove("hidden");

  return new Promise((resolve) => {
    const finish = () => {
      elements.flashContinue.removeEventListener("click", finish);
      hideRoundFlash();
      resolve();
    };

    elements.flashContinue.addEventListener("click", finish, { once: true });
  });
}

function loadMapsApi() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const callbackName = "__initStreetViewGame";
    window[callbackName] = () => {
      resolve();
      delete window[callbackName];
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      config.GOOGLE_MAPS_API_KEY
    )}&callback=${callbackName}&libraries=geometry`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps JS API."));
    document.head.appendChild(script);
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatMeters(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} km`;
  }
  return `${Math.round(value)} m`;
}

function serializeFogTrail() {
  if (!state.visitedPositions.length) {
    return [];
  }

  const step = Math.max(1, Math.ceil(state.visitedPositions.length / MAX_FOG_PAYLOAD_POINTS));
  const trail = [];

  for (let index = 0; index < state.visitedPositions.length; index += step) {
    const point = state.visitedPositions[index];
    trail.push({
      lat: Number(point.lat().toFixed(6)),
      lng: Number(point.lng().toFixed(6))
    });
  }

  const lastPoint = state.visitedPositions[state.visitedPositions.length - 1];
  if (trail.length) {
    const lastTrailPoint = trail[trail.length - 1];
    if (lastTrailPoint.lat !== Number(lastPoint.lat().toFixed(6)) || lastTrailPoint.lng !== Number(lastPoint.lng().toFixed(6))) {
      trail.push({
        lat: Number(lastPoint.lat().toFixed(6)),
        lng: Number(lastPoint.lng().toFixed(6))
      });
    }
  }

  return trail;
}

function setFogExpanded(expanded) {
  state.fogExpanded = expanded;
  elements.fogPanel.classList.toggle("collapsed", !expanded);
  elements.fogBody.hidden = !expanded;
  elements.fogToggle.textContent = expanded ? "Hide" : "Show";
  elements.fogToggle.setAttribute("aria-expanded", String(expanded));

  if (expanded) {
    queueMicrotask(() => {
      if (state.miniMap) {
        google.maps.event.trigger(state.miniMap, "resize");
      }
      redrawFogMask();
    });
  }
}

function resizeFogCanvas() {
  if (!elements.fogCanvas) {
    return;
  }

  const rect = elements.fogCanvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));

  if (elements.fogCanvas.width !== width || elements.fogCanvas.height !== height) {
    elements.fogCanvas.width = width;
    elements.fogCanvas.height = height;
    if (state.fogCtx) {
      state.fogCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }
}

function redrawFogMask() {
  if (!state.fogCtx || !state.miniMap || !state.fogExpanded) {
    return;
  }

  resizeFogCanvas();

  const ctx = state.fogCtx;
  const width = elements.fogCanvas.clientWidth;
  const height = elements.fogCanvas.clientHeight;
  const projection = state.miniMap.getProjection();
  const center = state.miniMap.getCenter();
  const zoom = state.miniMap.getZoom();
  if (width <= 0 || height <= 0) {
    return;
  }
  if (!projection || !center || typeof zoom !== "number") {
    return;
  }

  const scale = 2 ** zoom;
  const centerWorld = projection.fromLatLngToPoint(center);

  function toCanvasPoint(latLng) {
    const world = projection.fromLatLngToPoint(latLng);
    let dx = world.x - centerWorld.x;
    if (dx > 0.5) {
      dx -= 1;
    }
    if (dx < -0.5) {
      dx += 1;
    }
    const dy = world.y - centerWorld.y;
    return {
      x: dx * scale + width / 2,
      y: dy * scale + height / 2
    };
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = `rgba(10, 10, 10, ${FOG_ALPHA})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "destination-out";

  state.visitedPositions.forEach((latLng) => {
    const point = toCanvasPoint(latLng);
    ctx.beginPath();
    ctx.arc(point.x, point.y, FOG_REVEAL_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalCompositeOperation = "source-over";
}

function updateMiniMapPosition(current) {
  if (!state.miniMap || !state.playerMarker) {
    return;
  }

  state.playerMarker.setPosition(current);
  state.visitedPositions.push(new google.maps.LatLng(current.lat(), current.lng()));
  if (state.visitedPositions.length > MAX_VISITED_POINTS) {
    state.visitedPositions.shift();
  }
  state.miniMap.setCenter(current);
  redrawFogMask();
}

function initializeFogMap() {
  const level = getCurrentLevel();
  const start = new google.maps.LatLng(level.start.lat, level.start.lng);
  const goal = new google.maps.LatLng(level.goal.lat, level.goal.lng);

  if (!state.miniMap) {
    state.miniMap = new google.maps.Map(elements.fogMap, {
      center: start,
      zoom: FOG_ZOOM_LEVEL,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      disableDefaultUI: true,
      clickableIcons: false,
      keyboardShortcuts: false,
      gestureHandling: "none"
    });

    state.miniMap.addListener("idle", redrawFogMask);
    state.miniMap.addListener("zoom_changed", redrawFogMask);
  } else {
    state.miniMap.setCenter(start);
    state.miniMap.setZoom(FOG_ZOOM_LEVEL);
  }

  if (!state.startMarker) {
    state.startMarker = new google.maps.Marker({
      map: state.miniMap,
      position: start,
      title: "Start",
      label: "S"
    });
  } else {
    state.startMarker.setMap(state.miniMap);
    state.startMarker.setPosition(start);
  }

  if (!state.finishMarker) {
    state.finishMarker = new google.maps.Marker({
      map: state.miniMap,
      position: goal,
      title: "Finish",
      label: "F"
    });
  } else {
    state.finishMarker.setMap(state.miniMap);
    state.finishMarker.setPosition(goal);
  }

  if (!state.playerMarker) {
    state.playerMarker = new google.maps.Marker({
      map: state.miniMap,
      position: start,
      title: "Player",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: "#60a5fa",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2
      }
    });
  } else {
    state.playerMarker.setMap(state.miniMap);
    state.playerMarker.setPosition(start);
  }

  state.visitedPositions = [start];

  if (!state.fogCtx) {
    state.fogCtx = elements.fogCanvas.getContext("2d");
  }

  redrawFogMask();
}

function calculateScore(elapsedMs) {
  const mode = elements.mode.value;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  if (mode === "efficiency") {
    return Math.max(0, Math.round(
      state.totalDistanceMeters +
        state.moveCount * (config.MOVE_PENALTY ?? 4) +
        state.clickCount * (config.CLICK_PENALTY ?? 2) -
        state.qteScoreReduction
    ));
  }

  return Math.max(0, Math.round(
    elapsedSeconds +
      state.moveCount * (config.MOVE_PENALTY ?? 4) +
      state.clickCount * (config.CLICK_PENALTY ?? 2) -
      state.qteScoreReduction
  ));
}

function renderStats() {
  const elapsedMs = Date.now() - state.startedAt;
  state.score = calculateScore(elapsedMs);

  elements.timer.textContent = formatDuration(elapsedMs);
  elements.distance.textContent = formatMeters(state.distanceToGoalMeters);
  elements.moves.textContent = state.moveCount.toString();
  elements.clicks.textContent = state.clickCount.toString();
  elements.score.textContent = state.score.toString();
  elements.discovered.textContent = state.visitedPositions.length.toString();
}

async function loadUserProfile(username) {
  const response = await fetch(`${config.API_BASE_URL}/api/users/${encodeURIComponent(username)}/profile`);
  if (!response.ok) {
    elements.playerSummary.hidden = true;
    return;
  }

  const profile = await response.json();
  if (!profile?.latestSession) {
    elements.playerSummary.hidden = true;
    return;
  }

  elements.summaryScore.textContent = `Score: ${profile.latestSession.score}`;
  elements.summaryMode.textContent = `Mode: ${profile.latestSession.mode}`;
  elements.summaryDiscover.textContent = `Discovered points: ${profile.latestSession.discoveredPoints}`;
  elements.playerSummary.hidden = false;
}

async function startSession() {
  const level = getCurrentLevel();
  state.sessionId = null;

  const payload = {
    username: state.username,
    runId: state.currentRunId,
    expectedRounds: state.levels.length,
    startLocation: level.start,
    goalLocation: level.goal,
    mode: elements.mode.value,
    winRadiusMeters: config.WIN_RADIUS_METERS
  };

  const response = await fetch(`${config.API_BASE_URL}/api/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Unable to start game session.");
  }

  const data = await response.json();
  state.sessionId = data.sessionId;
}

async function completeSession() {
  if (!state.sessionId || !state.panorama) {
    return;
  }

  const position = state.panorama.getPosition();
  const payload = {
    currentPosition: { lat: position.lat(), lng: position.lng() },
    elapsedMs: Date.now() - state.startedAt,
    moveCount: state.moveCount,
    clickCount: state.clickCount,
    totalDistanceMeters: state.totalDistanceMeters,
    fogTrail: serializeFogTrail(),
    discoveredPoints: state.visitedPositions.length,
    qteScoreReduction: state.qteScoreReduction
  };

  const response = await fetch(
    `${config.API_BASE_URL}/api/sessions/${state.sessionId}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Could not complete session.");
  }

  return response.json();
}

async function loadLeaderboard() {
  const mode = encodeURIComponent(elements.mode.value);
  const response = await fetch(`${config.API_BASE_URL}/api/leaderboard?mode=${mode}`);
  if (!response.ok) {
    return;
  }

  const items = await response.json();
  elements.leaderboard.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("li");
    empty.textContent = "No entries yet";
    elements.leaderboard.appendChild(empty);
    return;
  }

  items.forEach((entry) => {
    const li = document.createElement("li");
    const roundsPlayed = entry.roundsPlayed ?? 1;
    const elapsedMs = entry.totalElapsedMs ?? entry.elapsedMs ?? 0;
    const totalMoves = entry.totalMoveCount ?? entry.moveCount ?? 0;
    li.textContent = `${entry.username || "anon"} • ${entry.score} pts total • ${roundsPlayed} rounds • ${Math.round(elapsedMs / 1000)}s • ${totalMoves} moves`;
    elements.leaderboard.appendChild(li);
  });
}

function onPositionChanged() {
  if (!state.panorama || state.won) {
    return;
  }

  const current = state.panorama.getPosition();
  if (!current) {
    return;
  }

  state.moveCount += 1;

  if (state.lastPosition) {
    const incremental = google.maps.geometry.spherical.computeDistanceBetween(
      state.lastPosition,
      current
    );
    state.totalDistanceMeters += incremental;
  }

  state.lastPosition = current;
  state.distanceToGoalMeters = google.maps.geometry.spherical.computeDistanceBetween(
    current,
    state.goal
  );
  updateMiniMapPosition(current);
  maybeTriggerQte(current);

  renderStats();

  if (state.distanceToGoalMeters <= (config.WIN_RADIUS_METERS ?? 15)) {
    state.won = true;
    setFogExpanded(true);
    redrawFogMask();
    clearRoundMarkers();
    const currentLevelNumber = state.currentLevelIndex + 1;
    const hasNextLevel = currentLevelNumber < state.levels.length;
    const roundSummary = {
      levelNumber: currentLevelNumber,
      elapsedMs: Date.now() - state.startedAt,
      moveCount: state.moveCount,
      discoveredPoints: state.visitedPositions.length,
      score: state.score
    };
    elements.status.textContent = hasNextLevel
      ? `Level ${currentLevelNumber} complete.`
      : "You reached the final goal.";
    completeSession()
      .then((result) => {
        if (result?.discoveredPoints) {
          elements.discovered.textContent = result.discoveredPoints.toString();
        }
        if (typeof result?.score === "number") {
          roundSummary.score = result.score;
        }
        if (typeof result?.discoveredPoints === "number") {
          roundSummary.discoveredPoints = result.discoveredPoints;
        }
        return Promise.all([loadLeaderboard(), loadUserProfile(state.username)]).then(() => result);
      })
      .then(() => {
        const nextLevelIndex = state.currentLevelIndex + 1;
        if (nextLevelIndex < state.levels.length) {
          showRoundFlash(roundSummary).then(() => {
            state.currentLevelIndex = nextLevelIndex;
            renderLevelMeta();
            elements.status.textContent = `Starting Level ${nextLevelIndex + 1} in 3 seconds...`;
            setTimeout(() => {
              restartGame();
            }, 3000);
          });
        } else {
          elements.status.textContent = "All levels complete.";
        }
      })
      .catch((error) => {
        elements.status.textContent = `Win recorded locally, backend error: ${error.message}`;
      });
  }
}

function initializePanorama() {
  const level = getCurrentLevel();
  state.goal = new google.maps.LatLng(level.goal.lat, level.goal.lng);
  const start = level.start;

  state.panorama = new google.maps.StreetViewPanorama(document.getElementById("pano"), {
    position: start,
    pov: { heading: 0, pitch: 0 },
    zoom: 1,
    addressControl: false,
    linksControl: true,
    panControl: false,
    enableCloseButton: false
  });

  state.panorama.addListener("position_changed", onPositionChanged);
  state.panorama.addListener("click", () => {
    if (state.won) {
      return;
    }
    state.clickCount += 1;
    renderStats();
  });
}

function resetState() {
  hideRoundFlash();
  hideQteOverlay();
  clearRoundPreviewTimers();
  elements.fogPanel.classList.remove("map-preview");
  state.sessionId = null;
  state.startedAt = Date.now();
  state.moveCount = 0;
  state.clickCount = 0;
  state.totalDistanceMeters = 0;
  state.distanceToGoalMeters = Number.POSITIVE_INFINITY;
  state.lastPosition = null;
  state.score = 0;
  state.won = false;
  state.visitedPositions = [];
  state.qteTriggered = false;
  state.qteActive = false;
  state.qtePressCount = 0;
  state.qteScoreReduction = 0;
  elements.status.textContent = "Navigate to the hidden goal.";
  renderStats();

  if (state.timerTick) {
    clearInterval(state.timerTick);
  }
  state.timerTick = setInterval(() => {
    if (!state.won) {
      renderStats();
    }
  }, 1000);
}

async function restartGame() {
  if (!state.username) {
    return;
  }

  renderLevelMeta();
  resetState();
  clearRoundMarkers();
  initializeFogMap();
  await showRoundMapPreview(10000);
  initializePanorama();
  try {
    await startSession();
    await loadLeaderboard();
    elements.status.textContent = "Session started.";
  } catch (error) {
    state.sessionId = null;
    elements.status.textContent = `Running without backend session: ${error.message}`;
  }
}

window.addEventListener("resize", () => {
  redrawFogMask();
});

elements.fogToggle.addEventListener("click", () => {
  setFogExpanded(!state.fogExpanded);
});

elements.qteClose.addEventListener("click", () => {
  hideQteOverlay();
});

window.addEventListener("keydown", (event) => {
  if (!state.qteActive) {
    return;
  }

  if (event.key.toLowerCase() !== "t") {
    return;
  }

  const qte = getQteConfig();
  state.qtePressCount += 1;
  elements.qteProgress.textContent = `T Presses: ${state.qtePressCount} / ${qte.requiredPresses}`;

  if (state.qtePressCount >= qte.requiredPresses) {
    completeQteSuccess();
  }
});

elements.startGameBtn.addEventListener("click", async () => {
  const username = sanitizeUsername(elements.usernameInput.value);
  if (!username) {
    setLandingStatus("Enter a username to continue.");
    return;
  }

  state.username = username;
  state.currentRunId = generateRunId();
  state.currentLevelIndex = 0;
  renderLevelMeta();
  elements.playerName.textContent = username;
  setLandingStatus("Loading profile...");
  elements.startGameBtn.disabled = true;
  setGameVisible(true);

  try {
    await loadUserProfile(username);
    setLandingStatus("Starting game...");
    await restartGame();
  } catch (error) {
    elements.status.textContent = `Game error: ${error.message}`;
  } finally {
    elements.startGameBtn.disabled = false;
    setLandingStatus("");
  }
});

elements.splashContinue.addEventListener("click", () => {
  hideSplashShowLanding();
});

elements.usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    elements.startGameBtn.click();
  }
});

async function bootstrap() {
  try {
    assertConfig();
    normalizeLevels();
    renderLevelMeta();
    await loadMapsApi();
    initializeSplash();
    state.gameInitialized = true;
    elements.status.textContent = "Set username to start.";
  } catch (error) {
    elements.status.textContent = `Initialization failed: ${error.message}`;
  }
}

elements.restartBtn.addEventListener("click", () => {
  restartGame();
});

elements.mode.addEventListener("change", () => {
  if (state.username) {
    restartGame();
  }
});

bootstrap();
