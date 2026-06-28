# syntax=docker/dockerfile:1

###############################################################################
# Stage 1 — build the static site
###############################################################################
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Build the production bundle.
COPY . .
RUN npm run build

###############################################################################
# Stage 2 — serve with a hardened, rootless nginx
#  - nginx-unprivileged runs as uid 101 (non-root) and listens on :8080
###############################################################################
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Security headers + SPA routing config.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf

# Static build output.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1

# The base image already drops to the unprivileged "nginx" user.
CMD ["nginx", "-g", "daemon off;"]
