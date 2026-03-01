const config = window.GAME_CONFIG;

const elements = {
  distance: document.getElementById("distance"),
  timer: document.getElementById("timer"),
  moves: document.getElementById("moves"),
  clicks: document.getElementById("clicks"),
  score: document.getElementById("score"),
  status: document.getElementById("status"),
  mode: document.getElementById("mode"),
  restartBtn: document.getElementById("restartBtn"),
  leaderboard: document.getElementById("leaderboard"),
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
  playerMarker: null,
  goalMarker: null,
  fogCtx: null,
  fogExpanded: false,
  visitedPositions: []
};

const FOG_ZOOM_LEVEL = 17;
const FOG_ALPHA = 0.85;
const FOG_REVEAL_RADIUS_PX = 32;
const MAX_VISITED_POINTS = 2500;

function assertConfig() {
  if (!config || !config.GOOGLE_MAPS_API_KEY) {
    throw new Error("Missing window.GAME_CONFIG or GOOGLE_MAPS_API_KEY.");
  }
  if (config.GOOGLE_MAPS_API_KEY === "REPLACE_ME") {
    elements.status.textContent = "Set client/config.js with your Google API key.";
  }
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
  const start = new google.maps.LatLng(config.START_LOCATION.lat, config.START_LOCATION.lng);
  const goal = new google.maps.LatLng(config.GOAL_LOCATION.lat, config.GOAL_LOCATION.lng);

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
    state.playerMarker.setPosition(start);
  }

  if (!state.goalMarker) {
    state.goalMarker = new google.maps.Marker({
      map: state.miniMap,
      position: goal,
      title: "Goal"
    });
  } else {
    state.goalMarker.setPosition(goal);
  }
  state.goalMarker.setVisible(false);

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
    return Math.round(
      state.totalDistanceMeters +
        state.moveCount * (config.MOVE_PENALTY ?? 4) +
        state.clickCount * (config.CLICK_PENALTY ?? 2)
    );
  }

  return Math.round(
    elapsedSeconds +
      state.moveCount * (config.MOVE_PENALTY ?? 4) +
      state.clickCount * (config.CLICK_PENALTY ?? 2)
  );
}

function renderStats() {
  const elapsedMs = Date.now() - state.startedAt;
  state.score = calculateScore(elapsedMs);

  elements.timer.textContent = formatDuration(elapsedMs);
  elements.distance.textContent = formatMeters(state.distanceToGoalMeters);
  elements.moves.textContent = state.moveCount.toString();
  elements.clicks.textContent = state.clickCount.toString();
  elements.score.textContent = state.score.toString();
}

async function startSession() {
  const payload = {
    startLocation: config.START_LOCATION,
    goalLocation: config.GOAL_LOCATION,
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
    totalDistanceMeters: state.totalDistanceMeters
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
    li.textContent = `${entry.score} pts • ${Math.round(entry.elapsedMs / 1000)}s • ${entry.moveCount} moves`;
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

  renderStats();

  if (state.distanceToGoalMeters <= (config.WIN_RADIUS_METERS ?? 15)) {
    state.won = true;
    state.goalMarker?.setVisible(true);
    setFogExpanded(true);
    redrawFogMask();
    elements.status.textContent = "You reached the goal.";
    completeSession()
      .then(() => loadLeaderboard())
      .catch((error) => {
        elements.status.textContent = `Win recorded locally, backend error: ${error.message}`;
      });
  }
}

function initializePanorama() {
  state.goal = new google.maps.LatLng(config.GOAL_LOCATION.lat, config.GOAL_LOCATION.lng);
  const start = config.START_LOCATION;

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
  state.startedAt = Date.now();
  state.moveCount = 0;
  state.clickCount = 0;
  state.totalDistanceMeters = 0;
  state.distanceToGoalMeters = Number.POSITIVE_INFINITY;
  state.lastPosition = null;
  state.score = 0;
  state.won = false;
  state.visitedPositions = [];
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
  resetState();
  initializeFogMap();
  setFogExpanded(false);
  initializePanorama();
  try {
    await startSession();
    await loadLeaderboard();
    elements.status.textContent = "Session started.";
  } catch (error) {
    elements.status.textContent = `Running without backend session: ${error.message}`;
  }
}

window.addEventListener("resize", () => {
  redrawFogMask();
});

elements.fogToggle.addEventListener("click", () => {
  setFogExpanded(!state.fogExpanded);
});

async function bootstrap() {
  try {
    assertConfig();
    await loadMapsApi();
    await restartGame();
  } catch (error) {
    elements.status.textContent = `Initialization failed: ${error.message}`;
  }
}

elements.restartBtn.addEventListener("click", () => {
  restartGame();
});

elements.mode.addEventListener("change", () => {
  restartGame();
});

bootstrap();
