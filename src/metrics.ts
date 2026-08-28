export type Telemetry = Record<string, number>;

export type MetricKind = 'value' | 'bar' | 'corners';

export interface Metric {
  id: string;
  label: string;
  group: string;
  kind: MetricKind;
  unit?: string;
  /** Primary numeric readout. */
  read: (t: Telemetry) => number;
  /** Custom string rendering of `read`. */
  format?: (v: number, t: Telemetry) => string;
  /** 0..1 fill level for bar metrics. */
  norm?: (t: Telemetry) => number;
  /** FL, FR, RL, RR values for corner metrics. */
  corners?: (t: Telemetry) => [number, number, number, number];
  /** Digits for the default numeric formatter. */
  digits?: number;
}

const MS_TO_MPH = 2.2369362920544;
const MS_TO_KPH = 3.6;
const W_TO_HP = 1 / 745.699872;

export type SpeedUnit = 'mph' | 'kph';

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

const corner = (prefix: string) =>
  (t: Telemetry): [number, number, number, number] => [
    t[`${prefix}FrontLeft`],
    t[`${prefix}FrontRight`],
    t[`${prefix}RearLeft`],
    t[`${prefix}RearRight`],
  ];

const lapTime = (v: number) => {
  if (!v || v <= 0) return '--:--.---';
  const m = Math.floor(v / 60);
  const s = v % 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
};

const CAR_CLASSES = ['D', 'C', 'B', 'A', 'S1', 'S2', 'X', 'X+'];
const DRIVETRAINS = ['FWD', 'RWD', 'AWD'];

export function buildMetrics(speedUnit: SpeedUnit): Metric[] {
  const speedFactor = speedUnit === 'mph' ? MS_TO_MPH : MS_TO_KPH;

  return [
    // ---- Drive -------------------------------------------------------------
    {
      id: 'speed',
      label: 'Speed',
      group: 'Drive',
      kind: 'value',
      unit: speedUnit,
      read: (t) => t.Speed * speedFactor,
      digits: 0,
    },
    {
      id: 'rpm',
      label: 'Engine RPM',
      group: 'Drive',
      kind: 'bar',
      unit: 'rpm',
      read: (t) => t.CurrentEngineRpm,
      norm: (t) => clamp01(t.CurrentEngineRpm / (t.EngineMaxRpm || 1)),
      digits: 0,
    },
    {
      id: 'gear',
      label: 'Gear',
      group: 'Drive',
      kind: 'value',
      read: (t) => t.Gear,
      format: (v) => (v === 0 ? 'R' : v === 1 ? '1' : String(v)),
    },
    {
      id: 'power',
      label: 'Power',
      group: 'Drive',
      kind: 'value',
      unit: 'hp',
      read: (t) => t.Power * W_TO_HP,
      digits: 0,
    },
    { id: 'torque', label: 'Torque', group: 'Drive', kind: 'value', unit: 'N\u00b7m', read: (t) => t.Torque, digits: 0 },
    { id: 'boost', label: 'Boost', group: 'Drive', kind: 'value', unit: 'psi', read: (t) => t.Boost, digits: 1 },
    {
      id: 'fuel',
      label: 'Fuel',
      group: 'Drive',
      kind: 'bar',
      unit: '%',
      read: (t) => t.Fuel * 100,
      norm: (t) => clamp01(t.Fuel),
      digits: 0,
    },
    {
      id: 'engineIdleRpm',
      label: 'Idle / Max RPM',
      group: 'Drive',
      kind: 'value',
      read: (t) => t.EngineMaxRpm,
      format: (_v, t) => `${Math.round(t.EngineIdleRpm)} / ${Math.round(t.EngineMaxRpm)}`,
    },

    // ---- Inputs ------------------------------------------------------------
    {
      id: 'accel',
      label: 'Throttle',
      group: 'Inputs',
      kind: 'bar',
      unit: '%',
      read: (t) => (t.Accel / 255) * 100,
      norm: (t) => clamp01(t.Accel / 255),
      digits: 0,
    },
    {
      id: 'brake',
      label: 'Brake',
      group: 'Inputs',
      kind: 'bar',
      unit: '%',
      read: (t) => (t.Brake / 255) * 100,
      norm: (t) => clamp01(t.Brake / 255),
      digits: 0,
    },
    {
      id: 'clutch',
      label: 'Clutch',
      group: 'Inputs',
      kind: 'bar',
      unit: '%',
      read: (t) => (t.Clutch / 255) * 100,
      norm: (t) => clamp01(t.Clutch / 255),
      digits: 0,
    },
    {
      id: 'handbrake',
      label: 'Handbrake',
      group: 'Inputs',
      kind: 'bar',
      unit: '%',
      read: (t) => (t.HandBrake / 255) * 100,
      norm: (t) => clamp01(t.HandBrake / 255),
      digits: 0,
    },
    {
      id: 'steer',
      label: 'Steering',
      group: 'Inputs',
      kind: 'value',
      read: (t) => (t.Steer / 127) * 100,
      format: (v) => `${v > 0 ? 'R' : v < 0 ? 'L' : ''} ${Math.abs(v).toFixed(0)}%`.trim(),
    },
    {
      id: 'drivingLine',
      label: 'Driving Line',
      group: 'Inputs',
      kind: 'value',
      read: (t) => t.NormalizedDrivingLine,
      digits: 0,
    },
    {
      id: 'aiBrakeDiff',
      label: 'AI Brake Diff',
      group: 'Inputs',
      kind: 'value',
      read: (t) => t.NormalizedAIBrakeDifference,
      digits: 0,
    },

    // ---- Race --------------------------------------------------------------
    { id: 'lapNumber', label: 'Lap', group: 'Race', kind: 'value', read: (t) => t.LapNumber, digits: 0 },
    { id: 'racePosition', label: 'Position', group: 'Race', kind: 'value', read: (t) => t.RacePosition, digits: 0 },
    { id: 'currentLap', label: 'Current Lap', group: 'Race', kind: 'value', read: (t) => t.CurrentLap, format: lapTime },
    { id: 'lastLap', label: 'Last Lap', group: 'Race', kind: 'value', read: (t) => t.LastLap, format: lapTime },
    { id: 'bestLap', label: 'Best Lap', group: 'Race', kind: 'value', read: (t) => t.BestLap, format: lapTime },
    {
      id: 'raceTime',
      label: 'Race Time',
      group: 'Race',
      kind: 'value',
      read: (t) => t.CurrentRaceTime,
      format: lapTime,
    },
    {
      id: 'distance',
      label: 'Distance',
      group: 'Race',
      kind: 'value',
      unit: 'km',
      read: (t) => t.DistanceTraveled / 1000,
      digits: 2,
    },
    {
      id: 'isRaceOn',
      label: 'Race State',
      group: 'Race',
      kind: 'value',
      read: (t) => t.IsRaceOn,
      format: (v) => (v ? 'RUNNING' : 'STOPPED'),
    },

    // ---- Tires -------------------------------------------------------------
    {
      id: 'tireTemp',
      label: 'Tire Temp',
      group: 'Tires',
      kind: 'corners',
      unit: '\u00b0F',
      read: (t) => t.TireTempFrontLeft,
      corners: corner('TireTemp'),
      digits: 0,
    },
    {
      id: 'tireCombinedSlip',
      label: 'Combined Slip',
      group: 'Tires',
      kind: 'corners',
      read: (t) => t.TireCombinedSlipFrontLeft,
      corners: corner('TireCombinedSlip'),
      digits: 2,
    },
    {
      id: 'tireSlipRatio',
      label: 'Slip Ratio',
      group: 'Tires',
      kind: 'corners',
      read: (t) => t.TireSlipRatioFrontLeft,
      corners: corner('TireSlipRatio'),
      digits: 2,
    },
    {
      id: 'tireSlipAngle',
      label: 'Slip Angle',
      group: 'Tires',
      kind: 'corners',
      read: (t) => t.TireSlipAngleFrontLeft,
      corners: corner('TireSlipAngle'),
      digits: 2,
    },
    {
      id: 'wheelRotationSpeed',
      label: 'Wheel Speed',
      group: 'Tires',
      kind: 'corners',
      unit: 'rad/s',
      read: (t) => t.WheelRotationSpeedFrontLeft,
      corners: corner('WheelRotationSpeed'),
      digits: 1,
    },
    {
      id: 'surfaceRumble',
      label: 'Surface Rumble',
      group: 'Tires',
      kind: 'corners',
      read: (t) => t.SurfaceRumbleFrontLeft,
      corners: corner('SurfaceRumble'),
      digits: 2,
    },
    {
      id: 'wheelInPuddle',
      label: 'Wheel In Puddle',
      group: 'Tires',
      kind: 'corners',
      read: (t) => t.WheelInPuddleFrontLeft,
      corners: corner('WheelInPuddle'),
      digits: 0,
    },
    {
      id: 'wheelOnRumbleStrip',
      label: 'On Rumble Strip',
      group: 'Tires',
      kind: 'corners',
      read: (t) => t.WheelOnRumbleStripFrontLeft,
      corners: corner('WheelOnRumbleStrip'),
      digits: 0,
    },

    // ---- Suspension --------------------------------------------------------
    {
      id: 'suspNorm',
      label: 'Suspension (norm)',
      group: 'Suspension',
      kind: 'corners',
      read: (t) => t.NormalizedSuspensionTravelFrontLeft,
      corners: corner('NormalizedSuspensionTravel'),
      digits: 2,
    },
    {
      id: 'suspMeters',
      label: 'Suspension Travel',
      group: 'Suspension',
      kind: 'corners',
      unit: 'm',
      read: (t) => t.SuspensionTravelMetersFrontLeft,
      corners: corner('SuspensionTravelMeters'),
      digits: 3,
    },

    // ---- Motion ------------------------------------------------------------
    {
      id: 'gForceLat',
      label: 'Lateral G',
      group: 'Motion',
      kind: 'value',
      unit: 'g',
      read: (t) => t.AccelerationX / 9.80665,
      digits: 2,
    },
    {
      id: 'gForceLong',
      label: 'Longitudinal G',
      group: 'Motion',
      kind: 'value',
      unit: 'g',
      read: (t) => t.AccelerationZ / 9.80665,
      digits: 2,
    },
    {
      id: 'gForceVert',
      label: 'Vertical G',
      group: 'Motion',
      kind: 'value',
      unit: 'g',
      read: (t) => t.AccelerationY / 9.80665,
      digits: 2,
    },
    {
      id: 'velocity',
      label: 'Velocity X/Y/Z',
      group: 'Motion',
      kind: 'value',
      unit: 'm/s',
      read: (t) => t.VelocityZ,
      format: (_v, t) => `${t.VelocityX.toFixed(1)} / ${t.VelocityY.toFixed(1)} / ${t.VelocityZ.toFixed(1)}`,
    },
    {
      id: 'angularVelocity',
      label: 'Angular Vel. P/Y/R',
      group: 'Motion',
      kind: 'value',
      unit: 'rad/s',
      read: (t) => t.AngularVelocityY,
      format: (_v, t) =>
        `${t.AngularVelocityX.toFixed(2)} / ${t.AngularVelocityY.toFixed(2)} / ${t.AngularVelocityZ.toFixed(2)}`,
    },
    {
      id: 'yaw',
      label: 'Yaw',
      group: 'Motion',
      kind: 'value',
      unit: '\u00b0',
      read: (t) => (t.Yaw * 180) / Math.PI,
      digits: 1,
    },
    {
      id: 'pitch',
      label: 'Pitch',
      group: 'Motion',
      kind: 'value',
      unit: '\u00b0',
      read: (t) => (t.Pitch * 180) / Math.PI,
      digits: 1,
    },
    {
      id: 'roll',
      label: 'Roll',
      group: 'Motion',
      kind: 'value',
      unit: '\u00b0',
      read: (t) => (t.Roll * 180) / Math.PI,
      digits: 1,
    },
    {
      id: 'position',
      label: 'World Position',
      group: 'Motion',
      kind: 'value',
      unit: 'm',
      read: (t) => t.PositionX,
      format: (_v, t) => `${t.PositionX.toFixed(0)}, ${t.PositionY.toFixed(0)}, ${t.PositionZ.toFixed(0)}`,
    },

    // ---- Car ---------------------------------------------------------------
    {
      id: 'carClass',
      label: 'Car Class',
      group: 'Car',
      kind: 'value',
      read: (t) => t.CarClass,
      format: (v) => CAR_CLASSES[v] ?? String(v),
    },
    { id: 'carPi', label: 'Performance Index', group: 'Car', kind: 'value', read: (t) => t.CarPerformanceIndex, digits: 0 },
    { id: 'carOrdinal', label: 'Car Ordinal', group: 'Car', kind: 'value', read: (t) => t.CarOrdinal, digits: 0 },
    {
      id: 'drivetrain',
      label: 'Drivetrain',
      group: 'Car',
      kind: 'value',
      read: (t) => t.DrivetrainType,
      format: (v) => DRIVETRAINS[v] ?? String(v),
    },
    { id: 'cylinders', label: 'Cylinders', group: 'Car', kind: 'value', read: (t) => t.NumCylinders, digits: 0 },
    { id: 'carGroup', label: 'Car Group', group: 'Car', kind: 'value', read: (t) => t.CarGroup, digits: 0 },
    {
      id: 'smashableVelDiff',
      label: 'Impact \u0394V',
      group: 'Car',
      kind: 'value',
      unit: 'm/s',
      read: (t) => t.SmashableVelDiff,
      digits: 2,
    },
    {
      id: 'smashableMass',
      label: 'Impact Mass',
      group: 'Car',
      kind: 'value',
      unit: 'kg',
      read: (t) => t.SmashableMass,
      digits: 1,
    },
  ];
}

export const DEFAULT_METRIC_IDS = [
  'speed',
  'rpm',
  'gear',
  'power',
  'torque',
  'boost',
  'accel',
  'brake',
  'steer',
  'fuel',
  'currentLap',
  'lastLap',
  'bestLap',
  'racePosition',
  'tireTemp',
  'tireCombinedSlip',
  'gForceLat',
  'gForceLong',
];

export const GROUP_ORDER = ['Drive', 'Inputs', 'Race', 'Tires', 'Suspension', 'Motion', 'Car'];
