import type { Metric, Telemetry } from '../metrics';

const CORNER_LABELS = ['FL', 'FR', 'RL', 'RR'];

interface Props {
  metric: Metric;
  telemetry: Telemetry | null;
  onRemove: (id: string) => void;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (id: string) => void;
  onMove: (id: string, delta: number) => void;
}

function render(metric: Metric, telemetry: Telemetry): string {
  const value = metric.read(telemetry);
  if (metric.format) return metric.format(value, telemetry);
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(metric.digits ?? 1);
}

export function MetricCard({
  metric,
  telemetry,
  onRemove,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  onMove,
}: Props) {
  const classes = [
    'card',
    `card--${metric.kind}`,
    dragging ? 'card--dragging' : '',
    dropTarget ? 'card--over' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={classes}
      draggable
      tabIndex={0}
      aria-label={`${metric.label}. Alt plus arrow keys to reorder.`}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', metric.id);
        onDragStart(metric.id);
      }}
      onDragEnter={() => onDragEnter(metric.id)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(metric.id);
      }}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => {
        if (!e.altKey) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onMove(metric.id, -1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          onMove(metric.id, 1);
        }
      }}
    >
      <header>
        <span className="card__label">{metric.label}</span>
        <button className="card__remove" onClick={() => onRemove(metric.id)} aria-label={`Remove ${metric.label}`}>
          &times;
        </button>
      </header>

      {metric.kind === 'corners' && metric.corners ? (
        <div className="corners">
          {(telemetry ? metric.corners(telemetry) : [NaN, NaN, NaN, NaN]).map((v, i) => (
            <div className="corners__cell" key={CORNER_LABELS[i]}>
              <span className="corners__tag">{CORNER_LABELS[i]}</span>
              <span className="corners__value">{Number.isFinite(v) ? v.toFixed(metric.digits ?? 1) : '--'}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card__readout">
          <span className="card__value">{telemetry ? render(metric, telemetry) : '--'}</span>
          {metric.unit && <span className="card__unit">{metric.unit}</span>}
        </div>
      )}

      {metric.kind === 'bar' && metric.norm && (
        <div className="bar">
          <div className="bar__fill" style={{ width: `${(telemetry ? metric.norm(telemetry) : 0) * 100}%` }} />
        </div>
      )}
    </article>
  );
}
