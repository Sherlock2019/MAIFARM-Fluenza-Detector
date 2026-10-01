import { AudioLines, Camera, Droplets, Egg, Thermometer, Wheat } from 'lucide-react'
import { Badge, Card, CardTitle, Ctx, fmtDev, fmtVal, HouseTabs, num, PageHeader, Spark, tone } from '../lib'

const GROUP_ICONS: Record<string, any> = {
  Camera, Microphone: AudioLines, 'Water sensor': Droplets, 'Feed sensor': Wheat, Environment: Thermometer, Production: Egg,
}

function change(item: any): string {
  if (item.mode === 'env' || item.mode === 'vent') return item.status === 'NORMAL' ? 'Normal' : item.mode === 'vent' ? 'Reduced' : 'High'
  if (item.mode === 'info') return '—'
  if (item.key === 'mortality') return item.status === 'NORMAL' ? 'Normal' : item.severity < 50 ? '↑ slightly' : '↑ rising'
  return fmtDev(item.key, item.dev)
}

export default function Health({ ctx }: { ctx: Ctx }) {
  const { farm, detail } = ctx
  const poultry = farm.farm_type === 'poultry'
  const { labels } = farm
  const columns: [string, string][] = [
    ['cough', labels.cough], ['activity', labels.activity], ['feed', 'Feed'], ['water', 'Water'],
    ...(poultry ? [['eggs', 'Eggs'] as [string, string]] : []), ['mortality', 'Mortality'],
  ]
  const groups: string[] = detail ? Array.from(new Set(detail.panel.map((p: any) => p.group))) : []

  return (
    <div className="space-y-5">
      <PageHeader title={poultry ? 'Flock Health' : 'Barn Health'}
        subtitle={`Every ${labels.unit.toLowerCase()} at a glance, and the live signals behind each one.`} />

      {/* ------------------------------------------------ farm map */}
      <Card className="p-5">
        <CardTitle>Farm map · today compared with each {labels.unit.toLowerCase()}'s own normal</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-2 font-semibold">{labels.unit}</th><th className="font-semibold">Status</th><th className="text-right font-semibold">Risk</th>
                <th className="pl-3 font-semibold">14 days</th>
                {columns.map(([k, name]) => <th key={k} className="text-right font-semibold">{name}</th>)}
                <th className="text-right font-semibold">Humidity</th>
              </tr>
            </thead>
            <tbody>
              {farm.barns.map((b: any) => {
                const t = tone(b.level)
                return (
                  <tr key={b.barn} onClick={() => ctx.setHouse(b.barn)}
                    className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${b.barn === ctx.house ? 'bg-emerald-50/60' : ''}`}>
                    <td className="py-2.5 font-bold text-slate-900">{b.barn}</td>
                    <td><Badge kind={b.status} /></td>
                    <td className="text-right font-bold text-slate-900">{b.risk}</td>
                    <td className="pl-3"><Spark values={b.spark} color={t.hex} width={80} height={22} /></td>
                    {columns.map(([k]) => (
                      <td key={k} className={`text-right ${b.components[k] >= 25 ? 'font-bold text-red-700' : 'text-slate-600'}`}>{fmtDev(k, b.dev[k])}</td>
                    ))}
                    <td className={`text-right ${b.env.humidity >= 25 ? 'font-bold text-red-700' : 'text-slate-600'}`}>{fmtVal('humidity', b.values.humidity)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">Bold red values are outside the normal range. Click a row to see its live signals below.</p>
      </Card>

      {/* ------------------------------------------------ live signals */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">LIVE {poultry ? 'FLOCK' : 'BARN'} SIGNALS · {labels.unit} {ctx.house}</h2>
          <p className="text-sm text-slate-600">Each sensor reading is compared with this {labels.unit.toLowerCase()}'s own baseline.</p>
        </div>
        <HouseTabs ctx={ctx} />
      </div>

      {!detail ? <p className="text-sm text-slate-500">Loading…</p> : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => {
              const Icon = GROUP_ICONS[group] ?? Thermometer
              return (
                <Card key={group} className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Icon size={16} className="text-slate-400" /> {group}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {detail.panel.filter((p: any) => p.group === group).map((p: any) => (
                      <div key={p.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 text-sm">
                        <div>
                          <div className="text-slate-800">{p.label}</div>
                          <div className="text-xs text-slate-500">{fmtVal(p.key, p.value)}</div>
                        </div>
                        <div className="text-right font-semibold text-slate-900">{change(p)}</div>
                        <div className="w-[6.4rem] text-right">{p.mode !== 'info' && <Badge kind={p.status} />}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>

          <Card className="p-5">
            <CardTitle>Management information · {labels.unit} {detail.barn}</CardTitle>
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                [poultry ? 'Birds' : 'Animals', num(detail.animal_count)],
                ['Breed', detail.breed],
                ['Average age', detail.avg_age_days ? `${detail.avg_age_days} days` : 'Not recorded'],
                [poultry ? 'Average weight' : 'Average daily gain', poultry ? fmtVal('weight', detail.values.weight) : fmtVal('adg', detail.values.adg)],
                ['Ventilation status', detail.ventilation_status],
                ['Vaccination status', detail.vaccination ? `${detail.vaccination.status} · ${detail.vaccination.completion}% complete` : 'Not recorded'],
                ['Medication history', detail.medication],
                ['Recent animal movement', detail.last_movement],
                ['Biosecurity inspection', detail.biosecurity],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-1.5">
                  <dt className="text-slate-600">{k}</dt><dd className="text-right font-semibold text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </>
      )}
    </div>
  )
}
