import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Badge, Button, Card, CardTitle, Ctx, PageHeader, shortDate, tone } from '../lib'

const TYPE_LABEL: Record<string, string> = { health: 'Health', environment: 'Environment', vaccination: 'Vaccination', biosecurity: 'Biosecurity' }
const TYPE_PAGE: Record<string, string> = { health: 'risk', environment: 'health', vaccination: 'vaccination', biosecurity: 'biosecurity' }
const SEVERITY_KIND: Record<string, string> = { high: 'CRITICAL', watch: 'WATCH', info: 'info' }
const SEVERITY_LABEL: Record<string, string> = { high: 'High risk', watch: 'Watch', info: 'Reminder' }

export default function Alerts({ ctx }: { ctx: Ctx }) {
  const { farm } = ctx
  const unit = farm.labels.unit
  const isHouse = (name: string) => farm.barns.some((b: any) => b.barn === name)

  return (
    <div className="space-y-5">
      <PageHeader title="Alerts" subtitle="Everything that needs a human decision today, most urgent first." />

      {farm.alerts.length === 0 && <Card className="border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">No alerts today. All signals are within their normal range.</Card>}
      <div className="space-y-3">
        {farm.alerts.map((a: any, i: number) => {
          const t = tone(SEVERITY_KIND[a.severity])
          return (
            <Card key={i} className={`p-4 ${t.border}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.bg}`}><t.Icon size={20} color={t.hex} strokeWidth={2.5} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{isHouse(a.barn) ? `${unit} ${a.barn}` : a.barn}</span>
                    <Badge kind={SEVERITY_KIND[a.severity]} label={SEVERITY_LABEL[a.severity]} />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{TYPE_LABEL[a.type]}</span>
                    {a.risk !== null && a.type === 'health' && <span className="text-xs font-semibold text-slate-600">Risk {a.risk}/100</span>}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">{a.title}</div>
                  <p className="text-sm text-slate-600">{a.message}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => ctx.go(TYPE_PAGE[a.type], isHouse(a.barn) ? a.barn : undefined)}>Investigate</Button>
                  {a.type === 'health' && <Button variant="ghost" onClick={() => ctx.ask(`Why is ${unit} ${a.barn} high risk?`)}>Ask Doctor</Button>}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="p-5">
        <CardTitle>What changed in the last 14 days</CardTitle>
        {farm.timeline.length === 0 ? <p className="text-sm text-slate-600">No risk level changes in the last 14 days.</p> : (
          <ol className="divide-y divide-slate-100">
            {farm.timeline.map((e: any, i: number) => (
              <li key={i} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-16 shrink-0 text-slate-500">{shortDate(e.date)}</span>
                {e.rising ? <ArrowUpRight size={16} className="shrink-0 text-red-600" /> : <ArrowDownRight size={16} className="shrink-0 text-emerald-600" />}
                <button className="w-12 shrink-0 text-left font-bold text-slate-900 hover:text-emerald-700" onClick={() => ctx.go('risk', e.barn)}>{e.barn}</button>
                <span className="text-slate-700">{e.text}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
