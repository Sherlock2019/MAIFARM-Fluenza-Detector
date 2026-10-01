import { FormEvent, useRef, useState } from 'react'
import { CheckCircle2, Download, FileUp, Plus, Trash2 } from 'lucide-react'
import { api } from '../api'
import { Button, Card, CardTitle, Ctx, PageHeader } from '../lib'

type Field = { key: string; label: string; type?: 'number' | 'text' | 'date' | 'select'; required?: boolean; hint?: string; wide?: boolean }
const VACCINATION_OPTIONS = ['', 'OK', 'Due', 'Overdue', 'Missing records']

const POULTRY_FIELDS: Field[] = [
  { key: 'farm', label: 'Farm', type: 'text' },
  { key: 'barn', label: 'House', type: 'text', required: true, hint: 'e.g. C-01' },
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'animal_count', label: 'Bird count', required: true },
  { key: 'feed_kg', label: 'Feed consumption', hint: 'kg, whole house' },
  { key: 'water_l', label: 'Water consumption', hint: 'L, whole house' },
  { key: 'activity', label: 'Movement score', hint: '0–100' },
  { key: 'feeder_visits', label: 'Feeder visits', hint: 'per bird per day' },
  { key: 'drinker_visits', label: 'Drinker visits', hint: 'per bird per day' },
  { key: 'cough_events', label: 'Respiratory events', hint: 'per hour' },
  { key: 'distress_events', label: 'Distress events', hint: 'per hour' },
  { key: 'egg_production', label: 'Egg production', hint: 'eggs that day' },
  { key: 'mortality', label: 'Mortality', hint: 'deaths that day' },
  { key: 'temp', label: 'Temperature', hint: '°C' },
  { key: 'humidity', label: 'Humidity', hint: '%' },
  { key: 'co2', label: 'CO₂', hint: 'ppm' },
  { key: 'ammonia', label: 'NH₃', hint: 'ppm' },
  { key: 'vaccination_status', label: 'Vaccination status', type: 'select' },
  { key: 'biosecurity_incident', label: 'Biosecurity incident', type: 'text', hint: 'leave empty if none', wide: true },
  { key: 'notes', label: 'Notes', type: 'text', wide: true },
]
const PIG_FIELDS: Field[] = [
  { key: 'farm', label: 'Farm', type: 'text' },
  { key: 'barn', label: 'Barn', type: 'text', required: true, hint: 'e.g. P-01' },
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'animal_count', label: 'Animal count', required: true },
  { key: 'feed_kg', label: 'Feed intake', hint: 'kg, whole barn' },
  { key: 'water_l', label: 'Water intake', hint: 'L, whole barn' },
  { key: 'avg_weight', label: 'Average weight', hint: 'kg' },
  { key: 'mortality', label: 'Mortality', hint: 'deaths that day' },
  { key: 'activity', label: 'Activity score', hint: '0–100' },
  { key: 'cough_events', label: 'Cough events', hint: 'per hour' },
  { key: 'temp', label: 'Temperature', hint: '°C' },
  { key: 'humidity', label: 'Humidity', hint: '%' },
  { key: 'ammonia', label: 'Ammonia', hint: 'ppm' },
  { key: 'vaccination_status', label: 'Vaccination status', type: 'select' },
  { key: 'notes', label: 'Notes', type: 'text', wide: true },
]

const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

function ManualEntry({ ctx }: { ctx: Ctx }) {
  const fields = ctx.farmType === 'poultry' ? POULTRY_FIELDS : PIG_FIELDS
  const today = new Date().toISOString().slice(0, 10)
  const [values, setValues] = useState<Record<string, string>>({ farm: 'My Farm', date: today })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const body: Record<string, unknown> = { farm_type: ctx.farmType }
    for (const f of fields) {
      const raw = (values[f.key] ?? '').trim()
      if (raw === '') continue
      body[f.key] = f.type === 'text' || f.type === 'date' || f.type === 'select' ? raw : Number(raw)
    }
    try {
      await api.addReading(body)
      setMessage({ ok: true, text: `Saved ${body.barn} for ${body.date}. Baseline and risk score were recalculated.` })
      setValues((v) => ({ farm: v.farm, barn: v.barn, date: v.date, animal_count: v.animal_count }))
      ctx.setSource('user')
      ctx.reload()
    } catch (err: any) {
      setMessage({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <CardTitle>Option A — manual entry</CardTitle>
      <p className="mb-4 text-sm text-slate-600">Enter one day for one {ctx.farm.labels.unit.toLowerCase()}. Only the first four fields are required; the more you fill in, the better the early warning. Saving the same {ctx.farm.labels.unit.toLowerCase()} and date again replaces the earlier entry.</p>
      <form onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((f) => (
            <label key={f.key} className={`block text-sm ${f.wide ? 'sm:col-span-2' : ''}`}>
              <span className="mb-1 block font-medium text-slate-700">
                {f.label}{f.required && <span className="text-red-600"> *</span>}
                {f.hint && <span className="font-normal text-slate-400"> · {f.hint}</span>}
              </span>
              {f.type === 'select' ? (
                <select className={inputClass} value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                  {VACCINATION_OPTIONS.map((o) => <option key={o} value={o}>{o || 'Not recorded'}</option>)}
                </select>
              ) : (
                <input className={inputClass} required={f.required} type={f.type ?? 'number'} step="any" min={f.type || f.key === 'temp' ? undefined : 0}
                  value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}><Plus size={16} /> ADD FARM DATA</Button>
          {message && (
            <span className={`flex items-center gap-1.5 text-sm font-medium ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {message.ok && <CheckCircle2 size={16} />} {message.text}
              {message.ok && <button type="button" className="underline" onClick={() => ctx.go('overview')}>Open dashboard</button>}
            </span>
          )}
        </div>
      </form>
    </Card>
  )
}

function CsvImport({ ctx }: { ctx: Ctx }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [mapping, setMapping] = useState<Record<string, string | null>>({})
  const [farmName, setFarmName] = useState('My Farm')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const choose = async (f: File | undefined) => {
    if (!f) return
    setError('')
    setResult(null)
    setPreview(null)
    setFile(f)
    try {
      const p = await api.importPreview(f)
      setPreview(p)
      setMapping(p.mapping)
    } catch (e: any) {
      setError(e.message)
    }
  }
  const fieldFor = (column: string) => Object.keys(mapping).find((k) => mapping[k] === column) ?? ''
  const assign = (column: string, field: string) => {
    const next = { ...mapping }
    for (const k of Object.keys(next)) if (next[k] === column) next[k] = null
    if (field) next[field] = column
    setMapping(next)
  }
  const missing = preview ? preview.fields.filter((f: any) => f.required && !mapping[f.key]) : []

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const r = await api.importCommit(file, mapping, ctx.farmType, farmName)
      setResult(r)
      setPreview(null)
      setFile(null)
      if (input.current) input.current.value = ''
      if (r.imported > 0) {
        ctx.setSource('user')
        ctx.reload()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <CardTitle right={
        <a href={`/api/import/example.csv?farm_type=${ctx.farmType}`} download className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline">
          <Download size={14} /> Download example CSV
        </a>
      }>Option B — upload farm data (CSV)</CardTitle>
      <p className="mb-3 text-sm text-slate-600">One row per {ctx.farm.labels.unit.toLowerCase()} per day. Your column names do not have to match ours — you can map them in the next step.</p>
      <pre className="mb-4 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
        {ctx.farmType === 'poultry'
          ? 'date,house,birds,feed_kg,water_l,movement,respiratory_events,egg_production,mortality,temp,humidity,co2,nh3\n2026-09-01,C-01,10000,1250,2100,91,7,9200,5,25.0,67,1800,12'
          : 'date,barn,animal_count,feed_kg,water_l,activity,cough_events,mortality,temp,humidity,ammonia\n2026-09-01,P-01,800,2020,5200,92,4,1,24.5,68,12'}
      </pre>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
        <Button variant="dark" onClick={() => input.current?.click()}><FileUp size={16} /> UPLOAD FARM DATA</Button>
        {file && <span className="text-sm text-slate-600">{file.name}</span>}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

      {preview && (
        <div className="pop-in mt-5 border-t border-slate-100 pt-5">
          <h4 className="text-sm font-bold text-slate-900">Check the column mapping · {preview.rows} rows found</h4>
          <p className="text-sm text-slate-600">
            {preview.needs_mapping ? 'Some of your columns have different names. Tell AIFARM DOCTOR what each one means.' : 'All columns were recognised automatically.'}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 font-semibold">Your column</th><th className="font-semibold">Example value</th><th className="font-semibold">AIFARM field</th>
                </tr>
              </thead>
              <tbody>
                {preview.columns.map((column: string) => (
                  <tr key={column} className="border-b border-slate-100">
                    <td className="py-2 font-mono text-slate-900">{column}</td>
                    <td className="text-slate-500">{String(preview.sample[0]?.[column] ?? '')}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">→</span>
                        <select className={`${inputClass} max-w-xs py-1.5`} value={fieldFor(column)} onChange={(e) => assign(column, e.target.value)}>
                          <option value="">Do not import</option>
                          {preview.fields.map((f: any) => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missing.length > 0 && <p className="mt-3 text-sm font-medium text-red-700">Still needed: {missing.map((f: any) => f.label).join(', ')}.</p>}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Farm name</span>
              <input className={inputClass} value={farmName} onChange={(e) => setFarmName(e.target.value)} />
            </label>
            <Button onClick={run} disabled={busy || missing.length > 0}>Import {preview.rows} rows</Button>
          </div>
        </div>
      )}

      {result && (
        <div className={`pop-in mt-5 rounded-xl border p-4 text-sm ${result.imported ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-800'}`}>
          <div className="font-semibold">
            {result.imported} row{result.imported === 1 ? '' : 's'} imported{result.barns.length ? ` for ${result.barns.join(', ')}` : ''}.
            {result.skipped > 0 && ` ${result.skipped} skipped.`}
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-1 text-xs">{result.errors.map((e: any) => <li key={e.line}>Line {e.line}: {e.problem}</li>)}</ul>
          )}
          {result.imported > 0 && <button className="mt-2 font-semibold underline" onClick={() => ctx.go('overview')}>Open the dashboard with my data →</button>}
        </div>
      )}
    </Card>
  )
}

export default function DataImport({ ctx }: { ctx: Ctx }) {
  const { farm } = ctx
  const clear = async () => {
    if (!window.confirm('Delete all of "My Farm Data" for this farm type? The Demo Farm is not affected.')) return
    await api.clearUserData(ctx.farmType)
    ctx.reload()
  }
  return (
    <div className="space-y-5">
      <PageHeader title="Data Import" subtitle="Try AIFARM DOCTOR with your own farm records. Data stays on this computer in a local database." />

      <Card className="p-5">
        <CardTitle>Data source</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {([['demo', 'Demo Farm', 'Always available. Realistic mock data with the 5-day outbreak story.'],
            ['user', 'My Farm Data', 'Readings you entered or uploaded for this farm type.']] as const).map(([id, name, text]) => (
            <button key={id} onClick={() => ctx.setSource(id)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${ctx.source === id ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-slate-200 hover:bg-slate-50'}`}>
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${ctx.source === id ? 'border-emerald-600' : 'border-slate-400'}`}>
                {ctx.source === id && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
              </span>
              <span><span className="block text-sm font-bold text-slate-900">{name}</span><span className="block text-sm text-slate-600">{text}</span></span>
            </button>
          ))}
        </div>
        {ctx.source === 'user' && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>{farm.has_data ? `${farm.reading_count} readings stored for ${farm.barns.length} ${farm.labels.unit.toLowerCase()}(s).` : 'No readings stored yet for this farm type.'}</span>
            {farm.has_data && <Button variant="danger" onClick={clear}><Trash2 size={15} /> Delete my data</Button>}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Tip: the engine compares each day with the {farm.labels.unit.toLowerCase()}'s own earlier days, so a week or more of history gives a meaningful baseline.
        </p>
      </Card>

      <ManualEntry key={ctx.farmType} ctx={ctx} />
      <CsvImport key={`csv-${ctx.farmType}`} ctx={ctx} />
    </div>
  )
}
