# RESONA — static site for Railway (or any Docker host).
# Caddy serves the files; Railway provides HTTPS at its edge (needed for the microphone).
FROM caddy:2.8-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html capture-worklet.js manifest.json sw.js icon-192.png icon-512.png icon-maskable.png /srv/
