// Sends synthetic FH6 Data Out packets to the listener so the dashboard can be
// developed without the game running.  Usage: npm run simulate
import dgram from 'node:dgram';
import { FIELDS, PACKET_SIZE } from './packet.js';

const PORT = Number(process.env.FH_UDP_PORT ?? 5400);
const HOST = process.env.FH_UDP_HOST ?? '127.0.0.1';

const socket = dgram.createSocket('udp4');
const buf = Buffer.alloc(PACKET_SIZE);
const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

const WRITERS = {
  f32: (o, v) => view.setFloat32(o, v, true),
  s32: (o, v) => view.setInt32(o, v | 0, true),
  u32: (o, v) => view.setUint32(o, v >>> 0, true),
  u16: (o, v) => view.setUint16(o, v & 0xffff, true),
  u8: (o, v) => view.setUint8(o, Math.max(0, Math.min(255, Math.round(v)))),
  s8: (o, v) => view.setInt8(o, Math.max(-127, Math.min(127, Math.round(v)))),
};

const OFFSETS = Object.fromEntries(FIELDS.map((f) => [f.name, f]));

function set(name, value) {
  const field = OFFSETS[name];
  WRITERS[field.type](field.offset, value);
}

const start = Date.now();
let distance = 0;
let lap = 1;
let lapStart = 0;
let bestLap = 0;
let lastLap = 0;

setInterval(() => {
  const t = (Date.now() - start) / 1000;
  const throttleWave = (Math.sin(t / 4) + 1) / 2;
  const speed = 10 + throttleWave * 70; // m/s
  const rpm = 1000 + throttleWave * 6500;
  const gear = Math.max(1, Math.min(8, Math.ceil(speed / 11)));
  distance += speed / 60;

  const raceTime = t;
  if (raceTime - lapStart > 45) {
    lastLap = raceTime - lapStart;
    bestLap = bestLap === 0 ? lastLap : Math.min(bestLap, lastLap);
    lapStart = raceTime;
    lap += 1;
  }

  set('IsRaceOn', 1);
  set('TimestampMS', Date.now() % 0xffffffff);
  set('EngineMaxRpm', 7800);
  set('EngineIdleRpm', 900);
  set('CurrentEngineRpm', rpm);

  set('AccelerationX', Math.sin(t) * 6);
  set('AccelerationY', 0.4);
  set('AccelerationZ', Math.cos(t / 2) * 8);

  set('VelocityX', Math.sin(t / 3) * 4);
  set('VelocityY', 0);
  set('VelocityZ', speed);

  set('AngularVelocityX', Math.sin(t * 2) * 0.2);
  set('AngularVelocityY', Math.sin(t / 2) * 0.8);
  set('AngularVelocityZ', Math.cos(t * 1.5) * 0.15);

  set('Yaw', Math.sin(t / 6) * Math.PI);
  set('Pitch', Math.sin(t / 5) * 0.1);
  set('Roll', Math.sin(t / 2) * 0.08);

  for (const corner of ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight']) {
    const jitter = Math.sin(t * 3 + corner.length) * 0.2;
    set(`NormalizedSuspensionTravel${corner}`, 0.5 + jitter * 0.5);
    set(`TireSlipRatio${corner}`, jitter);
    set(`WheelRotationSpeed${corner}`, speed / 0.34);
    set(`WheelOnRumbleStrip${corner}`, 0);
    set(`WheelInPuddle${corner}`, 0);
    set(`SurfaceRumble${corner}`, Math.abs(jitter) * 0.3);
    set(`TireSlipAngle${corner}`, jitter * 1.2);
    set(`TireCombinedSlip${corner}`, Math.abs(jitter) * 1.4);
    set(`SuspensionTravelMeters${corner}`, jitter * 0.05);
    set(`TireTemp${corner}`, 180 + Math.abs(jitter) * 90);
  }

  set('CarOrdinal', 2295);
  set('CarClass', 5);
  set('CarPerformanceIndex', 812);
  set('DrivetrainType', 2);
  set('NumCylinders', 6);
  set('CarGroup', 3);
  set('SmashableVelDiff', 0);
  set('SmashableMass', 0);

  set('PositionX', Math.cos(t / 6) * 800);
  set('PositionY', 120);
  set('PositionZ', Math.sin(t / 6) * 800);

  set('Speed', speed);
  set('Power', rpm * 40);
  set('Torque', 380 + throttleWave * 120);

  set('Boost', throttleWave * 18);
  set('Fuel', Math.max(0, 1 - t / 900));
  set('DistanceTraveled', distance);

  set('BestLap', bestLap);
  set('LastLap', lastLap);
  set('CurrentLap', raceTime - lapStart);
  set('CurrentRaceTime', raceTime);

  set('LapNumber', lap);
  set('RacePosition', 3);

  set('Accel', throttleWave * 255);
  set('Brake', (1 - throttleWave) * 90);
  set('Clutch', 0);
  set('HandBrake', 0);
  set('Gear', gear);

  set('Steer', Math.sin(t / 2) * 90);
  set('NormalizedDrivingLine', Math.sin(t / 3) * 40);
  set('NormalizedAIBrakeDifference', 0);

  socket.send(buf, PORT, HOST);
}, 1000 / 60);

console.log(`[sim] streaming synthetic telemetry to ${HOST}:${PORT} at 60 Hz`);
