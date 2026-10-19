FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run check && npm run build

FROM node:24-alpine
ENV NODE_ENV=production PORT=8000
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/tools/serve.mjs /app/tools/files.mjs ./tools/
COPY --from=build /app/package.json ./package.json
USER node
EXPOSE 8000
CMD ["node", "tools/serve.mjs", "--dist", "--host=0.0.0.0"]
