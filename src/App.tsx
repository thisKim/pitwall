import { useEffect, useMemo, useState } from 'react';
import { ListenerSettings } from './components/ListenerSettings';
import { MetricCard } from './components/MetricCard';
import { MetricPicker } from './components/MetricPicker';
import { buildMetrics, DEFAULT_METRIC_IDS, type SpeedUnit } from './metrics';
import { useTelemetry } from './useTelemetry';

// v3 ids are raw telemetry field names; earlier selections are not compatible.
const STORAGE_KEY = 'pitwall.selection.v3';
const UNIT_KEY = 'pitwall.speedUnit.v1';
const DEMO_KEY = 'pitwall.demo.v1';

function loadSelection(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_METRIC_IDS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((v) => typeof v === 'string') ? parsed : DEFAULT_METRIC_IDS;
  } catch {
    return DEFAULT_METRIC_IDS;
  }
}

const STATUS_TEXT: Record<string, string> = {
  idle: 'Waiting for game data',
  live: 'Live',
  demo: 'Demo data',
};

const DEMO_AVAILABLE = import.meta.env.DEV;

export default function App() {
  const [demo, setDemo] = useState(
    () => DEMO_AVAILABLE && localStorage.getItem(DEMO_KEY) === 'true',
  );
  const { telemetry, status, config, setListener } = useTelemetry(demo);
  const [selected, setSelected] = useState<string[]>(loadSelection);
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>(
    () => (localStorage.getItem(UNIT_KEY) as SpeedUnit) ?? 'mph',
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(DEMO_KEY, String(demo));
  }, [demo]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  }, [selected]);

  useEffect(() => {
    localStorage.setItem(UNIT_KEY, speedUnit);
  }, [speedUnit]);

  const metrics = useMemo(
    () => buildMetrics(config?.fields ?? [], speedUnit),
    [config?.fields, speedUnit],
  );
  const byId = useMemo(() => new Map(metrics.map((m) => [m.id, m])), [metrics]);
  const visible = useMemo(
    () => selected.map((id) => byId.get(id)).filter((m): m is NonNullable<typeof m> => Boolean(m)),
    [selected, byId],
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const reorder = (from: string, to: string) => {
    if (from === to) return;
    setSelected((prev) => {
      const next = prev.filter((id) => id !== from);
      const target = next.indexOf(to);
      next.splice(target < 0 ? next.length : target, 0, from);
      return next;
    });
  };

  const move = (id: string, delta: number) =>
    setSelected((prev) => {
      const from = prev.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });

  const endDrag = () => {
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Pitwall</h1>
        <div className="topbar__right">
          <span className={`status status--${status}`}>{STATUS_TEXT[status]}</span>
          <button
            className={config?.error ? 'ghost ghost--error' : 'ghost'}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            {config ? `${config.host}:${config.port}` : 'Listener…'}
          </button>
          {DEMO_AVAILABLE && (
            <label className="toggle">
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
              <span>Demo data</span>
            </label>
          )}
          <button className="ghost" onClick={() => setSpeedUnit((u) => (u === 'mph' ? 'kph' : 'mph'))}>
            {speedUnit.toUpperCase()}
          </button>
          <button className="primary" onClick={() => setPickerOpen((v) => !v)}>
            {pickerOpen ? 'Close' : 'Choose data'}
          </button>
        </div>
      </header>

      {settingsOpen && (
        <ListenerSettings config={config} onApply={setListener} onClose={() => setSettingsOpen(false)} />
      )}

      <main className="layout">
        <section className="grid">
          {visible.length === 0 ? (
            <p className="empty">No fields selected. Open “Choose data” to pick some.</p>
          ) : (
            visible.map((metric) => (
              <MetricCard
                key={metric.id}
                metric={metric}
                telemetry={telemetry}
                onRemove={(id) => setSelected((prev) => prev.filter((x) => x !== id))}
                dragging={dragId === metric.id}
                dropTarget={overId === metric.id && dragId !== metric.id}
                onDragStart={setDragId}
                onDragEnter={setOverId}
                onDragEnd={endDrag}
                onDrop={(id) => {
                  if (dragId) reorder(dragId, id);
                  endDrag();
                }}
                onMove={move}
              />
            ))
          )}
        </section>

        {pickerOpen && (
          <MetricPicker
            metrics={metrics}
            selected={selected}
            onToggle={toggle}
            onReset={() => setSelected(DEFAULT_METRIC_IDS)}
            onClear={() => setSelected([])}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </main>
    </div>
  );
}
