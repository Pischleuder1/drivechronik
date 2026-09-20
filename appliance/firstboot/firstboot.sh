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
BOOT_CREDENTIALS_FILE="/boot/firmware/drivechronik-credentials.txt"
LINUX_USER="drive"
LINUX_INITIAL_PASSWORD="drivechronik"

PROJECT_NAME="drivechronik-appliance"

WEB_PORT_VALUE="${DRIVECHRONIK_APPLIANCE_WEB_PORT:-3000}"
TESLAMATE_PORT_VALUE="${DRIVECHRONIK_APPLIANCE_TESLAMATE_PORT:-4000}"

STATUS_BIN="/usr/local/sbin/drivechronik-status"

status() {
  [ -x "$STATUS_BIN" ] &&
    "$STATUS_BIN" "$1" "$2" "${3:-normal}" ||
    true
}

log() {
  printf '%s\n' "[DriveChronik Appliance] $*"
}

fail() {
  status 0 "$*" error
  printf '%s\n' "[DriveChronik Appliance] FEHLER: $*" >&2
  exit 1
}

pull_images() {
  PULL_ATTEMPT=1
  PULL_MAX_ATTEMPTS=5

  while [ "$PULL_ATTEMPT" -le "$PULL_MAX_ATTEMPTS" ]; do
    log "Lade Container-Images (Versuch $PULL_ATTEMPT/$PULL_MAX_ATTEMPTS) ..."

    if docker compose \
      -p "$PROJECT_NAME" \
      pull; then
      return 0
    fi

    if [ "$PULL_ATTEMPT" -ge "$PULL_MAX_ATTEMPTS" ]; then
      return 1
    fi

    PULL_ATTEMPT=$((PULL_ATTEMPT + 1))

    log "WARNUNG: Container-Download fehlgeschlagen. Neuer Versuch in 10 Sekunden ..."
    status 45 "Container-Download fehlgeschlagen. Versuch $PULL_ATTEMPT/$PULL_MAX_ATTEMPTS folgt ..."

    sleep 10
  done

  return 1
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
  status 35 "Sichere Zugangsdaten werden erzeugt ..."
  log "Erzeuge sichere Zugangsdaten ..."

  TESLAMATE_POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  TESLAMATE_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  DRIVECHRONIK_TESLAMATE_RO_PASSWORD="$(openssl rand -hex 24)"
  DRIVECHRONIK_POSTGRES_PASSWORD="$(openssl rand -hex 24)"

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
DRIVECHRONIK_INITIAL_ADMIN_PASSWORD=
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

status 45 "Container-Images werden geladen ..."

if ! pull_images; then
  fail "Container-Images konnten nach 5 Versuchen nicht geladen werden."
fi

# ---------------------------------------------------------------------------
# TeslaMate starten
# ---------------------------------------------------------------------------

status 60 "TeslaMate wird gestartet ..."
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

    status 70 "TeslaMate-Datenbank ist bereit."
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

status 75 "Datenbankzugriff für DriveChronik ist vorbereitet."
log "Read-only-Rolle drivechronik_ro ist vorhanden."

# ---------------------------------------------------------------------------
# DriveChronik starten
# ---------------------------------------------------------------------------

status 80 "DriveChronik wird gestartet ..."
log "Starte DriveChronik ..."

docker compose \
  -p "$PROJECT_NAME" \
  up -d

# ---------------------------------------------------------------------------
# Auf betriebsbereites DriveChronik warten
# ---------------------------------------------------------------------------

status 90 "DriveChronik wird geprüft ..."
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
    status 95 "DriveChronik läuft. Abschlussprüfung ..."
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

Linux-Zugang:

Benutzer:
$LINUX_USER

Initiales Linux-Passwort:
$LINUX_INITIAL_PASSWORD

SSH:
ssh $LINUX_USER@drivechronik.local

DriveChronik:

Benutzer:
admin

Beim ersten Aufruf von DriveChronik
ein eigenes Admin-Passwort festlegen.

WICHTIG:

Das Linux-Passwort muss beim ersten Linux-Login geändert werden.

TeslaMate muss anschließend über seine Weboberfläche
mit dem persönlichen Tesla-Konto verbunden werden.
CREDEOF

chmod 600 "$CREDENTIALS_FILE"

if [ -d /boot/firmware ] && [ -w /boot/firmware ]; then
  BOOT_TMP="${BOOT_CREDENTIALS_FILE}.tmp"
  cp "$CREDENTIALS_FILE" "$BOOT_TMP"
  chmod 600 "$BOOT_TMP"
  mv "$BOOT_TMP" "$BOOT_CREDENTIALS_FILE"
else
  log "WARNUNG: Zugangsdaten konnten nicht nach /boot/firmware kopiert werden."
fi

touch "$STATE_FILE"
chmod 600 "$STATE_FILE"

status 100 "DriveChronik ist bereit." done

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
