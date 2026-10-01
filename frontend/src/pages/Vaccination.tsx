import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Badge, Card, CardTitle, Ctx, num, PageHeader, shortDate } from '../lib'

const FILTERS: [string, string, (r: any) => boolean][] = [
  ['all', 'All', () => true],
  ['due', 'Due', (r) => r.due > 0],
  ['overdue', 'Overdue', (r) => r.overdue > 0],
  ['completed', 'Completed', (r) => r.status === 'OK'],
  ['missing', 'Missing records', (r) => r.missing > 0],
]

export default function Vaccination({ ctx }: { ctx: Ctx }) {
  const { farm } = ctx
  const { summary, rows, insight } = farm.vaccination
  const [filter, setFilter] = useState('all')
  const { labels } = farm
  const shown = rows.filter(FILTERS.find((f) => f[0] === filter)![2])
  const stats: [string, number, string][] = [
    [`Total ${labels.animals}`, summary.total, 'text-slate-900'],
    ['Vaccinated', summary.vaccinated, 'text-emerald-700'],
    ['Due this week', summary.due, 'text-amber-700'],
    ['Overdue', summary.overdue, 'text-red-700'],
    ['Missing records', summary.missing, 'text-orange-700'],
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Vaccination" subtitle="Who is protected, who is due, and where records are missing — in one place instead of a spreadsheet." />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="bg-slate-900 p-4 text-white sm:col-span-3 lg:col-span-1">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">Compliance</div>
          <div className="mt-1 text-4xl font-extrabold">{summary.compliance}%</div>
        </Card>
        {stats.map(([name, value, color]) => (
          <Card key={name} className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{name}</div>
            <div className={`mt-1 text-2xl font-bold ${color}`}>{num(value)}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <CardTitle right={
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([id, name]) => (
              <button key={id} onClick={() => setFilter(id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${filter === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                {name}
              </button>
            ))}
          </div>
        }>Vaccination status by {labels.unit.toLowerCase()}</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-2 font-semibold">{labels.unit}</th><th className="text-right font-semibold">{labels.animals}</th>
                <th className="pl-4 font-semibold">Vaccine</th><th className="font-semibold">Last dose</th><th className="font-semibold">Next dose</th>
                <th className="text-right font-semibold">Vaccinated</th><th className="text-right font-semibold">Due</th>
                <th className="text-right font-semibold">Overdue</th><th className="text-right font-semibold">Missing</th><th className="pl-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r: any) => (
                <tr key={r.barn} className="border-b border-slate-100">
                  <td className="py-2.5 font-bold text-slate-900">{r.barn}</td>
                  <td className="text-right">{num(r.animals)}</td>
                  <td className="pl-4 text-slate-700">{r.vaccine}</td>
                  <td className="text-slate-600">{shortDate(r.last_dose)}</td>
                  <td className="text-slate-600">{shortDate(r.next_dose)}</td>
                  <td className="text-right">{num(r.vaccinated)}</td>
                  <td className="text-right">{num(r.due)}</td>
                  <td className="text-right">{num(r.overdue)}</td>
                  <td className="text-right">{num(r.missing)}</td>
                  <td className="pl-4"><Badge kind={r.status} label={r.status === 'Missing' ? 'Missing records' : r.status} /></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-slate-500">Nothing matches this filter.</td></tr>}
            </tbody>
          </table>
        </div>
        {farm.source === 'user' && (
          <p className="mt-3 text-xs text-slate-500">For your own data, the status comes from the "Vaccination status" you entered with the latest reading of each {labels.unit.toLowerCase()}. No status means "missing records".</p>
        )}
      </Card>

      {insight && (
        <Card className="border-emerald-300 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700"><Sparkles size={15} /> AI vaccination insight</div>
          <div className="mt-2 text-base font-bold text-slate-900">{labels.unit} {insight.barn} has:</div>
          <dl className="mt-2 grid max-w-xl gap-x-8 text-sm sm:grid-cols-2">
            {[
              ['Vaccination completion', `${insight.completion}%`],
              [`${labels.risk} score`, `${insight.risk} / 100`],
              ['Respiratory alerts (14 days)', insight.resp_alerts],
              ['Mortality trend', `${insight.mortality_trend > 0 ? '+' : ''}${insight.mortality_trend.toFixed(2)} pts`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-100 py-1.5"><dt className="text-slate-600">{k}</dt><dd className="font-semibold text-slate-900">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-slate-800"><strong>Recommendation:</strong> {insight.recommendation}</p>
          <p className="mt-2 text-xs text-slate-500">
            Vaccination status contributes to outbreak risk assessment, but does not by itself confirm or exclude infection.
            AIFARM DOCTOR does not prescribe vaccines.
          </p>
        </Card>
      )}
    </div>
  )
}
