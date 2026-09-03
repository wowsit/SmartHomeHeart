#!/bin/bash
# Erzeugt ein selbstsigniertes Zertifikat (10 Jahre) für das Dashboard über https.
# Aufruf auf dem Pi:  bash make-cert.sh [Zielordner]   (Standard: ~/dashboard/tls)
# Browser zeigt beim ersten Aufruf eine Warnung -> einmal akzeptieren ("Trotzdem fortfahren").
set -e
OUT="${1:-$HOME/dashboard/tls}"
mkdir -p "$OUT"
LAN_IP="$(hostname -I | awk '{print $1}')"
TS_IP="$(tailscale ip -4 2>/dev/null || true)"
TS_DNS="$(tailscale status --json 2>/dev/null | sed -n 's/.*"DNSName": "\([^"]*\)\.".*/\1/p' | head -1)"
SAN="DNS:localhost,DNS:$(hostname),DNS:$(hostname).local,IP:127.0.0.1,IP:${LAN_IP}"
[ -n "$TS_IP" ] && SAN="$SAN,IP:${TS_IP}"
[ -n "$TS_DNS" ] && SAN="$SAN,DNS:${TS_DNS}"
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -sha256 \
  -keyout "$OUT/dashboard.key" -out "$OUT/dashboard.crt" \
  -subj "/CN=$(hostname)" -addext "subjectAltName=$SAN" -addext "extendedKeyUsage=serverAuth"
chmod 600 "$OUT/dashboard.key"
echo "Zertifikat erstellt in $OUT  (SAN: $SAN)"
