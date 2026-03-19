const appJson = require('./app.json');

const fallbackBackendUrl = 'http://localhost:8000';

module.exports = () => ({
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      backendUrl: process.env.APP_BACKEND_URL || fallbackBackendUrl,
    },
  },
});