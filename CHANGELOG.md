# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Route planner handoff for Tesla without the Fleet API, including system sharing, ordered manual and charging stops, Google Maps multi-stop routes and clipboard fallback.

- Installable Progressive Web App (PWA) with offline fallback for the application shell.
- Tesla Supercharger CSV import with preview, duplicate-safe updates and automatic matching to charging sessions.
- Tesla invoice overview with monthly filters, payment status, assignment status, totals and links to matched charging sessions.

- Expanded yearly Insights / Wrapped with annual distance, drive count, driving time, classification rate, longest drive, busiest month, busiest day and top destination.
- Destination analytics with visit counts, distance, last visit and filters for all, business and customer destinations.
- Customer analytics with total customer visits, number of different customers, most-visited customer and business distance to customer places.
- Monthly yearly-distance chart split into business, private, commute and unclassified driving.
- Direct access from yearly Insights to the yearly business report and PDF export.
- Public HPC charger support in the route planner, including additional charger coverage in the Netherlands.
- Ferry-aware Sassnitz–Rønne routing.

### Changed

- Renamed remaining internal TripAtlas identifiers to DriveChronik across PostgreSQL, Docker images and volumes, container users, session cookie, demo/dev configuration, backup defaults, release workflow and documentation.
- Refined sidebar branding and navigation spacing.

- Yearly Insights now show business distance, configurable kilometre reimbursement, reimbursement amount and average distance per drive.
- Route planning preserves the selected route while charging stops are calculated and displays calculation progress.
- Dashboard overview modernized with vehicle metadata, localized vehicle label and dynamic vehicle artwork.

- Modernized the application UI across Insights, reports, journeys, calendar, planner, charging, places, rules, search, settings, tags and vehicle views using shared page headers, panels, metric cards, section headers and status badges.

### Fixed

- Improved charging-stop handling on ferry routes.

- Prevented route-planner delays and hangs when the Bundesnetzagentur charging-station feed times out or its data stream fails; provider refreshes now run non-blocking without preventing other charging providers from returning results.

## [0.3.2] - 2026-09-05

### Added

- Ed25519 signatures for new monthly logbook seal revisions.
- Signature status and signing-key fingerprint in sealed monthly PDF reports and revision history.
- Portable JSON proof export for sealed monthly revisions.
- Offline month-seal proof verifier for Content-Hash, Seal-Hash, signing-key fingerprint and Ed25519 signature.
- Runtime private-key configuration with read-only web-container mounting.

### Security

- Monthly seal signatures bind the existing Seal-Hash cryptographically to an Ed25519 signing key.
- Historical public keys are stored with each signed revision so signatures remain verifiable after later key rotation.
- Private month-seal signing keys are excluded from Git and are not stored in the database, audit log or proof snapshot.

## [0.3.1] - 2026-09-05

### Added

- Application version display in Settings.

### Changed

- Updated production deployment comment to use the DriveChronik name.

### Security

- Verified production backup integrity and isolated restore procedure.
- Rotated the DriveChronik PostgreSQL password.
- Rotated the TeslaMate read-only database password used by DriveChronik.

## [0.3.0] - 2026-09-05

### Added

- Tamper-evident audit chain with hash-linked change history.
- Seven-day logbook completion status and late-completion detection.
- Monthly logbook sealing with immutable snapshots, revision history and integrity hashes.
- Driver name and vehicle license plate in monthly reports and sealed revisions.
- Reproducible sealed monthly PDF reports with integrity verification.
- Vehicle analytics including battery health, projected range, odometer, charging efficiency and software history.
- Suggestions for recurring routes and time-of-day rule conditions.
- Tessie web import workflow.
- Automatic Supercharger stop planning with self-hosted SuperchargeCompass.
- Route alternatives, multi-stop charging and ferry-aware route planning.

### Changed

- Improved monthly PDF pagination and report layout.
- Improved Insights chart readability and scatter-chart legends.
- Updated README documentation for monthly logbook sealing and revision history.
- Updated demo documentation to reflect current DriveChronik features.
- Removed the obsolete CONTRIBUTING.md reference.
- Clarified project copyright and attribution for the DriveChronik continuation.

## [0.1.1] - 2026-07-08

### Fixed

- Route planner: selecting a destination from the address search was
  immediately discarded, so "Check range" always asked to pick a destination.
  Selected addresses are now retained.

## [0.1.0] - 2026-07-08

### Added

- Trip archive with day view.
- Classification, tags, and audit log.
- Places with geofences and map picker.
- Calendar, search, and monthly reports with CSV/PDF export.
- Journeys with CSV/PDF/GPX export.
- Trip and charging analytics with maps, charging curves, and weather.
- Insights.
- Start dashboard.
- Tessie import.
- Automatic classification rules.
- Bulk editing.
- Automatic charging costs per place.
- Route planner (experimental).
- Dark mode.
- Mobile optimization.
- Internationalization in German and English.
