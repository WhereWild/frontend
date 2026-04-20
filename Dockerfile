ARG NODE_VERSION=24.13.0

FROM node:${NODE_VERSION}-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
  EXPO_NO_DOTENV=1 \
  PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The production bundle in `dist` must be built before running `docker build`
# so it exists in the build context for the COPY instruction below.
COPY dist ./dist

EXPOSE 8080

CMD ["sh", "-c", "npx expo serve dist --port ${PORT}"]
