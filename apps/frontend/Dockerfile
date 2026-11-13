FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache openssl
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --chmod=755 tls-entrypoint.sh /docker-entrypoint.d/15-devup-tls.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
