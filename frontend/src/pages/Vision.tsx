import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { Badge, Card, CardTitle, Ctx, DayTabs, fmtVal, HouseTabs, num, PageHeader, seeded, shortDate } from '../lib'

const FLAGS = {
  inactive: { label: 'inactive', color: '#fbbf24', dash: '0', tag: 'I' },
  beak: { label: 'open-beak breathing', color: '#f87171', dash: '6 3', tag: 'B' },
  posture: { label: 'abnormal neck posture', color: '#c4b5fd', dash: '2 3', tag: 'P' },
} as const
type Flag = keyof typeof FLAGS

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const clusterLevel = (index: number) => (index < 30 ? 'LOW' : index < 45 ? 'MODERATE' : 'HIGH')
const LEVEL_KIND: Record<string, string> = { LOW: 'NORMAL', MODERATE: 'WATCH', HIGH: 'CRITICAL', NORMAL: 'NORMAL', REDUCED: 'WATCH' }

/** Synthetic camera frame: positions are generated, flags follow the day's camera metrics. */
function useScene(house: string, day: any) {
  return useMemo(() => {
    const v = day.values
    const pull = clamp((v.clustering - 22) / 55, 0, 0.65)
    const rnd = seeded(house)
    const birds = Array.from({ length: 64 }, (_, i) => {
      let x = 24 + rnd() * 592
      let y = 34 + rnd() * 300
      // every 5th bird is a candidate for a detection box and stays put, so the boxes remain readable
      const joins = rnd() < pull && i % 5 !== 3
      const tx = 424 + rnd() * 196
      const ty = 36 + rnd() * 130
      if (joins) { x = tx; y = ty }
      return { i, x, y, angle: rnd() * 360, id: 100 + Math.floor(rnd() * 800), flag: null as Flag | null }
    })
    const counts: [Flag, number][] = [
      ['inactive', clamp(Math.round((v.inactive - 7) / 2), 0, 6)],
      ['beak', clamp(Math.round((v.open_beak - 1) / 2.75), 0, 4)],
      ['posture', clamp(Math.round((v.posture - 2) / 2.3), 0, 3)],
    ]
    const fixedIds: Record<Flag, number> = { inactive: 124, beak: 207, posture: 311 }
    let cursor = 3
    for (const [flag, count] of counts) {
      for (let k = 0; k < count; k++) {
        const b = birds[cursor]
        cursor += 5
        b.flag = flag
        if (k === 0) b.id = fixedIds[flag]
      }
    }
    return { birds, pull }
  }, [house, day])
}

function CameraFeed({ house, day }: { house: string; day: any }) {
  const { birds } = useScene(house, day)
  const level = clusterLevel(day.values.clustering)
  const labelled = new Set<Flag>()
  return (
    <div className="overflow-hidden rounded-xl bg-black">
      <svg viewBox="0 0 640 360" className="block w-full" role="img" aria-label={`Synthetic camera view of house ${house} with detection boxes`}>
        <rect width="640" height="360" fill="#36302a" />
        {[120, 245].map((y) => <rect key={y} x="0" y={y} width="640" height="7" fill="#5d5548" />)}
        <text x="632" y="114" textAnchor="end" fontSize="9" fill="#9a917f">FEEDER LINE</text>
        <text x="632" y="239" textAnchor="end" fontSize="9" fill="#9a917f">DRINKER LINE</text>

        {birds.map((b) => (
          <g key={b.i} transform={`translate(${b.x} ${b.y}) rotate(${b.angle})`}>
            <ellipse rx="11" ry="8" fill="#eadfca" />
            <circle cx="11" cy="0" r="4.2" fill="#f4ecdc" />
            <circle cx="14" cy="-2" r="1.6" fill="#c2413b" />
          </g>
        ))}

        {level !== 'LOW' && (
          <g>
            <rect x="408" y="22" width="226" height="158" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="8 5" />
            <rect x="408" y="180" width="150" height="30" fill="#000" opacity="0.78" />
            <text x="414" y="193" fontSize="10" fontWeight="700" fill="#fbbf24">Zone B</text>
            <text x="414" y="205" fontSize="9.5" fill="#fff">{level === 'HIGH' ? 'Clustering anomaly detected' : 'Denser than normal'}</text>
          </g>
        )}

        {birds.map((b) => {
          if (!b.flag) {
            return b.i % 4 === 0 ? <rect key={b.i} x={b.x - 16} y={b.y - 14} width="32" height="28" fill="none" stroke="#34d399" strokeWidth="1" opacity="0.7" /> : null
          }
          const f = FLAGS[b.flag]
          const first = !labelled.has(b.flag)
          labelled.add(b.flag)
          const lx = clamp(b.x - 18, 4, 640 - 150)
          const ly = b.y > 60 ? b.y - 44 : b.y + 20
          return (
            <g key={b.i}>
              <rect x={b.x - 18} y={b.y - 16} width="36" height="32" fill="none" stroke={f.color} strokeWidth="2" strokeDasharray={f.dash} />
              {first ? (
                <g>
                  <rect x={lx} y={ly} width="146" height="26" rx="3" fill="#000" opacity="0.78" />
                  <text x={lx + 5} y={ly + 11} fontSize="9.5" fontWeight="700" fill={f.color}>Bird #{b.id}</text>
                  <text x={lx + 5} y={ly + 22} fontSize="9.5" fill="#fff">Status: {f.label}</text>
                </g>
              ) : (
                <g>
                  <rect x={b.x + 9} y={b.y - 25} width="11" height="11" fill="#000" opacity="0.78" />
                  <text x={b.x + 14.5} y={b.y - 16.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={f.color}>{f.tag}</text>
                </g>
              )}
            </g>
          )
        })}

        <rect x="0" y="0" width="640" height="18" fill="#000" opacity="0.55" />
        <circle cx="10" cy="9" r="3.5" fill="#ef4444" />
        <text x="19" y="12.5" fontSize="10" fontWeight="700" fill="#fff">CAM 02 · HOUSE {house} · {shortDate(day.date)}</text>
        <text x="632" y="12.5" textAnchor="end" fontSize="9.5" fill="#d6d3d1">SYNTHETIC DEMO FEED</text>
      </svg>
    </div>
  )
}

function Heatmap({ house, day }: { house: string; day: any }) {
  const cells = useMemo(() => {
    const rnd = seeded(house + 'heat')
    const pull = clamp((day.values.clustering - 22) / 55, 0, 0.65)
    const raw: number[] = []
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 16; c++) {
        raw.push(1 + 0.4 * (rnd() - 0.5) + pull * 7 * Math.exp(-((c - 13.6) ** 2 / 7 + (r - 0.7) ** 2 / 2.6)))
      }
    }
    const max = Math.max(...raw)
    return raw.map((d) => d / max)
  }, [house, day])
  // one hue, light -> dark = fewer -> more birds
  const fill = (t: number) => {
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
    return `rgb(${mix(230, 13)},${mix(238, 79)},${mix(251, 168)})`
  }
  return (
    <div>
      <div className="relative rounded-lg border-2 border-slate-400 p-1">
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-1.5 text-[10px] font-bold text-slate-500">NORTH</span>
        <span className="absolute -right-1 top-1/2 -translate-y-1/2 rotate-90 bg-white px-1.5 text-[10px] font-bold text-slate-500">EAST</span>
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
          {cells.map((t, i) => (
            <div key={i} className="aspect-square rounded-[3px]" style={{ background: fill(t) }} title={`Bird density: ${Math.round(t * 100)}% of the busiest area`} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        Fewer birds
        <span className="h-2.5 w-28 rounded-full" style={{ background: 'linear-gradient(to right, rgb(230,238,251), rgb(13,79,168))' }} />
        More birds
      </div>
    </div>
  )
}

export default function Vision({ ctx }: { ctx: Ctx }) {
  const { farm, detail } = ctx
  const [index, setIndex] = useState(-1)
  useEffect(() => setIndex(-1), [ctx.house])
  if (!detail) return <><PageHeader title="AI Vision" right={<HouseTabs ctx={ctx} />} /><p className="text-sm text-slate-500">Loading…</p></>

  const day = detail.days[index < 0 ? detail.days.length - 1 : Math.min(index, detail.days.length - 1)]
  const dayIndex = detail.days.indexOf(day)
  const v = day.values
  const b = day.baseline
  const header = (
    <PageHeader title="AI Vision" subtitle="Cameras in the house track how the flock moves, feeds, drinks and spreads out — and flag behaviour that differs from this flock's own normal."
      right={<HouseTabs ctx={ctx} />} />
  )
  if (v.clustering === null || v.clustering === undefined) {
    return <>{header}<Card className="p-6 text-sm text-slate-600">No camera data is available for {farm.labels.unit} {detail.barn}. Camera-derived signals are part of the Demo Farm; your own data uses the movement score you entered.</Card></>
  }

  const cluster = clusterLevel(v.clustering)
  const movement = day.dev.activity <= -15 ? 'LOW' : day.dev.activity <= -6 ? 'REDUCED' : 'NORMAL'
  const abnormal = cluster !== 'LOW' || movement !== 'NORMAL'
  const rows: [string, string, string][] = [
    ['Active birds', fmtVal('active', v.active), fmtVal('active', b.active)],
    ['Inactive birds', fmtVal('inactive', v.inactive), fmtVal('inactive', b.inactive)],
    ['Feeder visits', fmtVal('feeder', v.feeder), fmtVal('feeder', b.feeder)],
    ['Drinker visits', fmtVal('drinker', v.drinker), fmtVal('drinker', b.drinker)],
    ['Open-beak breathing', fmtVal('open_beak', v.open_beak), fmtVal('open_beak', b.open_beak)],
    ['Abnormal head / neck posture', fmtVal('posture', v.posture), fmtVal('posture', b.posture)],
    ['Balance abnormalities', fmtVal('balance', v.balance), fmtVal('balance', b.balance)],
    ['Immobile birds', fmtVal('immobile', v.immobile), fmtVal('immobile', b.immobile)],
  ]

  return (
    <div className="space-y-5">
      {header}
      <DayTabs detail={detail} index={dayIndex} onChange={setIndex} />

      <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-900 px-4 py-3 text-sm font-bold tracking-wide text-white">
        <Eye size={18} className="shrink-0 text-emerald-300" /> AI VISION IS SCREENING BEHAVIOR, NOT DIAGNOSING DISEASE.
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-4">
          <CardTitle right={<span className="text-xs text-slate-500">Synthetic demo detections</span>}>Camera · {farm.labels.unit} {detail.barn}</CardTitle>
          <CameraFeed house={detail.barn} day={day} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 border border-emerald-500" /> tracked, normal</span>
            {Object.values(FLAGS).map((f) => (
              <span key={f.tag} className="flex items-center gap-1.5">
                <span className="inline-flex h-3.5 w-4 items-center justify-center border-2 text-[8px] font-bold" style={{ borderColor: f.color, borderStyle: f.dash === '0' ? 'solid' : 'dashed' }}>{f.tag}</span>
                {f.label}
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <CardTitle>Camera metrics · {shortDate(day.date)}</CardTitle>
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-2">
            <span className="text-sm text-slate-600">Tracked birds</span>
            <span className="text-xl font-bold text-slate-900">{num(day.animal_count * 0.842)}</span>
          </div>
          <table className="mt-1 w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="py-1.5 font-semibold">Signal</th><th className="text-right font-semibold">Now</th><th className="text-right font-semibold">Expected</th></tr></thead>
            <tbody>
              {rows.map(([name, now, expected]) => (
                <tr key={name} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-700">{name}</td>
                  <td className="text-right font-semibold text-slate-900">{now}</td>
                  <td className="text-right text-slate-500">{expected}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-600">Clustering index</span>
            <Badge kind={LEVEL_KIND[cluster]} label={`${cluster} (${v.clustering.toFixed(0)})`} />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <CardTitle>Flock movement heatmap · overhead view of {farm.labels.unit} {detail.barn}</CardTitle>
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <Heatmap house={detail.barn} day={day} />
          <div className="text-sm">
            <dl className="space-y-2">
              <div className="flex items-center justify-between"><dt className="text-slate-600">Bird distribution</dt><dd className="font-bold text-slate-900">{cluster === 'LOW' ? 'EVEN' : 'UNEVEN'}</dd></div>
              {cluster !== 'LOW' && <div className="flex items-center justify-between"><dt className="text-slate-600">Large concentration</dt><dd className="font-bold text-slate-900">North-east corner</dd></div>}
              <div className="flex items-center justify-between"><dt className="text-slate-600">Movement</dt><dd><Badge kind={movement === 'LOW' ? 'CRITICAL' : LEVEL_KIND[movement]} label={movement} /></dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-600">Clustering</dt><dd><Badge kind={LEVEL_KIND[cluster]} label={cluster} /></dd></div>
            </dl>
            {abnormal ? (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <div className="font-semibold">Possible environmental or health abnormality.</div>
                <div className="mt-1">Inspect:</div>
                <ul className="mt-0.5 space-y-0.5">
                  {['ventilation', 'temperature', 'water', 'respiratory health'].map((x) => <li key={x}>• {x}</li>)}
                </ul>
                <p className="mt-2 text-xs">Birds can also huddle because of draughts, cold spots or a blocked drinker line, so clustering alone does not indicate disease.</p>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">Birds are spread evenly through the house. No clustering anomaly.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
