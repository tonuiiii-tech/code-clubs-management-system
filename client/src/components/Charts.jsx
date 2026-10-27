import { useTranslation } from 'react-i18next';

/**
 * Small SVG charts on the kit's flat colours, no chart library and no gradients (D4-1). Each
 * chart has a text label for screen readers, and the page shows the same numbers in a table.
 */

/** Columns from 0 to `max`, e.g. attendance per week in percent. `value` null shows no column. */
export function ColumnChart({ data, max = 100, unit = '', label, height = 160 }) {
  const { t } = useTranslation();
  const width = Math.max(data.length * 36, 240);
  const top = 16;
  const bottom = 22;
  const inner = height - top - bottom;
  const step = width / Math.max(data.length, 1);
  const bar = Math.min(24, step * 0.6);
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMinYMid meet"
    >
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          x1="0"
          x2={width}
          y1={top + inner * (1 - f)}
          y2={top + inner * (1 - f)}
          className="chart__grid"
        />
      ))}
      {data.map((d, i) => {
        const x = i * step + (step - bar) / 2;
        const h = d.value === null ? 0 : (Math.min(d.value, max) / max) * inner;
        return (
          <g key={d.label}>
            {d.value === null ? (
              <text
                x={x + bar / 2}
                y={top + inner - 4}
                className="chart__empty"
                textAnchor="middle"
              >
                –
              </text>
            ) : (
              <>
                <rect
                  x={x}
                  y={top + inner - h}
                  width={bar}
                  height={h}
                  className="chart__bar"
                  rx="2"
                >
                  <title>{`${d.title ?? d.label}: ${d.value}${unit}`}</title>
                </rect>
                <text
                  x={x + bar / 2}
                  y={top + inner - h - 4}
                  textAnchor="middle"
                  className="chart__value"
                >
                  {d.value}
                </text>
              </>
            )}
            <text x={x + bar / 2} y={height - 6} textAnchor="middle" className="chart__label">
              {d.label}
            </text>
          </g>
        );
      })}
      {data.length === 0 && (
        <text x={width / 2} y={height / 2} textAnchor="middle" className="chart__empty">
          {t('hq.noData')}
        </text>
      )}
    </svg>
  );
}

/** Horizontal bars split into parts (e.g. girls and boys), with a legend. */
export function StackedBars({ rows, parts, label }) {
  const total = Math.max(
    1,
    ...rows.map((r) => parts.reduce((n, p) => n + (r.values[p.key] ?? 0), 0)),
  );
  return (
    <figure className="stacked" aria-label={label} role="img">
      <ul className="stacked__legend" aria-hidden>
        {parts.map((p) => (
          <li key={p.key}>
            <span className={`swatch swatch--${p.tone}`} />
            {p.label}
          </li>
        ))}
      </ul>
      {rows.map((r) => {
        const sum = parts.reduce((n, p) => n + (r.values[p.key] ?? 0), 0);
        return (
          <div key={r.label} className="stacked__row" aria-hidden>
            <span className="stacked__name">{r.label}</span>
            <span className="stacked__track">
              {parts.map((p) =>
                r.values[p.key] ? (
                  <span
                    key={p.key}
                    className={`stacked__part swatch--${p.tone}`}
                    style={{ width: `${(r.values[p.key] / total) * 100}%` }}
                    title={`${p.label}: ${r.values[p.key]}`}
                  />
                ) : null,
              )}
            </span>
            <strong className="stacked__sum">{sum}</strong>
          </div>
        );
      })}
    </figure>
  );
}
