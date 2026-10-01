import { ArrowRight } from 'lucide-react'
import { Card, CardTitle, Ctx, num, Ring, Spark, tone } from '../lib'

// Three colours only, each with its own icon and label: green = healthy, orange = risk coming, red = high risk.
const LIGHTS = {
  green: { ...tone('LOW'), label: 'Healthy' },
  orange: { ...tone('HIGH'), label: 'Risk coming' },
  red: { ...tone('CRITICAL'), label: 'High risk' },
}
type Light = keyof typeof LIGHTS
const STATUS_LIGHT: Record<string, Light> = { healthy: 'green', watch: 'orange', high: 'red' }
const bySeverity = (score: number): Light => (score < 20 ? 'green' : score < 50 ? 'orange' : 'red')

function signalLights(b: any, poultry: boolean, labels: any): [string, Light][] {
  const c = b.components
  const vacc = b.vaccination?.status
  const out: [string, Light][] = [
    [poultry ? 'Sound' : 'Cough', bySeverity(c.cough)],
    [poultry ? 'Movement' : 'Activity', bySeverity(c.activity)],
    ['Feed', bySeverity(c.feed)],
    ['Water', bySeverity(c.water)],
  ]
  if (poultry && b.values.eggs !== null) out.push(['Eggs', bySeverity(c.eggs)])
  out.push(['Mortality', bySeverity(c.mortality)], ['Environment', bySeverity(c.environment)])
  if (vacc) out.push(['Vaccination', vacc === 'OK' ? 'green' : vacc === 'Due' ? 'orange' : 'red'])
  if (poultry) out.push(['Biosecurity', c.biosecurity <= 0 ? 'green' : c.biosecurity < 50 ? 'orange' : 'red'])
  return out
}

/** Farm health at a glance: animals by status, then one traffic-light card per house. */
export default function HealthBoard({ ctx }: { ctx: Ctx }) {
  const { farm } = ctx
  const poultry = farm.farm_type === 'poultry'
  const { labels } = farm
  const unit = labels.unit.toLowerCase()

  const groups = (['green', 'orange', 'red'] as Light[]).map((light) => {
    const houses = farm.barns.filter((b: any) => STATUS_LIGHT[b.status] === light)
    return { light, houses, animals: houses.reduce((n: number, b: any) => n + (b.animal_count || 0), 0) }
  })
  const total = farm.total_animals || 1
  const healthLight: Light = farm.health_score >= 85 ? 'green' : farm.health_score >= 70 ? 'orange' : 'red'

  return (
    <Card className="p-5">
      <CardTitle right={<button className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => ctx.go('health')}>Open {poultry ? 'flock' : 'barn'} health →</button>}>
        Farm health dashboard
      </CardTitle>

      {/* animals by status */}
      <div className="grid items-center gap-5 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4">
          <Ring value={farm.health_score} color={LIGHTS[healthLight].hex} size={104} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Overall health score</div>
            <div className="text-sm text-slate-600">{num(farm.total_animals)} {labels.animals} in {farm.barns.length} {unit}s</div>
          </div>
        </div>
        <div>
          <div className="flex h-5 gap-[2px] overflow-hidden rounded-full">
            {groups.filter((g) => g.animals > 0).map((g) => (
              <div key={g.light} className={LIGHTS[g.light].solid} style={{ width: `${(g.animals / total) * 100}%` }}
                title={`${LIGHTS[g.light].label}: ${num(g.animals)} ${labels.animals}`} />
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {groups.map((g) => {
              const t = LIGHTS[g.light]
              return (
                <div key={g.light} className={`rounded-xl border p-3 ${t.bg} ${t.border}`}>
                  <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${t.text}`}><t.Icon size={15} strokeWidth={2.5} /> {t.label}</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{num(g.animals)} <span className="text-sm font-medium text-slate-600">{labels.animals}</span></div>
                  <div className="text-xs text-slate-600">
                    {g.houses.length} {unit}{g.houses.length === 1 ? '' : 's'}{g.houses.length > 0 && `: ${g.houses.map((b: any) => b.barn).join(', ')}`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* one card per house */}
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {farm.barns.map((b: any) => {
          const light = STATUS_LIGHT[b.status]
          const t = LIGHTS[light]
          const v = b.values
          const deaths = v.mortality === null ? null : Math.round((v.mortality / 100) * b.animal_count)
          const extraInactive = v.inactive !== null && b.baseline.inactive !== null
            ? Math.round(((v.inactive - b.baseline.inactive) / 100) * b.animal_count) : null
          return (
            <button key={b.barn} onClick={() => ctx.go('risk', b.barn)}
              className={`group overflow-hidden rounded-xl border bg-white text-left transition hover:shadow-md ${t.border}`}>
              <div className={`flex items-center justify-between gap-2 px-4 py-2.5 ${t.bg}`}>
                <div className="flex items-center gap-2">
                  <t.Icon size={20} color={t.hex} strokeWidth={2.5} />
                  <span className="text-base font-bold text-slate-900">{labels.unit} {b.barn}</span>
                </div>
                <span className={`text-xs font-bold uppercase tracking-wide ${t.text}`}>{t.label}</span>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-2xl font-bold leading-none text-slate-900">{b.risk}<span className="text-sm font-medium text-slate-500"> / 100 risk</span></div>
                    <div className="mt-1 text-sm text-slate-600">{num(b.animal_count)} {labels.animals}</div>
                  </div>
                  <Spark values={b.spark} color={t.hex} width={84} height={30} />
                </div>

                <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                  {v.active !== null && <div>Active {v.active.toFixed(0)}% · inactive {v.inactive.toFixed(0)}%{extraInactive !== null && extraInactive >= 50 && <strong className="text-slate-900"> (≈{num(extraInactive)} more than normal)</strong>}</div>}
                  {deaths !== null && <div>Losses today: {deaths} {deaths === 1 ? labels.animals.slice(0, -1) : labels.animals} ({v.mortality.toFixed(2)}%)</div>}
                  {b.warned && <div className="font-semibold text-slate-900">{b.pattern}</div>}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {signalLights(b, poultry, labels).map(([name, l]) => {
                    const s = LIGHTS[l]
                    return (
                      <span key={name} title={`${name}: ${s.label.toLowerCase()}`}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.border} ${s.text}`}>
                        <s.Icon size={11} strokeWidth={2.5} /> {name}
                      </span>
                    )
                  })}
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-700 opacity-0 transition group-hover:opacity-100">Investigate <ArrowRight size={13} /></div>
              </div>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Green = within normal range. Orange = risk coming: early signals, keep a close watch. Red = high risk: inspect now.
        Each small tag is one signal compared with that {unit}'s own normal.
      </p>
    </Card>
  )
}
