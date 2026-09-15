# DriveChronik Demo

Die Demo ermöglicht es, DriveChronik ohne Tesla und ohne bestehende
TeslaMate-Installation auszuprobieren.

Sie verwendet ausschließlich synthetische Testdaten und verändert keine
bestehende TeslaMate- oder DriveChronik-Installation.

## Demo-Datensatz

Der Demo-Stack erzeugt einen zusammenhängenden synthetischen Datensatz über
rund zwölf Monate.

Enthalten sind unter anderem:

- ein fiktives Tesla Model Y RWD
- rund 430 Fahrten mit rund 18.000 km
- geschäftliche Fahrten, Privatfahrten und Arbeitswege
- bewusst einige unklassifizierte Fahrten zum Ausprobieren
- rund 120 AC- und DC-Ladevorgänge
- 18 unterschiedliche Orte
- Kunden, Baustelle, Lieferant, Hotels, Schnelllader und Parkplätze
- saisonal variierende Temperaturen und Verbrauchswerte
- Software-Updates und Fahrzeugstatusdaten
- automatische Klassifizierungsregeln
- synthetische GPS-Routen für Karten und Fahrtdetails

Die Demo-Orte liegen in Deutschland. Alle Personen, Unternehmen,
Fahrzeugdaten und Fahrten sind fiktiv.

Beim Start werden zuerst die synthetischen TeslaMate-Daten erzeugt.
Anschließend legt der Demo-Bootstrap die DriveChronik-Orte und
Klassifizierungsregeln an. Danach übernimmt der normale DriveChronik-Worker
die Daten aus der Fixture-TeslaMate-Datenbank.

Damit werden in der Demo dieselben Sync-, Orts- und Regelmechanismen verwendet
wie im normalen Betrieb.

Die Anzeigezeitzone der Demo ist `Europe/Berlin`.

## Start

```bash
docker compose -f docker-compose.demo.yml up -d --build
```

Danach ist die Demo standardmäßig unter
[http://localhost:3000](http://localhost:3000) erreichbar.

Login-Passwort:

```text
demo1234
```

Bei einer echten DriveChronik-Installation stammen die gefahrenen Routen aus
den von TeslaMate aufgezeichneten GPS-/Positionsdaten. Die Demo erzeugt ihre
Routen dagegen vollständig lokal und benötigt beim Start keinen externen
Routing-Dienst.

## Demo stoppen

```bash
docker compose -f docker-compose.demo.yml down
```

Die Demo-Daten bleiben dabei in den Docker-Volumes erhalten.

## Demo vollständig zurücksetzen

```bash
docker compose -f docker-compose.demo.yml down -v
docker compose -f docker-compose.demo.yml up -d --build
```

`down -v` ist ausschließlich für den eigenständigen Demo-Stack gedacht.

Beim nächsten Start werden die synthetischen Daten vollständig neu erzeugt.
