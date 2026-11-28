FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:stable-alpine AS production

# Compose mounts the shared nginx/nginx.conf directly.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443
