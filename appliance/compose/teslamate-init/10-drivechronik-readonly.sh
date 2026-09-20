#!/bin/sh
set -eu

: "${DRIVECHRONIK_TESLAMATE_RO_PASSWORD:?missing DRIVECHRONIK_TESLAMATE_RO_PASSWORD}"

psql \
  --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ro_password="$DRIVECHRONIK_TESLAMATE_RO_PASSWORD" <<'SQL'

SELECT format(
  'CREATE ROLE drivechronik_ro LOGIN PASSWORD %L',
  :'ro_password'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_roles
  WHERE rolname = 'drivechronik_ro'
)
\gexec

ALTER ROLE drivechronik_ro
  SET default_transaction_read_only = on;

GRANT CONNECT
  ON DATABASE teslamate
  TO drivechronik_ro;

GRANT USAGE
  ON SCHEMA public
  TO drivechronik_ro;

GRANT SELECT
  ON ALL TABLES IN SCHEMA public
  TO drivechronik_ro;

GRANT SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO drivechronik_ro;

ALTER DEFAULT PRIVILEGES
  FOR ROLE teslamate
  IN SCHEMA public
  GRANT SELECT ON TABLES
  TO drivechronik_ro;

ALTER DEFAULT PRIVILEGES
  FOR ROLE teslamate
  IN SCHEMA public
  GRANT SELECT ON SEQUENCES
  TO drivechronik_ro;

SQL

echo "DriveChronik read-only role prepared."
