FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run check && npm run build

FROM node:26-alpine
ENV NODE_ENV=production PORT=8000
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/tools/serve.mjs /app/tools/files.mjs ./tools/
COPY --from=build /app/tools/healthcheck.mjs ./tools/
COPY --from=build /app/package.json ./package.json
USER node
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 CMD ["node", "tools/healthcheck.mjs"]
CMD ["node", "tools/serve.mjs", "--dist", "--host=0.0.0.0"]
