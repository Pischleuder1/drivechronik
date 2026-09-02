# DriveChronik Demo

Die Demo ermöglicht es, DriveChronik ohne Tesla und ohne bestehende TeslaMate-Installation auszuprobieren.

Sie verwendet ausschließlich synthetische Testdaten.

## Start

```bash
docker compose -f docker-compose.demo.yml up -d --build
```

Danach ist die Demo standardmäßig unter http://localhost:3000 erreichbar.

Login-Passwort: demo1234

Bei einer echten DriveChronik-Installation stammen die gefahrenen Routen aus den von TeslaMate aufgezeichneten GPS-/Positionsdaten.

## Demo stoppen

```bash
docker compose -f docker-compose.demo.yml down
```

## Demo vollständig zurücksetzen

```bash
docker compose -f docker-compose.demo.yml down -v
docker compose -f docker-compose.demo.yml up -d --build
```

`down -v` ist ausschließlich für den Demo-Stack gedacht.
