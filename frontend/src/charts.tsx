import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, fmtVal, shortDate } from './lib'

const SERIES = '#2a78d6'
const BASELINE = '#94a3b8'
const ABNORMAL = '#d03b3b'

function MarkerLabel({ viewBox, text, row, color, flip }: any) {
  const x = viewBox.x + (flip ? 5 : -5)
  return (
    <text x={x} y={viewBox.y - 6 - row * 13} textAnchor={flip ? 'start' : 'end'} fontSize={11} fontWeight={700} fill={color}>
      {text}
    </text>
  )
}

function Tip({ active, payload, metric }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-slate-900">{shortDate(p.date)}</div>
      <div className="mt-1 flex items-center gap-2 text-slate-700">
        <span className="inline-block h-0.5 w-3" style={{ background: SERIES }} /> {fmtVal(metric, p.value)}
      </div>
      {p.baseline !== null && p.baseline !== undefined && (
        <div className="flex items-center gap-2 text-slate-500">
          <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: BASELINE }} /> normal {fmtVal(metric, p.baseline)}
        </div>
      )}
      {p.abnormal && <div className="mt-1 font-semibold text-red-700">Outside normal range</div>}
    </div>
  )
}

/**
 * One metric over time for one house: value line, dashed normal baseline, shaded abnormal
 * periods, and the two detection markers (AI early warning / traditional detection).
 */
export function TrendChart({ title, metric, days, offset, detection, isAbnormal, yDomain, note }: {
  title: string
  metric: string
  days: any[]
  offset: number            // index of days[0] in the full series, so detection markers line up
  detection?: any
  isAbnormal: (day: any) => boolean
  yDomain?: [number, number]
  note?: string
}) {
  const isRisk = metric === 'risk'
  const data = days.map((d, i) => ({
    x: i,
    date: d.date,
    value: isRisk ? d.risk : d.values[metric],
    baseline: isRisk ? null : d.baseline[metric],
    abnormal: isAbnormal(d),
  }))
  if (!data.some((d) => d.value !== null && d.value !== undefined)) return null

  const runs: [number, number][] = []
  data.forEach((d, i) => {
    if (!d.abnormal) return
    const last = runs[runs.length - 1]
    if (last && last[1] === i - 1) last[1] = i
    else runs.push([i, i])
  })
  const n = data.length
  const step = Math.max(1, Math.ceil(n / 7))
  const ticks = data.map((d) => d.x).filter((x) => (n - 1 - x) % step === 0)
  const ai = detection ? detection.ai_index - offset : -1
  const classic = detection && detection.classic_index !== null ? detection.classic_index - offset : -1
  const latest = data[n - 1]

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <span className="text-sm font-semibold text-slate-900">{fmtVal(metric, latest.value)}</span>
      </div>
      {note && <p className="text-xs text-slate-500">{note}</p>}
      <div className="mt-1 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 34, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#eef2f6" vertical={false} />
            <XAxis dataKey="x" type="number" domain={[-0.5, n - 0.5]} ticks={ticks} tickFormatter={(x) => shortDate(data[x]?.date)}
              tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
            <YAxis width={46} domain={yDomain ?? ['auto', 'auto']} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false}
              tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Number(v.toPrecision(3))))} />
            {runs.map(([a, b]) => (
              <ReferenceArea key={a} x1={a - 0.5} x2={b + 0.5} fill={ABNORMAL} fillOpacity={0.08} stroke="none" ifOverflow="hidden" />
            ))}
            <Tooltip content={<Tip metric={metric} />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} />
            {!isRisk && <Line dataKey="baseline" stroke={BASELINE} strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />}
            <Line dataKey="value" stroke={SERIES} strokeWidth={2} dot={{ r: 3, fill: SERIES, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
            {ai >= 0 && ai < n && (
              <ReferenceLine x={ai} stroke="#047857" strokeDasharray="4 3" label={<MarkerLabel text="AI early warning" row={1} color="#047857" flip={ai < n / 3} />} />
            )}
            {classic >= 0 && classic < n && (
              <ReferenceLine x={classic} stroke="#475569" strokeDasharray="4 3" label={<MarkerLabel text="Traditional detection" row={0} color="#475569" flip={classic < n / 3} />} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
      <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5" style={{ background: SERIES }} /> Measured value</span>
      <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: BASELINE }} /> Normal baseline</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: ABNORMAL, opacity: 0.18 }} /> Abnormal period</span>
    </div>
  )
}
