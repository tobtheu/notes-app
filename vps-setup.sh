#!/bin/bash
# ============================================================
# Lama Notes — VPS Setup Script
# Ubuntu 22.04 / 24.04 LTS | Hostinger KVM 2
#
# Installiert:
#   - Docker + Docker Compose
#   - PostgreSQL 16 (via Docker, mit Logical Replication)
#   - Supabase GoTrue (Auth only, via Docker)
#   - ElectricSQL 1.5
#   - Caddy (Reverse Proxy + automatisches SSL)
#
# Ausführen:
#   chmod +x vps-setup.sh && sudo ./vps-setup.sh
# ============================================================

set -euo pipefail

# ── Farben ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[✓]${NC} $1"; }
info()  { echo -e "${BLUE}[→]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[ "$EUID" -ne 0 ] && error "Bitte als root ausführen: sudo ./vps-setup.sh"

INSTALL_DIR="/opt/lama-notes"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║        Lama Notes — VPS Setup                   ║"
echo "║        PostgreSQL + ElectricSQL + GoTrue Auth   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Eingaben ─────────────────────────────────────────────────
read -rp "Domain (z.B. notes.example.com), leer = nur IP: " DOMAIN
read -rp "E-Mail (für SSL-Zertifikat, leer lassen wenn keine Domain): " SSL_EMAIL

USE_DOMAIN=false
[ -n "$DOMAIN" ] && USE_DOMAIN=true

# ── Secrets generieren ───────────────────────────────────────
info "Generiere Secrets..."
PG_PASSWORD=$(openssl rand -hex 24)
GOTRUE_DB_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 40)
ELECTRIC_PASSWORD=$(openssl rand -hex 16)
ELECTRIC_SECRET=$(openssl rand -hex 32)
GOTRUE_ADMIN_KEY=$(openssl rand -hex 20)

# JWT-Keys für GoTrue (anon + service_role) — HS256, manuell gebaut
# Format: base64url(header).base64url(payload).signature
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

ANON_HEADER=$(echo -n '{"alg":"HS256","typ":"JWT"}' | b64url)
ANON_PAYLOAD=$(echo -n "{\"role\":\"anon\",\"iss\":\"supabase\",\"iat\":$(date +%s),\"exp\":$(($(date +%s) + 315360000))}" | b64url)
ANON_SIG=$(echo -n "${ANON_HEADER}.${ANON_PAYLOAD}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)
ANON_KEY="${ANON_HEADER}.${ANON_PAYLOAD}.${ANON_SIG}"

SERVICE_HEADER=$(echo -n '{"alg":"HS256","typ":"JWT"}' | b64url)
SERVICE_PAYLOAD=$(echo -n "{\"role\":\"service_role\",\"iss\":\"supabase\",\"iat\":$(date +%s),\"exp\":$(($(date +%s) + 315360000))}" | b64url)
SERVICE_SIG=$(echo -n "${SERVICE_HEADER}.${SERVICE_PAYLOAD}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)
SERVICE_KEY="${SERVICE_HEADER}.${SERVICE_PAYLOAD}.${SERVICE_SIG}"

# ── Credentials anzeigen ──────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  WICHTIG: Diese Credentials jetzt sichern!                  ║"
echo "║  Sie werden nicht erneut angezeigt.                         ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "  Postgres Passwort:     $PG_PASSWORD"
echo "  GoTrue DB Passwort:    $GOTRUE_DB_PASSWORD"
echo "  JWT Secret:            $JWT_SECRET"
echo "  Anon Key:              $ANON_KEY"
echo "  Service Role Key:      $SERVICE_KEY"
echo "  Electric Passwort:     $ELECTRIC_PASSWORD"
echo "  Electric Secret:       $ELECTRIC_SECRET"
echo "  GoTrue Admin Key:      $GOTRUE_ADMIN_KEY"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Credentials in Datei speichern
mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/credentials.txt" <<EOF
# Lama Notes — VPS Credentials
# Generiert: $(date)

POSTGRES_PASSWORD=$PG_PASSWORD
GOTRUE_DB_PASSWORD=$GOTRUE_DB_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_KEY=$SERVICE_KEY
ELECTRIC_PASSWORD=$ELECTRIC_PASSWORD
ELECTRIC_SECRET=$ELECTRIC_SECRET
GOTRUE_ADMIN_KEY=$GOTRUE_ADMIN_KEY
DOMAIN=$DOMAIN
EOF
chmod 600 "$INSTALL_DIR/credentials.txt"
log "Credentials gespeichert unter $INSTALL_DIR/credentials.txt"

read -rp "Enter drücken sobald du die Credentials gesichert hast..."

# ── System-Update ─────────────────────────────────────────────
info "System aktualisieren..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git openssl ufw ca-certificates gnupg lsb-release
log "System aktualisiert"

# ── Firewall ──────────────────────────────────────────────────
info "Firewall konfigurieren..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# Intern: Postgres + Electric nicht öffentlich exponieren
ufw deny 5432/tcp
ufw deny 5133/tcp
ufw --force enable
log "Firewall konfiguriert (nur 22/80/443 offen)"

# ── Docker ────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Docker installieren..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  log "Docker installiert"
else
  log "Docker bereits installiert"
fi

# ── Caddy ─────────────────────────────────────────────────────
if ! command -v caddy &>/dev/null; then
  info "Caddy installieren..."
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy
  log "Caddy installiert"
else
  log "Caddy bereits installiert"
fi

# ── Verzeichnisse ─────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"/{postgres,electric,gotrue,caddy,migrations}

# ── PostgreSQL 16 ─────────────────────────────────────────────
info "PostgreSQL konfigurieren..."

cat > "$INSTALL_DIR/postgres/docker-compose.yml" <<EOF
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: "${PG_PASSWORD}"
      POSTGRES_DB: postgres
      POSTGRES_USER: postgres
    command:
      - postgres
      - -c
      - wal_level=logical
      - -c
      - max_replication_slots=10
      - -c
      - max_wal_senders=10
      - -c
      - shared_preload_libraries=pg_stat_statements
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d

volumes:
  pgdata:
    driver: local
EOF

# Init-Script: GoTrue Schema + Electric User anlegen
mkdir -p "$INSTALL_DIR/postgres/init"
cat > "$INSTALL_DIR/postgres/init/01_init.sql" <<EOF
-- GoTrue benötigt ein eigenes Schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Electric Replikations-User
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'electric_replication') THEN
    CREATE ROLE electric_replication WITH REPLICATION LOGIN PASSWORD '${ELECTRIC_PASSWORD}';
  END IF;
END
\$\$;

GRANT USAGE ON SCHEMA public TO electric_replication;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO electric_replication;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO electric_replication;

-- GoTrue DB User
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gotrue_user') THEN
    CREATE ROLE gotrue_user WITH LOGIN PASSWORD '${GOTRUE_DB_PASSWORD}';
  END IF;
END
\$\$;

GRANT ALL ON SCHEMA auth TO gotrue_user;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO gotrue_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO gotrue_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO gotrue_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO gotrue_user;
EOF

# ── Notes + App Config Migration ─────────────────────────────
cat > "$INSTALL_DIR/postgres/init/02_notes.sql" <<'EOF'
-- Notes
CREATE TABLE IF NOT EXISTS public.notes (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL,
    content     TEXT        NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
);

CREATE INDEX IF NOT EXISTS notes_user_id_idx    ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON public.notes(user_id, updated_at DESC);
ALTER TABLE public.notes REPLICA IDENTITY FULL;

-- App Config
CREATE TABLE IF NOT EXISTS public.app_config (
    user_id     UUID        NOT NULL PRIMARY KEY,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_config REPLICA IDENTITY FULL;

-- Publication für Electric
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'electric_publication') THEN
    CREATE PUBLICATION electric_publication FOR TABLE public.notes, public.app_config;
  END IF;
END
$$;
EOF

log "PostgreSQL konfiguriert"

# ── GoTrue (Supabase Auth Engine) ─────────────────────────────
info "GoTrue Auth konfigurieren..."

if [ "$USE_DOMAIN" = true ]; then
  GOTRUE_SITE_URL="https://$DOMAIN"
  GOTRUE_API_URL="https://auth.$DOMAIN"
else
  VPS_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
  GOTRUE_SITE_URL="http://$VPS_IP"
  GOTRUE_API_URL="http://$VPS_IP:9999"
fi

cat > "$INSTALL_DIR/gotrue/docker-compose.yml" <<EOF
services:
  gotrue:
    image: supabase/gotrue:v2.151.0
    restart: unless-stopped
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: "${GOTRUE_API_URL}"

      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: "postgres://gotrue_user:${GOTRUE_DB_PASSWORD}@host-gateway:5432/postgres?search_path=auth&sslmode=disable"

      GOTRUE_SITE_URL: "${GOTRUE_SITE_URL}"
      GOTRUE_URI_ALLOW_LIST: "*"

      GOTRUE_JWT_SECRET: "${JWT_SECRET}"
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated

      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_MAILER_AUTOCONFIRM: "true"

      # SMTP (optional — für Email-Verifizierung)
      # GOTRUE_SMTP_HOST: smtp.example.com
      # GOTRUE_SMTP_PORT: 587
      # GOTRUE_SMTP_USER: user@example.com
      # GOTRUE_SMTP_PASS: yourpassword
      # GOTRUE_SMTP_ADMIN_EMAIL: admin@example.com

      GOTRUE_LOG_LEVEL: info
    ports:
      - "127.0.0.1:9999:9999"
    extra_hosts:
      - "host-gateway:host-gateway"
EOF

log "GoTrue konfiguriert"

# ── ElectricSQL ───────────────────────────────────────────────
info "ElectricSQL konfigurieren..."

cat > "$INSTALL_DIR/electric/docker-compose.yml" <<EOF
services:
  electric:
    image: electricsql/electric:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: "postgresql://electric_replication:${ELECTRIC_PASSWORD}@host-gateway:5432/postgres"
      ELECTRIC_SECRET: "${ELECTRIC_SECRET}"
      ELECTRIC_STORAGE_DIR: "/electric/storage"
      # LOG_LEVEL: debug
    ports:
      - "127.0.0.1:5133:3000"
    volumes:
      - electric_storage:/electric/storage
    extra_hosts:
      - "host-gateway:host-gateway"

volumes:
  electric_storage:
    driver: local
EOF

log "ElectricSQL konfiguriert"

# ── Caddy Konfiguration ───────────────────────────────────────
info "Caddy konfigurieren..."

if [ "$USE_DOMAIN" = true ]; then
  cat > /etc/caddy/Caddyfile <<EOF
# Hauptdomain → App (optional: statische Dateien)
${DOMAIN} {
  respond "Lama Notes API läuft." 200
}

# Auth API
auth.${DOMAIN} {
  reverse_proxy localhost:9999
}

# ElectricSQL Sync
electric.${DOMAIN} {
  reverse_proxy localhost:5133
}
EOF
else
  cat > /etc/caddy/Caddyfile <<EOF
# Kein Domain konfiguriert — Dienste auf direkten Ports erreichbar:
#   GoTrue Auth:   http://<ip>:9999
#   ElectricSQL:   http://<ip>:5133  (intern, über Firewall blockiert)
:80 {
  respond "Lama Notes VPS läuft." 200
}
EOF
  # Ports temporär für direkten Zugriff öffnen (nur wenn keine Domain)
  ufw allow 9999/tcp
fi

systemctl reload caddy
log "Caddy konfiguriert"

# ── Services starten ──────────────────────────────────────────
info "PostgreSQL starten..."
cd "$INSTALL_DIR/postgres" && docker compose up -d
log "PostgreSQL gestartet"

info "Warte auf PostgreSQL..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U postgres &>/dev/null; then
    log "PostgreSQL bereit"
    break
  fi
  [ "$i" -eq 30 ] && error "PostgreSQL nicht erreichbar nach 60s"
  sleep 2
done

info "GoTrue starten..."
cd "$INSTALL_DIR/gotrue" && docker compose up -d
log "GoTrue gestartet"

info "ElectricSQL starten..."
cd "$INSTALL_DIR/electric" && docker compose up -d
log "ElectricSQL gestartet"

# ── Systemd Services für Autostart ───────────────────────────
info "Autostart konfigurieren..."

for SERVICE in postgres gotrue electric; do
cat > "/etc/systemd/system/lama-${SERVICE}.service" <<EOF
[Unit]
Description=Lama Notes — ${SERVICE}
Requires=docker.service
After=docker.service

[Service]
WorkingDirectory=${INSTALL_DIR}/${SERVICE}
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl enable "lama-${SERVICE}.service"
done

log "Autostart konfiguriert"

# ── App .env ausgeben ─────────────────────────────────────────
VPS_IP=$(curl -s ifconfig.me 2>/dev/null || echo "<deine-vps-ip>")

if [ "$USE_DOMAIN" = true ]; then
  AUTH_URL="https://auth.${DOMAIN}"
  ELECTRIC_URL="https://electric.${DOMAIN}"
else
  AUTH_URL="http://${VPS_IP}:9999"
  ELECTRIC_URL="http://${VPS_IP}:5133"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Setup abgeschlossen!                                        ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo ""
echo "  Diese Werte in deine App .env eintragen:"
echo ""
echo "  VITE_SUPABASE_URL=${AUTH_URL}"
echo "  VITE_SUPABASE_ANON_KEY=${ANON_KEY}"
echo "  VITE_ELECTRIC_URL=${ELECTRIC_URL}"
echo ""
if [ "$USE_DOMAIN" = true ]; then
echo "  DNS-Einträge benötigt:"
echo "    A  ${DOMAIN}           → ${VPS_IP}"
echo "    A  auth.${DOMAIN}      → ${VPS_IP}"
echo "    A  electric.${DOMAIN}  → ${VPS_IP}"
echo ""
fi
echo "  Credentials gespeichert: ${INSTALL_DIR}/credentials.txt"
echo ""
echo "  Logs prüfen:"
echo "    docker compose -f ${INSTALL_DIR}/postgres/docker-compose.yml logs -f"
echo "    docker compose -f ${INSTALL_DIR}/gotrue/docker-compose.yml logs -f"
echo "    docker compose -f ${INSTALL_DIR}/electric/docker-compose.yml logs -f"
echo ""
echo "╚══════════════════════════════════════════════════════════════╝"
