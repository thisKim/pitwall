import type { Telemetry } from './metrics';

const CORNERS = ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight'] as const;

/**
 * Client-side placeholder telemetry so the dashboard can be exercised without
 * the game or the UDP bridge running. `t` is elapsed seconds.
 */
export function demoTelemetry(t: number): Telemetry {
  const wave = (Math.sin(t / 4) + 1) / 2;
  const speed = 10 + wave * 70;
  const rpm = 1000 + wave * 6500;
  const gear = Math.max(1, Math.min(8, Math.ceil(speed / 11)));
  const lapLength = 45;
  const lap = Math.floor(t / lapLength) + 1;
  const currentLap = t % lapLength;

  const frame: Telemetry = {
    IsRaceOn: 1,
    TimestampMS: Math.round(t * 1000),

    EngineMaxRpm: 7800,
    EngineIdleRpm: 900,
    CurrentEngineRpm: rpm,

    AccelerationX: Math.sin(t) * 6,
    AccelerationY: 0.4,
    AccelerationZ: Math.cos(t / 2) * 8,

    VelocityX: Math.sin(t / 3) * 4,
    VelocityY: 0,
    VelocityZ: speed,

    AngularVelocityX: Math.sin(t * 2) * 0.2,
    AngularVelocityY: Math.sin(t / 2) * 0.8,
    AngularVelocityZ: Math.cos(t * 1.5) * 0.15,

    Yaw: Math.sin(t / 6) * Math.PI,
    Pitch: Math.sin(t / 5) * 0.1,
    Roll: Math.sin(t / 2) * 0.08,

    CarOrdinal: 2295,
    CarClass: 5,
    CarPerformanceIndex: 812,
    DrivetrainType: 2,
    NumCylinders: 6,
    CarGroup: 3,
    SmashableVelDiff: 0,
    SmashableMass: 0,

    PositionX: Math.cos(t / 6) * 800,
    PositionY: 120,
    PositionZ: Math.sin(t / 6) * 800,

    Speed: speed,
    Power: rpm * 40,
    Torque: 380 + wave * 120,

    Boost: wave * 18,
    Fuel: Math.max(0, 1 - (t % 900) / 900),
    DistanceTraveled: t * 45,

    BestLap: lap > 1 ? lapLength - 1.2 : 0,
    LastLap: lap > 1 ? lapLength : 0,
    CurrentLap: currentLap,
    CurrentRaceTime: t,

    LapNumber: lap,
    RacePosition: 3,

    Accel: Math.round(wave * 255),
    Brake: Math.round((1 - wave) * 90),
    Clutch: 0,
    HandBrake: 0,
    Gear: gear,

    Steer: Math.round(Math.sin(t / 2) * 90),
    NormalizedDrivingLine: Math.round(Math.sin(t / 3) * 40),
    NormalizedAIBrakeDifference: 0,
  };

  CORNERS.forEach((corner, i) => {
    const jitter = Math.sin(t * 3 + i) * 0.2;
    frame[`NormalizedSuspensionTravel${corner}`] = 0.5 + jitter * 0.5;
    frame[`TireSlipRatio${corner}`] = jitter;
    frame[`WheelRotationSpeed${corner}`] = speed / 0.34;
    frame[`WheelOnRumbleStrip${corner}`] = 0;
    frame[`WheelInPuddle${corner}`] = 0;
    frame[`SurfaceRumble${corner}`] = Math.abs(jitter) * 0.3;
    frame[`TireSlipAngle${corner}`] = jitter * 1.2;
    frame[`TireCombinedSlip${corner}`] = Math.abs(jitter) * 1.4;
    frame[`SuspensionTravelMeters${corner}`] = jitter * 0.05;
    frame[`TireTemp${corner}`] = 180 + Math.abs(jitter) * 90;
  });

  return frame;
}
