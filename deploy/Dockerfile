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
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
