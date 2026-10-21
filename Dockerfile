FROM node:22.16.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV WRANGLER_SEND_METRICS=false
ENV CLOUDFLARE_CF_FETCH_ENABLED=false
RUN npm run build
EXPOSE 3000
CMD ["node","scripts/docker-start.mjs"]
