import { useEffect, useState } from 'react';
import type { ListenerConfig } from '../useTelemetry';

interface Props {
  config: ListenerConfig | null;
  wsUrl: string;
  onApply: (host: string, port: number) => void;
  onApplyBridge: (url: string) => void;
  onClose: () => void;
}

const HOST_PRESETS = [
  { value: '0.0.0.0', label: 'All interfaces (0.0.0.0)' },
  { value: '127.0.0.1', label: 'Localhost only (127.0.0.1)' },
];

export function ListenerSettings({ config, wsUrl, onApply, onApplyBridge, onClose }: Props) {
  const [host, setHost] = useState(config?.host ?? '0.0.0.0');
  const [port, setPort] = useState(String(config?.port ?? 5400));
  const [bridge, setBridge] = useState(wsUrl);

  // Adopt whatever the bridge reports, including rejected changes.
  useEffect(() => {
    if (!config) return;
    setHost(config.host);
    setPort(String(config.port));
  }, [config?.host, config?.port]);

  useEffect(() => setBridge(wsUrl), [wsUrl]);

  const dirty = config ? host !== config.host || Number(port) !== config.port : false;
  const bridgeDirty = bridge.trim() !== wsUrl;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(host.trim(), Number(port));
  };

  return (
    <div className="listener">
      <form
        className="listener__row"
        onSubmit={(e) => {
          e.preventDefault();
          onApplyBridge(bridge);
        }}
      >
        <label className="listener__grow">
          <span>Bridge address</span>
          <input
            value={bridge}
            onChange={(e) => setBridge(e.target.value)}
            placeholder="ws://127.0.0.1:8787"
          />
        </label>
        <button className="primary" type="submit" disabled={!bridgeDirty}>
          {bridgeDirty ? 'Connect' : 'Connected'}
        </button>
        {!config && (
          <button className="ghost" type="button" onClick={onClose}>
            Done
          </button>
        )}
      </form>

      {config && (
        <form className="listener__row" onSubmit={submit}>
          <label>
            <span>Listen address</span>
            <select value={host} onChange={(e) => setHost(e.target.value)}>
              {HOST_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              {!HOST_PRESETS.some((p) => p.value === host) && <option value={host}>{host}</option>}
            </select>
          </label>

          <label>
            <span>UDP port</span>
            <input
              type="number"
              min={1024}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </label>

          <button className="primary" type="submit" disabled={!dirty}>
            {dirty ? 'Apply' : 'Applied'}
          </button>
          <button className="ghost" type="button" onClick={onClose}>
            Done
          </button>
        </form>
      )}

      <p className={config?.error ? 'listener__error' : 'listener__hint'}>
        {config?.error ??
          (config
            ? `Match the UDP port in FH6: Settings > HUD and Gameplay > Data Out. Avoid ports ${config.reserved.from}-${config.reserved.to}.`
            : 'No bridge connected. Run `npm run dev:server` on the machine running the game.')}
      </p>
    </div>
  );
}
