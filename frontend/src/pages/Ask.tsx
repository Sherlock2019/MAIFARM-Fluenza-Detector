import { FormEvent, useEffect, useRef, useState } from 'react'
import { Send, Stethoscope } from 'lucide-react'
import { api } from '../api'
import { Card, Ctx, PageHeader, Rich } from '../lib'

type Message = { from: 'user' | 'doctor'; text: string; barn?: string | null }

export default function Ask({ ctx, pending, clearPending }: { ctx: Ctx; pending: string | null; clearPending: () => void }) {
  const { farm } = ctx
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const send = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    setInput('')
    setBusy(true)
    setMessages((m) => [...m, { from: 'user', text: q }])
    try {
      const res = await api.chat(q, farm.source, farm.farm_type)
      setMessages((m) => [...m, { from: 'doctor', text: res.answer, barn: res.barn }])
    } catch (e: any) {
      setMessages((m) => [...m, { from: 'doctor', text: `Sorry, I could not answer that: ${e.message}` }])
    } finally {
      setBusy(false)
    }
  }

  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (pending && handled.current !== pending) {
      handled.current = pending
      send(pending)
      clearPending()
    }
    if (!pending) handled.current = null
  }, [pending])
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), [messages])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Ask AIFARM DOCTOR" subtitle="Ask about this farm's health in plain language. Answers use only the data shown in this application." />
      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <Card className="flex min-h-[28rem] flex-col">
          <div className="flex-1 space-y-4 p-5">
            {messages.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-500">
                <Stethoscope size={32} className="mx-auto text-emerald-600" />
                <p className="mt-3 font-semibold text-slate-700">What would you like to know about {farm.farm}?</p>
                <p>Pick a suggested question or type your own.</p>
              </div>
            )}
            {messages.map((m, i) => m.from === 'user' ? (
              <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 text-sm text-white">{m.text}</div></div>
            ) : (
              <div key={i} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Stethoscope size={16} /></div>
                <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-4 py-3">
                  <Rich text={m.text} />
                  {m.barn && <button className="mt-2 text-xs font-semibold text-emerald-700 hover:underline" onClick={() => ctx.go('risk', m.barn!)}>Open {farm.labels.unit} {m.barn} →</button>}
                </div>
              </div>
            ))}
            {busy && <div className="pl-11 text-sm text-slate-500">Checking the farm data…</div>}
            <div ref={end} />
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about a ${farm.labels.unit.toLowerCase()}, an alert, vaccination…`}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <button type="submit" disabled={busy || !input.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              <Send size={15} /> Ask
            </button>
          </form>
        </Card>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Suggested questions</div>
          <div className="space-y-2">
            {farm.suggestions.map((s: string) => (
              <button key={s} onClick={() => send(s)} disabled={busy}
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 shadow-sm transition hover:border-emerald-400 hover:text-emerald-800">
                {s}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">AIFARM DOCTOR only answers farm-health questions and never names a disease as a diagnosis.</p>
        </div>
      </div>
    </div>
  )
}
