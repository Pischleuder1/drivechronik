# DriveChronik

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)

> **Herkunft:** DriveChronik basiert auf **Tripatlas v0.1.1** von Jan Schultheiss,
> veröffentlicht unter der **GNU Affero General Public License v3.0**.
> DriveChronik ist eine unabhängige Weiterentwicklung und nicht das offizielle
> Tripatlas-/ODOVI-Projekt.
> Upstream: https://github.com/jsc2304/odovi/tree/v0.1.1


**Self-hosted Fahrtenarchiv & Analytics für Tesla.** Datum wählen, jede Fahrt des Tages sehen, klassifizieren, exportieren — deine Bewegungsdaten bleiben auf deinem Server.

DriveChronik liest die Datenbank einer bestehenden [TeslaMate](https://github.com/teslamate-org/teslamate)-Installation (read-only) und macht daraus ein durchsuchbares Fahrten-, Park- und Ladearchiv mit Tagesansicht, Orten, Tags, Auto-Klassifizierung und Business-Exporten (CSV/PDF/GPX). Kein Abo, keine Cloud, kein Tracking.

> *English: DriveChronik is a self-hosted trip archive and analytics UI on top of your existing TeslaMate database — day timeline, trip classification (logbook-style), tagging, charging analytics, journeys, exports (CSV/PDF/GPX), auto-classification rules, per-place charging costs, insights, dark mode, German/English UI. Read-only against TeslaMate, your data stays on your server.*

## Warum?

Tessie & Co. sind gut, aber: Abo-Kosten, Feature-Überschneidung mit der Tesla-App und Bewegungsdaten bei einem Drittanbieter. TeslaMate loggt hervorragend, hat aber keinen Workflow zum **Wiederfinden und Nachweisen** einzelner Fahrten. DriveChronik ist die Produkt-Schicht darüber.

## Features

**Fahrtenarchiv (der Kern)**
- **Tagesansicht** — Datum wählen → jede Fahrt als atomarer Eintrag: `08:14–08:47 · Zuhause → Kunde Müller · 27,3 km · Geschäftlich`; Parken und Laden interleaved als Timeline
- **Klassifizieren & Annotieren** — privat / geschäftlich / Arbeitsweg per Segmented Control, Zweck, Kunde, Projekt, Notizen und Tags; Änderungen bleiben mit ihrer Herkunft bzw. Regel-Provenienz nachvollziehbar
- **Auto-Klassifizierungs-Regeln** — Regeln mit Start-/Zielort, Wochentagen und optionalem Abfahrts-Zeitfenster klassifizieren neue unklassifizierte Fahrten automatisch. Vor dem Speichern zeigt eine Vorschau, wie viele Fahrten zur Regel passen und auf wie viele offene Fahrten sie tatsächlich angewendet würde. Eine neue Regel kann außerdem direkt aus einer vorhandenen Fahrt vorbereitet werden. Manuell getroffene Klassifizierungen werden nicht überschrieben.

- **Regelvorschläge für wiederkehrende Fahrten** — DriveChronik erkennt wiederkehrende unklassifizierte Start-/Ziel-Kombinationen der letzten 14 Tage und schlägt daraus Regeln vor. Wochentage und typische Abfahrtszeiten werden aus den beobachteten Fahrten abgeleitet; die zeitliche Regelmäßigkeit wird als hohe, mittlere oder niedrige Sicherheit bewertet. Vorschläge werden nie automatisch als Regel angelegt oder auf Fahrten angewendet.
- **Bulk-Bearbeitung** — viele Fahrten auf einmal auswählen und klassifizieren/taggen, in Tagesansicht und Suche
- **Orte** — Geofences mit Karten-Picker und Adresssuche (OSM/Nominatim); manuelle Korrekturen mit Lock, die jeden Re-Sync überleben
- **Kalender, Suche, Reports** — Monatsgrid mit Fahrt-Intensität; Volltextsuche über Orte/Kunden/Projekte/Tags mit Filtern; Monatsreports mit CSV-/PDF-Export (Fahrtenbuch-Stil)

**Fahrt- & Lade-Analytics**
- **Fahrt-Detail** — Route auf der Karte, kombinierter Verlaufs-Chart (Höhe/SoC/Tempo), Temperaturen, Max-Speed/-Leistung/Rekuperation, historisches Wetter zur Fahrtzeit, GPX-Export
  - Bei echten Fahrten basiert die dargestellte Route auf den von TeslaMate aufgezeichneten GPS-/Positionsdaten. OSRM rekonstruiert keine aufgezeichneten Fahrten.
- **Ladeübersicht** — Ladekurve (kW über SoC), AC/DC, Kosten, Standort-Karte
- **Automatische Ladekosten** — Strompreis pro Ort hinterlegen (z. B. Zuhause 0,32 €/kWh) → Sessions ohne bekannten Preis werden automatisch berechnet, manuelle und gesyncte Kosten bleiben unangetastet
- **Journeys** — Urlaube/Reisen als Klammer über Fahrten + Ladestopps mit Kennzahlen-Dashboard, Karte aller Etappen und Export als CSV, PDF und GPX
- **Insights** — persönliche Verbrauchskurve: Verbrauch vs. Außentemperatur und Tempo, Saisonmuster, Kurzstrecken-Anteil
- **Standzeit-Analytics** — Vampir-Verlust pro Parkvorgang, Standzeiten pro Ort
- **Routenplaner (experimentell)** — Reichweiten-Check mit echter Route (OSRM), Höhenprofil und deinem persönlichen Verbrauchsprofil aus der eigenen Historie; automatische Tesla-Supercharger-Planung mit empfohlenem Ladestopp, Ankunfts-SoC, Ladeziel und geschätzter Ladezeit; alle Annahmen offengelegt

**Cockpit & Fahrzeug**
- **Start-Dashboard** — SoC + Reichweite, Standort, Status, Wetter, Reifendruck mit Warnung, letzte Fahrten als Karte + Liste
- **Fahrzeug-Analytics** — geschätzter Batteriezustand und Degradation, prognostizierte 100-%-Reichweite, Kilometerstand, Ladeeffizienz, Vampir-Verlust und Software-/Update-Historie
- **Reale Fahrzeugdaten** — Auswertungen basieren auf TeslaMate-Historie und vorhandenen Fahrzeugwerten; Schätzwerte und Fallbacks werden entsprechend gekennzeichnet
- **Verbindungs-Diagnose** — Sync-Gesundheit pro Datenquelle auf einen Blick, optionaler TeslaMate-Direkttest

**Oberfläche**
- **Deutsch & Englisch** — umschaltbar im UI (Standard Deutsch)
- **Dark Mode** — Hell/Dunkel/System-Switcher, ohne Flackern
- **Mobile-first** — als PWA installierbar, 16px-Formularfelder (kein iOS-Zoom), Safe-Area-aware Bottom-Navigation

**Daten**
- **Datenhoheit** — eigene PostgreSQL-DB, quellen-agnostisches Schema (`source`/`source_id`), Annotationen überleben strukturell jeden Re-Sync
- **Tessie-Import** — rekonstruiert Fahrten/Ladungen aus einem Tessie-Rohdaten-Export (`import-tessie`-CLI), inkl. echter Energiewerte per Fahrzeug-Zähler
- **Energie ehrlich** — echte Zählerwerte wo verfügbar, sonst gekennzeichnete Schätzung; Effizienz-Fallback in den Settings, bis TeslaMate den Fahrzeugwert gelernt hat

## Hinweis zu Fahrtenbuch und Abrechnung

DriveChronik unterstützt die Dokumentation, Klassifizierung und den Export von Fahrten. Das Projekt erhebt jedoch keinen Anspruch auf eine behördliche, steuerliche oder rechtliche Zertifizierung als elektronisches Fahrtenbuch.

Ob ein erzeugter Nachweis für steuerliche Zwecke, gegenüber einem Arbeitgeber oder einer anderen Stelle ausreicht, hängt vom jeweiligen Anwendungsfall und den geltenden Anforderungen ab.

## Demo ohne Auto

Kein Tesla, kein TeslaMate? Der Demo-Stack startet eine komplett gefüllte App mit sechs Wochen synthetischer Fahrdaten:

```bash
docker compose -f docker-compose.demo.yml up -d --build
# → http://localhost:3000, Login: demo1234
```

Details: [docs/demo.md](docs/demo.md)

## Stack

pnpm-Monorepo: Next.js 15 (`apps/web`) · Sync-Worker (`apps/worker`) · Drizzle-Schema (`packages/db`) · pure Domain-Logik (`packages/core`) · PostgreSQL 17 · Docker Compose.

## Entwicklung

Ohne echtes Auto — eine Fixture-TeslaMate-DB mit 6 Wochen synthetischer Fahrdaten liegt bei:

```bash
pnpm install
pnpm dev:db                                # tripatlas-db :5432 + fixture teslamate-db :5433
pnpm db:seed:teslamate                     # ~140 Fahrten, Laden, Geofences (Raum Zürich)
DATABASE_URL=postgres://tripatlas:tripatlas@localhost:5432/tripatlas pnpm db:migrate
pnpm --filter @drivechronik/worker dev        # Sync-Loop (braucht DATABASE_URL + TESLAMATE_DATABASE_URL, siehe .env.example)
pnpm --filter @drivechronik/web dev           # http://localhost:3000
```

Tests: `pnpm test` · Typecheck: `pnpm lint`

## Deployment

Docker Compose auf Home Server/NAS/Raspberry Pi im LAN oder VPN (z. B. Tailscale), angebunden an die bestehende TeslaMate-Postgres über eine read-only-Rolle.

### Schnellstart

Für eine bestehende TeslaMate-Installation:

1. DriveChronik klonen oder auf den Server kopieren.
2. Eine read-only-Rolle in der TeslaMate-Datenbank anlegen.
3. `.env.example` nach `.env` kopieren und mindestens `POSTGRES_PASSWORD` sowie `TESLAMATE_DATABASE_URL` setzen.
4. Mit `docker compose up -d --build` starten.
5. `http://<server>:<WEB_PORT>` öffnen und die Erstanmeldung durchführen.

Anschließend mit `docker compose ps -a` prüfen: `db`, `web` und `worker` sollten healthy sein; `migrate` muss erfolgreich mit `Exited (0)` beendet sein.

### Voraussetzungen

- Docker + Docker Compose (Plugin) auf dem Zielgerät (Raspberry Pi, NAS, Home Server)
- ≥ 4 GB RAM
- Eine laufende TeslaMate-Installation mit erreichbarer Postgres (LAN, VPN oder gleicher Docker-Host)

### 0. TeslaMate bereitstellen

DriveChronik benötigt eine laufende TeslaMate-Installation. Ist TeslaMate bereits vorhanden, kann dieser Schritt übersprungen werden.

Ein minimales TeslaMate-Compose (ohne Grafana) liegt unter [deploy/teslamate/](deploy/teslamate/docker-compose.yml). Danach auf `http://<host>:4000` das Tesla-Konto anmelden.

Für DriveChronik muss die TeslaMate-PostgreSQL-Datenbank erreichbar sein. Die Verbindung wird später ausschließlich über `TESLAMATE_DATABASE_URL` in der `.env` konfiguriert.

Dabei gibt es zwei Möglichkeiten:

- **Standard:** Verbindung über einen erreichbaren Hostnamen oder eine IP-Adresse.
- **Optional auf demselben Docker-Host:** DriveChronik kann zusätzlich an das bestehende TeslaMate-Docker-Netz angebunden werden. Dadurch muss PostgreSQL nicht nach außen veröffentlicht werden.

Die Docker-Netzwerk-Variante ist optional und keine Voraussetzung für DriveChronik.

### 1. Read-only-Rolle auf der TeslaMate-DB anlegen

DriveChronik liest die TeslaMate-DB nur — nie schreibend. Auf dem TeslaMate-Postgres ausführen:

```sql
CREATE ROLE tripatlas_ro WITH LOGIN PASSWORD 'ein-sicheres-passwort';
GRANT CONNECT ON DATABASE teslamate TO tripatlas_ro;
GRANT USAGE ON SCHEMA public TO tripatlas_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO tripatlas_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO tripatlas_ro;
```

### 2. `.env` einrichten

```bash
cp .env.example .env
```

Mindestens setzen:

- `POSTGRES_PASSWORD` — Passwort für die neue DriveChronik-eigene PostgreSQL-Datenbank (Pflicht, kein Default)
- `TESLAMATE_DATABASE_URL` — Connection-String der `tripatlas_ro`-Rolle zur bestehenden TeslaMate-Datenbank
- optional `WEB_PORT` (Default `3000`), `APP_TIMEZONE`, `SYNC_INTERVAL_SECONDS`, `OSRM_URL`

Beispiel: `TESLAMATE_DATABASE_URL=postgres://tripatlas_ro:read-only-passwort@192.168.1.50:5432/teslamate`

Der TeslaMate-PostgreSQL-Port muss vom DriveChronik-Host erreichbar sein. Auf demselben Docker-Host kann alternativ ein gemeinsames Docker-Netzwerk verwendet werden.

### Optional: TeslaMate auf demselben Docker-Host

Laufen TeslaMate und DriveChronik auf demselben Docker-Host, kann der DriveChronik-Worker zusätzlich an das bestehende TeslaMate-Netzwerk angebunden werden. Dadurch muss der PostgreSQL-Port von TeslaMate nicht nach außen veröffentlicht werden.

Beispiel `docker-compose.override.yml`:

```yaml
services:
  web:
    networks:
      - default
      - teslamate

  worker:
    networks:
      - default
      - teslamate

networks:
  teslamate:
    external: true
    name: teslamate_default
```

Dann kann in `.env` z. B. verwendet werden:

`TESLAMATE_DATABASE_URL=postgres://tripatlas_ro:read-only-passwort@database:5432/teslamate`

### 3. Stack starten

```bash
docker compose up -d --build
```

Das baut `apps/web` und `apps/worker`, lässt den `migrate`-Service einmalig die Drizzle-Migrationen einspielen (`restart: "no"`, muss erfolgreich durchlaufen) und startet dann `db`, `web`, `worker` und den automatischen `backup`-Service dauerhaft (`restart: unless-stopped`).

### 4. Erstanmeldung

Beim ersten Start wird ein Admin-Account bootstrapped. Optional vorab ein Passwort über `INITIAL_ADMIN_PASSWORD` in `.env` setzen — sonst wird beim ersten Login-Flow eines gesetzt (mit Passwort-Wiederholung).

`INITIAL_ADMIN_PASSWORD` wird ausschließlich verwendet, solange noch kein Benutzer existiert. Nach erfolgreicher Erstanmeldung sollte der Wert aus `.env` entfernt und der Web-Container neu gestartet werden, damit das Initialpasswort nicht dauerhaft in der Container-Umgebung verbleibt.

### 5. HTTPS / Fernzugriff

Kein eigener Reverse Proxy im Compose-Stack. Empfehlung: [`tailscale serve`](https://tailscale.com/kb/1242/tailscale-serve) auf dem Zielgerät vor `${WEB_PORT}` schalten — TLS-Zertifikat und Zugriff nur im eigenen Tailnet, ohne offenen Port am Router.

### Update

Vor einem Update zuerst ein manuelles Backup der DriveChronik-Datenbank erstellen:

```bash
docker compose exec backup /scripts/backup.sh once
```

Danach den aktuellen Programmstand laden und die Container neu bauen:

```bash
git pull --ff-only
docker compose up -d --build
```

Neue Datenbank-Migrationen werden automatisch über den einmaligen `migrate`-Service ausgeführt. Anschließend den Zustand des Stacks prüfen:

```bash
docker compose ps -a
```

`db`, `web` und `worker` sollten laufen bzw. `healthy` sein. Der `migrate`-Service muss nach erfolgreicher Migration mit `Exited (0)` beendet sein.

### Backup & Restore

DriveChronik sichert seine eigene PostgreSQL-Datenbank automatisch über den
`backup`-Service. TeslaMate selbst ist nicht Bestandteil dieses Backups.

Standardmäßig gilt:

- Backup alle 24 Stunden
- Aufbewahrung 30 Tage
- Backup-Verzeichnis `./backups`
- PostgreSQL Custom Format (`.dump`)
- Prüfung jedes Archivs mit `pg_restore --list`
- SHA-256-Prüfsumme zu jedem Backup

Die Werte können in `.env` angepasst werden:

```env
BACKUP_DIR=./backups
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=30
```

Beim Start des Backup-Containers wird sofort ein Backup erzeugt. Danach
läuft die Sicherung im konfigurierten Intervall.

Manuelles Backup:

```bash
docker compose exec backup /scripts/backup.sh once
```

Ein erfolgreiches Backup besteht aus zwei Dateien:

```text
drivechronik-20260901T120000Z.dump
drivechronik-20260901T120000Z.dump.sha256
```

Das Backup enthält die komplette DriveChronik-Datenbank. Das
Backup-Verzeichnis sollte daher vor unbefugtem Zugriff geschützt und
idealerweise zusätzlich auf ein anderes Speichermedium gesichert werden.

#### Restore

Ein Restore ist bewusst kein automatischer Vorgang.

Zuerst die schreibenden DriveChronik-Dienste und den Backup-Dienst stoppen:

```bash
docker compose stop backup web worker
```

Dann das gewünschte Backup ausdrücklich zur Wiederherstellung freigeben:

```bash
docker compose run --rm --no-deps \
  -e RESTORE_CONFIRM=RESTORE_DRIVECHRONIK \
  backup /scripts/restore.sh drivechronik-YYYYMMDDTHHMMSSZ.dump
```

Standardmäßig muss die zugehörige SHA-256-Prüfsummendatei vorhanden sein.
Fehlt sie, wird der Restore abgebrochen. Nur wenn ein nicht verifiziertes
Backup ausdrücklich wiederhergestellt werden soll, kann dies bewusst
übersteuert werden:

```bash
docker compose run --rm --no-deps \
  -e RESTORE_CONFIRM=RESTORE_DRIVECHRONIK \
  -e RESTORE_ALLOW_MISSING_CHECKSUM=1 \
  backup /scripts/restore.sh drivechronik-YYYYMMDDTHHMMSSZ.dump
```

Vor der eigentlichen Wiederherstellung erzeugt DriveChronik automatisch
noch ein Sicherheitsbackup des aktuellen Datenbankstands. Anschließend
wird die DriveChronik-Datenbank neu angelegt und das gewählte Archiv
eingespielt.

Danach die Migrationen des aktuell installierten DriveChronik-Stands
anwenden und die Dienste wieder starten:

```bash
docker compose run --rm migrate
docker compose up -d backup web worker
```

Die TeslaMate-Datenbank wird bei Backup und Restore nicht verändert.


### Historie importieren (Tessie)

Wer vorher Tessie genutzt hat, kann den Rohdaten-Export (CSV-Zeitreihen) importieren — DriveChronik rekonstruiert daraus Fahrten, Park- und Ladesessions:

```bash
docker compose run --rm -v /pfad/zum/tessie-export:/import:ro worker \
  node dist/cli.js import-tessie /import
```

Idempotent (mehrfacher Lauf unschädlich), kollidiert nicht mit TeslaMate-Daten.

## Grenzen (ehrlich)

- **Braucht TeslaMate** als Datenquelle — DriveChronik spricht nicht selbst mit der Tesla-API und weckt dein Auto nie
- **Ein Fahrzeug** pro Instanz im Fokus
- **Zahlenformatierung** aktuell durchgehend de-DE (Dezimalkomma), auch in der englischen UI
- **Routenplaner** ist experimentell — automatische Tesla-Supercharger-Planung ist vorhanden, die Ladezeit wird derzeit noch konservativ geschätzt; Standard-Routing über den öffentlichen OSRM-Demo-Server
- **Kein steuerrechtliches Gutachten**: Exporte sind fahrtenbuch-artig mit Audit-Log, aber die Anerkennung beim Finanzamt ist einzelfallabhängig

## Mitmachen & Sicherheit

- Beiträge: [CONTRIBUTING.md](CONTRIBUTING.md) · Issues gerne auf Deutsch oder Englisch
- Sicherheitslücken bitte privat melden: [SECURITY.md](SECURITY.md)
- Änderungen: [CHANGELOG.md](CHANGELOG.md)

## Lizenz

[AGPL-3.0](LICENSE) © 2026 Jan Schultheiss
