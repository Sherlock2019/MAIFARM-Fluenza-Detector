import { ArrowDown } from 'lucide-react'
import { Card, CardTitle, Ctx, DetectionCompare, PageHeader } from '../lib'

const POULTRY_ROWS: [string, string, string][] = [
  ['Flock monitoring', 'Human rounds', 'Continuous AI monitoring'],
  ['Respiratory signs', 'Worker hears obvious symptoms', 'Audio trend detection'],
  ['Movement', 'Visual observation', 'Computer-vision baseline'],
  ['Feeding', 'Daily records', 'Continuous anomaly detection'],
  ['Drinking', 'Manual / meter reading', 'IoT trend monitoring'],
  ['Mortality', 'Daily count', 'Baseline deviation alert'],
  ['Environment', 'Separate sensor screen', 'Correlated with health'],
  ['Biosecurity', 'Paper / checklists', 'AI risk correlation'],
  ['Vaccination', 'Spreadsheet / calendar', 'Integrated compliance'],
  ['Detection', 'Often after obvious symptoms', 'Earlier weak-signal detection'],
  ['Risk explanation', 'Manual interpretation', 'Explainable risk scoring'],
  ['Outbreak response', 'Reactive', 'Earlier guided response'],
  ['Final diagnosis', 'Veterinarian / lab', 'Veterinarian / lab'],
  ['Decision authority', 'Human', 'Human'],
]
const PIG_ROWS: [string, string, string][] = [
  ['Health monitoring', 'Manual observation', 'Continuous data analysis'],
  ['Detection', 'After visible symptoms', 'Earlier anomaly detection'],
  ['Data sources', 'Separate records', 'Combined health + environment + vaccine data'],
  ['Feed monitoring', 'Manual reports', 'Automatic baseline comparison'],
  ['Water monitoring', 'Manual review', 'Trend and anomaly detection'],
  ['Cough detection', 'Human observation', 'Audio / event trend analysis'],
  ['Environment', 'Viewed separately', 'Correlated with health signals'],
  ['Vaccination', 'Calendar / spreadsheet', 'Intelligent due / overdue tracking'],
  ['Risk assessment', 'Experience-dependent', 'Consistent explainable risk score'],
  ['Alerts', 'Reactive', 'Predictive'],
  ['Investigation', 'Manual', 'AI-assisted prioritization'],
  ['Root-cause analysis', 'Human correlation', 'Multi-signal correlation'],
  ['Farm overview', 'Separate systems', 'One health-control center'],
  ['Financial impact', 'Often calculated later', 'Estimated during risk event'],
  ['Decision maker', 'Farmer / veterinarian', 'Farmer / veterinarian'],
  ['Role of AI', 'None', 'Decision support'],
]

function Flow({ title, steps, accent }: { title: string; steps: string[]; accent: boolean }) {
  return (
    <div className="flex-1">
      <div className={`mb-2 text-center text-xs font-bold uppercase tracking-wider ${accent ? 'text-emerald-700' : 'text-slate-500'}`}>{title}</div>
      <div className="flex flex-col items-center gap-1">
        {steps.map((s, i) => (
          <div key={s} className="flex w-full flex-col items-center gap-1">
            {i > 0 && <ArrowDown size={14} className="text-slate-400" />}
            <div className={`w-full rounded-lg border px-3 py-2 text-center text-sm font-semibold ${accent ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Classic vs AIFARM DOCTOR as two step-by-step flows (also shown on the Overview). */
export function Flows({ poultry }: { poultry: boolean }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row">
      <Flow title={poultry ? 'Classic farm' : 'Classic farm management'} accent={false}
        steps={poultry ? ['Visible illness', 'Worker notices', 'Veterinarian', 'Testing', 'Containment'] : ['See problem', 'Investigate', 'React']} />
      <Flow title="AIFARM DOCTOR" accent
        steps={poultry
          ? ['Weak signals', 'AI anomaly detection', 'Early outbreak warning', 'Farm isolation', 'Veterinary inspection', 'Laboratory confirmation']
          : ['Monitor', 'Detect abnormality', 'Explain', 'Warn early', 'Human investigation', 'Prevent / contain']} />
    </div>
  )
}

export default function Compare({ ctx }: { ctx: Ctx }) {
  const { farm } = ctx
  const poultry = farm.farm_type === 'poultry'
  const rows = poultry ? POULTRY_ROWS : PIG_ROWS
  const top = farm.barns.find((b: any) => b.barn === farm.top_barn)
  const watched = poultry
    ? ['behavior', 'sound', 'feeding', 'drinking', 'environment', 'mortality', 'production', 'vaccination', 'biosecurity']
    : ['feed', 'water', 'activity', 'cough events', 'environment', 'mortality', 'weight gain', 'vaccination']

  return (
    <div className="space-y-5">
      <PageHeader title={poultry ? 'Classic Poultry Health vs AIFARM DOCTOR' : 'Reactive Farm Health vs Predictive Farm Health'}
        subtitle="From reactive livestock health management to preventive, data-driven animal health." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Before</div>
          <p className="mt-2 text-xl font-bold text-slate-900">Wait until {poultry ? 'chickens' : 'animals'} look visibly sick.</p>
          <p className="mt-2 text-sm text-slate-600">By the time symptoms are obvious, the problem may already have spread through the {poultry ? 'flock' : 'barn'}.</p>
        </Card>
        <Card className="border-emerald-300 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">After</div>
          <p className="mt-2 text-xl font-bold text-slate-900">AI watches and warns when the {poultry ? 'flock' : 'herd'} begins behaving abnormally.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {watched.map((w) => <span key={w} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">{w}</span>)}
          </div>
        </Card>
      </div>

      {top?.detection && (
        <Card className="p-5">
          <CardTitle>In today's data · {farm.labels.unit} {top.barn}</CardTitle>
          <DetectionCompare detection={top.detection} unit={farm.labels.unit} barn={top.barn} />
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left">
                <th className="bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Capability</th>
                <th className="bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{poultry ? 'Classic poultry health' : 'Classic farm health management'}</th>
                <th className="bg-emerald-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white">AIFARM DOCTOR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([capability, classic, ai]) => (
                <tr key={capability} className="border-t border-slate-100">
                  <td className="px-5 py-2.5 font-semibold text-slate-900">{capability}</td>
                  <td className="px-5 py-2.5 text-slate-600">{classic}</td>
                  <td className="bg-emerald-50/60 px-5 py-2.5 font-medium text-emerald-900">{ai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <CardTitle>How a problem is handled</CardTitle>
          <Flows poultry={poultry} />
          {poultry && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex flex-col gap-5 sm:flex-row">
                <Flow title="Classic" accent={false} steps={['Symptoms', 'Detection', 'Response']} />
                <Flow title="AIFARM DOCTOR" accent steps={['Weak signals', 'Prediction', 'Early warning', 'Human verification', 'Response']} />
              </div>
            </div>
          )}
        </Card>

        <Card className="bg-slate-900 p-5 text-white">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">AIFARM DOCTOR does not replace the veterinarian</div>
          <div className="mt-4 flex flex-col items-center gap-1 text-sm">
            {['AI continuously watches farm data', 'AI detects weak signals', 'AI explains the risk', 'Farmer investigates',
              poultry ? 'Veterinarian and laboratory confirm' : 'Veterinarian confirms when necessary', 'Human decides'].map((s, i) => (
              <div key={s} className="flex w-full flex-col items-center gap-1">
                {i > 0 && <ArrowDown size={14} className="text-slate-500" />}
                <div className={`w-full rounded-lg px-3 py-2 text-center font-semibold ${i >= 3 ? 'bg-emerald-500 text-slate-900' : 'bg-white/10'}`}>{s}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-2xl font-extrabold">AI recommends.<br />Humans decide.</p>
          <p className="mt-2 text-center text-sm text-slate-300">AI watches. AI correlates. AI warns. Veterinarians and farmers decide.</p>
        </Card>
      </div>
    </div>
  )
}
