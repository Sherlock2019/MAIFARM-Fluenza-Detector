import { useState } from 'react'
import { Card, CardTitle, Ctx, PageHeader } from '../lib'

const DEFAULTS = {
  poultry: { animals: 10000, value: 120000, without: 12, withEarly: 3, cost: 25000000 },
  pig: { animals: 800, value: 2500000, without: 4, withEarly: 1, cost: 8000000 },
}

function dong(v: number): string {
  const abs = Math.abs(v)
  const text = abs >= 1e9 ? `${Number((abs / 1e9).toFixed(2))}B` : abs >= 1e6 ? `${Number((abs / 1e6).toFixed(1))}M` : Math.round(abs).toLocaleString()
  return `${v < 0 ? '−' : ''}₫${text}`
}

export default function Impact({ ctx }: { ctx: Ctx }) {
  const poultry = ctx.farmType === 'poultry'
  const [inputs, setInputs] = useState(DEFAULTS[ctx.farmType])
  const set = (key: keyof typeof inputs) => (e: any) => setInputs({ ...inputs, [key]: Math.max(0, Number(e.target.value) || 0) })

  const lostWithout = inputs.animals * inputs.without / 100
  const lostWith = inputs.animals * inputs.withEarly / 100
  const protectedAnimals = Math.max(0, lostWithout - lostWith)
  const protectedValue = protectedAnimals * inputs.value
  const net = protectedValue - inputs.cost
  const animal = poultry ? 'bird' : 'animal'

  const fields: [keyof typeof inputs, string, string][] = [
    ['animals', `${poultry ? 'Birds' : 'Animals'} in ${poultry ? 'house' : 'barn'}`, ''],
    ['value', `Average ${animal} value`, '₫'],
    ['without', 'Expected mortality without intervention', '%'],
    ['withEarly', 'Expected mortality with early intervention', '%'],
    ['cost', 'Cost of intervention', '₫'],
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Business Impact" subtitle="A simple simulator: what could earlier intervention be worth for one house? Change the numbers to match your farm." />

      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
        POC simulation — not a financial guarantee.
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle>Your assumptions</CardTitle>
          <div className="space-y-3">
            {fields.map(([key, label, unit]) => (
              <label key={key} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-700">{label}</span>
                <span className="flex items-center gap-1.5">
                  {unit === '₫' && <span className="text-slate-500">₫</span>}
                  <input type="number" min={0} step="any" value={inputs[key]} onChange={set(key)}
                    className="w-36 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  {unit === '%' && <span className="w-3 text-slate-500">%</span>}
                </span>
              </label>
            ))}
          </div>
          <button className="mt-4 text-xs font-semibold text-emerald-700 hover:underline" onClick={() => setInputs(DEFAULTS[ctx.farmType])}>Reset to example values</button>
        </Card>

        <Card className="p-5">
          <CardTitle>Estimated result</CardTitle>
          <dl className="divide-y divide-slate-100 text-sm">
            {[
              [`Losses without intervention`, `${Math.round(lostWithout).toLocaleString()} ${animal}s`],
              [`Losses with early intervention`, `${Math.round(lostWith).toLocaleString()} ${animal}s`],
              [`${poultry ? 'Birds' : 'Animals'} potentially protected`, Math.round(protectedAnimals).toLocaleString()],
              ['Potential value protected', dong(protectedValue)],
              ['Estimated intervention cost', dong(inputs.cost)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2"><dt className="text-slate-600">{k}</dt><dd className="font-semibold text-slate-900">{v}</dd></div>
            ))}
          </dl>
          <div className={`mt-3 rounded-xl p-4 text-white ${net >= 0 ? 'bg-emerald-600' : 'bg-slate-700'}`}>
            <div className="text-xs font-bold uppercase tracking-wider opacity-90">Estimated net value protected</div>
            <div className="text-3xl font-extrabold">{dong(net)}</div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Net value = (mortality avoided × {animal} value) − intervention cost. It leaves out lost production, treatment, movement restrictions
            and spread to other houses, which usually make a late response more expensive.
          </p>
        </Card>
      </div>
    </div>
  )
}
