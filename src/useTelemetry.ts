import { useCallback, useEffect, useRef, useState } from 'react';
import { demoTelemetry } from './demoTelemetry';
import type { Telemetry } from './metrics';

export type ConnectionState = 'connecting' | 'live' | 'idle' | 'offline' | 'demo';

interface Frame {
  type: 'frame';
  t: number;
  stale: boolean;
  data: Telemetry;
}

export interface ListenerConfig {
  type: 'config';
  host: string;
  port: number;
  error: string | null;
  reserved: { from: number; to: number };
}

const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://${location.hostname}:8787`;

/**
 * Subscribes to the telemetry bridge and re-renders at animation frame rate.
 * When `demo` is true, placeholder data is generated locally instead.
 */
export function useTelemetry(demo: boolean) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [status, setStatus] = useState<ConnectionState>('connecting');
  const [config, setConfig] = useState<ListenerConfig | null>(null);
  const latest = useRef<Frame | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const demoRef = useRef(demo);
  demoRef.current = demo;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let closed = false;
    const start = performance.now();

    const connect = () => {
      socket = new WebSocket(WS_URL);
      socketRef.current = socket;
      socket.onopen = () => setStatus('idle');
      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data) as Frame | ListenerConfig;
        if (msg.type === 'config') {
          setConfig(msg);
          latest.current = null;
        } else {
          latest.current = msg;
        }
      };
      socket.onclose = () => {
        if (closed) return;
        setStatus('offline');
        retry = setTimeout(connect, 2000);
      };
      socket.onerror = () => socket?.close();
    };

    const tick = () => {
      if (demoRef.current) {
        setTelemetry(demoTelemetry((performance.now() - start) / 1000));
        setStatus('demo');
      } else {
        const frame = latest.current;
        if (frame) {
          setTelemetry(frame.data);
          setStatus((prev) => (prev === 'offline' ? prev : frame.stale ? 'idle' : 'live'));
        }
      }
      raf = requestAnimationFrame(tick);
    };

    connect();
    raf = requestAnimationFrame(tick);

    return () => {
      closed = true;
      cancelAnimationFrame(raf);
      clearTimeout(retry);
      socket?.close();
    };
  }, []);

  const setListener = useCallback((host: string, port: number) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'config', host, port }));
    }
  }, []);

  return { telemetry, status, config, setListener };
}
