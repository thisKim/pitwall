// Forza Horizon 6 "Data Out" packet decoder.
// Single fixed 324-byte format (no sled/dash variants).
// Layout per https://support.forza.net/hc/en-us/articles/51744149102611

export const PACKET_SIZE = 324;

const F32 = 'f32';
const S32 = 's32';
const U32 = 'u32';
const U16 = 'u16';
const U8 = 'u8';
const S8 = 's8';

const SIZES = { f32: 4, s32: 4, u32: 4, u16: 2, u8: 1, s8: 1 };

/** Ordered field list; offsets are derived by accumulating sizes. */
const LAYOUT = [
  ['IsRaceOn', S32],
  ['TimestampMS', U32],

  ['EngineMaxRpm', F32],
  ['EngineIdleRpm', F32],
  ['CurrentEngineRpm', F32],

  ['AccelerationX', F32],
  ['AccelerationY', F32],
  ['AccelerationZ', F32],

  ['VelocityX', F32],
  ['VelocityY', F32],
  ['VelocityZ', F32],

  ['AngularVelocityX', F32],
  ['AngularVelocityY', F32],
  ['AngularVelocityZ', F32],

  ['Yaw', F32],
  ['Pitch', F32],
  ['Roll', F32],

  ['NormalizedSuspensionTravelFrontLeft', F32],
  ['NormalizedSuspensionTravelFrontRight', F32],
  ['NormalizedSuspensionTravelRearLeft', F32],
  ['NormalizedSuspensionTravelRearRight', F32],

  ['TireSlipRatioFrontLeft', F32],
  ['TireSlipRatioFrontRight', F32],
  ['TireSlipRatioRearLeft', F32],
  ['TireSlipRatioRearRight', F32],

  ['WheelRotationSpeedFrontLeft', F32],
  ['WheelRotationSpeedFrontRight', F32],
  ['WheelRotationSpeedRearLeft', F32],
  ['WheelRotationSpeedRearRight', F32],

  ['WheelOnRumbleStripFrontLeft', S32],
  ['WheelOnRumbleStripFrontRight', S32],
  ['WheelOnRumbleStripRearLeft', S32],
  ['WheelOnRumbleStripRearRight', S32],

  ['WheelInPuddleFrontLeft', S32],
  ['WheelInPuddleFrontRight', S32],
  ['WheelInPuddleRearLeft', S32],
  ['WheelInPuddleRearRight', S32],

  ['SurfaceRumbleFrontLeft', F32],
  ['SurfaceRumbleFrontRight', F32],
  ['SurfaceRumbleRearLeft', F32],
  ['SurfaceRumbleRearRight', F32],

  ['TireSlipAngleFrontLeft', F32],
  ['TireSlipAngleFrontRight', F32],
  ['TireSlipAngleRearLeft', F32],
  ['TireSlipAngleRearRight', F32],

  ['TireCombinedSlipFrontLeft', F32],
  ['TireCombinedSlipFrontRight', F32],
  ['TireCombinedSlipRearLeft', F32],
  ['TireCombinedSlipRearRight', F32],

  ['SuspensionTravelMetersFrontLeft', F32],
  ['SuspensionTravelMetersFrontRight', F32],
  ['SuspensionTravelMetersRearLeft', F32],
  ['SuspensionTravelMetersRearRight', F32],

  ['CarOrdinal', S32],
  ['CarClass', S32],
  ['CarPerformanceIndex', S32],
  ['DrivetrainType', S32],
  ['NumCylinders', S32],
  ['CarGroup', U32],

  ['SmashableVelDiff', F32],
  ['SmashableMass', F32],

  ['PositionX', F32],
  ['PositionY', F32],
  ['PositionZ', F32],

  ['Speed', F32],
  ['Power', F32],
  ['Torque', F32],

  ['TireTempFrontLeft', F32],
  ['TireTempFrontRight', F32],
  ['TireTempRearLeft', F32],
  ['TireTempRearRight', F32],

  ['Boost', F32],
  ['Fuel', F32],
  ['DistanceTraveled', F32],

  ['BestLap', F32],
  ['LastLap', F32],
  ['CurrentLap', F32],
  ['CurrentRaceTime', F32],

  ['LapNumber', U16],
  ['RacePosition', U8],

  ['Accel', U8],
  ['Brake', U8],
  ['Clutch', U8],
  ['HandBrake', U8],
  ['Gear', U8],

  ['Steer', S8],
  ['NormalizedDrivingLine', S8],
  ['NormalizedAIBrakeDifference', S8],
];

export const FIELDS = (() => {
  let offset = 0;
  return LAYOUT.map(([name, type]) => {
    const field = { name, type, offset };
    offset += SIZES[type];
    return field;
  });
})();

const READERS = {
  f32: (view, o) => view.getFloat32(o, true),
  s32: (view, o) => view.getInt32(o, true),
  u32: (view, o) => view.getUint32(o, true),
  u16: (view, o) => view.getUint16(o, true),
  u8: (view, o) => view.getUint8(o),
  s8: (view, o) => view.getInt8(o),
};

/**
 * @param {Buffer|Uint8Array} buf
 * @returns {Record<string, number>|null} null if the packet is too short
 */
export function decodePacket(buf) {
  if (buf.length < 323) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = {};
  for (const { name, type, offset } of FIELDS) {
    out[name] = READERS[type](view, offset);
  }
  return out;
}
