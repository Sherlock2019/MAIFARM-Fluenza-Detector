import { useCallback, useEffect, useState } from 'react'
import {
  Bell, Camera, GitCompareArrows, HeartPulse, LayoutDashboard, MessageCircle, Network, Play, Plus, ShieldCheck,
  Siren, Syringe, TrendingUp, Upload, AudioLines,
} from 'lucide-react'
import { api, FarmType, Source } from './api'
import { Ctx, Empty, Segmented, shortDate } from './lib'
import Overview from './pages/Overview'
import Risk from './pages/Risk'
import Vision from './pages/Vision'
import Sound from './pages/Sound'
import Health from './pages/Health'
import Vaccination from './pages/Vaccination'
import Biosecurity from './pages/Biosecurity'
import Alerts from './pages/Alerts'
import Ask from './pages/Ask'
import Compare from './pages/Compare'
import DataImport from './pages/DataImport'
import Impact from './pages/Impact'
import Architecture from './pages/Architecture'
import Story from './Story'

type NavItem = { id: string; label: string; Icon: any; poultryOnly?: boolean; needsData?: boolean }

function navItems(farmType: FarmType): NavItem[] {
  const poultry = farmType === 'poultry'
  const items: NavItem[] = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard, needsData: true },
    { id: 'risk', label: poultry ? 'Influenza Risk' : 'Health Risk', Icon: Siren, needsData: true },
    { id: 'vision', label: 'AI Vision', Icon: Camera, poultryOnly: true, needsData: true },
    { id: 'sound', label: 'Sound AI', Icon: AudioLines, poultryOnly: true, needsData: true },
    { id: 'health', label: poultry ? 'Flock Health' : 'Barn Health', Icon: HeartPulse, needsData: true },
    { id: 'vaccination', label: 'Vaccination', Icon: Syringe, needsData: true },
    { id: 'biosecurity', label: 'Biosecurity', Icon: ShieldCheck, poultryOnly: true, needsData: true },
    { id: 'alerts', label: 'Alerts', Icon: Bell, needsData: true },
    { id: 'ask', label: 'Ask Doctor', Icon: MessageCircle, needsData: true },
    { id: 'compare', label: 'Classic vs AI', Icon: GitCompareArrows },
    { id: 'import', label: 'Data Import', Icon: Upload },
    { id: 'impact', label: 'Business Impact', Icon: TrendingUp },
    { id: 'architecture', label: 'Architecture', Icon: Network },
  ]
  return items.filter((i) => poultry || !i.poultryOnly)
}

const PAGES: Record<string, (p: { ctx: Ctx }) => JSX.Element | null> = {
  overview: Overview, risk: Risk, vision: Vision, sound: Sound, health: Health, vaccination: Vaccination,
  biosecurity: Biosecurity, alerts: Alerts, compare: Compare, import: DataImport, impact: Impact,
  architecture: Architecture,
}

export default function App() {
  const [page, setPage] = useState(() => window.location.hash.slice(1) || 'overview')
  const [source, setSource] = useState<Source>('demo')
  const [farmType, setFarmType] = useState<FarmType>('poultry')
  const [farm, setFarm] = useState<any>(null)
  const [house, setHouse] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [story, setStory] = useState(() => window.location.hash === '#demo')
  const [question, setQuestion] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api.farm(source, farmType)
      .then((f) => {
        if (!live) return
        setFarm(f)
        setError('')
        setHouse((h) => (f.barns.some((b: any) => b.barn === h) ? h : f.top_barn))
      })
      .catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [source, farmType, version])

  useEffect(() => {
    if (!farm || !house || !farm.barns.some((b: any) => b.barn === house)) {
      setDetail(null)
      return
    }
    let live = true
    api.barn(house, farm.source, farm.farm_type).then((d) => live && setDetail(d)).catch(() => live && setDetail(null))
    return () => { live = false }
  }, [farm, house])

  const go = useCallback((p: string, h?: string) => {
    if (h) setHouse(h)
    setPage(p)
    window.history.replaceState(null, '', `#${p}`)
    window.scrollTo({ top: 0 })
  }, [])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <div className="text-4xl">🩺</div>
          <h1 className="mt-3 text-lg font-bold">AIFARM DOCTOR cannot reach its backend</h1>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
          <p className="mt-1 text-sm text-slate-600">Start the app with <code className="rounded bg-slate-200 px-1">./start.sh</code> and reload this page.</p>
        </div>
      </div>
    )
  }
  if (!farm) return <div className="flex h-full items-center justify-center text-slate-500">Loading farm data…</div>

  const ctx: Ctx = {
    farm, detail: detail && detail.barn === house ? detail : null, house, setHouse, source,
    setSource: (s) => setSource(s), farmType, go,
    reload: () => setVersion((v) => v + 1),
    ask: (q) => { setQuestion(q); go('ask') },
    openStory: () => { setSource('demo'); setStory(true) },
  }
  const items = navItems(farmType)
  const current = items.find((i) => i.id === page) ?? items[0]
  const Page = PAGES[current.id]
  const poultry = farmType === 'poultry'

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:px-6">
          <button className="flex items-center gap-2.5 text-left" onClick={() => go('overview')}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-lg">{farm.labels.icon}</span>
            <span>
              <span className="block text-base font-extrabold leading-tight tracking-tight text-slate-900">AIFARM DOCTOR</span>
              <span className="block text-[11px] leading-tight text-slate-500">
                {poultry ? 'Chicken Influenza Early Warning' : 'AI Preventive Health & Vaccination Copilot'}
              </span>
            </span>
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Data source
              <Segmented value={source} onChange={setSource} options={[{ value: 'demo', label: 'Demo Farm' }, { value: 'user', label: 'My Farm Data' }]} />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Farm type
              <Segmented value={farmType} onChange={setFarmType} options={[{ value: 'poultry', label: '🐔 Poultry' }, { value: 'pig', label: '🐷 Pig' }]} />
            </label>
            <button onClick={ctx.openStory}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
              <Play size={15} fill="currentColor" /> {poultry ? 'Run influenza outbreak demo' : 'Run demo story'}
            </button>
            <button onClick={() => go('import')}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
              <Plus size={16} /> Add farm data
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 lg:hidden">
          {items.map((i) => (
            <button key={i.id} onClick={() => go(i.id)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium ${i.id === current.id ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}>
              {i.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white lg:block">
          <nav className="sticky top-[61px] space-y-0.5 p-3">
            {items.map((i) => (
              <button key={i.id} onClick={() => go(i.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${i.id === current.id ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                <i.Icon size={17} /> {i.label}
                {i.id === 'alerts' && farm.alerts.length > 0 && (
                  <span className={`ml-auto rounded-full px-1.5 text-xs font-bold ${i.id === current.id ? 'bg-white text-emerald-700' : 'bg-red-100 text-red-700'}`}>{farm.alerts.length}</span>
                )}
              </button>
            ))}
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <div className="font-semibold text-slate-700">{farm.has_data ? farm.farm : 'My Farm'}</div>
              <div>{source === 'demo' ? 'Demo data' : 'Your data'} · {farm.has_data ? `as of ${shortDate(farm.as_of)}` : 'no readings yet'}</div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-7">
          <div className="mx-auto max-w-6xl">
            {current.needsData && !farm.has_data ? <Empty ctx={ctx} what={current.label} />
              : current.id === 'ask' ? <Ask key={source + farmType} ctx={ctx} pending={question} clearPending={() => setQuestion(null)} />
              : <Page key={farmType} ctx={ctx} />}
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-2.5 text-center text-xs text-slate-500 lg:px-6">
        <strong className="text-slate-700">AI watches. AI correlates. AI warns. Veterinarians and farmers decide.</strong>{' '}
        {farm.safety}
      </footer>

      {story && <Story ctx={ctx} onClose={() => setStory(false)} />}
    </div>
  )
}
