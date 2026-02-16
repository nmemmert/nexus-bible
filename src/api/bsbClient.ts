const API_BASE_URL = import.meta.env.DEV
  ? '/bible-api'
  : 'https://bible.helloao.org'

const LOCAL_API_BASE_URL = '/api'

const ESV_TRANSLATION: Translation = {
  id: 'ESV',
  name: 'English Standard Version',
  englishName: 'English Standard Version',
  website: 'https://www.esv.org/',
  licenseUrl: 'https://www.esv.org/',
  licenseNotes: 'Provided via ESV API key',
  shortName: 'ESV',
  language: 'eng',
  languageName: 'English',
  languageEnglishName: 'English',
  textDirection: 'ltr',
  availableFormats: ['json'],
  listOfBooksApiLink: '/api/esv/books',
  numberOfBooks: 66,
  totalNumberOfChapters: 1189,
  totalNumberOfVerses: 31102,
}

const API_BIBLE_TRANSLATIONS: Translation[] = [
  {
    id: 'CSB',
    name: 'Christian Standard Bible',
    englishName: 'Christian Standard Bible',
    website: 'https://www.christianstandardbible.com/',
    licenseUrl: 'https://www.christianstandardbible.com/',
    licenseNotes: 'Provided via API.bible access',
    shortName: 'CSB',
    language: 'eng',
    languageName: 'English',
    languageEnglishName: 'English',
    textDirection: 'ltr',
    availableFormats: ['json'],
    listOfBooksApiLink: '/api/apibible/CSB/books',
    numberOfBooks: 66,
    totalNumberOfChapters: 1189,
    totalNumberOfVerses: 31102,
  },
  {
    id: 'NLT',
    name: 'New Living Translation',
    englishName: 'New Living Translation',
    website: 'https://www.tyndale.com/',
    licenseUrl: 'https://www.tyndale.com/',
    licenseNotes: 'Provided via API.bible access',
    shortName: 'NLT',
    language: 'eng',
    languageName: 'English',
    languageEnglishName: 'English',
    textDirection: 'ltr',
    availableFormats: ['json'],
    listOfBooksApiLink: '/api/apibible/NLT/books',
    numberOfBooks: 66,
    totalNumberOfChapters: 1189,
    totalNumberOfVerses: 31102,
  },
  {
    id: 'NASB',
    name: 'New American Standard Bible',
    englishName: 'New American Standard Bible',
    website: 'https://www.lockman.org/',
    licenseUrl: 'https://www.lockman.org/',
    licenseNotes: 'Provided via API.bible access',
    shortName: 'NASB',
    language: 'eng',
    languageName: 'English',
    languageEnglishName: 'English',
    textDirection: 'ltr',
    availableFormats: ['json'],
    listOfBooksApiLink: '/api/apibible/NASB/books',
    numberOfBooks: 66,
    totalNumberOfChapters: 1189,
    totalNumberOfVerses: 31102,
  },
]

const LOCAL_PROVIDER_TRANSLATION_IDS = new Set([
  ESV_TRANSLATION.id,
  ...API_BIBLE_TRANSLATIONS.map((translation) => translation.id),
])

function mergePreferredTranslations(
  base: Translation[],
  preferred: Translation[],
): Translation[] {
  const existing = new Set(base.map((translation) => translation.id))
  return [...base, ...preferred.filter((translation) => !existing.has(translation.id))]
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

type FetchOptions = {
  method?: 'GET' | 'POST'
  body?: JsonValue
}

async function fetchJson<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export type Translation = {
  id: string
  name: string
  englishName: string
  website: string
  licenseUrl: string
  licenseNotes?: string | null
  shortName: string
  language: string
  languageName?: string
  languageEnglishName?: string
  textDirection: 'ltr' | 'rtl'
  availableFormats: Array<'json' | 'usfm'>
  listOfBooksApiLink: string
  numberOfBooks: number
  totalNumberOfChapters: number
  totalNumberOfVerses: number
  numberOfApocryphalBooks?: number
  totalNumberOfApocryphalChapters?: number
  totalNumberOfApocryphalVerses?: number
}

export type AvailableTranslations = {
  translations: Translation[]
}

export type TranslationBook = {
  id: string
  translationId: string
  name: string
  commonName: string
  title: string | null
  order: number
  numberOfChapters: number
  firstChapterNumber: number
  firstChapterApiLink: string
  lastChapterNumber: number
  lastChapterApiLink: string
  totalNumberOfVerses: number
  isApocryphal?: boolean
}

export type TranslationBooks = {
  translation: Translation
  books: TranslationBook[]
}

export type ChapterHeading = {
  type: 'heading'
  content: string[]
}

export type ChapterLineBreak = {
  type: 'line_break'
}

export type ChapterHebrewSubtitle = {
  type: 'hebrew_subtitle'
  content: Array<string | FormattedText | VerseFootnoteReference>
}

export type ChapterVerse = {
  type: 'verse'
  number: number
  content: Array<
    string | FormattedText | InlineHeading | InlineLineBreak | VerseFootnoteReference
  >
}

export type ChapterContent =
  | ChapterHeading
  | ChapterLineBreak
  | ChapterHebrewSubtitle
  | ChapterVerse

export type FormattedText = {
  text: string
  poem?: number
  wordsOfJesus?: boolean
}

export type InlineHeading = {
  heading: string
}

export type InlineLineBreak = {
  lineBreak: true
}

export type VerseFootnoteReference = {
  noteId: number
}

export type ChapterFootnote = {
  noteId: number
  text: string
  reference?: {
    chapter: number
    verse: number
  }
  caller: '+' | string | null
}

export type TranslationBookChapterAudioLinks = {
  [reader: string]: string
}

export type TranslationBookChapter = {
  translation: Translation
  book: TranslationBook
  thisChapterLink: string
  thisChapterAudioLinks: TranslationBookChapterAudioLinks
  nextChapterApiLink: string | null
  nextChapterAudioLinks: TranslationBookChapterAudioLinks | null
  previousChapterApiLink: string | null
  previousChapterAudioLinks: TranslationBookChapterAudioLinks | null
  numberOfVerses: number
  chapter: {
    number: number
    content: ChapterContent[]
    footnotes: ChapterFootnote[]
  }
}

export type Commentary = {
  id: string
  name: string
  englishName: string
  website: string
  licenseUrl: string
  licenseNotes?: string | null
  language: string
  languageName?: string
  languageEnglishName?: string
  textDirection: 'ltr' | 'rtl'
  availableFormats: Array<'json' | 'usfm'>
  listOfBooksApiLink: string
  listOfProfilesApiLink?: string
  sha256?: string
  numberOfBooks: number
  totalNumberOfChapters: number
  totalNumberOfVerses: number
  totalNumberOfProfiles?: number
}

export type AvailableCommentaries = {
  commentaries: Commentary[]
}

export type CommentaryBook = {
  id: string
  commentaryId: string
  name: string
  commonName: string
  introduction?: string
  order: number
  firstChapterNumber: number | null
  firstChapterApiLink: string | null
  lastChapterNumber: number | null
  lastChapterApiLink: string | null
  numberOfChapters: number
  totalNumberOfVerses: number
}

export type CommentaryBooks = {
  commentary: Commentary
  books: CommentaryBook[]
}

export type CommentaryBookChapter = {
  commentary: Commentary
  book: CommentaryBook
  thisChapterLink: string
  nextChapterApiLink: string | null
  previousChapterApiLink: string | null
  numberOfVerses: number
  chapter: {
    number: number
    introduction?: string
    content: ChapterVerse[]
  }
}

export type VerseRef = {
  book: string
  chapter: number
  verse: number
  endChapter?: number
  endVerse?: number
}

export type CommentaryProfile = {
  id: string
  subject: string
  reference: VerseRef | null
  thisProfileLink: string
  referenceChapterLink: string | null
}

export type CommentaryProfiles = {
  commentary: Commentary
  profiles: CommentaryProfile[]
}

export type CommentaryProfileContent = {
  commentary: Commentary
  profile: CommentaryProfile
  content: string[]
}

export type Dataset = {
  id: string
  name: string
  englishName: string
  website: string
  licenseUrl: string
  licenseNotes?: string | null
  language: string
  languageName?: string
  languageEnglishName?: string
  textDirection: 'ltr' | 'rtl'
  availableFormats: Array<'json' | 'usfm'>
  listOfBooksApiLink: string
  numberOfBooks: number
  totalNumberOfChapters: number
  totalNumberOfVerses: number
  totalNumberOfReferences: number
}

export type AvailableDatasets = {
  datasets: Dataset[]
}

export type DatasetBook = {
  id: string
  datasetId: string
  order: number
  firstChapterNumber: number
  firstChapterApiLink: string | null
  lastChapterNumber: number | null
  lastChapterApiLink: string | null
  numberOfChapters: number
  totalNumberOfVerses: number
  totalNumberOfReferences: number
}

export type DatasetBooks = {
  dataset: Dataset
  books: DatasetBook[]
}

export type DatasetReference = {
  book: string
  chapter: number
  verse: number
  endVerse?: number
  score?: number
}

export type DatasetVerse = {
  verse: number
  references: DatasetReference[]
}

export type DatasetBookChapter = {
  dataset: Dataset
  book: DatasetBook
  thisChapterLink: string
  nextChapterApiLink: string | null
  previousChapterApiLink: string | null
  numberOfVerses: number
  numberOfReferences?: number
  chapter: {
    number: number
    content: DatasetVerse[]
  }
}

export async function getAvailableTranslations(): Promise<AvailableTranslations> {
  const available = await fetchJson<AvailableTranslations>('/api/available_translations.json')
  return {
    translations: mergePreferredTranslations(available.translations, [
      ESV_TRANSLATION,
      ...API_BIBLE_TRANSLATIONS,
    ]),
  }
}

export async function getBooksForTranslation(
  translationId: string,
): Promise<TranslationBooks> {
  if (LOCAL_PROVIDER_TRANSLATION_IDS.has(translationId)) {
    const endpoint =
      translationId === ESV_TRANSLATION.id
        ? `${LOCAL_API_BASE_URL}/esv/books`
        : `${LOCAL_API_BASE_URL}/apibible/${translationId}/books`

    const response = await fetch(endpoint)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      const message = payload?.error ?? `Request failed: ${response.status}`
      throw new Error(message)
    }
    return (await response.json()) as TranslationBooks
  }

  return fetchJson<TranslationBooks>(`/api/${translationId}/books.json`)
}

export async function getChapter(
  translationId: string,
  bookId: string,
  chapterNumber: number,
): Promise<TranslationBookChapter> {
  if (LOCAL_PROVIDER_TRANSLATION_IDS.has(translationId)) {
    const endpoint =
      translationId === ESV_TRANSLATION.id
        ? `${LOCAL_API_BASE_URL}/esv/${bookId}/${chapterNumber}.json`
        : `${LOCAL_API_BASE_URL}/apibible/${translationId}/${bookId}/${chapterNumber}.json`

    const response = await fetch(endpoint)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      const message = payload?.error ?? `Request failed: ${response.status}`
      throw new Error(message)
    }
    return (await response.json()) as TranslationBookChapter
  }

  return fetchJson<TranslationBookChapter>(
    `/api/${translationId}/${bookId}/${chapterNumber}.json`,
  )
}

export async function getAvailableCommentaries(): Promise<AvailableCommentaries> {
  return fetchJson<AvailableCommentaries>('/api/available_commentaries.json')
}

export async function getCommentaryBooks(
  commentaryId: string,
): Promise<CommentaryBooks> {
  return fetchJson<CommentaryBooks>(`/api/c/${commentaryId}/books.json`)
}

export async function getCommentaryChapter(
  commentaryId: string,
  bookId: string,
  chapterNumber: number,
): Promise<CommentaryBookChapter> {
  return fetchJson<CommentaryBookChapter>(
    `/api/c/${commentaryId}/${bookId}/${chapterNumber}.json`,
  )
}

export async function getCommentaryProfiles(
  commentaryId: string,
): Promise<CommentaryProfiles> {
  return fetchJson<CommentaryProfiles>(`/api/c/${commentaryId}/profiles.json`)
}

export async function getCommentaryProfile(
  commentaryId: string,
  profileId: string,
): Promise<CommentaryProfileContent> {
  return fetchJson<CommentaryProfileContent>(
    `/api/c/${commentaryId}/profiles/${profileId}.json`,
  )
}

export async function getAvailableDatasets(): Promise<AvailableDatasets> {
  return fetchJson<AvailableDatasets>('/api/available_datasets.json')
}

export async function getDatasetBooks(datasetId: string): Promise<DatasetBooks> {
  return fetchJson<DatasetBooks>(`/api/d/${datasetId}/books.json`)
}

export async function getDatasetChapter(
  datasetId: string,
  bookId: string,
  chapterNumber: number,
): Promise<DatasetBookChapter> {
  return fetchJson<DatasetBookChapter>(
    `/api/d/${datasetId}/${bookId}/${chapterNumber}.json`,
  )
}
