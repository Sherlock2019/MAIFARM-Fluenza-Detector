export type Source = 'demo' | 'user'
export type FarmType = 'pig' | 'poultry'

async function handle(res: Response) {
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) message = body.detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join('; ')
    } catch {
      /* keep the default message */
    }
    throw new Error(message)
  }
  return res.json()
}

const qs = (source: Source, farmType: FarmType) => `source=${source}&farm_type=${farmType}`

export const api = {
  farm: (source: Source, farmType: FarmType) => fetch(`/api/farm?${qs(source, farmType)}`).then(handle),
  barn: (barn: string, source: Source, farmType: FarmType) =>
    fetch(`/api/barns/${encodeURIComponent(barn)}?${qs(source, farmType)}`).then(handle),
  chat: (question: string, source: Source, farmType: FarmType) =>
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, source, farm_type: farmType }),
    }).then(handle),
  addReading: (reading: Record<string, unknown>) =>
    fetch('/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reading),
    }).then(handle),
  clearUserData: (farmType: FarmType) => fetch(`/api/user-data?farm_type=${farmType}`, { method: 'DELETE' }).then(handle),
  importPreview: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch('/api/import/preview', { method: 'POST', body: form }).then(handle)
  },
  importCommit: (file: File, mapping: Record<string, string | null>, farmType: FarmType, farm: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('mapping', JSON.stringify(mapping))
    form.append('farm_type', farmType)
    form.append('farm', farm)
    return fetch('/api/import/commit', { method: 'POST', body: form }).then(handle)
  },
}
