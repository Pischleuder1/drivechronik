# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.1] - 2026-09-25

### Added

- Added a Raspberry Pi appliance updater (`drivechronik-update`) with automatic DriveChronik database backup, image update, database migration and service health checks.
- Added support for updating an existing Raspberry Pi appliance installation without reflashing the SD card.
- Added multi-vehicle support with a persistent global active-vehicle selector used across dashboard, charging, planner, search, calendar, vehicle analytics, Insights and reports.
- Added vehicle-scoped journeys so each journey belongs to exactly one vehicle and only matching drives, charging sessions and parking periods can be assigned.
- Expanded the self-contained demo with a second synthetic vehicle and distinct driving, charging and timeline data for multi-vehicle testing.

### Changed

- Refined dashboard tire-pressure warnings: only the lower-pressure tire is highlighted when it differs by at least 0.2 bar from the tire on the same axle.
- Day, month and year views, reports and exports now consistently use the globally selected vehicle instead of page-local vehicle selectors.
- Journey CSV, PDF and GPX exports now use the journey's owning vehicle independently of the currently selected UI vehicle.
- Existing journeys are migrated to explicit vehicle ownership when their vehicle can be determined unambiguously. Single-vehicle installations are backfilled automatically; ambiguous or empty legacy journeys in an existing multi-vehicle installation must be resolved before the migration can complete.



### Fixed

- Fixed report driver identity in multi-vehicle installations: driver names are now stored and resolved per vehicle, with the previous global driver name retained as a compatibility fallback for existing installations.
- Fixed sealed monthly PDF reports dropping the vehicle model while parsing an otherwise valid immutable month snapshot.

## [0.5.0] - 2026-09-24

### Added

- Added a GPS-based route heatmap to Insights with 30-day, current-year and all-time ranges plus business, private and other classification filters.
- Added normalized, direction-independent route-segment aggregation with usage-based heat coloring and a summary of the most frequently driven routes.

- Added historical TPMS synchronization from TeslaMate vehicle metrics.

- Added 30- and 90-day tire-pressure history with individual tire charts, peer-median reference lines and a combined overview.

- Added cautious slow tire-pressure loss detection based on each tire's relative trend versus the other tires.

- Added consumption anomaly detection that compares each drive with similar historical drives using distance class, temperature and average speed, with the median as a robust reference.

- Added a 30-day vehicle sleep and status timeline based on historical TeslaMate states, combined with driving and charging periods.
- Added sleep share, recorded-state coverage and daily vehicle-status visualization for asleep, online, offline, driving and charging states.
- Added persistent synchronization of historical TeslaMate vehicle states with incremental updates for open and later-completed state periods.
- Expanded the self-contained demo with 30 days of synthetic TeslaMate vehicle-state history.

### Changed

- Reworked mobile navigation with a five-item bottom bar and a full navigation hub for vehicle, planner, calendar, journeys, places, reports, insights and settings.
- Improved the synthetic demo GPS data with shared offline route corridors so repeated trips visibly reuse common route sections instead of forming independent straight-line spokes.

- Refined the vehicle view with more compact driving, charging, long-term trend and software sections.

- Expanded the synthetic demo with a controlled gradual rear-left tire-pressure loss for TPMS trend validation.

- Improved synthetic demo drive consumption by preserving continuous SoC for rated-range calculation, avoiding artificial whole-percentage consumption jumps.

## [0.4.6] - 2026-09-23

### Added

- Added a unified Insights view with tabs for analysis and yearly review.
- Added yearly destination filtering for all trips, business trips and customer visits.

### Changed

- Redesigned monthly and yearly reports with a more compact layout and clearer KPI presentation.
- Added private and all-trip scopes to annual reporting while keeping mileage reimbursement limited to business distance.
- Redesigned the yearly Insights overview with compact KPI cards, monthly category visualization and a consolidated usage-by-category summary.
- Moved the yearly monthly-distance chart and category breakdown to the top of the yearly review.
- Integrated the former separate yearly Insights page into the main Insights area while preserving legacy links through a redirect.


## [0.4.5] - 2026-09-22

### Added

- Added live local time and current weather to the dashboard welcome header.
- Added current-week charts for daily driving distance and distance-weighted energy consumption.
- Added a color-coded overview of the five most recent drive routes with numbered route markers and start/destination indicators.

### Changed

- Redesigned the start dashboard with a more compact vehicle-focused layout.
- Replaced the dashboard quick-access panel with key metrics for today, this week, the latest charge and unclassified drives.
- Integrated the vehicle odometer directly into the vehicle status card.
- Refined the recent-drives overview with separate list and map cards and clearer route identification.

## [0.4.4] - 2026-09-20

### Changed

- Renamed the main navigation entry “More” to “Settings” and replaced the ellipsis icon with a settings icon.
- Redesigned the Settings navigation with grouped cards, descriptive icons, supporting text and color-coded section headers.
- Integrated auto-classification rules into the main Settings navigation.
- Updated German and English Settings navigation labels and related documentation.


## [0.4.3] - 2026-09-19

### Added

- Added a DC charging-curve comparison to the charging overview for the last 5 or 10 completed DC charging sessions.
- Added an interpolated median charging curve while preserving the actual recorded SoC range of each TeslaMate charging session.
- Added an optional `docker-compose.teslamate.yml` override for installations where TeslaMate runs on the same Docker host.
- Added `docker-compose.build.yml` for developers who want to build DriveChronik locally from source.

### Changed

- Moved the DC charging analysis and Tesla invoice actions into the charging overview month toolbar.
- The DC charging-curve comparison is intentionally independent of the selected month so recent DC sessions remain comparable across month boundaries.
- Simplified the standard production deployment to use the published GHCR images directly.
- Simplified installation and updates to the normal `docker compose pull` and `docker compose up -d` workflow.
- Made the default Compose stack independent of a pre-existing `teslamate_default` Docker network.

### Removed

- Removed the obsolete `docker-compose.release.yml` override.

## [0.4.2] - 2026-09-17

### Added

- Added a `VehicleDataSource` abstraction for vehicle-data providers.
- Added the TeslaMate data-source adapter behind the new abstraction.
- Added tests for TeslaMate data-source behavior and compatibility.

### Changed

- Decoupled worker synchronization from direct TeslaMate query/client access.
- Added worker lint, test and build checks to CI.

### Removed

- Removed an obsolete release-image workflow superseded by the current Docker image pipeline.

## [0.4.1] - 2026-09-16

### Added

- Expanded the self-contained demo to roughly one year of deterministic synthetic Model Y data with around 430 drives, 18,000 km, 120 charging sessions and 18 places, including business, private, commute and intentionally unclassified drives.
- Added demo bootstrap data for synthetic places and automatic classification rules used by the local and Synology demo stacks.

- Added route-planner PDF export for the current calculated route, including route summary, charging stops, ferry passages and a captured OpenStreetMap overview with schematic fallback.

- Added a vehicle usage overview with day, month, year and all-time filters, previous/next period navigation and combined driving and charging KPIs including distance, drive time, consumed energy, average consumption, charging sessions, DC sessions, charged energy, charging time and charging costs.

- Vehicle view now shows the stored Tesla model, license plate and VIN in a dedicated vehicle-details section.
- Expanded place types with site/branch, supplier, hotel and parking while keeping the existing home, work, customer, charger and other categories.

- TRONITY XLSX charging import with vehicle selection, preview, duplicate-safe matching and merging into existing charging sessions while protecting manual costs, notes and locked place assignments.
- Import history with safe rollback support for TRONITY and Tesla charging-history imports, including rollback preview, conflict protection for later manual changes, partial rollback handling, transaction locking and tamper-evident audit logging.
- Complete portable data export as a ZIP archive with JSON and CSV representations of DriveChronik application data, table metadata, row counts and SHA-256 checksums while excluding authentication, session, secret and temporary runtime data.

- Route planner handoff for Tesla without the Fleet API, including ordered manual and charging stops, Tesla handoff mode, automatic route splitting at a maximum of 9 intermediate points per handoff, Google Maps multi-stop routes, QR-code transfer to smartphones, route sharing/copying and visible success feedback.
- Improved route planner input layout with repositioned waypoint creation, clearer waypoint action styling, card-based start/destination selection and compact cards for SoC, outside temperature and battery capacity.

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

- Updated the demo to use Europe/Berlin, a more realistic cumulative parked-energy drain and locally generated synthetic GPS routes; removed the obsolete static demoRoutes fixture.

- Refined route-planner result presentation with more compact KPI values, a complete three-column summary grid and the PDF export action alongside the range-check action.

- Added contextual SVG artwork to Dashboard, Fahrten, yearly Wrapped and destination heatmap headers.

- Renamed remaining internal TripAtlas identifiers to DriveChronik across PostgreSQL, Docker images and volumes, container users, session cookie, demo/dev configuration, backup defaults, release workflow and documentation.
- Refined sidebar branding and navigation spacing.

- Yearly Insights now show business distance, configurable kilometre reimbursement, reimbursement amount and average distance per drive.
- Route planning preserves the selected route while charging stops are calculated and displays calculation progress.
- Dashboard overview modernized with vehicle metadata, localized vehicle label and dynamic vehicle artwork.

- Modernized the application UI across Insights, reports, journeys, calendar, planner, charging, places, rules, search, settings, tags and vehicle views using shared page headers, panels, metric cards, section headers and status badges.
- Modernized the data import page and import history using the shared PageHeader, Panel and StatusBadge components without changing import or rollback behavior.

- Yearly reports can now switch between business drives and all drives while preserving the selected scope across year navigation and CSV/PDF exports; kilometre reimbursement continues to use business distance only.

- Standardized vehicle identity across report PDFs with driver name, vehicle name, normalized Tesla model (`Tesla 3` / `Tesla Y`) and license plate; monthly and sealed-month PDFs continue to include the VIN.
- New monthly seal snapshots also preserve the vehicle model while remaining compatible with older revisions that do not contain this field.
- Yearly PDF reports now include the actual vehicle model and license plate when available.

- Refined Insights with more compact metric presentation, clearer panel styling and a dedicated annual-report action.

- Moved page-level actions out of decorative page headers across Insights, charging, places and journeys for a more consistent layout.

- Standardized compact metric typography in charging analysis, Tesla invoice statistics and journey details.

- Replaced the generic vehicle header drawing with a dedicated transparent Tesla-style vehicle illustration.

### Fixed

- Fixed route-planner charging plans being incorrectly marked incomplete when floating-point rounding placed the calculated destination SoC fractionally below the configured target reserve.

- Improved charging-stop handling on ferry routes.

- Prevented route-planner delays and hangs when the Bundesnetzagentur charging-station feed times out or its data stream fails; provider refreshes now run non-blocking without preventing other charging providers from returning results.

## [0.4.0] - 2026-09-08

### Added
- Vehicle driving profiles for future completed drives, with explicit application to unclassified history and guarded undo.

### Changed
- Paper & Ink application styling, a clearer overview and faster drive classification.
- Continuous, distance-based journey and day recaps with shorter sections for short trips and distinct charging-stop cards.
- Locale-aware numeric and ongoing-session formatting on overview, day and drive views.

### Fixed
- Clearing a manual charging price immediately restores the available place tariff and updates the form.
- Rapid recap chapter selection retains every keyboard step.

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

## [0.2.0] - 2026-08-27

### Added

- A mobile "More" hub keeps the five-item bottom navigation focused while
  exposing planning, analysis and configuration capabilities by intent.
- Saved roadtrip plans now show a leg-by-leg plan-versus-actual comparison and
  can refresh newly synchronized Journey items on demand.
- Explicit charging checkpoints support target SoC values and estimated charge
  times derived from the vehicle's own DC charging history.

### Fixed

- Vehicle-dependent pages now explain how to finish setup instead of showing an
  incorrect not-found state on fresh installations.

### Changed

- Start new `0.2.x` versions under FSL-1.1-ALv2. Previously published releases
  and branch commits remain available under AGPL-3.0 for copies received under
  those terms.
- Clarify separate terms for the marketing site, brand assets and external
  contributions.

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
