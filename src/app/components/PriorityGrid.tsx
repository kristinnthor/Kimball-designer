import { displayName, type BusinessProcess } from '../../core';
import { truncate } from '../../core/text';

/** Kimball prioritisation grid: business value (y) against feasibility (x), 1–5. */
export function PriorityGrid({ processes }: { processes: BusinessProcess[] }) {
  const W = 520;
  const H = 360;
  const pad = { l: 56, r: 16, t: 16, b: 44 };
  const x = (v: number) => pad.l + ((v - 0.5) / 5) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - ((v - 0.5) / 5) * (H - pad.t - pad.b);
  const scored = processes.filter((p) => p.businessValue != null && p.feasibility != null);
  const cells = new Map<string, BusinessProcess[]>();
  for (const p of scored) {
    const key = `${p.businessValue}-${p.feasibility}`;
    cells.set(key, [...(cells.get(key) ?? []), p]);
  }

  return (
    <div className="priority">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="kd-prio-title">
        <title id="kd-prio-title">
          {`Prioritisation grid. ${scored.map((p) => `${displayName(p)}: value ${p.businessValue}, feasibility ${p.feasibility}`).join('; ') || 'No processes scored yet.'}`}
        </title>
        <rect x={x(3)} y={pad.t} width={x(5.5) - x(3)} height={y(3) - pad.t} fill="var(--kd-fact-soft)" />
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="none" stroke="var(--kd-line)" />
        <line x1={x(3)} x2={x(3)} y1={pad.t} y2={H - pad.b} stroke="var(--kd-line)" strokeDasharray="4 4" />
        <line x1={pad.l} x2={W - pad.r} y1={y(3)} y2={y(3)} stroke="var(--kd-line)" strokeDasharray="4 4" />
        <g fontSize="11" fill="var(--kd-muted)">
          <text x={W - pad.r - 8} y={pad.t + 16} textAnchor="end" fontWeight="700" fill="var(--kd-fact-strong)">
            Build first
          </text>
          <text x={pad.l + 8} y={pad.t + 16}>
            Valuable but hard
          </text>
          <text x={W - pad.r - 8} y={H - pad.b - 8} textAnchor="end">
            Easy, lower value
          </text>
          <text x={pad.l + 8} y={H - pad.b - 8}>
            Later
          </text>
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <text x={x(v)} y={H - pad.b + 16} textAnchor="middle">
                {v}
              </text>
              <text x={pad.l - 10} y={y(v) + 4} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          <text x={(pad.l + W - pad.r) / 2} y={H - 6} textAnchor="middle" fontWeight="600" fill="var(--kd-ink-2)">
            Feasibility →
          </text>
          <text transform={`translate(16 ${(pad.t + H - pad.b) / 2}) rotate(-90)`} textAnchor="middle" fontWeight="600" fill="var(--kd-ink-2)">
            Business value →
          </text>
        </g>
        {[...cells.values()].map((group) => {
          // Processes with the same scores share a cell: stack them (at most three lines) so labels never overlap.
          const { businessValue: v, feasibility: f } = group[0]!;
          const shown = group.length > 3 ? group.slice(0, 2) : group;
          const lines = shown.length + (group.length > shown.length ? 1 : 0);
          const top = y(v!) - ((lines - 1) * 16) / 2;
          const right = f === 5; // Labels in the last column go left so the edge doesn't clip them.
          const cx = x(f!);
          return (
            <g key={`${v}-${f}`}>
              {shown.map((p, i) => (
                <g key={p.id}>
                  <title>{`${displayName(p)}: value ${v}, feasibility ${f}`}</title>
                  <circle cx={cx} cy={top + i * 16} r={6} fill="var(--kd-fact)" stroke="var(--kd-surface)" strokeWidth={2} />
                  <text x={right ? cx - 10 : cx + 10} y={top + i * 16 + 4} textAnchor={right ? 'end' : 'start'} fontSize="12" fontWeight="600" fill="var(--kd-ink)">
                    {truncate(displayName(p), 16)}
                  </text>
                </g>
              ))}
              {group.length > shown.length && (
                <text x={right ? cx - 10 : cx + 10} y={top + shown.length * 16 + 4} textAnchor={right ? 'end' : 'start'} fontSize="11" fill="var(--kd-muted)">
                  <title>{group.slice(shown.length).map((p) => displayName(p)).join(', ')}</title>
                  {`+${group.length - shown.length} more`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
