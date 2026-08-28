import { useMemo, useState } from 'react';
import { GROUP_ORDER, type Metric } from '../metrics';

interface Props {
  metrics: Metric[];
  selected: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function MetricPicker({ metrics, selected, onToggle, onReset, onClear, onClose }: Props) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle ? metrics.filter((m) => m.label.toLowerCase().includes(needle)) : metrics;
    const byGroup = new Map<string, Metric[]>();
    for (const metric of matches) {
      const list = byGroup.get(metric.group) ?? [];
      list.push(metric);
      byGroup.set(metric.group, list);
    }
    return [...byGroup.entries()].sort(
      (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]),
    );
  }, [metrics, query]);

  return (
    <aside className="picker">
      <div className="picker__head">
        <h2>Data fields</h2>
        <button className="ghost" onClick={onClose}>
          Done
        </button>
      </div>

      <input
        className="picker__search"
        placeholder="Search fields…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="picker__actions">
        <button className="ghost" onClick={onReset}>
          Default set
        </button>
        <button className="ghost" onClick={onClear}>
          Clear all
        </button>
        <span className="picker__count">{selected.length} selected</span>
      </div>

      <div className="picker__list">
        {grouped.map(([group, items]) => (
          <section key={group}>
            <h3>{group}</h3>
            {items.map((metric) => (
              <label key={metric.id} className="picker__item">
                <input
                  type="checkbox"
                  checked={selected.includes(metric.id)}
                  onChange={() => onToggle(metric.id)}
                />
                <span>{metric.label}</span>
                {metric.unit && <em>{metric.unit}</em>}
              </label>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}
