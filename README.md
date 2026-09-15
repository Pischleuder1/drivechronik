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
- **Orte** — Geofences mit Karten-Picker und Adresssuche (OSM/Nominatim); Ortstypen für Zuhause, Arbeit, Kunde, Werk/Niederlassung, Lieferant, Hotel, Lader, Parkplatz und Sonstiges; manuelle Korrekturen mit Lock, die jeden Re-Sync überleben
- **Kalender, Suche, Reports** — Monatsgrid mit Fahrt-Intensität; Volltextsuche über Orte/Kunden/Projekte/Tags mit Filtern; Monats- und Jahresreports mit CSV-/PDF-Export (Fahrtenbuch-Stil). PDF-Auswertungen weisen Fahrer, Fahrzeug, Tesla-Modell und Kennzeichen einheitlich aus; Monatsberichte enthalten zusätzlich die VIN. Jahresreports können wahlweise nur Dienstfahrten oder alle Fahrten berücksichtigen.
- **Monatsabschluss & Revisionshistorie** — vergangene Monate können nach Vollständigkeitsprüfung abgeschlossen werden. Jeder Abschluss erhält eine Revision mit unveränderlichem Snapshot, Fahrer-/Fahrzeugidentität sowie Content-, Seal- und Audit-Hash. Neue Snapshots sichern zusätzlich das Fahrzeugmodell; ältere Revisionen ohne dieses Feld bleiben unverändert und kompatibel. Neue Revisionen werden mit Ed25519 digital signiert; Signaturstatus und Schlüssel-ID werden im Abschlussbericht ausgewiesen. Ein portabler Proof-JSON-Export kann unabhängig mit dem mitgelieferten Offline-Verifier geprüft werden. Spätere Änderungen bleiben erlaubt und führen beim erneuten Abschluss zu einer neuen Revision.

**Fahrt- & Lade-Analytics**
- **Fahrt-Detail** — Route auf der Karte, kombinierter Verlaufs-Chart (Höhe/SoC/Tempo), Temperaturen, Max-Speed/-Leistung/Rekuperation, historisches Wetter zur Fahrtzeit, GPX-Export
  - Bei echten Fahrten basiert die dargestellte Route auf den von TeslaMate aufgezeichneten GPS-/Positionsdaten. OSRM rekonstruiert keine aufgezeichneten Fahrten.
- **Ladeübersicht** — Ladekurve (kW über SoC), AC/DC, Kosten, Standort-Karte
- **Automatische Ladekosten** — Strompreis pro Ort hinterlegen (z. B. Zuhause 0,32 €/kWh) → Sessions ohne bekannten Preis werden automatisch berechnet, manuelle und gesyncte Kosten bleiben unangetastet
- **Journeys** — Urlaube/Reisen als Klammer über Fahrten + Ladestopps mit Kennzahlen-Dashboard, Karte aller Etappen und Export als CSV, PDF und GPX
- **Insights** — persönliche Verbrauchskurve: Verbrauch vs. Außentemperatur und Tempo, Saisonmuster und Kurzstrecken-Anteil; zusätzlich eine Jahresübersicht („Wrapped“) mit Gesamtkilometern, Fahrten, Fahrzeit, Klassifizierungsquote, längster Fahrt, stärkstem Monat/Tag und Top-Ziel
- **Ziel- & Kundenanalyse** — Top-Ziele mit Besuchen, Kilometern, letzter Anfahrt und Aufteilung nach geschäftlich / privat / Arbeitsweg; Filter für alle Ziele, geschäftliche Ziele und Kunden sowie eine Ziel-Heatmap. Kundenkennzahlen zeigen Gesamtbesuche, unterschiedliche Kunden, meistbesuchten Kunden und geschäftliche Kundenkilometer
- **Jahresanalyse & Abrechnung** — Monatsverlauf nach geschäftlich / privat / Arbeitsweg / unklassifiziert, geschäftliche Jahreskilometer, konfigurierbare Kilometererstattung sowie direkter Jahresbericht mit CSV-/PDF-Export. Der Jahresbericht kann zwischen „Dienstfahrten“ und „Alle Fahrten“ umgeschaltet werden; die Kilometererstattung wird auch in der Gesamtansicht ausschließlich aus geschäftlichen Kilometern berechnet. PDF-Berichte enthalten Fahrername, Fahrzeugname, normalisierte Modellbezeichnung (`Tesla 3` / `Tesla Y`) und Kennzeichen.
- **Standzeit-Analytics** — Vampir-Verlust pro Parkvorgang, Standzeiten pro Ort
- **Routenplaner (experimentell)** — Reichweiten-Check mit echter Route (OSRM), Höhenprofil und deinem persönlichen Verbrauchsprofil aus der eigenen Historie; automatische Ladeplanung mit Tesla-Superchargern und öffentlichen HPC-Ladern entlang der Route, mehreren Ladestopps, Ankunfts-SoC, Ladeziel und geschätzter Ladezeit; alternative Routen und fährenbewusste Streckenführung einschließlich Sassnitz–Rønne; alle Annahmen offengelegt
- **Routenübergabe ohne Tesla Fleet API** — geplante Zwischen- und Ladestopps können als Google-Maps-Mehrzielroute geteilt oder per QR-Code auf ein Smartphone übertragen werden; zusätzlich steht eine Tesla-Übergabe der Ziele zur Verfügung. Längere Google-Maps-Routen werden automatisch in Teilrouten aufgeteilt.

**Cockpit & Fahrzeug**
- **Start-Dashboard** — SoC + Reichweite, Standort, Status, Wetter, Reifendruck mit Warnung und letzte Fahrten als Karte + Liste; zusätzlich Fahrzeugmetadaten, lokalisierte Modellbezeichnung und dynamische Fahrzeugdarstellung
- **Fahrzeug-Analytics** — Fahrzeugdaten mit Modell, Kennzeichen und VIN; zusätzlich eine filterbare Nutzungsübersicht für Tag, Monat, Jahr oder Gesamtzeitraum mit Fahrten, Kilometern, Fahrzeit, Energieverbrauch, Durchschnittsverbrauch sowie Ladeanzahl, DC-Ladungen, geladener Energie, Ladezeit und Ladekosten. Ergänzt um geschätzten Batteriezustand und Degradation, prognostizierte 100-%-Reichweite, Kilometerstand, Ladeeffizienz, Vampir-Verlust und Software-/Update-Historie
- **Reale Fahrzeugdaten** — Auswertungen basieren auf TeslaMate-Historie und vorhandenen Fahrzeugwerten; Schätzwerte und Fallbacks werden entsprechend gekennzeichnet
- **Verbindungs-Diagnose** — Sync-Gesundheit pro Datenquelle auf einen Blick, optionaler TeslaMate-Direkttest

**Oberfläche**
- **Deutsch & Englisch** — umschaltbar im UI (Standard Deutsch)
- **Dark Mode** — Hell/Dunkel/System-Switcher, ohne Flackern
- **Mobile-first** — als PWA installierbar, 16px-Formularfelder (kein iOS-Zoom), Safe-Area-aware Bottom-Navigation

**Daten**
- **Datenhoheit** — eigene PostgreSQL-DB, quellen-agnostisches Schema (`source`/`source_id`), Annotationen überleben strukturell jeden Re-Sync
- **Tessie-Import** — rekonstruiert Fahrten und Ladevorgänge aus einem Tessie-Rohdaten-Export; vorhandene TeslaMate-Zeiträume werden geschützt
- **Tesla-Ladehistorie** — CSV-Import mit Vorschau, automatischer Zuordnung zu vorhandenen Ladevorgängen und dublettensicheren Aktualisierungen
- **TRONITY-Ladeimport** — XLSX-Import mit Fahrzeugauswahl und Vorschau; vorhandene TeslaMate-/Tessie-Ladungen werden erkannt und sicher ergänzt, während manuelle Kosten, Notizen und gelockte Orte geschützt bleiben
- **Import-Historie & sicherer Rollback** — protokollierte TRONITY- und Tesla-Ladehistorienimporte können vor dem Zurücksetzen geprüft und anschließend gezielt rückgängig gemacht werden. Spätere manuelle Änderungen werden erkannt und bleiben geschützt; vollständige und teilweise Rollbacks werden nachvollziehbar protokolliert.
- **Vollständiger Datenexport** — portables ZIP-Archiv aller fachlichen DriveChronik-Daten als JSON und CSV. Ein Manifest dokumentiert Tabellenstruktur, Datensatzanzahlen und SHA-256-Prüfsummen. Passwort-Hashes, Sessions, Secrets, technische Synchronisationszustände und temporäre Import-Jobs werden bewusst nicht exportiert.
- **Energie ehrlich** — echte Zählerwerte wo verfügbar, sonst gekennzeichnete Schätzung; Effizienz-Fallback in den Settings, bis TeslaMate den Fahrzeugwert gelernt hat

## Hinweis zu Fahrtenbuch und Abrechnung

DriveChronik unterstützt die Dokumentation, Klassifizierung und den Export von Fahrten. Das Projekt erhebt jedoch keinen Anspruch auf eine behördliche, steuerliche oder rechtliche Zertifizierung als elektronisches Fahrtenbuch.

Ob ein erzeugter Nachweis für steuerliche Zwecke, gegenüber einem Arbeitgeber oder einer anderen Stelle ausreicht, hängt vom jeweiligen Anwendungsfall und den geltenden Anforderungen ab.

## Demo ohne Auto

Kein Tesla, kein TeslaMate? Der Demo-Stack startet eine komplett gefüllte App mit rund zwölf Monaten synthetischer Fahr-, Lade- und Ortsdaten:

```bash
docker compose -f docker-compose.demo.yml up -d --build
# → http://localhost:3000, Login: demo1234
```

Details: [docs/demo.md](docs/demo.md)

## Stack

pnpm-Monorepo: Next.js 15 (`apps/web`) · Sync-Worker (`apps/worker`) · Drizzle-Schema (`packages/db`) · pure Domain-Logik (`packages/core`) · PostgreSQL 17 · Docker Compose · eingebetteter SuperchargeCompass-Dienst für Supercharger-Daten.

## Entwicklung

Ohne echtes Auto — eine Fixture-TeslaMate-DB mit rund zwölf Monaten synthetischer Fahrdaten liegt bei:

```bash
pnpm install
pnpm dev:db                                # drivechronik-db :5432 + fixture teslamate-db :5433
pnpm db:seed:teslamate                     # ~430 Fahrten, ~18.000 km, Laden und Geofences (Deutschland)
DATABASE_URL=postgres://drivechronik:drivechronik@localhost:5432/drivechronik pnpm db:migrate
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
CREATE ROLE drivechronik_ro WITH LOGIN PASSWORD 'ein-sicheres-passwort';
GRANT CONNECT ON DATABASE teslamate TO drivechronik_ro;
GRANT USAGE ON SCHEMA public TO drivechronik_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO drivechronik_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO drivechronik_ro;
```

### 2. `.env` einrichten

```bash
cp .env.example .env
```

Mindestens setzen:

- `POSTGRES_PASSWORD` — Passwort für die neue DriveChronik-eigene PostgreSQL-Datenbank (Pflicht, kein Default)
- `TESLAMATE_DATABASE_URL` — Connection-String der `drivechronik_ro`-Rolle zur bestehenden TeslaMate-Datenbank
- optional `WEB_PORT` (Default `3000`), `APP_TIMEZONE`, `SYNC_INTERVAL_SECONDS`, `OSRM_URL`

Beispiel: `TESLAMATE_DATABASE_URL=postgres://drivechronik_ro:read-only-passwort@192.168.1.50:5432/teslamate`

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

`TESLAMATE_DATABASE_URL=postgres://drivechronik_ro:read-only-passwort@database:5432/teslamate`

### 3. Signaturschlüssel für Monatsabschlüsse

Neue Monatsabschluss-Revisionen benötigen einen lokalen Ed25519-Schlüssel. Der private Schlüssel bleibt ausschließlich auf dem DriveChronik-Host und darf nicht in Git eingecheckt werden.

Erzeugen:

`mkdir -p secrets && openssl genpkey -algorithm Ed25519 -out secrets/month-seal-ed25519-private.pem`

Danach die Datei nur für den vorgesehenen Container-Benutzer lesbar machen. Der Compose-Stack bindet den Schlüssel read-only als `/run/secrets/month-seal-ed25519-private.pem` ausschließlich in den Web-Container ein.

Vorhandene ältere, noch unsignierte Revisionen bleiben lesbar und exportierbar.

### 4. Stack starten

```bash
docker compose up -d --build
```

Das baut `apps/web`, `apps/worker` und den eingebetteten `supercharge-compass`-Dienst, lässt den `migrate`-Service einmalig die Drizzle-Migrationen einspielen (`restart: "no"`, muss erfolgreich durchlaufen) und startet dann `db`, `web`, `worker`, `supercharge-compass` und den automatischen `backup`-Service dauerhaft (`restart: unless-stopped`).

`supercharge-compass` stellt DriveChronik die Tesla-Supercharger-Standorte für die automatische Ladestopp-Planung bereit. Der Dienst ist nur im internen Docker-Netz erreichbar und veröffentlicht keinen zusätzlichen Port. Beim ersten Start wird der Supercharger-Datensatz automatisch geladen und anschließend täglich aktualisiert. Die Daten werden im Docker-Volume `supercharge-compass-data` persistent gespeichert. Für diese Nutzung ist kein OpenRouteService-API-Key erforderlich; die eigentliche Routenberechnung übernimmt weiterhin der von DriveChronik konfigurierte OSRM-Dienst.

### 5. Erstanmeldung

Beim ersten Start wird ein Admin-Account bootstrapped. Optional vorab ein Passwort über `INITIAL_ADMIN_PASSWORD` in `.env` setzen — sonst wird beim ersten Login-Flow eines gesetzt (mit Passwort-Wiederholung).

Für vollständige Monats- und Fahrtenbuchberichte sollten anschließend in den Einstellungen der Fahrername und beim Fahrzeug das Kennzeichen gepflegt werden. Modell und VIN werden aus den vorhandenen Fahrzeugdaten übernommen. Fahrername, Kennzeichen, Fahrzeugname, Modell und VIN werden bei neuen Monatsabschlüssen in der jeweiligen Revision historisch mitgesichert; ältere Revisionen bleiben unverändert.

`INITIAL_ADMIN_PASSWORD` wird ausschließlich verwendet, solange noch kein Benutzer existiert. Nach erfolgreicher Erstanmeldung sollte der Wert aus `.env` entfernt und der Web-Container neu gestartet werden, damit das Initialpasswort nicht dauerhaft in der Container-Umgebung verbleibt.

### 6. HTTPS / Fernzugriff

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

`db`, `web`, `worker` und `supercharge-compass` sollten laufen bzw. `healthy` sein. Der `migrate`-Service muss nach erfolgreicher Migration mit `Exited (0)` beendet sein.

### Monatsberichte und Monatsabschluss

DriveChronik unterscheidet zwischen zwei Berichtstypen:

- **Normaler Monatsreport** — aktueller, filterbarer Bericht mit CSV-/PDF-Export und optionaler Kilometererstattung für geschäftliche Fahrten.
- **Abgeschlossener Monatsbericht** — historisch reproduzierbare Revision mit allen Fahrten des Monats, Fahrer- und Fahrzeugidentität einschließlich Fahrzeugmodell sowie Integritätsnachweis über Content-, Seal- und Audit-Hash. Neue Revisionen werden mit Ed25519 digital signiert. Der PDF-Bericht zeigt Fahrer, Fahrzeug, Modell, Kennzeichen und VIN sowie Signaturstatus und Schlüssel-ID; zusätzlich kann ein Proof-JSON mit Snapshot, Hashes, Signatur und öffentlichem Schlüssel exportiert werden. Änderungen nach einem Abschluss bleiben möglich, werden nachvollziehbar protokolliert und können durch einen neuen Abschluss als nächste Revision festgehalten werden.

Der Proof kann unabhängig von Webserver und Datenbank mit `node scripts/verify-month-seal-proof.mjs <proof.json>` geprüft werden. Der Verifier berechnet Content-Hash und Seal-Hash neu, prüft die Schlüssel-ID und validiert die Ed25519-Signatur. Der enthaltene Audit-Hash ist Bestandteil des signierten Seal-Payloads; die vollständige Audit-Kette wird durch diesen portablen Proof allein nicht erneut berechnet.

Der Abschluss ist ein manipulationserschwerender und nachvollziehbarer Anwendungsmechanismus, keine behördliche Zertifizierung oder Garantie einer steuerlichen Anerkennung.

### Backup & Restore

Der vollständige Datenexport unter **Mehr → Datenexport** ist eine portable,
menschenlesbare Sicherung der fachlichen DriveChronik-Daten in JSON und CSV.
Für eine vollständige 1:1-Wiederherstellung der Anwendung bleibt das
PostgreSQL-Backup im Custom-Format (`.dump`) der maßgebliche Sicherungsweg.

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


### Historische Daten importieren

Unter **Mehr → Datenimport** stehen mehrere Importwege für vorhandene historische Lade- und Fahrdaten zur Verfügung.

**Tesla-Ladehistorie**

Der CSV-Export aus der Tesla-App kann zunächst geprüft und anschließend importiert werden. DriveChronik ordnet passende Einträge vorhandenen Ladevorgängen zu und führt Aktualisierungen dublettensicher aus.

**TRONITY-Ladungen**

TRONITY-Ladevorgänge können aus einem XLSX-Export mit dem Tabellenblatt `Ladungen` übernommen werden. Bei mehreren Fahrzeugen wird das Ziel-Fahrzeug ausgewählt; bei nur einem Fahrzeug erfolgt die Vorauswahl automatisch.

Vor dem Import zeigt DriveChronik eine Vorschau mit zugeordneten, neuen, zu ergänzenden, unveränderten und mehrdeutigen Ladevorgängen. Vorhandene TeslaMate- oder Tessie-Ladungen werden nicht dupliziert, sondern nur um fehlende TRONITY-Daten ergänzt.

**Import-Historie und Rückgängig-Funktion**

Ausgeführte TRONITY- und Tesla-Ladehistorienimporte werden unter **Mehr → Datenimport** in einer Import-Historie angezeigt. Vor einem Rollback prüft DriveChronik, welche Änderungen sicher zurückgenommen werden können. Nachträglich manuell geänderte Felder werden geschützt und als Konflikt ausgewiesen; bei TRONITY werden zusätzlich abhängige Ladepunkte, Tags und Tesla-Ladeverknüpfungen berücksichtigt. Ein Rollback kann deshalb vollständig oder teilweise erfolgen; das Ergebnis wird zusätzlich in der manipulationserschwerenden Audit-Kette protokolliert.

Die Rückgängig-Funktion gilt derzeit für TRONITY-Importe und die Tesla-Ladehistorie. Tessie-Importe werden noch nicht über diese Funktion zurückgesetzt.

Tatsächliche TRONITY-Kosten dürfen automatische Kostenschätzungen ersetzen. Manuelle Kosten, vorhandene Notizen und gelockte Ortszuordnungen bleiben geschützt. Mehrdeutige Treffer werden nicht automatisch verändert.

**Tessie**

Ein vorhandener Tessie-Rohdatenexport kann unter **Mehr → Datenimport** über den Web-Import übernommen werden. DriveChronik erwartet die vier Dateien des Tessie-Rohdatenexports, prüft sie vor dem Start und zeigt den Importfortschritt im Browser an.

Der Tessie-Import rekonstruiert Fahrten und Ladevorgänge und schützt bereits vorhandene TeslaMate-Zeiträume. Die Rückgängig-Funktion der Import-Historie gilt derzeit noch nicht für Tessie-Importe.

## Grenzen (ehrlich)

- **Braucht TeslaMate** als Datenquelle — DriveChronik spricht nicht selbst mit der Tesla-API und weckt dein Auto nie
- **Ein Fahrzeug** pro Instanz im Fokus
- **Zahlenformatierung** aktuell durchgehend de-DE (Dezimalkomma), auch in der englischen UI
- **Routenplaner** ist experimentell — automatische Ladeplanung mit Tesla-Superchargern und öffentlichen HPC-Ladern ist vorhanden, die Ladezeit wird derzeit noch konservativ geschätzt; Standard-Routing über den öffentlichen OSRM-Demo-Server
- **Kein steuerrechtliches Gutachten**: Exporte sind fahrtenbuch-artig mit Audit-Log, aber die Anerkennung beim Finanzamt ist einzelfallabhängig

## Mitmachen & Sicherheit

- Issues gerne auf Deutsch oder Englisch
- Sicherheitslücken bitte privat melden: [SECURITY.md](SECURITY.md)
- Änderungen: [CHANGELOG.md](CHANGELOG.md)

## Lizenz

[AGPL-3.0](LICENSE)

Basiert auf Tripatlas v0.1.1 © 2026 Jan Schultheiss.  
DriveChronik Weiterentwicklung © 2026 Pischleuder1.
