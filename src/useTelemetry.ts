import { useCallback, useEffect, useRef, useState } from 'react';
import { demoTelemetry } from './demoTelemetry';
import type { Telemetry } from './metrics';

export type ConnectionState = 'connecting' | 'live' | 'idle' | 'offline' | 'demo' | 'blocked';

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

// The bridge always runs on the viewer's own machine, never on the page's host.
const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://127.0.0.1:8787';
const WS_KEY = 'fhdash.bridgeUrl.v1';
// Loopback is exempt from mixed-content blocking; anything else insecure is not,
// and the WebSocket constructor throws rather than firing onerror.
const LOOPBACK = /^wss?:\/\/(127\.0\.0\.1|\[::1\]|localhost)(:|\/|$)/;

const isBlocked = (url: string) =>
  location.protocol === 'https:' && url.startsWith('ws:') && !LOOPBACK.test(url);

/**
 * Subscribes to the telemetry bridge and re-renders at animation frame rate.
 * When `demo` is true, placeholder data is generated locally instead.
 */
export function useTelemetry(demo: boolean) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [status, setStatus] = useState<ConnectionState>('connecting');
  const [config, setConfig] = useState<ListenerConfig | null>(null);
  const [wsUrl, setWsUrlState] = useState(() => localStorage.getItem(WS_KEY) ?? DEFAULT_WS_URL);
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

    setConfig(null);
    latest.current = null;

    const connect = () => {
      try {
        socket = new WebSocket(wsUrl);
      } catch {
        setStatus('blocked');
        return;
      }
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
      // Dead code in production builds, so the generator is tree-shaken out.
      if (import.meta.env.DEV && demoRef.current) {
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

    if (isBlocked(wsUrl)) setStatus('blocked');
    else connect();
    raf = requestAnimationFrame(tick);

    return () => {
      closed = true;
      cancelAnimationFrame(raf);
      clearTimeout(retry);
      socket?.close();
    };
  }, [wsUrl]);

  const setListener = useCallback((host: string, port: number) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'config', host, port }));
    }
  }, []);

  const setWsUrl = useCallback((url: string) => {
    const next = url.trim() || DEFAULT_WS_URL;
    localStorage.setItem(WS_KEY, next);
    setStatus('connecting');
    setWsUrlState(next);
  }, []);

  return { telemetry, status, config, setListener, wsUrl, setWsUrl };
}
