FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY public ./public
COPY LICENSE ./LICENSE
COPY docker-entrypoint.sh ./docker-entrypoint.sh

ENV PORT=3000
ENV DATA_FILE=/app/data/superchargers.json

VOLUME ["/app/data"]

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
