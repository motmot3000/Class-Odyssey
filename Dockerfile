FROM node:22-bookworm-slim

WORKDIR /app

COPY server/server.mjs ./server/server.mjs
COPY server/api.mjs ./server/api.mjs

ENV HOST=0.0.0.0 \
    PORT=5180 \
    DATA_DIR=/data \
    NODE_ENV=production

USER node

EXPOSE 5180

CMD ["node", "server/server.mjs"]
