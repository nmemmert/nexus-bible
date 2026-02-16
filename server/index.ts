import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const PORT = 8787
const JWT_SECRET = process.env.BSB_JWT_SECRET ?? 'local-dev-secret'
const DB_PATH = process.env.BSB_DB_PATH ?? './server/data/bsb.sqlite'
const BIBLE_DB_PATH = process.env.BSB_BIBLE_DB_PATH ?? './server/data/bible.eng.db'
const ALLOWED_ORIGIN = process.env.BSB_ORIGIN ?? 'http://localhost:5173'
const ESV_API_KEY = process.env.ESV_API_KEY
const ESV_API_BASE_URL = 'https://api.esv.org/v3/passage/text/'
const API_BIBLE_KEY = process.env.API_BIBLE_KEY
const API_BIBLE_BASE_URL = 'https://rest.api.bible/v1'
const API_BIBLE_SUPPORTED_TRANSLATIONS = ['CSB', 'NLT', 'NASB'] as const

const API_BIBLE_TRANSLATION_META: Record<
  (typeof API_BIBLE_SUPPORTED_TRANSLATIONS)[number],
  { name: string; englishName: string; shortName: string; website: string; licenseUrl: string }
> = {
  CSB: {
    name: 'Christian Standard Bible',
    englishName: 'Christian Standard Bible',
    shortName: 'CSB',
    website: 'https://www.christianstandardbible.com/',
    licenseUrl: 'https://www.christianstandardbible.com/',
  },
  NLT: {
    name: 'New Living Translation',
    englishName: 'New Living Translation',
    shortName: 'NLT',
    website: 'https://www.tyndale.com/',
    licenseUrl: 'https://www.tyndale.com/',
  },
  NASB: {
    name: 'New American Standard Bible',
    englishName: 'New American Standard Bible',
    shortName: 'NASB',
    website: 'https://www.lockman.org/',
    licenseUrl: 'https://www.lockman.org/',
  },
}

const app = express()
// Allow CORS from configured origin and any HTTPS origin on port 5173
app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true)
    
    // Allow the configured origin
    if (origin === ALLOWED_ORIGIN) return callback(null, true)
    
    // Allow any origin on port 5173 (development)
    if (origin.includes(':5173')) return callback(null, true)
    
    // Deny all others
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))
app.use(express.json())

const db = new Database(DB_PATH)
const bibleDb = new Database(BIBLE_DB_PATH, { readonly: true })

type EsvBookRow = {
  id: string
  name: string
  commonName: string
  order: number
  numberOfChapters: number
}

function getEsvBooksFromLocalDb(): EsvBookRow[] {
  const rows = bibleDb
    .prepare(
      `SELECT
         id,
         COALESCE(MAX(name), id) AS name,
         COALESCE(MAX(commonName), MAX(name), id) AS commonName,
         MIN("order") AS "order",
         MAX(numberOfChapters) AS numberOfChapters
       FROM Book
       WHERE COALESCE(isApocryphal, 0) = 0
       GROUP BY id
       ORDER BY "order"`,
    )
    .all() as EsvBookRow[]

  return rows.filter((row) => row.numberOfChapters > 0)
}

function parseEsvPassageToVerses(passage: string) {
  const normalized = passage.replace(/\r/g, '').trim()
  const withoutHeading = normalized.replace(/^[^\n]*\n+/, '').trim()
  const verseRegex = /\[(\d+)\]\s*([\s\S]*?)(?=\[(\d+)\]|$)/g

  const verses: Array<{
    type: 'verse'
    number: number
    content: string[]
  }> = []

  for (const match of withoutHeading.matchAll(verseRegex)) {
    const number = Number(match[1])
    const text = (match[2] ?? '').replace(/\s+/g, ' ').trim()
    if (number > 0 && text) {
      verses.push({ type: 'verse', number, content: [text] })
    }
  }

  if (verses.length > 0) {
    return verses
  }

  const fallback = withoutHeading.replace(/\s+/g, ' ').trim()
  if (!fallback) {
    return []
  }

  return [
    {
      type: 'verse' as const,
      number: 1,
      content: [fallback],
    },
  ]
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function parseApiBibleChapterContentToVerses(content: string) {
  const verseRegex =
    /<span[^>]*data-number="(\d+)"[^>]*class="[^"]*\bv\b[^"]*"[^>]*>.*?<\/span>([\s\S]*?)(?=<span[^>]*data-number="\d+"[^>]*class="[^"]*\bv\b[^"]*"[^>]*>|$)/g

  const verses: Array<{ type: 'verse'; number: number; content: string[] }> = []

  for (const match of content.matchAll(verseRegex)) {
    const number = Number(match[1])
    const text = stripHtml(match[2] ?? '')
    if (number > 0 && text) {
      verses.push({
        type: 'verse',
        number,
        content: [text],
      })
    }
  }

  if (verses.length > 0) {
    return verses
  }

  const fallback = stripHtml(content)
  if (!fallback) {
    return []
  }

  return [
    {
      type: 'verse' as const,
      number: 1,
      content: [fallback],
    },
  ]
}

async function apiBibleRequest<T>(path: string, query?: Record<string, string>) {
  if (!API_BIBLE_KEY) {
    throw new Error('API.bible is not configured. Set API_BIBLE_KEY on the server.')
  }

  const params = query ? new URLSearchParams(query) : null
  const url = `${API_BIBLE_BASE_URL}${path}${params ? `?${params.toString()}` : ''}`
  const response = await fetch(url, {
    headers: {
      'api-key': API_BIBLE_KEY,
    },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`API.bible request failed (${response.status}). ${detail}`.trim())
  }

  return (await response.json()) as T
}

type ApiBibleBible = {
  id: string
  abbreviation?: string
  abbreviationLocal?: string
  name: string
  description?: string
  language?: { id?: string }
}

async function resolveApiBibleTextBibleId(translationId: string) {
  const payload = await apiBibleRequest<{ data: ApiBibleBible[] }>('/bibles')

  const target = translationId.toLowerCase()
  const byAbbreviation = payload.data.find((bible) => {
    const abbreviation = (bible.abbreviation ?? '').toLowerCase()
    const abbreviationLocal = (bible.abbreviationLocal ?? '').toLowerCase()
    return (
      abbreviation === target ||
      abbreviationLocal === target ||
      abbreviation.startsWith(target) ||
      abbreviationLocal.startsWith(target) ||
      abbreviation.includes(target) ||
      abbreviationLocal.includes(target)
    )
  })

  if (byAbbreviation) {
    return byAbbreviation.id
  }

  const byName = payload.data.find((bible) => {
    const blob = `${bible.name ?? ''} ${bible.description ?? ''}`.toLowerCase()
    return blob.includes(target)
  })

  return byName?.id ?? null
}

type ApiBibleBook = {
  id: string
  abbreviation?: string
  name: string
  nameLong?: string
}

async function getApiBibleBookIdMap(translationId: string) {
  const bibleId = await resolveApiBibleTextBibleId(translationId)
  if (!bibleId) {
    return { bibleId: null, canonicalToApiBookId: new Map<string, string>() }
  }

  const payload = await apiBibleRequest<{ data: ApiBibleBook[] }>(`/bibles/${bibleId}/books`)
  const canonicalBookIds = new Set(getEsvBooksFromLocalDb().map((book) => book.id.toUpperCase()))
  const canonicalToApiBookId = new Map<string, string>()

  for (const book of payload.data) {
    const direct = (book.id ?? '').toUpperCase()
    const abbreviation = (book.abbreviation ?? '').toUpperCase()
    const candidates = [direct, abbreviation]

    for (const candidate of candidates) {
      if (candidate && canonicalBookIds.has(candidate) && !canonicalToApiBookId.has(candidate)) {
        canonicalToApiBookId.set(candidate, book.id)
        break
      }
    }
  }

  return { bibleId, canonicalToApiBookId }
}

type ApiBibleChapter = { id: string; number?: string }

async function getApiBibleChapterId(
  bibleId: string,
  apiBookId: string,
  chapterNumber: number,
) {
  const payload = await apiBibleRequest<{ data: ApiBibleChapter[] }>(
    `/bibles/${bibleId}/books/${apiBookId}/chapters`,
  )

  const exactByNumber = payload.data.find(
    (chapter) => Number(chapter.number ?? NaN) === chapterNumber,
  )
  if (exactByNumber) {
    return exactByNumber.id
  }

  const fallbackSuffix = `.${chapterNumber}`
  const bySuffix = payload.data.find((chapter) => chapter.id.endsWith(fallbackSuffix))
  return bySuffix?.id ?? null
}

type ApiBibleVerse = {
  id?: string
  orgId?: string
  reference?: string
  content?: string
  number?: string
}

function inferVerseNumber(verse: ApiBibleVerse, index: number) {
  const fromNumber = Number(verse.number)
  if (Number.isInteger(fromNumber) && fromNumber > 0) {
    return fromNumber
  }

  if (verse.reference) {
    const referenceMatch = verse.reference.match(/:(\d+)/)
    if (referenceMatch) {
      return Number(referenceMatch[1])
    }
  }

  if (verse.orgId) {
    const orgParts = verse.orgId.split('.')
    const orgValue = Number(orgParts[orgParts.length - 1])
    if (Number.isInteger(orgValue) && orgValue > 0) {
      return orgValue
    }
  }

  if (verse.id) {
    const idParts = verse.id.split('.')
    const idValue = Number(idParts[idParts.length - 1])
    if (Number.isInteger(idValue) && idValue > 0) {
      return idValue
    }
  }

  return index + 1
}

async function getApiBibleAudioLinksForChapter(
  translationId: string,
  chapterId: string,
) {
  const payload = await apiBibleRequest<{ data: Array<{ id: string; abbreviation?: string; name: string }> }>(
    '/audio-bibles',
  )

  const target = translationId.toLowerCase()
  const candidates = payload.data.filter((audioBible) => {
    const abbreviation = (audioBible.abbreviation ?? '').toLowerCase()
    const name = (audioBible.name ?? '').toLowerCase()
    return abbreviation.includes(target) || name.includes(target)
  })

  const links: Record<string, string> = {}

  for (const candidate of candidates.slice(0, 5)) {
    try {
      const chapterPayload = await apiBibleRequest<{ data?: { resourceUrl?: string; path?: string } }>(
        `/audio-bibles/${candidate.id}/chapters/${chapterId}`,
      )

      const resourceUrl = chapterPayload.data?.resourceUrl
      if (resourceUrl) {
        links[candidate.abbreviation || candidate.name] = resourceUrl
      }
    } catch {
      continue
    }
  }

  return links
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  color TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  next_reading TEXT NOT NULL,
  progress INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  translation_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES plans (id)
);
`)

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/esv/books', (_req, res) => {
  if (!ESV_API_KEY) {
    res.status(503).json({ error: 'ESV is not configured. Set ESV_API_KEY on the server.' })
    return
  }

  const books = getEsvBooksFromLocalDb().map((book) => ({
    id: book.id,
    translationId: 'ESV',
    name: book.name,
    commonName: book.commonName,
    title: null,
    order: book.order,
    numberOfChapters: book.numberOfChapters,
    firstChapterNumber: 1,
    firstChapterApiLink: `/api/esv/${book.id}/1.json`,
    lastChapterNumber: book.numberOfChapters,
    lastChapterApiLink: `/api/esv/${book.id}/${book.numberOfChapters}.json`,
    totalNumberOfVerses: 0,
    isApocryphal: false,
  }))

  res.json({
    translation: {
      id: 'ESV',
      name: 'English Standard Version',
      englishName: 'English Standard Version',
      website: 'https://www.esv.org/',
      licenseUrl: 'https://www.esv.org/',
      shortName: 'ESV',
      language: 'eng',
      languageName: 'English',
      languageEnglishName: 'English',
      textDirection: 'ltr',
      availableFormats: ['json'],
      listOfBooksApiLink: '/api/esv/books',
      numberOfBooks: books.length,
      totalNumberOfChapters: books.reduce((sum, book) => sum + book.numberOfChapters, 0),
      totalNumberOfVerses: 0,
    },
    books,
  })
})

app.get('/esv/:bookId/:chapterNumber.json', async (req, res) => {
  if (!ESV_API_KEY) {
    res.status(503).json({ error: 'ESV is not configured. Set ESV_API_KEY on the server.' })
    return
  }

  const bookId = String(req.params.bookId ?? '').trim().toUpperCase()
  const chapterNumber = Number(req.params.chapterNumber)
  if (!bookId || !Number.isInteger(chapterNumber) || chapterNumber < 1) {
    res.status(400).json({ error: 'Invalid book or chapter.' })
    return
  }

  const books = getEsvBooksFromLocalDb()
  const currentBook = books.find((book) => book.id === bookId)
  if (!currentBook) {
    res.status(404).json({ error: `Unknown ESV book id: ${bookId}` })
    return
  }

  if (chapterNumber > currentBook.numberOfChapters) {
    res.status(404).json({ error: `${currentBook.commonName} has only ${currentBook.numberOfChapters} chapters.` })
    return
  }

  const query = `${currentBook.commonName} ${chapterNumber}`
  const params = new URLSearchParams({
    q: query,
    'include-footnotes': 'false',
    'include-footnote-body': 'false',
    'include-headings': 'true',
    'include-verse-numbers': 'true',
    'include-short-copyright': 'false',
    'include-passage-references': 'true',
    'include-first-verse-numbers': 'false',
    'line-length': '0',
  })

  try {
    const response = await fetch(`${ESV_API_BASE_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Token ${ESV_API_KEY}`,
      },
    })

    if (!response.ok) {
      const payload = await response.text().catch(() => '')
      res.status(502).json({ error: `ESV request failed (${response.status}). ${payload}`.trim() })
      return
    }

    const payload = (await response.json()) as {
      passages?: string[]
      query?: string
      canonical?: string
    }

    const passage = payload.passages?.[0]
    if (!passage) {
      res.status(404).json({ error: `No ESV passage found for ${query}.` })
      return
    }

    const verses = parseEsvPassageToVerses(passage)
    const currentBookIndex = books.findIndex((book) => book.id === currentBook.id)
    const previousChapterApiLink =
      chapterNumber > 1
        ? `/api/esv/${currentBook.id}/${chapterNumber - 1}.json`
        : currentBookIndex > 0
          ? `/api/esv/${books[currentBookIndex - 1].id}/${books[currentBookIndex - 1].numberOfChapters}.json`
          : null

    const nextChapterApiLink =
      chapterNumber < currentBook.numberOfChapters
        ? `/api/esv/${currentBook.id}/${chapterNumber + 1}.json`
        : currentBookIndex < books.length - 1
          ? `/api/esv/${books[currentBookIndex + 1].id}/1.json`
          : null

    res.json({
      translation: {
        id: 'ESV',
        name: 'English Standard Version',
        englishName: 'English Standard Version',
        website: 'https://www.esv.org/',
        licenseUrl: 'https://www.esv.org/',
        shortName: 'ESV',
        language: 'eng',
        languageName: 'English',
        languageEnglishName: 'English',
        textDirection: 'ltr',
        availableFormats: ['json'],
        listOfBooksApiLink: '/api/esv/books',
        numberOfBooks: books.length,
        totalNumberOfChapters: 1189,
        totalNumberOfVerses: 31102,
      },
      book: {
        id: currentBook.id,
        translationId: 'ESV',
        name: currentBook.name,
        commonName: currentBook.commonName,
        title: null,
        order: currentBook.order,
        numberOfChapters: currentBook.numberOfChapters,
        firstChapterNumber: 1,
        firstChapterApiLink: `/api/esv/${currentBook.id}/1.json`,
        lastChapterNumber: currentBook.numberOfChapters,
        lastChapterApiLink: `/api/esv/${currentBook.id}/${currentBook.numberOfChapters}.json`,
        totalNumberOfVerses: 0,
        isApocryphal: false,
      },
      thisChapterLink: `/api/esv/${currentBook.id}/${chapterNumber}.json`,
      thisChapterAudioLinks: {},
      nextChapterApiLink,
      nextChapterAudioLinks: null,
      previousChapterApiLink,
      previousChapterAudioLinks: null,
      numberOfVerses: verses.length,
      chapter: {
        number: chapterNumber,
        content: verses,
        footnotes: [],
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(502).json({ error: `Failed to load ESV passage: ${message}` })
  }
})

app.get('/apibible/:translationId/books', async (req, res) => {
  const translationId = String(req.params.translationId ?? '').trim().toUpperCase()

  if (!API_BIBLE_SUPPORTED_TRANSLATIONS.includes(translationId as 'CSB' | 'NLT' | 'NASB')) {
    res.status(404).json({ error: `Unsupported API.bible translation: ${translationId}` })
    return
  }

  try {
    const { bibleId, canonicalToApiBookId } = await getApiBibleBookIdMap(translationId)
    if (!bibleId) {
      res.status(404).json({ error: `${translationId} is not available in your API.bible account.` })
      return
    }

    const canonicalBooks = getEsvBooksFromLocalDb().filter((book) =>
      canonicalToApiBookId.has(book.id.toUpperCase()),
    )

    const books = canonicalBooks.map((book) => ({
      id: book.id,
      translationId,
      name: book.name,
      commonName: book.commonName,
      title: null,
      order: book.order,
      numberOfChapters: book.numberOfChapters,
      firstChapterNumber: 1,
      firstChapterApiLink: `/api/apibible/${translationId}/${book.id}/1.json`,
      lastChapterNumber: book.numberOfChapters,
      lastChapterApiLink: `/api/apibible/${translationId}/${book.id}/${book.numberOfChapters}.json`,
      totalNumberOfVerses: 0,
      isApocryphal: false,
    }))

    const meta = API_BIBLE_TRANSLATION_META[translationId as 'CSB' | 'NLT' | 'NASB']
    res.json({
      translation: {
        id: translationId,
        name: meta.name,
        englishName: meta.englishName,
        website: meta.website,
        licenseUrl: meta.licenseUrl,
        licenseNotes: 'Provided via API.bible access',
        shortName: meta.shortName,
        language: 'eng',
        languageName: 'English',
        languageEnglishName: 'English',
        textDirection: 'ltr',
        availableFormats: ['json'],
        listOfBooksApiLink: `/api/apibible/${translationId}/books`,
        numberOfBooks: books.length,
        totalNumberOfChapters: books.reduce((sum, book) => sum + book.numberOfChapters, 0),
        totalNumberOfVerses: 0,
      },
      books,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(502).json({ error: `Failed to load API.bible books: ${message}` })
  }
})

app.get('/apibible/:translationId/:bookId/:chapterNumber.json', async (req, res) => {
  const translationId = String(req.params.translationId ?? '').trim().toUpperCase()
  const bookId = String(req.params.bookId ?? '').trim().toUpperCase()
  const chapterNumber = Number(req.params.chapterNumber)

  if (!API_BIBLE_SUPPORTED_TRANSLATIONS.includes(translationId as 'CSB' | 'NLT' | 'NASB')) {
    res.status(404).json({ error: `Unsupported API.bible translation: ${translationId}` })
    return
  }

  if (!bookId || !Number.isInteger(chapterNumber) || chapterNumber < 1) {
    res.status(400).json({ error: 'Invalid book or chapter.' })
    return
  }

  try {
    const canonicalBooks = getEsvBooksFromLocalDb()
    const currentBook = canonicalBooks.find((book) => book.id === bookId)
    if (!currentBook) {
      res.status(404).json({ error: `Unknown book id: ${bookId}` })
      return
    }

    if (chapterNumber > currentBook.numberOfChapters) {
      res.status(404).json({ error: `${currentBook.commonName} has only ${currentBook.numberOfChapters} chapters.` })
      return
    }

    const { bibleId, canonicalToApiBookId } = await getApiBibleBookIdMap(translationId)
    if (!bibleId) {
      res.status(404).json({ error: `${translationId} is not available in your API.bible account.` })
      return
    }

    const apiBookId = canonicalToApiBookId.get(bookId)
    if (!apiBookId) {
      res.status(404).json({ error: `${translationId} does not expose book ${bookId}.` })
      return
    }

    const chapterId = await getApiBibleChapterId(bibleId, apiBookId, chapterNumber)
    if (!chapterId) {
      res.status(404).json({ error: `Could not resolve chapter ${bookId} ${chapterNumber} for ${translationId}.` })
      return
    }

    const chapterPayload = await apiBibleRequest<{ data?: { content?: string } }>(
      `/bibles/${bibleId}/chapters/${chapterId}`,
    )

    const verses = parseApiBibleChapterContentToVerses(chapterPayload.data?.content ?? '')

    const currentBookIndex = canonicalBooks.findIndex((book) => book.id === currentBook.id)
    const previousChapterApiLink =
      chapterNumber > 1
        ? `/api/apibible/${translationId}/${currentBook.id}/${chapterNumber - 1}.json`
        : currentBookIndex > 0
          ? `/api/apibible/${translationId}/${canonicalBooks[currentBookIndex - 1].id}/${canonicalBooks[currentBookIndex - 1].numberOfChapters}.json`
          : null

    const nextChapterApiLink =
      chapterNumber < currentBook.numberOfChapters
        ? `/api/apibible/${translationId}/${currentBook.id}/${chapterNumber + 1}.json`
        : currentBookIndex < canonicalBooks.length - 1
          ? `/api/apibible/${translationId}/${canonicalBooks[currentBookIndex + 1].id}/1.json`
          : null

    const thisChapterAudioLinks = await getApiBibleAudioLinksForChapter(translationId, chapterId)
    const meta = API_BIBLE_TRANSLATION_META[translationId as 'CSB' | 'NLT' | 'NASB']

    res.json({
      translation: {
        id: translationId,
        name: meta.name,
        englishName: meta.englishName,
        website: meta.website,
        licenseUrl: meta.licenseUrl,
        licenseNotes: 'Provided via API.bible access',
        shortName: meta.shortName,
        language: 'eng',
        languageName: 'English',
        languageEnglishName: 'English',
        textDirection: 'ltr',
        availableFormats: ['json'],
        listOfBooksApiLink: `/api/apibible/${translationId}/books`,
        numberOfBooks: 66,
        totalNumberOfChapters: 1189,
        totalNumberOfVerses: 31102,
      },
      book: {
        id: currentBook.id,
        translationId,
        name: currentBook.name,
        commonName: currentBook.commonName,
        title: null,
        order: currentBook.order,
        numberOfChapters: currentBook.numberOfChapters,
        firstChapterNumber: 1,
        firstChapterApiLink: `/api/apibible/${translationId}/${currentBook.id}/1.json`,
        lastChapterNumber: currentBook.numberOfChapters,
        lastChapterApiLink: `/api/apibible/${translationId}/${currentBook.id}/${currentBook.numberOfChapters}.json`,
        totalNumberOfVerses: 0,
        isApocryphal: false,
      },
      thisChapterLink: `/api/apibible/${translationId}/${currentBook.id}/${chapterNumber}.json`,
      thisChapterAudioLinks,
      nextChapterApiLink,
      nextChapterAudioLinks: null,
      previousChapterApiLink,
      previousChapterAudioLinks: null,
      numberOfVerses: verses.length,
      chapter: {
        number: chapterNumber,
        content: verses,
        footnotes: [],
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(502).json({ error: `Failed to load API.bible chapter: ${message}` })
  }
})

function createToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' })
}

function getUserFromToken(token: string) {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string }
    if (!payload.sub) {
      return null
    }
    return payload.sub
  } catch {
    return null
  }
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = header.slice('Bearer '.length)
  const userId = getUserFromToken(token)
  if (!userId) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }

  req.userId = userId
  next()
}

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string
  }
}

app.post('/auth/signup', (req, res) => {
  const { name, email, password } = req.body as {
    name?: string
    email?: string
    password?: string
  }

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required.' })
    return
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email.toLowerCase())
  if (existing) {
    res.status(409).json({ error: 'Email already exists.' })
    return
  }

  const id = randomUUID()
  const passwordHash = bcrypt.hashSync(password, 10)
  const createdAt = new Date().toISOString()

  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, name.trim(), email.toLowerCase(), passwordHash, createdAt)

  const token = createToken(id)
  res.json({
    token,
    user: { id, name: name.trim(), email: email.toLowerCase() },
  })
})

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body as {
    email?: string
    password?: string
  }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' })
    return
  }

  const row = db
    .prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?')
    .get(email.toLowerCase()) as
    | { id: string; name: string; email: string; password_hash: string }
    | undefined

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials.' })
    return
  }

  const token = createToken(row.id)
  res.json({
    token,
    user: { id: row.id, name: row.name, email: row.email },
  })
})

app.get('/me', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT id, name, email FROM users WHERE id = ?')
    .get(req.userId) as { id: string; name: string; email: string } | undefined

  if (!row) {
    res.status(404).json({ error: 'User not found.' })
    return
  }

  res.json({ user: row })
})

app.get('/search', (req, res) => {
  const query = String(req.query.query ?? '').trim()
  const translation = String(req.query.translation ?? '').trim()
  const book = String(req.query.book ?? '').trim()
  const limit = Math.min(Number(req.query.limit ?? 20), 100)

  if (!query) {
    res.status(400).json({ error: 'Query is required.' })
    return
  }

  const like = `%${query.replace(/%/g, '')}%`
  const params: Array<string | number> = [like]
  const filters: string[] = []

  if (translation) {
    filters.push('translationId = ?')
    params.push(translation)
  }

  if (book) {
    filters.push('bookId = ?')
    params.push(book)
  }

  params.push(limit)

  const where = filters.length > 0 ? `AND ${filters.join(' AND ')}` : ''
  const rows = bibleDb
    .prepare(
      `SELECT translationId, bookId, chapterNumber, number AS verseNumber, text
       FROM ChapterVerse
       WHERE text LIKE ? ${where}
       ORDER BY bookId, chapterNumber, verseNumber
       LIMIT ?`,
    )
    .all(...params) as Array<{
    translationId: string
    bookId: string
    chapterNumber: number
    verseNumber: number
    text: string
  }>

  const results = rows.map((row) => ({
    translationId: row.translationId,
    bookId: row.bookId,
    chapterNumber: row.chapterNumber,
    verseNumber: row.verseNumber,
    text: row.text,
  }))

  res.json({ results })
})

app.get('/notes', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, reference, text, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId)
  res.json({ notes: rows })
})

app.post('/notes', requireAuth, (req, res) => {
  const { reference, text } = req.body as { reference?: string; text?: string }
  if (!reference || !text) {
    res.status(400).json({ error: 'Reference and text are required.' })
    return
  }
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  db.prepare(
    'INSERT INTO notes (id, user_id, reference, text, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, req.userId, reference.trim(), text.trim(), createdAt)

  res.json({ note: { id, reference: reference.trim(), text: text.trim(), created_at: createdAt } })
})

app.delete('/notes/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
  res.json({ ok: true })
})

app.get('/highlights', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, reference, color, note, created_at FROM highlights WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId)
  res.json({ highlights: rows })
})

app.post('/highlights', requireAuth, (req, res) => {
  const { reference, color, note } = req.body as {
    reference?: string
    color?: string
    note?: string
  }
  if (!reference || !color) {
    res.status(400).json({ error: 'Reference and color are required.' })
    return
  }
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  db.prepare(
    'INSERT INTO highlights (id, user_id, reference, color, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, req.userId, reference.trim(), color, (note ?? '').trim(), createdAt)

  res.json({
    highlight: {
      id,
      reference: reference.trim(),
      color,
      note: (note ?? '').trim(),
      created_at: createdAt,
    },
  })
})

app.delete('/highlights/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM highlights WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
  res.json({ ok: true })
})

app.get('/plans', requireAuth, (req, res) => {
  const plans = db
    .prepare('SELECT id, title, next_reading, progress, created_at FROM plans WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId) as Array<{
      id: string
      title: string
      next_reading: string
      progress: number
      created_at: string
    }>

  if (plans.length === 0) {
    res.json({ plans: [] })
    return
  }

  const planIds = plans.map((plan) => plan.id)
  const placeholders = planIds.map(() => '?').join(', ')
  const items = db
    .prepare(
      `SELECT id, plan_id, translation_id, book_id, chapter_number, label, order_index, completed_at, created_at
       FROM plan_items
       WHERE plan_id IN (${placeholders})
       ORDER BY plan_id, order_index`,
    )
    .all(...planIds) as Array<{
      id: string
      plan_id: string
      translation_id: string
      book_id: string
      chapter_number: number
      label: string
      order_index: number
      completed_at: string | null
      created_at: string
    }>

  const itemsByPlan = new Map<string, typeof items>()
  for (const item of items) {
    const group = itemsByPlan.get(item.plan_id)
    if (group) {
      group.push(item)
    } else {
      itemsByPlan.set(item.plan_id, [item])
    }
  }

  const response = plans.map((plan) => {
    const planItems = itemsByPlan.get(plan.id) ?? []
    const totalItems = planItems.length
    const completedItems = planItems.filter((item) => item.completed_at).length
    const nextItem = planItems.find((item) => !item.completed_at)
    const progress = totalItems
      ? Math.round((completedItems / totalItems) * 100)
      : plan.progress

    return {
      ...plan,
      progress,
      next_reading: nextItem?.label ?? plan.next_reading,
      total_items: totalItems,
      completed_items: completedItems,
      items: planItems,
    }
  })

  res.json({ plans: response })
})

app.post('/plans', requireAuth, (req, res) => {
  const { title, nextReading, progress, items } = req.body as {
    title?: string
    nextReading?: string
    progress?: number
    items?: Array<{
      translationId?: string
      bookId?: string
      chapterNumber?: number
      label?: string
    }>
  }
  if (!title) {
    res.status(400).json({ error: 'Title is required.' })
    return
  }
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const planItems = Array.isArray(items) ? items : []
  const sanitizedItems = planItems
    .map((item, index) => ({
      id: randomUUID(),
      translation_id: (item.translationId ?? '').trim(),
      book_id: (item.bookId ?? '').trim(),
      chapter_number: Number(item.chapterNumber ?? 0),
      label: (item.label ?? '').trim(),
      order_index: index,
      created_at: createdAt,
    }))
    .filter(
      (item) =>
        item.translation_id &&
        item.book_id &&
        item.chapter_number > 0 &&
        item.label,
    )
  const nextReadingFromItems = sanitizedItems[0]?.label
  const safeProgress = Math.max(0, Math.min(Number(progress ?? 0), 100))
  db.prepare(
    'INSERT INTO plans (id, user_id, title, next_reading, progress, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, req.userId, title.trim(), (nextReading ?? '').trim(), safeProgress, createdAt)

  if (sanitizedItems.length > 0) {
    const insertItem = db.prepare(
      `INSERT INTO plan_items
       (id, plan_id, translation_id, book_id, chapter_number, label, order_index, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertMany = db.transaction((itemsToInsert: typeof sanitizedItems) => {
      for (const item of itemsToInsert) {
        insertItem.run(
          item.id,
          id,
          item.translation_id,
          item.book_id,
          item.chapter_number,
          item.label,
          item.order_index,
          null,
          item.created_at,
        )
      }
    })
    insertMany(sanitizedItems)

    db.prepare('UPDATE plans SET next_reading = ?, progress = ? WHERE id = ?').run(
      nextReadingFromItems ?? '',
      0,
      id,
    )
  }

  res.json({
    plan: {
      id,
      title: title.trim(),
      next_reading: nextReadingFromItems ?? (nextReading ?? '').trim(),
      progress: sanitizedItems.length > 0 ? 0 : safeProgress,
      created_at: createdAt,
      total_items: sanitizedItems.length,
      completed_items: 0,
      items: sanitizedItems.map((item) => ({
        id: item.id,
        plan_id: id,
        translation_id: item.translation_id,
        book_id: item.book_id,
        chapter_number: item.chapter_number,
        label: item.label,
        order_index: item.order_index,
        completed_at: null,
        created_at: item.created_at,
      })),
    },
  })
})

app.put('/plans/:planId/items/:itemId', requireAuth, (req, res) => {
  const { completed } = req.body as { completed?: boolean }
  const planId = req.params.planId
  const itemId = req.params.itemId
  const completedAt = completed ? new Date().toISOString() : null

  const plan = db
    .prepare('SELECT id FROM plans WHERE id = ? AND user_id = ?')
    .get(planId, req.userId) as { id: string } | undefined

  if (!plan) {
    res.status(404).json({ error: 'Plan not found.' })
    return
  }

  db.prepare(
    'UPDATE plan_items SET completed_at = ? WHERE id = ? AND plan_id = ?',
  ).run(completedAt, itemId, planId)

  const total = db
    .prepare('SELECT COUNT(*) as count FROM plan_items WHERE plan_id = ?')
    .get(planId) as { count: number }
  const completedCount = db
    .prepare(
      'SELECT COUNT(*) as count FROM plan_items WHERE plan_id = ? AND completed_at IS NOT NULL',
    )
    .get(planId) as { count: number }
  const nextItem = db
    .prepare(
      'SELECT label FROM plan_items WHERE plan_id = ? AND completed_at IS NULL ORDER BY order_index LIMIT 1',
    )
    .get(planId) as { label: string } | undefined

  const progress = total.count > 0
    ? Math.round((completedCount.count / total.count) * 100)
    : 0

  db.prepare('UPDATE plans SET progress = ?, next_reading = ? WHERE id = ?').run(
    progress,
    nextItem?.label ?? 'Completed',
    planId,
  )

  res.json({
    ok: true,
    plan: {
      id: planId,
      progress,
      next_reading: nextItem?.label ?? 'Completed',
      total_items: total.count,
      completed_items: completedCount.count,
    },
    item: {
      id: itemId,
      completed_at: completedAt,
    },
  })
})

app.delete('/plans/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM plans WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Local API running on http://localhost:${PORT}`)
})
