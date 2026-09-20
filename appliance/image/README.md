# DriveChronik Raspberry Pi Appliance Image

Target:

- Raspberry Pi 4
- arm64
- SD card
- Debian/Raspberry Pi OS Trixie base
- rpi-image-gen v2.8.0

Appliance:

- DriveChronik v0.4.4
- TeslaMate 4.2.0
- Docker Compose
- Hostname: drivechronik
- mDNS: drivechronik.local
- DriveChronik port: 3000
- TeslaMate port: 4000

## First setup

DriveChronik:

- Open `http://drivechronik.local:3000`
- Username: `admin`
- On the first visit, choose your own administrator password.

TeslaMate:

- Open `http://drivechronik.local:4000`
- TeslaMate requires an Access Token and a Refresh Token.
- The initial tokens are generated outside TeslaMate.
- Official token instructions: https://docs.teslamate.org/docs/installation/tokens/

Linux / SSH:

- Username: `drive`
- Initial password: `drivechronik`
- The Linux password must be changed at the first login.
- SSH: `ssh drive@drivechronik.local`
