import { useEffect, useMemo, useRef, useState } from 'react'
import { TrendChart } from '../charts'
import { Card, CardTitle, Ctx, DayTabs, fmtVal, HouseTabs, PageHeader, seeded, shortDate } from '../lib'

const COLS = 180
const ROWS = 44
const KINDS = {
  R: { label: 'Respiratory event', color: '#f87171' },
  S: { label: 'Sneezing-like event', color: '#fbbf24' },
  D: { label: 'Distress vocalization', color: '#c4b5fd' },
} as const
type Kind = keyof typeof KINDS

const STOPS = [[11, 16, 38], [72, 35, 116], [201, 79, 73], [246, 158, 44], [253, 243, 176]]
function heat(t: number): string {
  const x = Math.max(0, Math.min(0.999, t)) * (STOPS.length - 1)
  const i = Math.floor(x)
  const f = x - i
  const c = STOPS[i].map((a, k) => Math.round(a + (STOPS[i + 1][k] - a) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** Mock one-minute spectrogram: background flock noise plus bursts whose number follows the day's audio metrics. */
function Spectrogram({ house, day }: { house: string; day: any }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const v = day.values
  const scene = useMemo(() => {
    const rnd = seeded(house + day.date)
    const grid = new Float32Array(COLS * ROWS)
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) grid[c * ROWS + r] = 0.1 + 0.3 * Math.exp(-r / 9) + 0.12 * rnd()
    const add = (c0: number, width: number, r0: number, r1: number, gain: number) => {
      for (let c = c0; c < Math.min(COLS, c0 + width); c++) for (let r = r0; r <= r1; r++) grid[c * ROWS + r] += gain * (0.7 + 0.3 * rnd())
    }
    for (let k = 0; k < 22; k++) add(Math.floor(rnd() * COLS), 3, 5 + Math.floor(rnd() * 6), 13 + Math.floor(rnd() * 5), 0.22)  // normal clucking
    const events: { col: number; kind: Kind }[] = []
    const place = (kind: Kind, count: number, width: number, r0: number, r1: number, gain: number) => {
      for (let k = 0; k < count; k++) {
        const col = 2 + Math.floor(rnd() * (COLS - width - 4))
        add(col, width, r0, r1, gain)
        events.push({ col: col + width / 2, kind })
      }
    }
    place('R', Math.max(1, Math.min(18, Math.round(v.cough / 3))), 2, 8, 34, 0.55)
    place('S', Math.min(8, Math.round((v.sneeze ?? 0) / 4)), 1, 20, ROWS - 1, 0.7)
    place('D', Math.min(5, Math.round((v.distress ?? 0) / 4)), 7, 24, 28, 0.55)
    return { grid, events }
  }, [house, day])

  useEffect(() => {
    const g = ref.current?.getContext('2d')
    if (!g) return
    const w = 720 / COLS
    const h = 220 / ROWS
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        g.fillStyle = heat(scene.grid[c * ROWS + r])
        g.fillRect(c * w, 220 - (r + 1) * h, w + 0.5, h + 0.5)
      }
    }
  }, [scene])

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-1 text-right text-[10px] text-slate-500"><span>8 kHz</span><span>4 kHz</span><span>0</span></div>
        <div className="min-w-0 flex-1">
          <canvas ref={ref} width={720} height={220} className="block w-full rounded-t-lg" role="img" aria-label="Mock spectrogram of flock sound" />
          <svg viewBox="0 0 720 22" className="block w-full rounded-b-lg bg-slate-900">
            {scene.events.map((e, i) => (
              <g key={i}>
                <rect x={(e.col / COLS) * 720 - 6} y="3" width="12" height="16" rx="2" fill={KINDS[e.kind].color} />
                <text x={(e.col / COLS) * 720} y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a">{e.kind}</text>
              </g>
            ))}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>0 s</span><span>one-minute sample · detected events marked below the spectrogram</span><span>60 s</span></div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {(Object.keys(KINDS) as Kind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold text-slate-900" style={{ background: KINDS[k].color }}>{k}</span>
            {KINDS[k].label}
          </span>
        ))}
        <span className="text-slate-500">Brighter = louder</span>
      </div>
    </div>
  )
}

export default function Sound({ ctx }: { ctx: Ctx }) {
  const { farm, detail } = ctx
  const [index, setIndex] = useState(-1)
  useEffect(() => setIndex(-1), [ctx.house])
  const header = (
    <PageHeader title="Respiratory Sound AI" subtitle="Microphones listen to the flock around the clock and count sounds that differ from normal poultry noise. A rising trend is an early signal — it is not a diagnosis."
      right={<HouseTabs ctx={ctx} />} />
  )
  if (!detail) return <>{header}<p className="text-sm text-slate-500">Loading…</p></>

  const n = detail.days.length
  const day = detail.days[index < 0 ? n - 1 : Math.min(index, n - 1)]
  const v = day.values
  const b = day.baseline
  const det = detail.detection
  const start = Math.max(0, n - 5)
  const last5 = detail.days.slice(start)
  const maxCough = Math.max(...last5.map((d: any) => d.values.cough ?? 0), 1)
  const hasAudio = v.sneeze !== null && v.sneeze !== undefined
  const focus = det ? detail.days[det.ai_index] : detail.days[n - 1]
  const ratio = focus.values.cough && focus.baseline.cough ? focus.values.cough / focus.baseline.cough : null

  const classes: [string, number | null, number | null][] = [
    ['Normal poultry sound', v.acoustic === null ? null : 240 * v.acoustic / 100, b.acoustic === null ? null : 240 * b.acoustic / 100],
    ['Respiratory event', v.cough, b.cough],
    ['Sneezing-like event', v.sneeze, b.sneeze],
    ['Distress vocalization', v.distress, b.distress],
    ['Unknown', v.vocal, b.vocal],
  ]
  const offset = Math.max(0, n - 14)

  return (
    <div className="space-y-5">
      {header}
      <DayTabs detail={detail} index={detail.days.indexOf(day)} onChange={setIndex} />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <CardTitle right={<span className="text-xs text-slate-500">Synthetic demo audio</span>}>Microphone · {farm.labels.unit} {detail.barn} · {shortDate(day.date)}</CardTitle>
          {hasAudio ? <Spectrogram house={detail.barn} day={day} />
            : <p className="text-sm text-slate-600">No microphone classification data for this house. The respiratory events you entered are shown on the right and in the trend below.</p>}
        </Card>

        <Card className="p-5">
          <CardTitle>Respiratory events / hour</CardTitle>
          <div className="space-y-1.5">
            {last5.map((d: any, k: number) => {
              const i = start + k
              const isAi = det && i === det.ai_index
              const isClassic = det && i === det.classic_index
              return (
                <div key={d.date} className={`grid grid-cols-[3.2rem_1fr_2.2rem] items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${isAi ? 'bg-emerald-50 ring-1 ring-emerald-400' : ''}`}>
                  <span className="font-semibold text-slate-700">Day {k + 1}</span>
                  <div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div className="h-3 rounded-full bg-[#2a78d6]" style={{ width: `${((d.values.cough ?? 0) / maxCough) * 100}%` }} title={`${shortDate(d.date)}: ${fmtVal('cough', d.values.cough)}`} />
                    </div>
                    {isAi && <div className="mt-0.5 text-[11px] font-bold text-emerald-700">← EARLY WARNING</div>}
                    {isClassic && <div className="mt-0.5 text-[11px] font-semibold text-slate-600">← traditional detection</div>}
                  </div>
                  <span className="text-right font-bold text-slate-900">{d.values.cough === null ? '—' : Number(d.values.cough.toFixed(1))}</span>
                </div>
              )
            })}
          </div>
          {ratio !== null && (
            <div className="mt-4 rounded-xl bg-slate-900 p-4 text-white">
              <div className="text-3xl font-extrabold">{ratio.toFixed(1)}× normal baseline</div>
              <div className="mt-1 text-sm text-slate-300">
                {det ? `on ${shortDate(focus.date)}, the day AIFARM DOCTOR raised its first warning` : 'today'} ({fmtVal('cough', focus.values.cough)} vs normal {fmtVal('cough', focus.baseline.cough)})
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        {hasAudio && (
          <Card className="p-5">
            <CardTitle>Sound classification · events per hour</CardTitle>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="py-1.5 font-semibold">Class</th><th className="text-right font-semibold">Now</th><th className="text-right font-semibold">Normal</th><th className="text-right font-semibold">Change</th></tr></thead>
              <tbody>
                {classes.map(([name, now, base]) => {
                  const x = now !== null && base ? now / base : null
                  return (
                    <tr key={name} className="border-t border-slate-100">
                      <td className="py-2 text-slate-700">{name}</td>
                      <td className="text-right font-semibold text-slate-900">{now === null ? '—' : Number(now.toFixed(1))}</td>
                      <td className="text-right text-slate-500">{base === null ? '—' : Number(base.toFixed(1))}</td>
                      <td className={`text-right font-semibold ${x !== null && x >= 1.5 ? 'text-red-700' : 'text-slate-600'}`}>{x === null ? '—' : Math.abs(x - 1) < 0.05 ? 'Normal' : `${x.toFixed(1)}×`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">"Unknown" sounds are counted but never interpreted as a health signal on their own.</p>
          </Card>
        )}
        <TrendChart title={`${farm.labels.cough} per hour — last 14 days`} metric="cough" days={detail.days.slice(offset)} offset={offset}
          detection={det} isAbnormal={(d) => d.components.cough >= 25} />
      </div>
    </div>
  )
}
