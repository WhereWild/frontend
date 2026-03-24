const appJson = require('./app.json');

const fallbackBackendUrl = 'http://localhost:8000';
const stadiaMapsApiKey = process.env.APP_STADIA_MAPS_API_KEY?.trim() || null;

module.exports = () => ({
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      backendUrl: process.env.APP_BACKEND_URL || fallbackBackendUrl,
      stadiaMapsApiKey,
    },
  },
});