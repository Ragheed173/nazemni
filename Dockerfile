FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --include=dev

COPY . .

RUN npm run db:generate && npm run build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npm run db:deploy && npm start"]
