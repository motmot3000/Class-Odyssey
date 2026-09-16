FROM node:22-bookworm-slim

WORKDIR /app

COPY server/ ./server/
COPY index.html styles.css character-detail-study.html items-3d.html ./
COPY src/ ./src/
COPY assets/ ./assets/

ENV HOST=0.0.0.0 \
    PORT=5180 \
    DATA_DIR=/data \
    NODE_ENV=production

USER node

EXPOSE 5180

CMD ["node", "server/server.mjs"]
