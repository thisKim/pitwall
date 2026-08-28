# Pitwall

Electron desktop app for Forza Horizon 6 "Data Out" UDP telemetry.
The main process listens for the game's UDP packets and streams decoded frames to a React UI.
Displayed fields are user-selectable, drag-reorderable, and persist in `localStorage`.

## Run

```bash
npm install
npm run dev          # Vite with HMR + Electron
npm start            # production build + Electron
npm run simulate     # optional: synthetic telemetry so you can work without the game
```

## Package

```bash
npm run package        # installer for the current platform
npm run package:win    # Windows NSIS + portable
npm run package:dir    # unpacked, for quick testing
```

Artifacts land in `release/`.

## Configure the game

`SETTINGS > HUD AND GAMEPLAY`:

- **Data Out**: On
- **Data Out IP Address**: IP of the machine running this app (`127.0.0.1` if same PC)
- **Data Out IP Port**: `5400` (avoid 5200–5300)

Both values can be changed from the app's listener settings without restarting.

Data is only sent while actively driving — not in menus, pauses, replays, or rewinds.

## Environment

| Variable      | Default   | Purpose          |
| ------------- | --------- | ---------------- |
| `FH_UDP_PORT` | `5400`    | UDP listen port  |
| `FH_UDP_HOST` | `0.0.0.0` | UDP bind address |

## Packet format

Fixed 324-byte layout decoded in [electron/packet.js](electron/packet.js). FH6-specific fields
`CarGroup`, `SmashableVelDiff`, and `SmashableMass` sit between `NumCylinders` and `PositionX`;
`TireWear` and `TrackOrdinal` from Forza Motorsport's Dash format are not present.
The final byte is trailing padding.
