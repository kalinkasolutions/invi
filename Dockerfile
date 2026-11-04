FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx ng build && rm -f dist/invi/browser/config.json

FROM nginxinc/nginx-unprivileged:1.29-alpine
# INVIDIOUS_URL: where this container reaches Invidious.
# INVIDIOUS_PUBLIC_URL: where the user's browser reaches Invidious, for sign-in.
ENV INVIDIOUS_URL=http://invidious:3000
COPY --chmod=755 docker/check-settings.sh /docker-entrypoint.d/05-check-settings.sh
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/invi/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
