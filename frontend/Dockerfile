FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
RUN printf '%s\n' 'server {' '  listen 80;' '  root /usr/share/nginx/html;' '  location / { try_files $uri $uri/ /index.html; }' '}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
