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

export type SpeedUnit = 'mph' | 'kph';

const MS_TO_MPH = 2.2369362920544;
const MS_TO_KPH = 3.6;
const W_TO_HP = 1 / 745.699872;
const G = 9.80665;

const CORNER_SUFFIXES = ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight'] as const;
const CAR_CLASSES = ['D', 'C', 'B', 'A', 'S1', 'S2', 'X', 'X+'];
const DRIVETRAINS = ['FWD', 'RWD', 'AWD'];

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

const humanize = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();

const lapTime = (v: number) => {
  if (!v || v <= 0) return '--:--.---';
  const m = Math.floor(v / 60);
  const s = v % 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
};

/** First matching pattern wins. */
const GROUP_RULES: [RegExp, string][] = [
  [/^(Accel|Brake|Clutch|HandBrake|Steer|Normalized(DrivingLine|AIBrakeDifference))$/, 'Inputs'],
  [/Rpm|Power|Torque|Boost|Fuel|Gear|^Speed$/, 'Drive'],
  [/Lap|Race|Position$|DistanceTraveled/, 'Race'],
  [/Tire|Wheel|SurfaceRumble/, 'Tires'],
  [/Suspension/, 'Suspension'],
  [/Acceleration|Velocity|Angular|Yaw|Pitch|Roll|^Position[XYZ]$/, 'Motion'],
  [/Car|Drivetrain|Cylinders|Smashable/, 'Car'],
];

const groupFor = (name: string) => GROUP_RULES.find(([re]) => re.test(name))?.[1] ?? 'Other';

/** Curated presentation for known fields; unmatched names fall back to a raw readout. */
function describe(name: string, fields: Set<string>, speedUnit: SpeedUnit): Partial<Metric> {
  const speedFactor = speedUnit === 'mph' ? MS_TO_MPH : MS_TO_KPH;

  switch (name) {
    case 'Speed':
      return { label: 'Speed', unit: speedUnit, read: (t) => t.Speed * speedFactor, digits: 0 };
    case 'Power':
      return { label: 'Power', unit: 'hp', read: (t) => t.Power * W_TO_HP, digits: 0 };
    case 'Torque':
      return { label: 'Torque', unit: 'N\u00b7m', digits: 0 };
    case 'Boost':
      return { label: 'Boost', unit: 'psi', digits: 1 };
    case 'CurrentEngineRpm':
      return fields.has('EngineMaxRpm')
        ? {
            label: 'Engine RPM',
            unit: 'rpm',
            kind: 'bar',
            read: (t) => t.CurrentEngineRpm,
            norm: (t) => clamp01(t.CurrentEngineRpm / (t.EngineMaxRpm || 1)),
            digits: 0,
          }
        : { label: 'Engine RPM', unit: 'rpm', digits: 0 };
    case 'EngineMaxRpm':
      return { label: 'Max RPM', unit: 'rpm', digits: 0 };
    case 'EngineIdleRpm':
      return { label: 'Idle RPM', unit: 'rpm', digits: 0 };
    case 'Gear':
      return { label: 'Gear', format: (v) => (v === 0 ? 'R' : String(v)) };
    case 'Fuel':
      return {
        label: 'Fuel',
        unit: '%',
        kind: 'bar',
        read: (t) => t.Fuel * 100,
        norm: (t) => clamp01(t.Fuel),
        digits: 0,
      };
    case 'Steer':
      return {
        label: 'Steering',
        read: (t) => (t.Steer / 127) * 100,
        format: (v) => `${v > 0 ? 'R' : v < 0 ? 'L' : ''} ${Math.abs(v).toFixed(0)}%`.trim(),
      };
    case 'DistanceTraveled':
      return { label: 'Distance', unit: 'km', read: (t) => t.DistanceTraveled / 1000, digits: 2 };
    case 'IsRaceOn':
      return { label: 'Race State', format: (v) => (v ? 'RUNNING' : 'STOPPED') };
    case 'CarClass':
      return { label: 'Car Class', format: (v) => CAR_CLASSES[v] ?? String(v) };
    case 'DrivetrainType':
      return { label: 'Drivetrain', format: (v) => DRIVETRAINS[v] ?? String(v) };
    case 'CarPerformanceIndex':
      return { label: 'Performance Index', digits: 0 };
    case 'SmashableVelDiff':
      return { label: 'Impact \u0394V', unit: 'm/s', digits: 2 };
    case 'SmashableMass':
      return { label: 'Impact Mass', unit: 'kg', digits: 1 };
    case 'TimestampMS':
      return { label: 'Timestamp', unit: 'ms', digits: 0 };
  }

  // Pedal inputs arrive as 0-255 and read best as filled bars.
  if (/^(Accel|Brake|Clutch|HandBrake)$/.test(name)) {
    return {
      label: name === 'Accel' ? 'Throttle' : humanize(name),
      unit: '%',
      kind: 'bar',
      read: (t) => (t[name] / 255) * 100,
      norm: (t) => clamp01(t[name] / 255),
      digits: 0,
    };
  }

  if (/^(Yaw|Pitch|Roll)$/.test(name)) {
    return { label: name, unit: '\u00b0', read: (t) => (t[name] * 180) / Math.PI, digits: 1 };
  }

  if (/^(BestLap|LastLap|CurrentLap|CurrentRaceTime)$/.test(name)) {
    return { label: humanize(name), format: lapTime };
  }

  if (/^Velocity[XYZ]$/.test(name)) return { label: humanize(name), unit: 'm/s', digits: 1 };
  if (/^Acceleration[XYZ]$/.test(name)) return { label: humanize(name), unit: 'm/s\u00b2', digits: 1 };
  if (/^AngularVelocity[XYZ]$/.test(name)) return { label: humanize(name), unit: 'rad/s', digits: 2 };
  if (/^Position[XYZ]$/.test(name)) return { label: humanize(name), unit: 'm', digits: 0 };

  if (/^Normalized(DrivingLine|AIBrakeDifference)$/.test(name)) {
    return { label: humanize(name.replace('Normalized', '')), digits: 0 };
  }

  if (/^(LapNumber|RacePosition|CarOrdinal|NumCylinders|CarGroup)$/.test(name)) {
    return { label: humanize(name), digits: 0 };
  }

  return { label: humanize(name) };
}

/** Curated presentation for a set of four corner fields sharing a prefix. */
function describeCorner(prefix: string): Partial<Metric> {
  switch (prefix) {
    case 'TireTemp':
      return { label: 'Tire Temp', unit: '\u00b0F', digits: 0 };
    case 'WheelRotationSpeed':
      return { label: 'Wheel Speed', unit: 'rad/s', digits: 1 };
    case 'SuspensionTravelMeters':
      return { label: 'Suspension Travel', unit: 'm', digits: 3 };
    case 'NormalizedSuspensionTravel':
      return { label: 'Suspension (norm)', digits: 2 };
    case 'TireCombinedSlip':
      return { label: 'Combined Slip', digits: 2 };
    case 'TireSlipRatio':
      return { label: 'Slip Ratio', digits: 2 };
    case 'TireSlipAngle':
      return { label: 'Slip Angle', digits: 2 };
    case 'WheelOnRumbleStrip':
      return { label: 'On Rumble Strip', digits: 0 };
    case 'WheelInPuddle':
      return { label: 'Wheel In Puddle', digits: 0 };
    default:
      return { label: humanize(prefix), digits: 2 };
  }
}

interface Derived extends Omit<Metric, 'kind'> {
  needs: string[];
}

/** Computed from several raw fields; included only when their inputs exist. */
const DERIVED: Derived[] = [
  {
    id: 'gForceLat',
    label: 'Lateral G',
    group: 'Motion',
    unit: 'g',
    digits: 2,
    needs: ['AccelerationX'],
    read: (t) => t.AccelerationX / G,
  },
  {
    id: 'gForceLong',
    label: 'Longitudinal G',
    group: 'Motion',
    unit: 'g',
    digits: 2,
    needs: ['AccelerationZ'],
    read: (t) => t.AccelerationZ / G,
  },
  {
    id: 'gForceVert',
    label: 'Vertical G',
    group: 'Motion',
    unit: 'g',
    digits: 2,
    needs: ['AccelerationY'],
    read: (t) => t.AccelerationY / G,
  },
];

/** Derives the metric catalog from whatever fields the telemetry source provides. */
export function buildMetrics(fieldNames: string[], speedUnit: SpeedUnit): Metric[] {
  const fields = new Set(fieldNames);
  const metrics: Metric[] = [];
  const consumed = new Set<string>();

  // Any prefix with all four corners present collapses into one card.
  const prefixes = new Set<string>();
  for (const name of fieldNames) {
    const suffix = CORNER_SUFFIXES.find((s) => name.endsWith(s));
    if (suffix) prefixes.add(name.slice(0, -suffix.length));
  }

  for (const prefix of prefixes) {
    const members = CORNER_SUFFIXES.map((s) => `${prefix}${s}`);
    if (!members.every((m) => fields.has(m))) continue;
    members.forEach((m) => consumed.add(m));
    metrics.push({
      id: prefix,
      label: humanize(prefix),
      group: groupFor(prefix),
      kind: 'corners',
      read: (t) => t[members[0]],
      corners: (t) => [t[members[0]], t[members[1]], t[members[2]], t[members[3]]],
      ...describeCorner(prefix),
    });
  }

  for (const name of fieldNames) {
    if (consumed.has(name)) continue;
    metrics.push({
      id: name,
      label: humanize(name),
      group: groupFor(name),
      kind: 'value',
      read: (t) => t[name],
      digits: 1,
      ...describe(name, fields, speedUnit),
    });
  }

  for (const { needs, ...metric } of DERIVED) {
    if (needs.every((n) => fields.has(n))) metrics.push({ ...metric, kind: 'value' });
  }

  return metrics;
}

/** Preferred initial cards; ids absent from the live field set are skipped. */
export const DEFAULT_METRIC_IDS = [
  // Core driving
  'Speed',
  'CurrentEngineRpm',
  'Gear',
  'Power',
  'Boost',
  // Inputs
  'Accel',
  'Brake',
  'Steer',
  // Grip
  'gForceLat',
  'gForceLong',
  'TireCombinedSlip',
  'TireTemp',
  // Race
  'CurrentLap',
  'BestLap',
  'RacePosition',
];

export const GROUP_ORDER = [
  'Drive',
  'Inputs',
  'Race',
  'Tires',
  'Suspension',
  'Motion',
  'Car',
  'Other',
];
