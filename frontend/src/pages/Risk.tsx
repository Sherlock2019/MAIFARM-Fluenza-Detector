import { useState } from 'react'
import { HelpCircle, ListChecks, MessageCircle } from 'lucide-react'
import { ChartLegend, TrendChart } from '../charts'
import { Badge, Button, Card, CardTitle, Ctx, DetectionCompare, fmtDev, HouseTabs, num, PageHeader, Ring, SafetyNote, Segmented, tone } from '../lib'

const COMPONENT_NAMES: Record<string, string> = {
  cough: 'Respiratory audio', activity: 'Activity / movement drop', feed: 'Feed drop', water: 'Water drop',
  mortality: 'Mortality', eggs: 'Egg production drop', posture: 'Abnormal posture', environment: 'Environment',
  biosecurity: 'Biosecurity',
}

export function Contributors({ barn }: { barn: any }) {
  if (!barn.contributors.length) return <p className="text-sm text-slate-600">No signal is adding to the risk score right now.</p>
  const max = Math.max(...barn.contributors.map((c: any) => c.share))
  return (
    <div className="space-y-2">
      {barn.contributors.map((c: any) => (
        <div key={c.key} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate text-slate-700">{c.label}</span>
          <div className="h-3 rounded-full bg-slate-100">
            <div className="h-3 rounded-full bg-[#2a78d6]" style={{ width: `${(c.share / max) * 100}%` }} />
          </div>
          <span className="text-right font-semibold text-slate-900">{c.share}%</span>
        </div>
      ))}
    </div>
  )
}

export function Explanation({ barn, farm }: { barn: any; farm: any }) {
  const e = barn.explanation
  return (
    <Card className="pop-in border-emerald-300 p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">AIFARM DOCTOR analysis</div>
      <p className="mt-2 font-semibold text-slate-900">{e.summary}</p>
      {e.signals.length > 0 && (
        <ol className="mt-3 space-y-1.5 text-sm text-slate-700">
          {e.signals.map((s: string, i: number) => (
            <li key={i} className="flex gap-2"><span className="w-5 shrink-0 font-semibold text-slate-400">{i + 1}.</span>{s}</li>
          ))}
        </ol>
      )}
      {e.timing && <p className="mt-3 text-sm text-slate-700">{e.timing}</p>}
      {e.context && <p className="mt-1 text-sm text-slate-700">{e.context}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Recommended</div>
          <ul className="mt-1 space-y-1 text-sm text-slate-800">
            {e.recommended.map((r: string) => <li key={r}>• {r}</li>)}
          </ul>
        </div>
        {e.checks.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Check</div>
            <ul className="mt-1 space-y-1 text-sm text-slate-800">
              {e.checks.map((c: string) => <li key={c}>• {c}</li>)}
            </ul>
          </div>
        )}
      </div>
      {e.disclaimer && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{e.disclaimer}</p>}
      <p className="mt-2 text-xs text-slate-500">{farm.safety}</p>
    </Card>
  )
}

export default function Risk({ ctx }: { ctx: Ctx }) {
  const { farm, detail } = ctx
  const [why, setWhy] = useState(false)
  const [range, setRange] = useState<'5' | '14' | '30'>('14')
  const poultry = farm.farm_type === 'poultry'
  const { labels } = farm
  const title = poultry ? 'Influenza Risk' : 'Health Risk'

  if (!detail) return <><PageHeader title={title} /><HouseTabs ctx={ctx} /><p className="mt-6 text-sm text-slate-500">Loading…</p></>

  const t = tone(detail.level)
  const n = detail.days.length
  const offset = Math.max(0, n - Number(range))
  const days = detail.days.slice(offset)
  const comp = (key: string) => (d: any) => d.components[key] >= 25
  const vac = detail.vaccination
  const charts: [string, string, (d: any) => boolean, [number, number]?][] = [
    ['risk', `${labels.risk} score`, (d) => d.warned, [0, 100]],
    ['cough', `${labels.cough} per hour`, comp('cough')],
    ['activity', `${labels.activity} score`, comp('activity')],
    ['feed', 'Feed intake', comp('feed')],
    ['water', 'Water consumption', comp('water')],
    ['eggs', 'Egg production (lay rate)', comp('eggs')],
    ['mortality', 'Daily mortality', comp('mortality')],
    ['humidity', 'Humidity', (d) => d.env.humidity >= 25],
  ]

  return (
    <div className="space-y-5">
      <PageHeader title={title}
        subtitle={poultry
          ? 'A transparent score that combines sound, camera, feed, water, production, environment and biosecurity signals for each house.'
          : 'A transparent score that combines feed, water, activity, cough, mortality and environment signals for each barn.'}
        right={<HouseTabs ctx={ctx} />} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className={`p-5 ${t.border}`}>
          <CardTitle right={<Badge kind={detail.level} size="lg" />}>{labels.risk} · {labels.unit} {detail.barn}</CardTitle>
          <div className="flex items-center gap-5">
            <Ring value={detail.risk} color={t.hex} size={132} />
            <div className="text-sm">
              <div className="text-base font-bold text-slate-900">{detail.pattern}</div>
              <div className="mt-1 text-slate-600">
                {detail.risk_delta_48h > 0 ? `Up ${detail.risk_delta_48h} points` : detail.risk_delta_48h < 0 ? `Down ${-detail.risk_delta_48h} points` : 'No change'} in 48 hours
              </div>
              <div className="mt-1 text-slate-600">{num(detail.animal_count)} {labels.animals} · {detail.breed}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-lg border border-slate-200 text-center text-[11px] font-bold">
            {(['LOW', 'WATCH', 'HIGH', 'CRITICAL'] as const).map((lv, i) => {
              const from = lv === 'LOW' ? 0 : farm.engine.levels[lv]
              const to = i === 3 ? 100 : farm.engine.levels[['WATCH', 'HIGH', 'CRITICAL'][i]] - 1
              const on = lv === detail.level
              return (
                <div key={lv} className={`py-1.5 ${on ? `${tone(lv).solid} text-white` : 'bg-slate-50 text-slate-500'}`}>
                  {lv}<div className="font-normal">{from}–{to}</div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="p-5">
          <CardTitle>What is driving the score</CardTitle>
          <Contributors barn={detail} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="dark" onClick={() => setWhy((w) => !w)}>
              <HelpCircle size={16} /> {poultry ? 'WHY DOES AIFARM DOCTOR THINK THERE IS A RISK?' : `WHY IS THIS ${labels.unit.toUpperCase()} ${detail.level === 'LOW' ? 'LOW' : 'HIGH'} RISK?`}
            </Button>
            <Button variant="ghost" onClick={() => ctx.ask(`Why is ${labels.unit} ${detail.barn} high risk?`)}>
              <MessageCircle size={15} /> Ask Doctor
            </Button>
          </div>
        </Card>
      </div>

      {why && <Explanation barn={detail} farm={farm} />}

      {detail.detection && (
        <Card className="p-5">
          <CardTitle>Classic detection vs AIFARM DOCTOR</CardTitle>
          <DetectionCompare detection={detail.detection} unit={labels.unit} barn={detail.barn} />
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {detail.response_plan.length > 0 && (
          <Card className="border-red-200 p-5">
            <CardTitle right={<ListChecks size={18} className="text-red-600" />}>AIFARM DOCTOR response plan</CardTitle>
            <ol className="space-y-2 text-sm text-slate-800">
              {detail.response_plan.map((s: string, i: number) => (
                <li key={s} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-slate-500">
              AIFARM DOCTOR never decides on medication or culling. Those decisions belong to the veterinarian and the animal-health authority.
            </p>
          </Card>
        )}
        {vac && (
          <Card className="p-5">
            <CardTitle right={<Badge kind={vac.status} />}>{poultry ? 'Flock' : 'Barn'} {detail.barn} · vaccination</CardTitle>
            <dl className="divide-y divide-slate-100 text-sm">
              {[
                [labels.animals[0].toUpperCase() + labels.animals.slice(1), num(vac.animals)],
                ['Vaccination compliance', `${vac.completion}%`],
                ['Vaccinated', num(vac.vaccinated)],
                ['Due this week', num(vac.due)],
                ['Missing records', num(vac.missing)],
                ['Overdue', num(vac.overdue)],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between py-1.5">
                  <dt className="text-slate-600">{k}</dt><dd className="font-semibold text-slate-900">{val}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-slate-600">
              Vaccination status contributes to outbreak risk assessment, but does not by itself confirm or exclude infection.
              Changes to the vaccination program need veterinary input.
            </p>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Trends for {labels.unit} {detail.barn}</h2>
        <div className="flex flex-wrap items-center gap-4">
          <ChartLegend />
          <Segmented value={range} onChange={setRange} options={[{ value: '5', label: '5 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }]} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {charts.map(([metric, name, abnormal, domain]) => (
          <TrendChart key={metric} title={name} metric={metric} days={days} offset={offset} detection={detail.detection} isAbnormal={abnormal} yDomain={domain} />
        ))}
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Technical details — how the score of {detail.risk} was calculated</summary>
        <p className="mt-3 text-sm text-slate-600">
          Each signal is compared with the house's own normal level (median of the previous {farm.engine.baseline_window} days),
          converted to an anomaly score from 0 to 100, then multiplied by its weight. The risk score is the sum of the points.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2">Signal</th><th>Change vs normal</th><th className="text-right">Anomaly (0–100)</th><th className="text-right">Weight</th><th className="text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(farm.engine.weights).map(([k, w]: [string, any]) => (
                <tr key={k} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-800">{COMPONENT_NAMES[k]}</td>
                  <td className="text-slate-600">
                    {k === 'environment' ? `worst factor: ${detail.env_driver}` : k === 'biosecurity' ? `warnings in last ${farm.biosecurity.window_days} days` : fmtDev(k, detail.dev[k])}
                  </td>
                  <td className="text-right">{detail.components[k].toFixed(0)}</td>
                  <td className="text-right">{w.toFixed(2)}</td>
                  <td className="text-right font-semibold">{(detail.components[k] * w).toFixed(1)}</td>
                </tr>
              ))}
              <tr><td className="py-2 font-bold" colSpan={4}>Risk score</td><td className="text-right font-bold">{detail.risk}</td></tr>
            </tbody>
          </table>
        </div>
      </details>

      <SafetyNote text={farm.safety} />
    </div>
  )
}
