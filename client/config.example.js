window.GAME_CONFIG = {
  GOOGLE_MAPS_API_KEY: "YOUR_GOOGLE_MAPS_API_KEY",
  API_BASE_URL: "http://localhost:3001",
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
  CLICK_PENALTY: 2
};
