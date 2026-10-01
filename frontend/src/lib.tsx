import { ReactNode } from 'react'
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react'
import type { FarmType, Source } from './api'

export type Ctx = {
  farm: any
  detail: any | null
  house: string | null
  setHouse: (h: string) => void
  source: Source
  setSource: (s: Source) => void
  farmType: FarmType
  go: (page: string, house?: string) => void
  reload: () => void
  ask: (question: string) => void
  openStory: () => void
}

// ---------------------------------------------------------------- status styling (always icon + label, never colour alone)

type Tone = { text: string; bg: string; border: string; solid: string; hex: string; Icon: any }
const TONES: Record<string, Tone> = {
  good: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', solid: 'bg-emerald-600', hex: '#0ca30c', Icon: CheckCircle2 },
  watch: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', solid: 'bg-amber-500', hex: '#e0a000', Icon: AlertTriangle },
  serious: { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', solid: 'bg-orange-600', hex: '#e8703f', Icon: ShieldAlert },
  critical: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', solid: 'bg-red-600', hex: '#d03b3b', Icon: AlertOctagon },
  info: { text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', solid: 'bg-sky-600', hex: '#2a78d6', Icon: Info },
}
const TONE_OF: Record<string, string> = {
  LOW: 'good', NORMAL: 'good', OK: 'good', healthy: 'good',
  WATCH: 'watch', watch: 'watch', Due: 'watch',
  HIGH: 'serious', ABNORMAL: 'serious', Missing: 'serious',
  CRITICAL: 'critical', high: 'critical', Overdue: 'critical',
  info: 'info',
}
export const tone = (key: string): Tone => TONES[TONE_OF[key] ?? 'info']
const STATUS_LABEL: Record<string, string> = { healthy: 'Healthy', watch: 'Watch', high: 'High risk' }

export function Badge({ kind, label, size = 'sm' }: { kind: string; label?: string; size?: 'sm' | 'lg' }) {
  const t = tone(kind)
  const big = size === 'lg'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap ${t.bg} ${t.text} ${t.border} ${big ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`}>
      <t.Icon size={big ? 16 : 12} strokeWidth={2.5} />
      {label ?? STATUS_LABEL[kind] ?? kind}
    </span>
  )
}

// ---------------------------------------------------------------- layout atoms

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${onClick ? 'cursor-pointer transition hover:border-emerald-400 hover:shadow-md' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{children}</h3>
      {right}
    </div>
  )
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button', className = '' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'dark' | 'danger'; disabled?: boolean
  type?: 'button' | 'submit'; className?: string
}) {
  const styles = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
    dark: 'bg-slate-900 text-white hover:bg-slate-700',
    ghost: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 ${styles} ${className}`}>
      {children}
    </button>
  )
}

export function Segmented({ value, onChange, options }: {
  value: string; onChange: (v: any) => void; options: { value: string; label: ReactNode }[]
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${value === o.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** House picker shared by the per-house pages. */
export function HouseTabs({ ctx }: { ctx: Ctx }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ctx.farm.barns.map((b: any) => {
        const t = tone(b.status)
        const active = b.barn === ctx.house
        return (
          <button key={b.barn} onClick={() => ctx.setHouse(b.barn)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
            <t.Icon size={14} color={t.hex} strokeWidth={2.5} />
            {b.barn}
            <span className={`text-xs font-normal ${active ? 'text-slate-300' : 'text-slate-500'}`}>{b.risk}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Day picker over the last 5 days of a house (used by AI Vision and Sound AI). */
export function DayTabs({ detail, index, onChange }: { detail: any; index: number; onChange: (i: number) => void }) {
  const n = detail.days.length
  const start = Math.max(0, n - 5)
  return (
    <div className="flex flex-wrap gap-2">
      {detail.days.slice(start).map((d: any, k: number) => {
        const i = start + k
        const t = tone(d.level)
        return (
          <button key={d.date} onClick={() => onChange(i)}
            className={`rounded-lg border px-3 py-1.5 text-left text-sm transition ${i === index ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
            <div className="font-semibold">{i === n - 1 ? 'Today' : `Day ${k + 1}`}</div>
            <div className={`flex items-center gap-1 text-xs ${i === index ? 'text-slate-300' : 'text-slate-500'}`}>
              <t.Icon size={11} color={t.hex} strokeWidth={2.5} /> {shortDate(d.date)}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function SafetyNote({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 ${className}`}>
      <Info size={16} className="mt-0.5 shrink-0 text-slate-500" />
      <span>{text}</span>
    </div>
  )
}

export function Ring({ value, color, size = 120, label }: { value: number; color: string; size?: number; label?: string }) {
  const r = size / 2 - 9
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={9} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold leading-none text-slate-900">{value}</span>
        <span className="mt-0.5 text-[11px] text-slate-500">{label ?? '/ 100'}</span>
      </div>
    </div>
  )
}

export function Spark({ values, color = '#64748b', width = 96, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - (Math.min(100, v) / 100) * (height - 6)}`).join(' ')
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Minimal renderer for assistant answers: **bold**, _italic_ lines, "- " bullets, "1. " lists. */
export function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') ? <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong> : part)
  return (
    <div className="space-y-1 text-sm leading-relaxed text-slate-700">
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />
        if (/^_.*_$/.test(line)) return <p key={i} className="text-xs italic text-slate-500">{line.slice(1, -1)}</p>
        const bullet = line.match(/^(-|\d+\.)\s+(.*)$/)
        if (bullet) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="w-4 shrink-0 text-slate-400">{bullet[1] === '-' ? '•' : bullet[1]}</span>
              <span>{inline(bullet[2])}</span>
            </div>
          )
        }
        return <p key={i}>{inline(line)}</p>
      })}
    </div>
  )
}

// ---------------------------------------------------------------- formatting

const trim = (v: number, digits: number) => String(Number(v.toFixed(digits)))
const FORMATS: Record<string, (v: number) => string> = {
  feed: (v) => `${Number(v.toPrecision(3))} kg/head`,
  water: (v) => `${Number(v.toPrecision(3))} L/head`,
  activity: (v) => v.toFixed(0),
  cough: (v) => `${trim(v, 1)}/hr`,
  mortality: (v) => `${v.toFixed(2)}%`,
  eggs: (v) => `${v.toFixed(1)}%`,
  abn_eggs: (v) => `${v.toFixed(1)}%`,
  humidity: (v) => `${v.toFixed(0)}%`,
  temp: (v) => `${v.toFixed(1)}°C`,
  ammonia: (v) => `${v.toFixed(0)} ppm`,
  co2: (v) => `${Math.round(v).toLocaleString()} ppm`,
  ventilation: (v) => `${v.toFixed(0)}/100`,
  weight: (v) => `${Number(v.toPrecision(3))} kg`,
  adg: (v) => `${v.toFixed(2)} kg/day`,
  feeder: (v) => `${trim(v, 1)}/bird/day`,
  drinker: (v) => `${trim(v, 1)}/bird/day`,
  inactive: (v) => `${v.toFixed(0)}%`,
  active: (v) => `${v.toFixed(0)}%`,
  clustering: (v) => v.toFixed(0),
  acoustic: (v) => v.toFixed(0),
  immobile: (v) => v.toFixed(0),
  risk: (v) => `${v.toFixed(0)}/100`,
}
export function fmtVal(key: string, v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return (FORMATS[key] ?? ((x: number) => `${trim(x, 1)}/hr`))(v)
}

/** "↓ 18%" / "↑ 245%" / "+0.06 pts" (mortality is a percentage-point difference). */
export function fmtDev(key: string, dev: number | null | undefined): string {
  if (dev === null || dev === undefined) return '—'
  if (key === 'mortality') return Math.abs(dev) < 0.005 ? 'Normal' : `${dev > 0 ? '+' : ''}${dev.toFixed(2)} pts`
  if (Math.abs(dev) < 0.5) return 'Normal'
  return `${dev > 0 ? '↑' : '↓'} ${Math.abs(dev).toFixed(0)}%`
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export const num = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString())

/** Small deterministic random generator so mock visuals look the same on every render. */
export function seeded(seed: string) {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------- the key sales visual

/** Classic detection day vs AIFARM DOCTOR detection day for one house. */
export function DetectionCompare({ detection, unit, barn, compact = false }: { detection: any; unit: string; barn: string; compact?: boolean }) {
  if (!detection) return null
  const { window: days, ai_day, classic_day, lead_days } = detection
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Classic farm</div>
          <div className="mt-1 text-sm text-slate-600">Problem noticed</div>
          <div className="text-2xl font-bold text-slate-900">{classic_day ? `Day ${classic_day}` : 'Not yet visible'}</div>
        </div>
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">AIFARM DOCTOR</div>
          <div className="mt-1 text-sm text-emerald-800">First anomaly detected</div>
          <div className="text-2xl font-bold text-emerald-900">Day {ai_day}</div>
        </div>
        <div className="rounded-xl bg-slate-900 p-4 text-white">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">Early warning gain</div>
          <div className="mt-1 text-sm text-slate-300">{unit} {barn}</div>
          <div className="text-2xl font-bold">
            {lead_days === null ? 'Ahead of visible signs' : lead_days === 0 ? 'Same day' : `${lead_days} day${lead_days > 1 ? 's' : ''} earlier`}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="mt-4 flex items-stretch gap-1.5 overflow-x-auto pb-1">
          {days.slice(-8).map((d: any) => {
            const t = tone(d.level)
            return (
              <div key={d.day} className={`min-w-[92px] flex-1 rounded-xl border p-2.5 ${t.bg} ${t.border}`}>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Day {d.day}</span><span className="font-normal text-slate-500">{shortDate(d.date)}</span>
                </div>
                <div className={`mt-1 flex items-center gap-1 text-lg font-bold ${t.text}`}><t.Icon size={16} strokeWidth={2.5} />{d.risk}</div>
                <div className={`text-[11px] font-semibold ${t.text}`}>{d.level}</div>
                <div className="mt-1 min-h-[30px] text-[11px] font-semibold leading-tight">
                  {d.day === ai_day && <div className="text-emerald-700">▲ AI early warning</div>}
                  {d.day === classic_day && <div className="text-slate-700">▲ Traditional detection</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Empty({ ctx, what = 'this page' }: { ctx: Ctx; what?: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-xl p-8 text-center">
      <div className="text-4xl">{ctx.farm.labels.icon}</div>
      <h2 className="mt-3 text-lg font-bold">No farm data yet</h2>
      <p className="mt-1 text-sm text-slate-600">
        "My Farm Data" is empty for this farm type, so there is nothing to show on {what}. Add a few days of readings or
        upload a CSV — or switch back to the Demo Farm.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={() => ctx.go('import')}>Add farm data</Button>
        <Button variant="ghost" onClick={() => ctx.setSource('demo')}>Use Demo Farm</Button>
      </div>
    </Card>
  )
}
