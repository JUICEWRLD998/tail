# Tail: bot, connect API and connect page in one container.
FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
# The web build needs vite and react, not the native database module: skip install scripts so nothing compiles here.
RUN npm ci --ignore-scripts
COPY web ./web
COPY src/strike/base58.ts ./src/strike/base58.ts
RUN npm run web:build

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    TAIL_DB=/data/tail.db
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 is a native module. When no prebuilt binary matches, npm compiles it with node-gyp, which needs Python,
# make and a C++ compiler. Install them for this step only and remove them again so the image stays small.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && npm ci --omit=dev \
 && npm cache clean --force \
 && apt-get purge -y --auto-remove python3 make g++ \
 && rm -rf /var/lib/apt/lists/* \
 && node -e "const D=require('better-sqlite3');const d=new D(':memory:');d.exec('create table t(x)');console.log('better-sqlite3 loads')"
COPY src ./src
COPY --from=web /app/web/dist ./web/dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "--import", "tsx", "src/main.ts"]
