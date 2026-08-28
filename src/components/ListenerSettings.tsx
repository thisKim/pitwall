import { useEffect, useState } from 'react';
import type { ListenerConfig } from '../useTelemetry';

interface Props {
  config: ListenerConfig | null;
  onApply: (host: string, port: number) => void;
  onClose: () => void;
}

const HOST_PRESETS = [
  { value: '0.0.0.0', label: 'All interfaces (0.0.0.0)' },
  { value: '127.0.0.1', label: 'Localhost only (127.0.0.1)' },
];

export function ListenerSettings({ config, onApply, onClose }: Props) {
  const [host, setHost] = useState(config?.host ?? '0.0.0.0');
  const [port, setPort] = useState(String(config?.port ?? 5400));

  // Adopt whatever the bridge reports, including rejected changes.
  useEffect(() => {
    if (!config) return;
    setHost(config.host);
    setPort(String(config.port));
  }, [config?.host, config?.port]);

  const dirty = config ? host !== config.host || Number(port) !== config.port : false;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(host.trim(), Number(port));
  };

  return (
    <form className="listener" onSubmit={submit}>
      <div className="listener__row">
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
      </div>

      <p className={config?.error ? 'listener__error' : 'listener__hint'}>
        {config?.error ??
          `Match this in FH6: Settings > HUD and Gameplay > Data Out. Avoid ports ${config?.reserved.from ?? 5200}-${config?.reserved.to ?? 5300}.`}
      </p>
    </form>
  );
}
