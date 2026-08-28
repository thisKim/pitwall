# FH6 Telemetry Dashboard

React dashboard for Forza Horizon 6 "Data Out" UDP telemetry.
Fields are user-selectable and persist in `localStorage`, with a sensible default set.

## Run

```bash
npm install
npm run dev          # UDP listener + WebSocket bridge (:8787) and Vite client (:5173)
npm run simulate     # optional: synthetic telemetry so you can develop without the game
```

## Configure the game

`SETTINGS > HUD AND GAMEPLAY`:

- **Data Out**: On
- **Data Out IP Address**: IP of the machine running this app (`127.0.0.1` if same PC)
- **Data Out IP Port**: `5400` (avoid 5200–5300)

Data is only sent while actively driving — not in menus, pauses, replays, or rewinds.

## Environment

| Variable        | Default   | Purpose                      |
| --------------- | --------- | ---------------------------- |
| `FH_UDP_PORT`   | `5400`    | UDP listen port              |
| `FH_UDP_HOST`   | `0.0.0.0` | UDP bind address             |
| `FH_WS_PORT`    | `8787`    | WebSocket port for the client |
| `FH_SEND_HZ`    | `30`      | Browser update rate          |
| `VITE_WS_URL`   | —         | Override the client's WS URL |

## Packet format

Fixed 324-byte layout decoded in [server/packet.js](server/packet.js). FH6-specific fields
`CarGroup`, `SmashableVelDiff`, and `SmashableMass` sit between `NumCylinders` and `PositionX`;
`TireWear` and `TrackOrdinal` from Forza Motorsport's Dash format are not present.
The final byte is trailing padding.
