const fallbackBackendUrl = 'http://localhost:8000';
const stadiaMapsApiKey = process.env.APP_STADIA_MAPS_API_KEY?.trim() || null;

module.exports = ({ config }) => ({
  ...config,
    extra: {
      ...config.extra,
      backendUrl: process.env.APP_BACKEND_URL || fallbackBackendUrl,
      stadiaMapsApiKey,
    },
});