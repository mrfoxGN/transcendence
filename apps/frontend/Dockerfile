FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:stable-alpine

RUN apk add --no-cache openssl

# Production Compose uses the internal HTTP configuration behind its edge Nginx.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Local Compose sets PUBLIC_ORIGIN; the entrypoint then enables this TLS config.
COPY nginx.tls.conf.template /etc/nginx/nginx.tls.conf.template
COPY --chmod=755 tls-entrypoint.sh /docker-entrypoint.d/15-devup-tls.sh

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443
