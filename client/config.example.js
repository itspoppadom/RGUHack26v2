window.GAME_CONFIG = {
  GOOGLE_MAPS_API_KEY: "YOUR_GOOGLE_MAPS_API_KEY",
  API_BASE_URL: "http://localhost:3001",
  SPLASH: {
    enabled: true,
    imageUrl: "./assets/splash-art.png",
    title: "Street View Challenge",
    subtitle: "Press continue to begin",
    continueLabel: "Continue"
  },
  LEVELS: [
    {
      name: "Level 1",
      start: { lat: 57.148056, lng: -2.101667 },
      goal: { lat: 57.14445662853467, lng: -2.0965852807853143 }
    },
    {
      name: "Level 2",
      start: { lat: 57.13247900591649, lng: -2.1025585789109353 },
      goal: { lat: 57.144730834461654, lng: -2.091061109456266 }
    }
  ],
  START_LOCATION: { lat: 40.758, lng: -73.9855 },
  GOAL_LOCATION: { lat: 40.7614, lng: -73.9776 },
  WIN_RADIUS_METERS: 15,
  MOVE_PENALTY: 4,
  CLICK_PENALTY: 2,
  QTE: {
    interceptLocation: { lat: 57.14696712569186, lng: -2.097676156362164 },
    triggerRadiusMeters: 5,
    requiredPresses: 18,
    durationMs: 7000,
    scoreReduction: 20,
    introTitle: "Seagull Alert!",
    introMessage:
      "The Carry-on at St Nics has distracted you, and a seagull is trying to steal your chips! Press <T>, to T pose to assert dominance",
    successTitle: "Dominance asserted",
    successMessage: "You T-posed hard. The seagull dropped your chips and flew off. Score reduced.",
    failTitle: "Seagull wins this round",
    failMessage: "Too slow. The seagull nicked your chips and escaped."
  }
};
