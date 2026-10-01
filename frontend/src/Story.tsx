import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from 'lucide-react'
import { api } from './api'
import { Badge, Ctx, fmtDev, fmtVal, Ring, shortDate, tone } from './lib'

const SCRIPT = {
  poultry: [
    ['Healthy flock.', 'Movement, sound, feed, water and egg production are all inside their normal range.'],
    ['Environment changes.', 'Humidity climbs and respiratory sounds tick up slightly. On a walk-through, there is no visible problem.'],
    ['Early weak signals.', 'Respiratory activity has increased significantly while flock movement and feeding have declined.'],
    ['More indicators appear.', 'Feed, water and egg production start to fall together. The risk becomes HIGH.'],
    ['Visible outbreak.', 'Birds now look unwell, feed intake has dropped sharply and mortality is rising.'],
  ],
  pig: [
    ['Farm healthy.', 'Feed, water, activity and cough events are all inside their normal range.'],
    ['Humidity increases.', 'Ventilation is falling behind. There is no major visible health issue yet.'],
    ['Cough anomaly detected.', 'Cough events have doubled while activity starts to slip.'],
    ['Feed and activity decline.', 'More signals move together. The pattern keeps building.'],
    ['Visible health issue.', 'Feed intake is clearly down and mortality begins to rise.'],
  ],
}
const STEP_MS = 4500

export default function Story({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const [barn, setBarn] = useState<any>(null)
  const [farm, setFarm] = useState<any>(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const poultry = ctx.farmType === 'poultry'

  useEffect(() => {
    let live = true
    api.farm('demo', ctx.farmType).then(async (f) => {
      const b = await api.barn(f.story_barn, 'demo', ctx.farmType)
      if (live) { setFarm(f); setBarn(b) }
    })
    return () => { live = false }
  }, [ctx.farmType])

  const det = barn?.detection
  const days: any[] = det ? barn.days.slice(det.window_start) : []
  const last = days.length   // index of the closing slide

  useEffect(() => {
    if (!playing || !det || step >= last) return
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => clearTimeout(timer)
  }, [playing, step, det, last])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setStep((s) => Math.min(last, s + 1))
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, onClose])

  const labels = farm?.labels
  const day = days[Math.min(step, last - 1)]
  const isAi = det && step === det.ai_day - 1
  const isClassic = det && det.classic_day && step === det.classic_day - 1
  const script = SCRIPT[ctx.farmType][step] ?? ['', '']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 bg-slate-900 px-5 py-3 text-white">
          <div className="text-sm font-bold tracking-wide">{poultry ? 'INFLUENZA OUTBREAK DEMO' : 'DEMO STORY'}{barn && ` · ${labels.unit} ${barn.barn}`}</div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-white/10"><X size={18} /></button>
        </div>

        {!det ? <div className="p-10 text-center text-sm text-slate-500">Loading the demo…</div> : (
          <>
            <div className="flex gap-1.5 border-b border-slate-100 px-5 py-3">
              {days.map((d, i) => {
                const t = tone(d.level)
                const shown = i <= step
                return (
                  <button key={d.date} onClick={() => { setStep(i); setPlaying(false) }}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-left text-xs transition ${i === step ? 'ring-2 ring-slate-900' : ''} ${shown ? `${t.bg} ${t.border}` : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                    <div className="font-bold">DAY {i + 1}</div>
                    <div className={shown ? `font-semibold ${t.text}` : ''}>{shown ? `${d.risk} · ${d.level}` : '…'}</div>
                  </button>
                )
              })}
              <button onClick={() => { setStep(last); setPlaying(false) }}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-left text-xs font-bold ${step === last ? 'border-emerald-500 bg-emerald-500 text-slate-900' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                RESULT
              </button>
            </div>

            <div className="min-h-[24rem] flex-1 overflow-y-auto p-6">
              {step < last ? (
                <div key={step} className="pop-in grid gap-6 md:grid-cols-[1.2fr_1fr]">
                  <div>
                    <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Day {step + 1} · {shortDate(day.date)}</div>
                    <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{script[0]}</h2>
                    <p className="mt-2 text-slate-600">{script[1]}</p>

                    {isAi && (
                      <div className="mt-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4">
                        <div className="animate-pulse text-lg font-extrabold text-emerald-800">⚠ AIFARM DOCTOR — EARLY WARNING DETECTED</div>
                        <div className="mt-2 text-sm text-slate-800">
                          <div><strong>{labels.unit} {barn.barn}</strong> · {labels.risk}: <strong>{day.level}</strong></div>
                          <div className="mt-2"><strong>Reason:</strong> {script[1]}</div>
                          <div className="mt-2"><strong>Recommended:</strong> Inspect {labels.unit} {barn.barn}.{poultry && ' Review biosecurity. Review vaccination records.'}</div>
                        </div>
                      </div>
                    )}
                    {isClassic && (
                      <div className="mt-4 rounded-2xl border-2 border-slate-800 bg-slate-100 p-4">
                        <div className="text-lg font-extrabold text-slate-900">TRADITIONAL DETECTION</div>
                        <p className="mt-1 text-sm text-slate-700">Classic monitoring recognises the problem here — {det.lead_days} day{det.lead_days === 1 ? '' : 's'} after AIFARM DOCTOR's first warning.</p>
                      </div>
                    )}
                    {!isAi && !isClassic && step > det.ai_day - 1 && (
                      <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">AIFARM DOCTOR warning active since Day {det.ai_day}. On manual rounds the house still looks mostly normal.</p>
                    )}
                    {step < det.ai_day - 1 && (
                      <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">No warning. AIFARM DOCTOR keeps watching every signal against this {labels.unit.toLowerCase()}'s own baseline.</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-4">
                      <Ring value={day.risk} color={tone(day.level).hex} size={112} />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{labels.risk}</div>
                        <div className="mt-1"><Badge kind={day.level} size="lg" /></div>
                      </div>
                    </div>
                    <dl className="mt-4 divide-y divide-slate-100 text-sm">
                      {([['cough', labels.cough], ['activity', labels.activity], ['feed', 'Feed intake'], ['water', 'Water intake'],
                        ...(poultry ? [['eggs', 'Egg production']] : []), ['mortality', 'Mortality']] as [string, string][]).map(([k, name]) => (
                        <div key={k} className="grid grid-cols-[1fr_auto_5rem] gap-2 py-1.5">
                          <dt className="text-slate-600">{name}</dt>
                          <dd className="text-slate-500">{fmtVal(k, day.values[k])}</dd>
                          <dd className={`text-right font-bold ${day.components[k] >= 25 ? 'text-red-700' : 'text-slate-900'}`}>{fmtDev(k, day.dev[k])}</dd>
                        </div>
                      ))}
                      <div className="grid grid-cols-[1fr_auto_5rem] gap-2 py-1.5">
                        <dt className="text-slate-600">Humidity</dt><dd />
                        <dd className={`text-right font-bold ${day.env.humidity >= 25 ? 'text-red-700' : 'text-slate-900'}`}>{fmtVal('humidity', day.values.humidity)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : (
                <div className="pop-in py-6 text-center">
                  <div className="text-sm font-bold uppercase tracking-wider text-emerald-700">AIFARM DOCTOR alerted</div>
                  <h2 className="mt-2 text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
                    {det.lead_days ?? 0} DAY{det.lead_days === 1 ? '' : 'S'} EARLIER {poultry ? 'WARNING' : ''}
                  </h2>
                  <div className="mx-auto mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Classic monitoring</div>
                      <div className="mt-1 text-2xl font-bold text-slate-900">Day {det.classic_day}</div>
                      <div className="text-sm text-slate-600">problem noticed</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-400 bg-emerald-50 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">AIFARM DOCTOR</div>
                      <div className="mt-1 text-2xl font-bold text-emerald-900">Day {det.ai_day}</div>
                      <div className="text-sm text-emerald-800">risk detected</div>
                    </div>
                  </div>
                  <p className="mx-auto mt-6 max-w-xl text-slate-600">
                    Detect risk early → contain quickly → reduce spread. {poultry
                      ? 'The warning is not a diagnosis: veterinary inspection and laboratory confirmation are required.'
                      : 'The warning is not a diagnosis: veterinary review is recommended.'}
                  </p>
                  <p className="mt-2 font-bold text-slate-900">AI watches. AI correlates. AI warns. Veterinarians and farmers decide.</p>
                  <button onClick={() => { onClose(); ctx.go('risk', barn.barn) }}
                    className="mt-6 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
                    See why AIFARM DOCTOR raised the warning →
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
              <button onClick={() => { setStep(0); setPlaying(true) }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"><RotateCcw size={15} /> Replay</button>
              <div className="flex items-center gap-2">
                <button onClick={() => { setStep((s) => Math.max(0, s - 1)); setPlaying(false) }} disabled={step === 0} aria-label="Previous day"
                  className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={18} /></button>
                <button onClick={() => setPlaying((p) => !p)} disabled={step >= last}
                  className="inline-flex w-28 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
                  {playing && step < last ? <><Pause size={15} /> Pause</> : <><Play size={15} fill="currentColor" /> Play</>}
                </button>
                <button onClick={() => { setStep((s) => Math.min(last, s + 1)); setPlaying(false) }} disabled={step >= last} aria-label="Next day"
                  className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={18} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
