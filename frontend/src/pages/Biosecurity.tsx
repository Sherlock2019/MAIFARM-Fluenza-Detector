import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge, Card, CardTitle, Ctx, PageHeader, shortDate } from '../lib'

export default function Biosecurity({ ctx }: { ctx: Ctx }) {
  const { farm } = ctx
  const bio = farm.biosecurity

  return (
    <div className="space-y-5">
      <PageHeader title="Biosecurity Guard"
        subtitle={`Who and what came onto the farm, and whether it was disinfected. Unconfirmed entries in the last ${bio.window_days} days add to the outbreak risk of the house they reached.`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {bio.categories.map((c: any) => (
          <Card key={c.name} className={`p-3 ${c.warnings ? 'border-amber-300 bg-amber-50' : ''}`}>
            <div className="flex items-center justify-between">
              {c.warnings ? <ShieldAlert size={18} className="text-amber-600" /> : <ShieldCheck size={18} className="text-emerald-600" />}
              <span className={`text-xs font-bold ${c.warnings ? 'text-amber-800' : 'text-emerald-700'}`}>{c.warnings ? `${c.warnings} WARNING${c.warnings > 1 ? 'S' : ''}` : c.records ? 'OK' : 'NO RECORDS'}</span>
            </div>
            <div className="mt-2 text-sm font-semibold leading-tight text-slate-900">{c.name}</div>
            <div className="text-xs text-slate-500">{c.records} record{c.records === 1 ? '' : 's'}</div>
          </Card>
        ))}
      </div>

      {bio.warnings.length === 0 ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">No open biosecurity warnings in the last {bio.window_days} days.</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {bio.warnings.map((e: any, i: number) => (
            <Card key={i} className="border-amber-300 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700"><ShieldAlert size={16} /> Biosecurity warning</div>
                <span className="text-xs text-slate-500">{shortDate(e.date)}{e.time ? ` · ${e.time}` : ''}</span>
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">{e.title}</div>
              <p className="mt-1 text-sm text-slate-700">{e.detail}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <dt className="text-xs text-slate-500">Affects</dt>
                  <dd className="font-semibold text-slate-900">{e.barn ? `House ${e.barn}` : 'Whole farm'}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <dt className="text-xs text-slate-500">Risk contribution</dt>
                  <dd className="font-semibold text-slate-900">+{e.contribution} point{e.contribution === 1 ? '' : 's'}</dd>
                </div>
              </dl>
              {e.action && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Action: {e.action}</p>}
              {e.barn && <button className="mt-3 text-xs font-semibold text-emerald-700 hover:underline" onClick={() => ctx.go('risk', e.barn)}>See the risk for House {e.barn} →</button>}
            </Card>
          ))}
        </div>
      )}

      <Card className="p-5">
        <CardTitle>Biosecurity score by house (0 = no open warnings)</CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {farm.barns.map((b: any) => {
            const score = bio.scores[b.barn] ?? 0
            return (
              <div key={b.barn} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between"><span className="font-bold text-slate-900">{b.barn}</span><Badge kind={score >= 50 ? 'ABNORMAL' : score > 0 ? 'WATCH' : 'NORMAL'} label={score >= 50 ? 'Elevated' : score > 0 ? 'Watch' : 'Clear'} /></div>
                <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-[#2a78d6]" style={{ width: `${score}%` }} /></div>
                <div className="mt-1 text-xs text-slate-500">{score}/100 · adds {(score * bio.weight).toFixed(1)} risk points</div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Biosecurity carries {(bio.weight * 100).toFixed(0)}% of the influenza-like risk score. It raises attention; it cannot confirm or exclude infection.</p>
      </Card>

      <Card className="p-5">
        <CardTitle>Access and movement log</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-2 font-semibold">When</th><th className="font-semibold">Type</th><th className="font-semibold">Record</th><th className="font-semibold">House</th><th className="font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {bio.events.map((e: any, i: number) => (
                <tr key={i} className="border-b border-slate-100 align-top">
                  <td className="whitespace-nowrap py-2.5 text-slate-600">{shortDate(e.date)}{e.time ? ` ${e.time}` : ''}</td>
                  <td className="whitespace-nowrap pr-3 text-slate-700">{e.category}</td>
                  <td className="pr-3"><div className="font-semibold text-slate-900">{e.title}</div><div className="text-xs text-slate-500">{e.detail}</div></td>
                  <td className="text-slate-700">{e.barn ?? 'Farm'}</td>
                  <td><Badge kind={e.status === 'ok' ? 'NORMAL' : e.active ? 'WATCH' : 'info'} label={e.status === 'ok' ? 'Confirmed' : e.active ? 'Not confirmed' : 'Older warning'} /></td>
                </tr>
              ))}
              {bio.events.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">No biosecurity records yet. Add a "Biosecurity incident" with your daily data on the Data Import page.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
