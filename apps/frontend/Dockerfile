# ==========================================
# STAGE 1: BUILD REACT
# ==========================================

FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./

RUN npm ci

# Copy frontend source
COPY . .

# Build production frontend
RUN npm run build

# ==========================================
# STAGE 2: NGINX
# ==========================================

FROM nginx:stable-alpine

# Copy React build
COPY --from=build /app/dist /usr/share/nginx/html

# Custom Nginx configuration for React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Frontend container listens internally on port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]