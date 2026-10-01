import { ArrowRight, MessageCircle, Play, Search } from 'lucide-react'
import { Badge, Button, Card, CardTitle, Ctx, fmtDev, fmtVal, num, Ring, Spark, tone } from '../lib'
import { Flows } from './Compare'

const LEVELS = ['LOW', 'WATCH', 'HIGH', 'CRITICAL']

export default function Overview({ ctx }: { ctx: Ctx }) {
  const { farm } = ctx
  const poultry = farm.farm_type === 'poultry'
  const { labels } = farm
  const top = farm.barns.find((b: any) => b.barn === farm.top_barn)
  const det = top.detection
  const v = farm.vaccination.summary
  const healthTone = farm.health_score >= 85 ? tone('LOW') : farm.health_score >= 70 ? tone('WATCH') : tone('CRITICAL')

  const heroRows: [string, string][] = [
    ['Farm Health Score', `${farm.health_score} / 100`],
    [labels.risk, top.level],
    [`Affected ${labels.unit.toLowerCase()}`, top.warned ? top.barn : 'None'],
    ['First anomaly detected', det ? `Day ${det.ai_day}` : '—'],
    ['Traditional detection', det ? (det.classic_day ? `Day ${det.classic_day}` : 'Not yet visible') : '—'],
  ]
  const gain = !det ? null : det.lead_days === null ? 'AHEAD OF VISIBLE SIGNS' : det.lead_days === 0 ? 'SAME DAY' : `${det.lead_days} DAY${det.lead_days > 1 ? 'S' : ''}`

  const alertMetrics = [
    ['cough', labels.cough], ['activity', labels.activity], ['feed', 'Feed intake'], ['water', 'Water intake'],
    ...(poultry ? [['eggs', 'Egg production']] : []),
  ].filter(([k]) => top.dev[k] !== null && top.dev[k] !== undefined)

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ first screen: the sales message */}
      <section className="overflow-hidden rounded-3xl bg-slate-900 text-white shadow-lg">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_1fr] lg:p-8">
          <div>
            <div className="text-sm font-semibold text-emerald-300">{labels.icon} AIFARM DOCTOR · {farm.farm}</div>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {poultry ? <>CHICKEN INFLUENZA<br />EARLY WARNING</> : <>PREVENTIVE HEALTH<br />EARLY WARNING</>}
            </h1>
            <p className="mt-3 max-w-md text-slate-300">
              {poultry
                ? 'Detect the outbreak signal before the outbreak becomes obvious.'
                : 'Detect health risk earlier. Prevent outbreaks. Improve vaccination control.'}
            </p>

            <div className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">Farm outbreak risk</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEVELS.map((lv) => {
                const t = tone(lv)
                const on = lv === top.level
                return (
                  <span key={lv} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold ${on ? `${t.solid} text-white ring-2 ring-white/70` : 'bg-white/5 text-slate-500'}`}>
                    {on && <t.Icon size={16} strokeWidth={2.5} />} {lv}
                  </span>
                )
              })}
            </div>
            <p className="mt-3 text-sm text-slate-300">
              {top.warned
                ? <><strong className="text-white">{top.pattern} detected</strong> in {labels.unit} {top.barn}. {poultry ? 'Laboratory confirmation is required for any diagnosis.' : 'Veterinary review recommended.'}</>
                : <>No abnormal pattern detected. All {labels.unit.toLowerCase()}s are within their normal range.</>}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={ctx.openStory} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-emerald-400">
                <Play size={15} fill="currentColor" /> {poultry ? 'RUN INFLUENZA OUTBREAK DEMO' : 'RUN DEMO STORY'}
              </button>
              <button onClick={() => ctx.go('risk', top.barn)} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
                Why? See the risk breakdown <ArrowRight size={15} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <dl className="divide-y divide-white/10">
              {heroRows.map(([k, val]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-sm text-slate-300">{k}</dt>
                  <dd className="text-lg font-bold">{val}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-xl bg-emerald-500 px-4 py-3 text-slate-900">
              <div className="text-xs font-bold uppercase tracking-wider">Early warning gain</div>
              <div className="text-3xl font-extrabold">{gain ?? 'NO ACTIVE WARNING'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ farm status */}
      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-5 p-5">
          <Ring value={farm.health_score} color={healthTone.hex} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Overall health score</div>
            <div className="mt-2 space-y-1.5 text-sm">
              {(['healthy', 'watch', 'high'] as const).map((s) => (
                <div key={s} className="flex items-center justify-between gap-6">
                  <Badge kind={s} /> <span className="font-bold text-slate-900">{farm.counts[s]}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-500">{num(farm.total_animals)} {labels.animals} monitored</div>
          </div>
        </Card>

        <Card className="p-5">
          <CardTitle right={<button className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => ctx.go('health')}>Open {poultry ? 'flock' : 'barn'} health →</button>}>
            {labels.unit}s — click one to investigate
          </CardTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            {farm.barns.map((b: any) => {
              const t = tone(b.level)
              return (
                <button key={b.barn} onClick={() => ctx.go('risk', b.barn)}
                  className={`rounded-xl border p-3 text-left transition hover:shadow-md ${t.bg} ${t.border}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-slate-900">{b.barn}</span>
                    <t.Icon size={18} color={t.hex} strokeWidth={2.5} />
                  </div>
                  <div className={`text-xs font-bold ${t.text}`}>{b.level}</div>
                  <div className="mt-1 flex items-end justify-between">
                    <span className="text-xl font-bold text-slate-900">{b.risk}</span>
                    <Spark values={b.spark} color={t.hex} width={56} height={22} />
                  </div>
                </button>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------ today's alert + daily brief */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle right={<Badge kind={top.level} />}>Today's alerts</CardTitle>
          {top.warned ? (
            <>
              <div className="text-lg font-bold text-slate-900">{labels.unit} {top.barn}</div>
              <div className="text-sm text-slate-600">{top.pattern} detected</div>
              <dl className="mt-3 divide-y divide-slate-100 text-sm">
                {alertMetrics.map(([k, name]) => (
                  <div key={k} className="flex justify-between py-1.5">
                    <dt className="text-slate-600">{name}</dt>
                    <dd className="font-semibold text-slate-900">{fmtDev(k, top.dev[k])}</dd>
                  </div>
                ))}
                <div className="flex justify-between py-1.5">
                  <dt className="text-slate-600">Humidity</dt>
                  <dd className="font-semibold text-slate-900">{fmtVal('humidity', top.values.humidity)}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="font-semibold text-slate-800">AI risk score</dt>
                  <dd className="text-lg font-bold text-slate-900">{top.risk} / 100</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => ctx.go('risk', top.barn)}><Search size={15} /> INVESTIGATE</Button>
                <Button variant="ghost" onClick={() => ctx.ask(`Why is ${labels.unit} ${top.barn} high risk?`)}>
                  <MessageCircle size={15} /> ASK AIFARM DOCTOR
                </Button>
              </div>
              {farm.alerts.length > 1 && (
                <button className="mt-3 text-xs font-semibold text-emerald-700 hover:underline" onClick={() => ctx.go('alerts')}>
                  + {farm.alerts.length - 1} more alert{farm.alerts.length > 2 ? 's' : ''} →
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">No health alerts today. {farm.alerts.length > 0 && `${farm.alerts.length} reminder(s) on the Alerts page.`}</p>
          )}
        </Card>

        <Card className="p-5">
          <CardTitle>Today's AIFARM DOCTOR brief</CardTitle>
          <div className="text-sm font-semibold text-slate-900">Farm health: {farm.briefing.health_score}/100</div>
          <ol className="mt-3 space-y-3">
            {farm.briefing.priorities.map((p: any, i: number) => (
              <li key={i}>
                <button className="group flex w-full gap-3 text-left" onClick={() => ctx.go(p.page, farm.barns.some((b: any) => b.barn === p.barn) ? p.barn : undefined)}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{i + 1}</span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900 group-hover:text-emerald-700">{p.title}</span>
                    <span className="block text-sm text-slate-600">{p.reason}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {farm.briefing.note && <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{farm.briefing.note}</p>}
        </Card>
      </div>

      {/* ------------------------------------------------ vaccination + the business problem */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <Card className="p-5" onClick={() => ctx.go('vaccination')}>
          <CardTitle>Vaccination</CardTitle>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{v.compliance}%</span>
            <span className="text-sm text-slate-600">compliance</span>
          </div>
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            {[['Due this week', v.due], ['Overdue', v.overdue], ['Missing records', v.missing]].map(([k, n]) => (
              <div key={k} className="flex justify-between py-1.5">
                <dt className="text-slate-600">{k}</dt>
                <dd className="font-semibold text-slate-900">{num(n as number)} {labels.animals}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-5">
          <CardTitle>Why earlier matters</CardTitle>
          <Flows poultry={poultry} />
        </Card>
      </div>
    </div>
  )
}
