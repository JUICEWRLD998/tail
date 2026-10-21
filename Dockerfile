# Tail: bot, connect API and connect page in one container.
FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY web ./web
COPY src/strike/base58.ts ./src/strike/base58.ts
RUN npm run web:build

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    TAIL_DB=/data/tail.db
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY --from=web /app/web/dist ./web/dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "--import", "tsx", "src/main.ts"]
