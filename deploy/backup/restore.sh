#!/bin/sh
set -eu

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-tripatlas}"
DB_NAME="${DB_NAME:-tripatlas}"

BACKUP_DIR="${BACKUP_DIR_CONTAINER:-/backups}"

: "${PGPASSWORD:?PGPASSWORD must be set}"

if [ "${RESTORE_CONFIRM:-}" != "RESTORE_DRIVECHRONIK" ]; then
  echo "Restore refused." >&2
  echo "Set RESTORE_CONFIRM=RESTORE_DRIVECHRONIK explicitly." >&2
  exit 2
fi

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <backup.dump>" >&2
  exit 2
fi

archive="$1"

case "$archive" in
  /*)
    ;;
  *)
    archive="${BACKUP_DIR}/${archive}"
    ;;
esac

if [ ! -f "$archive" ]; then
  echo "Backup file not found: $archive" >&2
  exit 1
fi

checksum="${archive}.sha256"

if [ -f "$checksum" ]; then
  echo "Verifying SHA-256 checksum..."

  (
    cd "$(dirname "$archive")"
    sha256sum -c "$(basename "$checksum")"
  )
elif [ "${RESTORE_ALLOW_MISSING_CHECKSUM:-}" = "1" ]; then
  echo "WARNING: no SHA-256 checksum found; continuing because RESTORE_ALLOW_MISSING_CHECKSUM=1" >&2
else
  echo "Restore refused: SHA-256 checksum file is missing." >&2
  echo "Expected: ${checksum}" >&2
  echo "Set RESTORE_ALLOW_MISSING_CHECKSUM=1 only if you explicitly accept restoring an unverified backup." >&2
  exit 1
fi

echo "Checking PostgreSQL archive..."

if ! pg_restore --list "$archive" >/dev/null 2>&1; then
  echo "Invalid or damaged PostgreSQL backup archive" >&2
  exit 1
fi

attempt=0

while ! pg_isready \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d postgres >/dev/null 2>&1
do
  attempt=$((attempt + 1))

  if [ "$attempt" -ge 60 ]; then
    echo "Database server did not become ready in time" >&2
    exit 1
  fi

  sleep 2
done

echo "Creating safety backup of the current database..."

safety_timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
safety_name="drivechronik-pre-restore-${safety_timestamp}.dump"
safety_target="${BACKUP_DIR}/${safety_name}"
safety_temporary="${safety_target}.part"

rm -f "$safety_temporary"

pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$safety_temporary"

if ! pg_restore --list "$safety_temporary" >/dev/null 2>&1; then
  rm -f "$safety_temporary"
  echo "Safety backup verification failed. Restore aborted." >&2
  exit 1
fi

mv "$safety_temporary" "$safety_target"

(
  cd "$BACKUP_DIR"
  sha256sum "$safety_name" > "${safety_name}.sha256"
)

echo "Safety backup created:"
echo "  ${safety_target}"

echo "Recreating DriveChronik database..."

dropdb \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  --if-exists \
  --force \
  "$DB_NAME"

createdb \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  --owner="$DB_USER" \
  "$DB_NAME"

echo "Restoring DriveChronik database..."

if ! pg_restore \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  "$archive"
then
  echo "Restore failed." >&2
  echo "The pre-restore safety backup is available at:" >&2
  echo "  ${safety_target}" >&2
  exit 1
fi

echo "Restore completed successfully."
echo "Pre-restore safety backup:"
echo "  ${safety_target}"
