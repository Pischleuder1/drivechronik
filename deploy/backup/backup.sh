#!/bin/sh
set -eu

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-tripatlas}"
DB_NAME="${DB_NAME:-tripatlas}"

BACKUP_DIR="${BACKUP_DIR_CONTAINER:-/backups}"
BACKUP_INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

: "${PGPASSWORD:?PGPASSWORD must be set}"

case "$BACKUP_INTERVAL_HOURS" in
  ''|*[!0-9]*)
    echo "BACKUP_INTERVAL_HOURS must be a positive integer" >&2
    exit 2
    ;;
esac

case "$BACKUP_RETENTION_DAYS" in
  ''|*[!0-9]*)
    echo "BACKUP_RETENTION_DAYS must be a non-negative integer" >&2
    exit 2
    ;;
esac

if [ "$BACKUP_INTERVAL_HOURS" -lt 1 ]; then
  echo "BACKUP_INTERVAL_HOURS must be at least 1" >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"

wait_for_db() {
  attempt=0

  while ! pg_isready \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" >/dev/null 2>&1
  do
    attempt=$((attempt + 1))

    if [ "$attempt" -ge 60 ]; then
      echo "Database did not become ready in time" >&2
      return 1
    fi

    sleep 2
  done
}

cleanup_old_backups() {
  find "$BACKUP_DIR" \
    -type f \
    \( \
      -name 'drivechronik-*.dump' \
      -o -name 'drivechronik-*.dump.sha256' \
      -o -name 'drivechronik-*.part' \
    \) \
    -mtime "+${BACKUP_RETENTION_DAYS}" \
    -exec rm -f {} \;
}

run_backup() {
  if ! wait_for_db; then
    return 1
  fi

  timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  basename="drivechronik-${timestamp}.dump"

  target="${BACKUP_DIR}/${basename}"
  temporary="${target}.part"

  rm -f "$temporary"

  echo "Creating DriveChronik backup: ${basename}"

  if ! pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --no-owner \
    --no-acl \
    --file="$temporary"
  then
    rm -f "$temporary"
    echo "Backup failed" >&2
    return 1
  fi

  if ! pg_restore --list "$temporary" >/dev/null 2>&1; then
    rm -f "$temporary"
    echo "Backup verification failed" >&2
    return 1
  fi

  mv "$temporary" "$target"

  (
    cd "$BACKUP_DIR"
    sha256sum "$basename" > "${basename}.sha256"
  )

  cleanup_old_backups

  echo "Backup completed successfully:"
  echo "  ${target}"
  du -h "$target" 2>/dev/null || true
}

mode="${1:-daemon}"

case "$mode" in
  once)
    run_backup
    ;;

  daemon)
    echo "DriveChronik automatic backup service started"
    echo "Interval: ${BACKUP_INTERVAL_HOURS} hour(s)"
    echo "Retention: ${BACKUP_RETENTION_DAYS} day(s)"

    while :
    do
      if run_backup; then
        sleep "$((BACKUP_INTERVAL_HOURS * 3600))"
      else
        echo "Backup attempt failed; retrying in 1 hour" >&2
        sleep 3600
      fi
    done
    ;;

  *)
    echo "Usage: $0 [once|daemon]" >&2
    exit 2
    ;;
esac
