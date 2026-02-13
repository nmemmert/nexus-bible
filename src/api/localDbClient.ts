// Use relative URL for same-origin requests, or construct based on current host
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8787'
  : `${window.location.protocol}//${window.location.hostname}:8787`

const TOKEN_KEY = 'bsb-token'

export type AuthUser = {
  id: string
  name: string
  email: string
}

export type NoteRecord = {
  id: string
  reference: string
  text: string
  created_at: string
}

export type HighlightRecord = {
  id: string
  reference: string
  color: string
  note: string
  created_at: string
}

export type PlanRecord = {
  id: string
  title: string
  next_reading: string
  progress: number
  created_at: string
  total_items?: number
  completed_items?: number
  items?: PlanItem[]
}

export type PlanItem = {
  id: string
  plan_id: string
  translation_id: string
  book_id: string
  chapter_number: number
  label: string
  order_index: number
  completed_at: string | null
  created_at: string
}

export type SearchResult = {
  translationId: string
  bookId: string
  chapterNumber: number
  verseNumber: number
  text: string
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function hasToken() {
  return Boolean(getToken())
}

function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  includeAuth = true,
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (includeAuth) {
    const token = getToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = payload?.error ?? `Request failed: ${response.status}`
    throw new Error(message)
  }

  return (await response.json()) as T
}

export async function signUp(name: string, email: string, password: string) {
  const result = await apiFetch<{ token: string; user: AuthUser }>(
    '/auth/signup',
    {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    },
    false,
  )
  setToken(result.token)
  return result.user
}

export async function signIn(email: string, password: string) {
  const result = await apiFetch<{ token: string; user: AuthUser }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    false,
  )
  setToken(result.token)
  return result.user
}

export async function signOut() {
  setToken(null)
}

export async function getCurrentUser() {
  const result = await apiFetch<{ user: AuthUser }>('/me')
  return result.user
}

export async function checkHealth() {
  const result = await apiFetch<{ ok: boolean }>('/health', {}, false)
  return result.ok
}

export async function searchPassages(options: {
  query: string
  translation?: string
  book?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  params.set('query', options.query)
  if (options.translation) {
    params.set('translation', options.translation)
  }
  if (options.book) {
    params.set('book', options.book)
  }
  if (options.limit) {
    params.set('limit', String(options.limit))
  }
  const result = await apiFetch<{ results: SearchResult[] }>(
    `/search?${params.toString()}`,
    {},
    false,
  )
  return result.results
}

export async function getNotes() {
  const result = await apiFetch<{ notes: NoteRecord[] }>('/notes')
  return result.notes
}

export async function createNote(reference: string, text: string) {
  const result = await apiFetch<{ note: NoteRecord }>(
    '/notes',
    {
      method: 'POST',
      body: JSON.stringify({ reference, text }),
    },
  )
  return result.note
}

export async function deleteNote(id: string) {
  await apiFetch<{ ok: boolean }>(`/notes/${id}`, { method: 'DELETE' })
}

export async function getHighlights() {
  const result = await apiFetch<{ highlights: HighlightRecord[] }>('/highlights')
  return result.highlights
}

export async function createHighlight(reference: string, color: string, note: string) {
  const result = await apiFetch<{ highlight: HighlightRecord }>(
    '/highlights',
    {
      method: 'POST',
      body: JSON.stringify({ reference, color, note }),
    },
  )
  return result.highlight
}

export async function deleteHighlight(id: string) {
  await apiFetch<{ ok: boolean }>(`/highlights/${id}`, { method: 'DELETE' })
}

export async function getPlans() {
  const result = await apiFetch<{ plans: PlanRecord[] }>('/plans')
  return result.plans
}

export async function createPlan(
  title: string,
  nextReading: string,
  progress: number,
  items?: Array<{
    translationId: string
    bookId: string
    chapterNumber: number
    label: string
  }>,
) {
  const result = await apiFetch<{ plan: PlanRecord }>(
    '/plans',
    {
      method: 'POST',
      body: JSON.stringify({ title, nextReading, progress, items }),
    },
  )
  return result.plan
}

export async function updatePlanItem(
  planId: string,
  itemId: string,
  completed: boolean,
) {
  const result = await apiFetch<{
    ok: boolean
    plan: {
      id: string
      progress: number
      next_reading: string
      total_items: number
      completed_items: number
    }
    item: {
      id: string
      completed_at: string | null
    }
  }>(`/plans/${planId}/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ completed }),
  })
  return result
}

export async function deletePlan(id: string) {
  await apiFetch<{ ok: boolean }>(`/plans/${id}`, { method: 'DELETE' })
}
