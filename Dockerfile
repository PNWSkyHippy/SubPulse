# Container for the SubPulse GATEWAY (server/), not the mobile app.
# Lives at the repo root because the gateway reuses the app's pure logic in src/.
#   docker build -t subpulse-gateway .      or      gcloud run deploy subpulse-gateway --source .
FROM node:22-slim AS build
WORKDIR /repo
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci
COPY src ./src
COPY server ./server
RUN cd server && npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/server/dist ./dist
COPY --from=build /repo/server/node_modules ./node_modules
COPY --from=build /repo/server/package.json ./
EXPOSE 8080
CMD ["node", "dist/index.js"]
