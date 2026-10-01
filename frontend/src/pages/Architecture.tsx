import { ArrowDown } from 'lucide-react'
import { Card, CardTitle, Ctx, PageHeader } from '../lib'

const NAMES: Record<string, string> = {
  cough: 'Respiratory audio score', activity: 'Activity drop score', feed: 'Feed drop score', water: 'Water drop score',
  mortality: 'Mortality score', eggs: 'Egg production score', posture: 'Abnormal posture score',
  environment: 'Environment score', biosecurity: 'Biosecurity score',
}

function Step({ title, text, accent = false }: { title: string; text: string; accent?: boolean }) {
  return (
    <div className={`w-full max-w-md rounded-xl border px-4 py-3 text-center ${accent ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="text-xs text-slate-600">{text}</div>
    </div>
  )
}
const Arrow = () => <ArrowDown size={18} className="text-slate-400" />

export default function Architecture({ ctx }: { ctx: Ctx }) {
  const { farm } = ctx
  const poultry = farm.farm_type === 'poultry'
  const e = farm.engine
  const sources = poultry
    ? ['Camera (vision)', 'Microphone (audio)', 'Feed', 'Water', 'Environment sensors', 'Mortality', 'Egg production', 'Vaccination', 'Biosecurity log']
    : ['Feed', 'Water', 'Weight', 'Mortality', 'Vaccination', 'Sensors', 'Environment']
  const levels = [['LOW', 0, e.levels.WATCH - 1], ['WATCH', e.levels.WATCH, e.levels.HIGH - 1], ['HIGH', e.levels.HIGH, e.levels.CRITICAL - 1], ['CRITICAL', e.levels.CRITICAL, 100]]

  return (
    <div className="space-y-5">
      <PageHeader title="How AIFARM DOCTOR works" subtitle="A simple, transparent pipeline. Everything runs locally on this computer — no cloud service is required." />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card className="p-5">
          <CardTitle>From farm data to human decision</CardTitle>
          <div className="flex flex-col items-center gap-2">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-center text-sm font-bold text-slate-900">FARM DATA</div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {sources.map((s) => <span key={s} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">{s}</span>)}
              </div>
            </div>
            <Arrow />
            <Step title="DATA PROCESSING" text="Clean the readings and convert totals to per-animal values" />
            <Arrow />
            <Step title="BASELINE ENGINE" text={`Each house's own normal: median of the previous ${e.baseline_window} days`} />
            <Arrow />
            <Step title="ANOMALY DETECTION" text="How far is today from normal, in the harmful direction?" />
            <Arrow />
            <Step title="RISK ENGINE" text="Weighted sum of the anomaly scores, 0–100" />
            <Arrow />
            <Step title="AIFARM DOCTOR" text="Combines the signals into one picture per house" accent />
            <Arrow />
            <div className="grid w-full max-w-md grid-cols-2 gap-2">
              <Step title="EXPLANATION" text="Why the score changed" />
              <Step title="ALERT" text="Early warning to the farm team" />
            </div>
            <Arrow />
            <div className="w-full max-w-md rounded-xl bg-slate-900 px-4 py-3 text-center text-white">
              <div className="text-sm font-bold">HUMAN DECISION</div>
              <div className="text-xs text-slate-300">Farmer investigates · veterinarian {poultry ? 'and laboratory confirm' : 'confirms'}</div>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <CardTitle>The {e.name.toLowerCase()} formula</CardTitle>
            <p className="text-sm text-slate-600">The score is not a black box. Each signal gets an anomaly score from 0 to 100 and a fixed weight:</p>
            <table className="mt-3 w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="py-1.5 font-semibold">Signal</th><th className="text-right font-semibold">Weight</th><th className="pl-4 font-semibold">Reaches 100 at</th></tr></thead>
              <tbody>
                {Object.entries(e.weights).map(([k, w]: [string, any]) => (
                  <tr key={k} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-800">{NAMES[k]}</td>
                    <td className="text-right font-semibold">{w.toFixed(2)}</td>
                    <td className="pl-4 text-slate-600">
                      {k === 'environment' ? `humidity ${e.env_limits.humidity[1]}%, NH₃ ${e.env_limits.ammonia[1]} ppm, CO₂ ${e.env_limits.co2[1].toLocaleString()} ppm`
                        : k === 'biosecurity' ? 'unconfirmed entries in the last 5 days'
                        : k === 'mortality' ? `+${e.full_scale[k]} percentage points`
                        : `${k === 'cough' || k === 'posture' ? '+' : '−'}${e.full_scale[k]}% vs baseline`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              {levels.map(([name, from, to]) => (
                <div key={name} className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200"><div className="font-bold text-slate-900">{name}</div><div className="text-slate-500">{from}–{to}</div></div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <CardTitle>What "traditional detection" means here</CardTitle>
            <p className="text-sm text-slate-600">
              To compare fairly, the demo marks the day a problem would normally be visible on manual rounds: feed down {e.classic_rules.feed}% or more,
              {' '}{farm.labels.activity.toLowerCase()} down {e.classic_rules.activity}% or more{e.classic_rules.eggs ? `, egg production down ${e.classic_rules.eggs}% or more` : ''},
              or daily mortality up {e.classic_rules.mortality} percentage points. AIFARM DOCTOR warns as soon as the combined score reaches WATCH ({e.levels.WATCH}).
            </p>
          </Card>

          <Card className="p-5">
            <CardTitle>Technology in this proof of concept</CardTitle>
            <ul className="space-y-1 text-sm text-slate-700">
              <li>• React + TypeScript + Tailwind CSS + Recharts (this screen)</li>
              <li>• Python + FastAPI (analysis service), Pandas (CSV import)</li>
              <li>• SQLite (local database on this computer)</li>
              <li>• Rules engine: rolling baselines, percentage deviation, weighted risk score</li>
              <li>• Camera and sound screens use synthetic demo detections</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
