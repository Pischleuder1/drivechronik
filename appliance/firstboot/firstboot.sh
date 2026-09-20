#!/bin/sh
set -eu

umask 077

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APPLIANCE_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_DIR="$APPLIANCE_DIR/compose"

ENV_FILE="$COMPOSE_DIR/.env"
SECRET_DIR="$COMPOSE_DIR/secrets"

STATE_DIR="/var/lib/drivechronik-appliance"
STATE_FILE="$STATE_DIR/initialized"
CREDENTIALS_FILE="$STATE_DIR/credentials.txt"

PROJECT_NAME="drivechronik-appliance"

WEB_PORT_VALUE="${DRIVECHRONIK_APPLIANCE_WEB_PORT:-3000}"
TESLAMATE_PORT_VALUE="${DRIVECHRONIK_APPLIANCE_TESLAMATE_PORT:-4000}"

log() {
  printf '%s\n' "[DriveChronik Appliance] $*"
}

fail() {
  printf '%s\n' "[DriveChronik Appliance] FEHLER: $*" >&2
  exit 1
}

if [ "$(id -u)" -ne 0 ]; then
  fail "firstboot.sh muss als root ausgeführt werden."
fi

command -v docker >/dev/null 2>&1 ||
  fail "Docker wurde nicht gefunden."

command -v openssl >/dev/null 2>&1 ||
  fail "OpenSSL wurde nicht gefunden."

docker compose version >/dev/null 2>&1 ||
  fail "Docker Compose Plugin wurde nicht gefunden."

mkdir -p \
  "$STATE_DIR" \
  "$SECRET_DIR" \
  "$COMPOSE_DIR/data/teslamate-import" \
  "$COMPOSE_DIR/backups"

# ---------------------------------------------------------------------------
# Zugangsdaten erzeugen
# ---------------------------------------------------------------------------

if [ ! -f "$ENV_FILE" ]; then
  log "Erzeuge sichere Zugangsdaten ..."

  TESLAMATE_POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  TESLAMATE_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  DRIVECHRONIK_TESLAMATE_RO_PASSWORD="$(openssl rand -hex 24)"
  DRIVECHRONIK_POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  DRIVECHRONIK_INITIAL_ADMIN_PASSWORD="$(openssl rand -hex 10)"

  ENV_TMP="${ENV_FILE}.tmp"

  cat > "$ENV_TMP" <<ENVEOF
APP_TIMEZONE=Europe/Berlin

TESLAMATE_IMAGE_TAG=4.2.0
DRIVECHRONIK_IMAGE_TAG=v0.4.4

TESLAMATE_PORT=$TESLAMATE_PORT_VALUE
WEB_PORT=$WEB_PORT_VALUE

SYNC_INTERVAL_SECONDS=60

TESLAMATE_POSTGRES_PASSWORD=$TESLAMATE_POSTGRES_PASSWORD
TESLAMATE_ENCRYPTION_KEY=$TESLAMATE_ENCRYPTION_KEY
DRIVECHRONIK_TESLAMATE_RO_PASSWORD=$DRIVECHRONIK_TESLAMATE_RO_PASSWORD
DRIVECHRONIK_POSTGRES_PASSWORD=$DRIVECHRONIK_POSTGRES_PASSWORD
DRIVECHRONIK_INITIAL_ADMIN_PASSWORD=$DRIVECHRONIK_INITIAL_ADMIN_PASSWORD
ENVEOF

  chmod 600 "$ENV_TMP"
  mv "$ENV_TMP" "$ENV_FILE"

  log ".env erzeugt."
else
  log ".env bereits vorhanden – Zugangsdaten bleiben unverändert."
fi

# ---------------------------------------------------------------------------
# Ed25519-Schlüssel für Monatsabschlüsse
# ---------------------------------------------------------------------------

PRIVATE_KEY="$SECRET_DIR/month-seal-ed25519-private.pem"

if [ ! -f "$PRIVATE_KEY" ]; then
  log "Erzeuge Ed25519-Schlüssel ..."

  openssl genpkey \
    -algorithm Ed25519 \
    -out "$PRIVATE_KEY"

  chmod 600 "$PRIVATE_KEY"
else
  log "Ed25519-Schlüssel bereits vorhanden."
fi

# ---------------------------------------------------------------------------
# Compose-Konfiguration prüfen
# ---------------------------------------------------------------------------

cd "$COMPOSE_DIR"

log "Prüfe Docker-Compose-Konfiguration ..."

docker compose \
  -p "$PROJECT_NAME" \
  config >/dev/null

# ---------------------------------------------------------------------------
# Images laden
# ---------------------------------------------------------------------------

log "Lade Container-Images ..."

docker compose \
  -p "$PROJECT_NAME" \
  pull

# ---------------------------------------------------------------------------
# TeslaMate starten
# ---------------------------------------------------------------------------

log "Starte TeslaMate-Datenbank und TeslaMate ..."

docker compose \
  -p "$PROJECT_NAME" \
  up -d \
  teslamate-db \
  teslamate

log "Warte auf TeslaMate-Datenbankschema ..."

i=0

while [ "$i" -lt 120 ]; do
  if docker compose \
      -p "$PROJECT_NAME" \
      exec -T teslamate-db \
      psql \
        -U teslamate \
        -d teslamate \
        -tAc "SELECT to_regclass('public.cars')" \
        2>/dev/null |
        grep -q cars; then

    log "TeslaMate-Datenbankschema ist verfügbar."
    break
  fi

  i=$((i + 1))
  sleep 2
done

if [ "$i" -ge 120 ]; then
  docker compose \
    -p "$PROJECT_NAME" \
    logs --tail=100 teslamate || true

  fail "TeslaMate-Datenbankschema wurde nicht rechtzeitig verfügbar."
fi

# ---------------------------------------------------------------------------
# Read-only-Rolle prüfen
# ---------------------------------------------------------------------------

if ! docker compose \
    -p "$PROJECT_NAME" \
    exec -T teslamate-db \
    psql \
      -U teslamate \
      -d teslamate \
      -tAc "SELECT 1 FROM pg_roles WHERE rolname='drivechronik_ro'" |
      grep -q 1; then

  fail "Read-only-Rolle drivechronik_ro fehlt."
fi

log "Read-only-Rolle drivechronik_ro ist vorhanden."

# ---------------------------------------------------------------------------
# DriveChronik starten
# ---------------------------------------------------------------------------

log "Starte DriveChronik ..."

docker compose \
  -p "$PROJECT_NAME" \
  up -d

# ---------------------------------------------------------------------------
# Auf betriebsbereites DriveChronik warten
# ---------------------------------------------------------------------------

log "Warte auf DriveChronik Web und Worker ..."

i=0

while [ "$i" -lt 150 ]; do
  WEB_ID="$(
    docker compose       -p "$PROJECT_NAME"       ps -q web
  )"

  WORKER_ID="$(
    docker compose       -p "$PROJECT_NAME"       ps -q worker
  )"

  WEB_HEALTH="$(
    docker inspect       --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}'       "$WEB_ID" 2>/dev/null || true
  )"

  WORKER_HEALTH="$(
    docker inspect       --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}'       "$WORKER_ID" 2>/dev/null || true
  )"

  if [ "$WEB_HEALTH" = "healthy" ] &&
     [ "$WORKER_HEALTH" = "healthy" ]; then
    log "DriveChronik Web und Worker sind healthy."
    break
  fi

  i=$((i + 1))
  sleep 2
done

if [ "$i" -ge 150 ]; then
  docker compose     -p "$PROJECT_NAME"     ps || true

  docker compose     -p "$PROJECT_NAME"     logs --tail=100 web worker || true

  fail "DriveChronik wurde nicht rechtzeitig healthy."
fi

# ---------------------------------------------------------------------------
# Zugangsinformationen
# ---------------------------------------------------------------------------

ADMIN_PASSWORD="$(
  sed -n \
    's/^DRIVECHRONIK_INITIAL_ADMIN_PASSWORD=//p' \
    "$ENV_FILE"
)"

HOSTNAME_NOW="$(hostname)"

IP_ADDRESS="$(
  hostname -I 2>/dev/null |
  awk '{print $1}'
)"

SCHEME="http"

cat > "$CREDENTIALS_FILE" <<CREDEOF
DriveChronik Raspberry Pi Appliance
===================================

Hostname:
$HOSTNAME_NOW

IP-Adresse:
${IP_ADDRESS:-noch nicht verfügbar}

DriveChronik:
${SCHEME}://${IP_ADDRESS:-$HOSTNAME_NOW}:$WEB_PORT_VALUE

TeslaMate:
${SCHEME}://${IP_ADDRESS:-$HOSTNAME_NOW}:$TESLAMATE_PORT_VALUE

DriveChronik initiales Admin-Passwort:
$ADMIN_PASSWORD

WICHTIG:
Das Admin-Passwort nach der ersten Anmeldung ändern.

TeslaMate muss anschließend über seine Weboberfläche
mit dem persönlichen Tesla-Konto verbunden werden.
CREDEOF

chmod 600 "$CREDENTIALS_FILE"

touch "$STATE_FILE"
chmod 600 "$STATE_FILE"

log ""
log "============================================================"
log "DriveChronik Appliance wurde eingerichtet."
log ""
log "DriveChronik:"
log "  ${SCHEME}://${IP_ADDRESS:-$HOSTNAME_NOW}:$WEB_PORT_VALUE"
log ""
log "TeslaMate:"
log "  ${SCHEME}://${IP_ADDRESS:-$HOSTNAME_NOW}:$TESLAMATE_PORT_VALUE"
log ""
log "Zugangsdaten:"
log "  $CREDENTIALS_FILE"
log "============================================================"
