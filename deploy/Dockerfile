# Baut das Dashboard und liefert es per nginx aus (läuft auf arm64 = Raspberry Pi 4)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_* Variablen werden beim Build eingebrannt -> per --build-arg übergeben
ARG VITE_HA_URL
ARG VITE_HA_TOKEN
ENV VITE_HA_URL=$VITE_HA_URL VITE_HA_TOKEN=$VITE_HA_TOKEN
RUN npm run build

FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
# Selbstsigniertes Zertifikat fürs https-Listen (Port 443); auf dem Pi kann stattdessen ein eigenes
# per deploy/tls/make-cert.sh erzeugtes Zertifikat nach /etc/nginx/tls gemountet werden.
RUN apk add --no-cache openssl && mkdir -p /etc/nginx/tls \
 && openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=dashboard" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
      -keyout /etc/nginx/tls/dashboard.key -out /etc/nginx/tls/dashboard.crt
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
