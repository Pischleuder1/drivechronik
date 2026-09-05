# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
