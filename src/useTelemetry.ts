import { useCallback, useEffect, useRef, useState } from 'react';
import { demoTelemetry } from './demoTelemetry';
import type { Telemetry } from './metrics';

export type ConnectionState = 'idle' | 'live' | 'demo';

interface Frame {
  t: number;
  stale: boolean;
  data: Telemetry;
}

export interface ListenerConfig {
  host: string;
  port: number;
  error: string | null;
  reserved: { from: number; to: number };
  fields: string[];
}

interface DesktopApi {
  onFrame: (cb: (frame: Frame) => void) => () => void;
  onConfig: (cb: (config: ListenerConfig) => void) => () => void;
  getConfig: () => Promise<ListenerConfig>;
  setListener: (host: string, port: number) => Promise<ListenerConfig>;
}

declare global {
  interface Window {
    pitwall: DesktopApi;
  }
}

/**
 * Streams telemetry from the main process and re-renders at animation frame rate.
 * When `demo` is true, placeholder data is generated locally instead.
 */
export function useTelemetry(demo: boolean) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [status, setStatus] = useState<ConnectionState>('idle');
  const [config, setConfig] = useState<ListenerConfig | null>(null);
  const latest = useRef<Frame | null>(null);
  const demoRef = useRef(demo);
  demoRef.current = demo;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    window.pitwall.getConfig().then(setConfig);
    const offConfig = window.pitwall.onConfig((next) => {
      setConfig(next);
      latest.current = null;
    });
    const offFrame = window.pitwall.onFrame((frame) => {
      latest.current = frame;
    });

    const tick = () => {
      // Dead code in production builds, so the generator is tree-shaken out.
      if (import.meta.env.DEV && demoRef.current) {
        setTelemetry(demoTelemetry((performance.now() - start) / 1000));
        setStatus('demo');
      } else {
        const frame = latest.current;
        if (frame) {
          setTelemetry(frame.data);
          setStatus(frame.stale ? 'idle' : 'live');
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      offConfig();
      offFrame();
    };
  }, []);

  const setListener = useCallback((host: string, port: number) => {
    window.pitwall.setListener(host, port).then(setConfig);
  }, []);

  return { telemetry, status, config, setListener };
}
