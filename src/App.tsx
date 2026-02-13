import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  BrowserRouter,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  getAvailableCommentaries,
  getAvailableDatasets,
  getAvailableTranslations,
  getBooksForTranslation,
  getChapter,
  getCommentaryBooks,
  getCommentaryChapter,
  getDatasetBooks,
  getDatasetChapter,
  type ChapterContent,
  type ChapterFootnote,
  type DatasetReference,
  type FormattedText,
  type InlineHeading,
  type InlineLineBreak,
  type Translation,
  type TranslationBookChapter,
  type VerseFootnoteReference,
} from './api/bsbClient'
import {
  createHighlight,
  createNote,
  createPlan,
  checkHealth,
  deleteHighlight,
  deleteNote,
  deletePlan,
  getCurrentUser,
  getHighlights,
  getNotes,
  getPlans,
  hasToken,
  searchPassages,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  type AuthUser,
  type HighlightRecord,
  type NoteRecord,
  type PlanItem,
  type PlanRecord,
  type SearchResult,
  updatePlanItem,
} from './api/localDbClient'
import './App.css'

type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

const navigation = [
  { to: '/overview', label: 'Overview', caption: 'Start here' },
  { to: '/', label: 'Reader', caption: 'Read and listen' },
  { to: '/search', label: 'Search', caption: 'Find passages' },
  { to: '/library', label: 'Library', caption: 'Books and chapters' },
  { to: '/diagnostics', label: 'Diagnostics', caption: 'Check connectivity' },
]

const mobileToolNavigation = [
  { to: '/notes?tab=notes', label: 'Notes', caption: 'Capture insights' },
  { to: '/notes?tab=highlights', label: 'Highlights', caption: 'Saved marks' },
  { to: '/notes?tab=plans', label: 'Plans', caption: 'Reading rhythm' },
  { to: '/tools/compare', label: 'Compare', caption: 'Translations' },
  { to: '/tools/word-study', label: 'Word study', caption: 'Key terms' },
  { to: '/tools/commentary', label: 'Commentary', caption: 'Study notes' },
  { to: '/tools/cross-references', label: 'Cross refs', caption: 'Linked passages' },
]

const DEFAULT_TRANSLATION = 'BSB'
const DEFAULT_BOOK = 'GEN'
const BOOKMARK_STORAGE_KEY = 'bsb-bookmarks'

type BookmarkEntry = {
  translationId: string
  bookId: string
  chapterNumber: number
  label: string
  createdAt: string
}

const loadBookmarks = (): BookmarkEntry[] => {
  try {
    const raw = localStorage.getItem(BOOKMARK_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is BookmarkEntry =>
        entry &&
        typeof entry.translationId === 'string' &&
        typeof entry.bookId === 'string' &&
        typeof entry.chapterNumber === 'number' &&
        typeof entry.label === 'string' &&
        typeof entry.createdAt === 'string',
    )
  } catch {
    return []
  }
}

const saveBookmarks = (bookmarks: BookmarkEntry[]) => {
  localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('bookmarks-updated'))
  }
}

const PRIORITY_LANGUAGES = [
  { priority: 0, matchers: ['english', 'en', 'eng'] },
  { priority: 1, matchers: ['hebrew', 'he', 'heb', 'hbo'] },
  { priority: 2, matchers: ['greek', 'el', 'ell', 'grc', 'gre'] },
]

const getLanguagePriority = (translation: Translation) => {
  const candidates = [
    translation.languageEnglishName,
    translation.languageName,
    translation.language,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase())

  for (const candidate of candidates) {
    const hit = PRIORITY_LANGUAGES.find((entry) =>
      entry.matchers.some((matcher) =>
        candidate === matcher || candidate.includes(matcher),
      ),
    )
    if (hit) {
      return hit.priority
    }
  }

  return PRIORITY_LANGUAGES.length
}

const prioritizeTranslations = (translations: Translation[]) =>
  translations
    .map((translation, index) => ({
      translation,
      index,
      priority: getLanguagePriority(translation),
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      return a.index - b.index
    })
    .map((entry) => entry.translation)

const PLAN_SETS = [
  {
    id: 'new-testament',
    label: 'New Testament',
    bookIds: [
      'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH',
      'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS',
      '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
    ],
  },
  {
    id: 'old-testament',
    label: 'Old Testament',
    bookIds: [
      'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
      '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
      'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
      'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
    ],
  },
  {
    id: 'gospels',
    label: 'Gospels',
    bookIds: ['MAT', 'MRK', 'LUK', 'JHN'],
  },
  {
    id: 'psalms-proverbs',
    label: 'Psalms + Proverbs',
    bookIds: ['PSA', 'PRO'],
  },
]

const recents = [
  {
    label: 'John 3',
    detail: 'For God so loved the world',
    translationId: DEFAULT_TRANSLATION,
    bookId: 'JHN',
    chapterNumber: 3,
  },
  {
    label: 'Psalm 23',
    detail: 'The Lord is my shepherd',
    translationId: DEFAULT_TRANSLATION,
    bookId: 'PSA',
    chapterNumber: 23,
  },
  {
    label: 'Romans 8',
    detail: 'No condemnation',
    translationId: DEFAULT_TRANSLATION,
    bookId: 'ROM',
    chapterNumber: 8,
  },
]

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('AuthContext is missing')
  }
  return context
}

function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let active = true
    setState((prev) => ({ ...prev, loading: true, error: null }))

    loader()
      .then((data) => {
        if (active) {
          setState({ data, loading: false, error: null })
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message = error instanceof Error ? error.message : 'Request failed'
          setState({ data: null, loading: false, error: message })
        }
      })

    return () => {
      active = false
    }
  }, deps)

  return state
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const bootstrap = async () => {
      if (!hasToken()) {
        setAuthLoading(false)
        return
      }
      try {
        const current = await getCurrentUser()
        setUser(current)
      } catch {
        setUser(null)
      } finally {
        setAuthLoading(false)
      }
    }
    bootstrap()
  }, [])

  const signIn = async (email: string, password: string) => {
    setAuthError(null)
    setAuthLoading(true)
    try {
      const nextUser = await apiSignIn(email, password)
      setUser(nextUser)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed'
      setAuthError(message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const signUp = async (name: string, email: string, password: string) => {
    setAuthError(null)
    setAuthLoading(true)
    try {
      const nextUser = await apiSignUp(name, email, password)
      setUser(nextUser)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed'
      setAuthError(message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const signOut = () => {
    apiSignOut()
    setUser(null)
  }

  const authValue = useMemo<AuthContextValue>(
    () => ({ user, loading: authLoading, error: authError, signIn, signUp, signOut }),
    [user, authLoading, authError],
  )

  return (
    <AuthContext.Provider value={authValue}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<ReaderRoute />} />
            <Route path="overview" element={<OverviewRoute />} />
            <Route path="read/:translationId/:bookId/:chapterNumber" element={<ReaderRoute />} />
            <Route path="search" element={<SearchRoute />} />
            <Route path="library" element={<LibraryRoute />} />
            <Route path="notes" element={<NotesRoute />} />
            <Route path="tools" element={<ToolsRoute />} />
            <Route path="tools/compare" element={<CompareToolRoute />} />
            <Route path="tools/word-study" element={<WordStudyRoute />} />
            <Route path="tools/commentary" element={<CommentaryRoute />} />
            <Route path="tools/cross-references" element={<CrossReferencesRoute />} />
            <Route path="diagnostics" element={<DiagnosticsRoute />} />
            <Route path="signup" element={<SignupRoute />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

function AppShell() {
  const { user, loading, error, signIn, signUp, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showAuth, setShowAuth] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [navOpen, setNavOpen] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [quickSearch, setQuickSearch] = useState('')
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([])
  const [dailyFocus, setDailyFocus] = useState<
    { plan: PlanRecord; item: PlanItem } | null
  >(null)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email ?? '')
    }
  }, [user])

  useEffect(() => {
    const refresh = () => setBookmarks(loadBookmarks())
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('bookmarks-updated', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('bookmarks-updated', refresh)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setDailyFocus(null)
      return
    }
    let active = true
    getPlans()
      .then((plans) => {
        if (!active) return
        const candidates = plans.flatMap((plan) =>
          (plan.items ?? [])
            .filter((item) => !item.completed_at)
            .map((item) => ({ plan, item })),
        )
        if (candidates.length === 0) {
          setDailyFocus(null)
          return
        }
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        setDailyFocus(pick)
      })
      .catch(() => {
        if (active) setDailyFocus(null)
      })
    return () => {
      active = false
    }
  }, [user, location.pathname])

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      return
    }
    if (mode === 'signup' && !name.trim()) {
      return
    }
    try {
      if (mode === 'signup') {
        await signUp(name.trim(), email.trim(), password)
      } else {
        await signIn(email.trim(), password)
      }
      setPassword('')
      setShowAuth(false)
    } catch {
      // Error state is handled by auth context.
    }
  }

  const handleQuickSearch = () => {
    const query = quickSearch.trim()
    if (!query) {
      return
    }
    navigate(`/search?q=${encodeURIComponent(query)}&auto=1`)
    setQuickSearch('')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="kicker">Nexus Bible</p>
          <h1>Read, compare, and study with the Free Use Bible API.</h1>
        </div>
        <div className="header-actions">
          <label className="search">
            <span className="search-label">Quick search</span>
            <input
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleQuickSearch()
                }
              }}
              placeholder="Search within a loaded chapter"
              aria-label="Search passages"
            />
          </label>
          <div className="action-row">
            {user ? (
              <button className="ghost" onClick={() => setShowAuth((prev) => !prev)}>
                {user.name}
              </button>
            ) : (
              <button className="ghost" onClick={() => setShowAuth(true)}>
                Sign in
              </button>
            )}
            <button
              className="ghost"
              onClick={() => navigate('/signup')}
              type="button"
            >
              {user ? 'Manage account' : 'Create account'}
            </button>
            {user && (
              <button className="ghost" onClick={signOut}>
                Sign out
              </button>
            )}
            <button
              className="primary"
              onClick={() =>
                navigate(`/read/${DEFAULT_TRANSLATION}/${DEFAULT_BOOK}/1`)
              }
            >
              Open reader
            </button>
          </div>
          {showAuth && (
            <div className="auth-panel">
              <div>
                <h3>{user ? 'Account' : mode === 'signin' ? 'Sign in' : 'Create account'}</h3>
                <p>
                  {user
                    ? 'Local sync is enabled for your profile.'
                    : 'Use the local server to sync notes, highlights, and plans.'}
                </p>
              </div>
              {!user && (
                <div className="auth-form">
                  <div className="auth-toggle">
                    <button
                      className={`tab ${mode === 'signin' ? 'active' : ''}`}
                      onClick={() => setMode('signin')}
                      type="button"
                    >
                      Sign in
                    </button>
                    <button
                      className={`tab ${mode === 'signup' ? 'active' : ''}`}
                      onClick={() => setMode('signup')}
                      type="button"
                    >
                      Sign up
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <label>
                      Name
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </label>
                  )}
                  <label>
                    Email
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                  {error && <div className="status error">{error}</div>}
                  <button className="primary" onClick={handleAuth} disabled={loading}>
                    {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
                  </button>
                </div>
              )}
              {user && (
                <div className="auth-summary">
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email ?? 'Local profile'}</span>
                  </div>
                  <button className="ghost small" onClick={signOut}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div
        className={`app-body ${
          ''
        }`}
      >
        <aside className={`panel nav-panel ${navOpen ? 'open' : 'collapsed'}`}>
          <div className="panel-header">
            <h2>Navigate</h2>
            <p>Switch between reading modes.</p>
            <button
              className="ghost small nav-toggle"
              type="button"
              onClick={() => setNavOpen((prev) => !prev)}
              aria-expanded={navOpen}
            >
              {navOpen ? 'Hide' : 'Menu'}
            </button>
          </div>
          <nav className="nav-list">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) => {
                  const isReaderRoute =
                    item.to === '/' &&
                    (location.pathname === '/' ||
                      location.pathname.startsWith('/read/'))
                  const isOverviewRoute =
                    item.to === '/overview' && location.pathname === '/overview'
                  return `nav-link ${
                    isActive || isReaderRoute || isOverviewRoute ? 'active' : ''
                  }`
                }}
              >
                <span>{item.label}</span>
                <small>{item.caption}</small>
              </NavLink>
            ))}
            <div className="nav-section mobile-only">Tools</div>
            {mobileToolNavigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-link mobile-only${isActive ? ' active' : ''}`
                }
              >
                <span>{item.label}</span>
                <small>{item.caption}</small>
              </NavLink>
            ))}
          </nav>
          <div className="panel-footer">
            <h3>Recently opened</h3>
            <ul>
              {recents.map((item) => (
                <li key={item.label}>
                  <button
                    className="ghost small recent-link"
                    onClick={() =>
                      navigate(
                        `/read/${item.translationId}/${item.bookId}/${item.chapterNumber}`,
                      )
                    }
                    type="button"
                  >
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
            <h3>Bookmarks</h3>
            {bookmarks.length === 0 ? (
              <p className="muted">Save a verse or range to see it here.</p>
            ) : (
              <ul>
                {bookmarks.slice(0, 6).map((bookmark) => (
                  <li key={`${bookmark.translationId}-${bookmark.bookId}-${bookmark.chapterNumber}-${bookmark.createdAt}`}>
                    <button
                      className="ghost small recent-link"
                      onClick={() =>
                        navigate(
                          `/read/${bookmark.translationId}/${bookmark.bookId}/${bookmark.chapterNumber}`,
                        )
                      }
                      type="button"
                    >
                      <strong>{bookmark.label}</strong>
                      <span>{new Date(bookmark.createdAt).toLocaleDateString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <h3>Daily focus</h3>
            {dailyFocus ? (
              <>
                <p>
                  {dailyFocus.item.label} · {dailyFocus.plan.title}
                </p>
                <button
                  className="primary small"
                  onClick={() =>
                    navigate(
                      `/read/${dailyFocus.item.translation_id}/${
                        dailyFocus.item.book_id
                      }/${dailyFocus.item.chapter_number}`,
                    )
                  }
                >
                  Open reading
                </button>
              </>
            ) : (
              <>
                <p>Build a reading rhythm and keep your study tools close by.</p>
                <button
                  className="primary small"
                  onClick={() => navigate('/notes?tab=plans')}
                >
                  Start a plan
                </button>
              </>
            )}
          </div>
        </aside>

        <main className="panel content-panel">
          <Outlet />
        </main>

      </div>
    </div>
  )
}

function ReaderRoute() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams<{
    translationId?: string
    bookId?: string
    chapterNumber?: string
  }>()
  const paramTranslation = params.translationId
  const paramBook = params.bookId
  const paramChapter = params.chapterNumber
  const isDeepLink = location.pathname.startsWith('/read/')
  const initialChapter = Number(paramChapter)
  const translationsState = useAsyncData(getAvailableTranslations, [])
  const orderedTranslations = useMemo(
    () => prioritizeTranslations(translationsState.data?.translations ?? []),
    [translationsState.data],
  )
  const [translationId, setTranslationId] = useState(
    paramTranslation ?? DEFAULT_TRANSLATION,
  )
  const booksState = useAsyncData(
    () => getBooksForTranslation(translationId),
    [translationId],
  )
  const [bookId, setBookId] = useState(paramBook ?? DEFAULT_BOOK)
  const [chapterNumber, setChapterNumber] = useState(
    Number.isFinite(initialChapter) && initialChapter > 0 ? initialChapter : 1,
  )
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const actionTimeoutRef = useRef<number | null>(null)
  const audioPanelRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [selectionInfo, setSelectionInfo] = useState<
    | {
        from: number
        to: number
        text: string
        rect?: DOMRect
      }
    | null
  >(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [highlightColor, setHighlightColor] = useState('gold')
  const [highlightVerse, setHighlightVerse] = useState<number | null>(null)

  const chapterState = useAsyncData(
    () => getChapter(translationId, bookId, chapterNumber),
    [translationId, bookId, chapterNumber],
  )

  const [audioReader, setAudioReader] = useState<string | null>(null)

  const books = booksState.data?.books ?? []
  const selectedBook = books.find((book) => book.id === bookId) ?? books[0]
  const chapterMax = selectedBook?.numberOfChapters ?? 1

  const setToast = (message: string) => {
    setActionMessage(message)
    if (actionTimeoutRef.current) {
      window.clearTimeout(actionTimeoutRef.current)
    }
    actionTimeoutRef.current = window.setTimeout(() => {
      setActionMessage(null)
      actionTimeoutRef.current = null
    }, 3000)
  }

  const clearSelection = () => {
    setSelectionInfo(null)
    setNoteDraft('')
    setShowNoteEditor(false)
    window.getSelection()?.removeAllRanges()
  }

  const buildReference = (from: number, to: number) => {
    const range = from === to ? `${from}` : `${from}-${to}`
    const bookLabel = selectedBook?.commonName ?? bookId
    return `${translationId} ${bookLabel} ${chapterNumber}:${range}`
  }

  const handleSelection = (
    info: { from: number; to: number; text: string; rect?: DOMRect } | null,
  ) => {
    if (!info) {
      clearSelection()
      return
    }
    setSelectionInfo(info)
    setShowNoteEditor(false)
    setNoteDraft(info.text)
  }

  const handleAddNote = async () => {
    if (!selectionInfo) {
      return
    }
    if (!user) {
      setToast('Sign in to save notes.')
      return
    }
    const text = noteDraft.trim() || selectionInfo.text.trim()
    if (!text) {
      setToast('Enter a note to save.')
      return
    }
    try {
      await createNote(buildReference(selectionInfo.from, selectionInfo.to), text)
      setToast('Note saved.')
      clearSelection()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save note'
      setToast(message)
    }
  }

  const handleHighlight = async (color: string) => {
    if (!selectionInfo) {
      return
    }
    if (!user) {
      setToast('Sign in to save highlights.')
      return
    }
    try {
      await createHighlight(
        buildReference(selectionInfo.from, selectionInfo.to),
        color,
        selectionInfo.text.trim(),
      )
      setToast('Highlight saved.')
      clearSelection()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save highlight'
      setToast(message)
    }
  }

  const handleShare = async () => {
    const chapterLabel = `${selectedBook?.commonName ?? bookId} ${chapterNumber}`
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Nexus Bible - ${chapterLabel}`,
          text: `${chapterLabel} (${translationId})`,
          url,
        })
        setToast('Share dialog opened.')
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setToast('Link copied to clipboard.')
        return
      }
    } catch {
      // Fall through to manual copy message.
    }
    setToast('Copy the page URL from your browser address bar.')
  }

  const handleBookmark = () => {
    const chapterLabel = `${selectedBook?.commonName ?? bookId} ${chapterNumber}`
    const entry: BookmarkEntry = {
      translationId,
      bookId,
      chapterNumber,
      label: chapterLabel,
      createdAt: new Date().toISOString(),
    }
    const existing = loadBookmarks()
    const isDuplicate = existing.some(
      (bookmark) =>
        bookmark.translationId === translationId &&
        bookmark.bookId === bookId &&
        bookmark.chapterNumber === chapterNumber,
    )
    if (!isDuplicate) {
      saveBookmarks([entry, ...existing].slice(0, 50))
    }
    setToast(isDuplicate ? 'Bookmark already saved.' : 'Bookmark saved.')
  }

  const handleListen = async () => {
    if (!audioPanelRef.current) {
      setToast('No audio is available for this chapter.')
      return
    }
    audioPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (audioRef.current) {
      try {
        await audioRef.current.play()
      } catch {
        // Autoplay may be blocked; user can press play.
      }
    }
  }

  useEffect(() => {
    if (orderedTranslations.length === 0) {
      return
    }
    if (!orderedTranslations.find((translation) => translation.id === translationId)) {
      setTranslationId(orderedTranslations[0].id)
    }
  }, [orderedTranslations, translationId])

  useEffect(() => {
    if (!isDeepLink) {
      return
    }
    if (paramTranslation && paramTranslation !== translationId) {
      setTranslationId(paramTranslation)
    }
    if (paramBook && paramBook !== bookId) {
      setBookId(paramBook)
    }
    if (paramChapter) {
      const nextChapter = Number(paramChapter)
      if (Number.isFinite(nextChapter) && nextChapter > 0 && nextChapter !== chapterNumber) {
        setChapterNumber(nextChapter)
      }
    }
  }, [isDeepLink, paramTranslation, paramBook, paramChapter])

  useEffect(() => {
    if (books.length > 0 && !books.find((book) => book.id === bookId)) {
      setBookId(books[0].id)
      setChapterNumber(books[0].firstChapterNumber)
    }
  }, [books, bookId])

  useEffect(() => {
    if (chapterNumber > chapterMax) {
      setChapterNumber(chapterMax)
    }
  }, [chapterNumber, chapterMax])

  useEffect(() => {
    const target = `/read/${translationId}/${bookId}/${chapterNumber}`
    if (location.pathname !== target) {
      navigate(target, { replace: true })
    }
  }, [translationId, bookId, chapterNumber, location.pathname, navigate])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const verseParam = Number(params.get('verse') ?? 0)
    if (Number.isFinite(verseParam) && verseParam > 0) {
      setHighlightVerse(verseParam)
    } else {
      setHighlightVerse(null)
    }
  }, [location.search])

  useEffect(() => {
    if (!chapterState.data || !highlightVerse) {
      return
    }
    const element = document.getElementById(`verse-${highlightVerse}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [chapterState.data, highlightVerse])

  useEffect(() => {
    const audioLinks = chapterState.data?.thisChapterAudioLinks
    if (!audioLinks) {
      setAudioReader(null)
      return
    }

    const readers = Object.keys(audioLinks)
    if (readers.length === 0) {
      setAudioReader(null)
      return
    }

    if (!audioReader || !audioLinks[audioReader]) {
      setAudioReader(readers[0])
    }
  }, [chapterState.data, audioReader])

  return (
    <section className="reader">
      <header>
        <div>
          <p className="kicker">Passage</p>
          <h2>Reader</h2>
          <p className="subtitle">
            Browse chapters and listen to available audio readers.
          </p>
        </div>
        <div className="reader-actions">
          <button className="ghost small" onClick={handleShare}>
            Share
          </button>
          <button className="ghost small" onClick={handleBookmark}>
            Bookmark
          </button>
          <button className="primary small" onClick={handleListen}>
            Listen
          </button>
        </div>
      </header>

      {actionMessage && <div className="status">{actionMessage}</div>}

      <div className="selector-row">
        <Selector
          label="Translation"
          value={translationId}
          onChange={setTranslationId}
          options={
            orderedTranslations.map((translation) => ({
              value: translation.id,
              label: `${translation.shortName} - ${translation.englishName}`,
            })) ?? []
          }
          loading={translationsState.loading}
        />
        <Selector
          label="Book"
          value={bookId}
          onChange={setBookId}
          options={books.map((book) => ({
            value: book.id,
            label: book.commonName,
          }))}
          loading={booksState.loading}
        />
        <Selector
          label="Chapter"
          value={chapterNumber.toString()}
          onChange={(value) => setChapterNumber(Number(value))}
          options={Array.from({ length: chapterMax }, (_, index) => ({
            value: String(index + 1),
            label: String(index + 1),
          }))}
          loading={booksState.loading}
        />
      </div>

      {selectionInfo && (
        <div
          className={`selection-panel${selectionInfo.rect ? ' floating' : ''}`}
          style={
            selectionInfo.rect
              ? {
                  top: Math.min(selectionInfo.rect.bottom + 8, window.innerHeight - 140),
                  left: Math.min(selectionInfo.rect.left, window.innerWidth - 320),
                }
              : undefined
          }
        >
          <div>
            <p className="selection-label">Selected</p>
            <strong>{buildReference(selectionInfo.from, selectionInfo.to)}</strong>
          </div>
          <div className="selection-actions">
            <button
              className="ghost small"
              type="button"
              onClick={() => setShowNoteEditor((prev) => !prev)}
            >
              {showNoteEditor ? 'Hide note' : 'Add note'}
            </button>
            <select
              value={highlightColor}
              onChange={(event) => setHighlightColor(event.target.value)}
            >
              <option value="gold">Gold</option>
              <option value="sage">Sage</option>
              <option value="rose">Rose</option>
              <option value="sky">Sky</option>
            </select>
            <button
              className="primary small"
              type="button"
              onClick={() => handleHighlight(highlightColor)}
            >
              Highlight
            </button>
            <button className="ghost small" type="button" onClick={clearSelection}>
              Clear
            </button>
          </div>
          {showNoteEditor && (
            <div className="selection-note">
              <textarea
                rows={3}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Write a note for this passage"
              />
              <button className="primary small" type="button" onClick={handleAddNote}>
                Save note
              </button>
            </div>
          )}
        </div>
      )}
      {chapterState.loading && <div className="status">Loading...</div>}
      {chapterState.error && (
        <div className="status error">{chapterState.error}</div>
      )}

      {chapterState.data && (
        <ReaderContent
          chapter={chapterState.data}
          audioReader={audioReader}
          onAudioReaderChange={setAudioReader}
          audioPanelRef={audioPanelRef}
          audioRef={audioRef}
          highlightVerse={highlightVerse}
          onSelection={handleSelection}
        />
      )}

    </section>
  )
}

function ReaderContent({
  chapter,
  audioReader,
  onAudioReaderChange,
  audioPanelRef,
  audioRef,
  highlightVerse,
  onSelection,
}: {
  chapter: TranslationBookChapter
  audioReader: string | null
  onAudioReaderChange: (reader: string) => void
  audioPanelRef?: RefObject<HTMLDivElement>
  audioRef?: RefObject<HTMLAudioElement>
  highlightVerse?: number | null
  onSelection?: (
    info: { from: number; to: number; text: string; rect?: DOMRect } | null,
  ) => void
}) {
  const audioLinks = chapter.thisChapterAudioLinks
  const audioReaders = Object.keys(audioLinks)
  const chapterRef = useRef<HTMLDivElement | null>(null)
  const footnoteMap = useMemo(
    () => new Map(chapter.chapter.footnotes.map((note) => [note.noteId, note])),
    [chapter.chapter.footnotes],
  )

  const handleSelection = () => {
    if (!onSelection) {
      return
    }
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      onSelection(null)
      return
    }
    const anchorNode = selection.anchorNode
    const focusNode = selection.focusNode
    if (!anchorNode || !focusNode || !chapterRef.current) {
      onSelection(null)
      return
    }
    if (!chapterRef.current.contains(anchorNode)) {
      return
    }
    const getVerse = (node: Node) =>
      (node instanceof Element ? node : node.parentElement)?.closest('.verse') as
        | HTMLElement
        | null
    const startVerse = getVerse(anchorNode)
    const endVerse = getVerse(focusNode)
    if (!startVerse || !endVerse) {
      onSelection(null)
      return
    }
    const startNumber = Number(startVerse.dataset.verseNumber ?? 0)
    const endNumber = Number(endVerse.dataset.verseNumber ?? 0)
    if (!startNumber || !endNumber) {
      onSelection(null)
      return
    }
    const from = Math.min(startNumber, endNumber)
    const to = Math.max(startNumber, endNumber)
    const text = selection.toString().trim()
    if (!text) {
      onSelection(null)
      return
    }
    const range = selection.getRangeAt(0)
    onSelection({ from, to, text, rect: range.getBoundingClientRect() })
  }

  return (
    <>
      {audioReaders.length > 0 && (
        <div className="audio-panel" ref={audioPanelRef}>
          <Selector
            label="Audio reader"
            value={audioReader ?? audioReaders[0]}
            onChange={onAudioReaderChange}
            options={audioReaders.map((reader) => ({
              value: reader,
              label: reader,
            }))}
          />
          {audioReader && audioLinks[audioReader] && (
            <audio ref={audioRef} controls src={audioLinks[audioReader]} />
          )}
        </div>
      )}

      <div
        className="chapter-content"
        ref={chapterRef}
        onMouseUp={handleSelection}
        onKeyUp={handleSelection}
      >
        {chapter.chapter.content.map((item, index) =>
          renderChapterItem(
            item,
            index,
            footnoteMap,
            highlightVerse,
            chapter.translation.shortName,
            chapter.book.commonName,
            chapter.chapter.number,
          ),
        )}
      </div>

      {chapter.chapter.footnotes.length > 0 && (
        <div className="footnotes">
          <h3>Footnotes</h3>
          <ol>
            {chapter.chapter.footnotes.map((note) => (
              <li key={note.noteId}>
                <strong>{formatCaller(note, chapter.chapter.footnotes)}</strong>{' '}
                {note.text}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}

function LibraryRoute() {
  const navigate = useNavigate()
  const translationsState = useAsyncData(getAvailableTranslations, [])
  const orderedTranslations = useMemo(
    () => prioritizeTranslations(translationsState.data?.translations ?? []),
    [translationsState.data],
  )
  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION)
  const booksState = useAsyncData(
    () => getBooksForTranslation(translationId),
    [translationId],
  )

  useEffect(() => {
    if (orderedTranslations.length === 0) {
      return
    }
    if (!orderedTranslations.find((translation) => translation.id === translationId)) {
      setTranslationId(orderedTranslations[0].id)
    }
  }, [orderedTranslations, translationId])

  const categorizedBooks = useMemo(() => {
    if (!booksState.data) {
      return []
    }

    const categories = [
      {
        name: 'Pentateuch (Law)',
        books: ['GEN', 'EXO', 'LEV', 'NUM', 'DEU'],
      },
      {
        name: 'Historical Books',
        books: ['JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST'],
      },
      {
        name: 'Wisdom & Poetry',
        books: ['JOB', 'PSA', 'PRO', 'ECC', 'SNG'],
      },
      {
        name: 'Major Prophets',
        books: ['ISA', 'JER', 'LAM', 'EZK', 'DAN'],
      },
      {
        name: 'Minor Prophets',
        books: ['HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'],
      },
      {
        name: 'Gospels',
        books: ['MAT', 'MRK', 'LUK', 'JHN'],
      },
      {
        name: 'History',
        books: ['ACT'],
      },
      {
        name: "Paul's Letters",
        books: ['ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM'],
      },
      {
        name: 'General Letters',
        books: ['HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD'],
      },
      {
        name: 'Prophecy',
        books: ['REV'],
      },
    ]

    return categories
      .map((category) => ({
        name: category.name,
        books: booksState.data!.books.filter((book) =>
          category.books.includes(book.id),
        ),
      }))
      .filter((category) => category.books.length > 0)
  }, [booksState.data])

  return (
    <section className="library">
      <header>
        <div>
          <p className="kicker">Library</p>
          <h2>Books and chapters</h2>
          <p className="subtitle">
            Browse the full list of books available for the chosen translation.
          </p>
        </div>
      </header>

      <div className="selector-row">
        <Selector
          label="Translation"
          value={translationId}
          onChange={setTranslationId}
          options={
            orderedTranslations.map((translation) => ({
              value: translation.id,
              label: `${translation.shortName} - ${translation.englishName}`,
            })) ?? []
          }
          loading={translationsState.loading}
        />
      </div>

      <StatusBlock
        loading={booksState.loading}
        error={booksState.error}
        emptyMessage="Select a translation to view books."
      />

      {booksState.data && (
        <div className="library-categories">
          {categorizedBooks.map((category) => (
            <div key={category.name} className="book-category">
              <h3>{category.name}</h3>
              <div className="library-grid">
                {category.books.map((book) => (
                  <article key={book.id}>
                    <h4>{book.commonName}</h4>
                    <p>{book.numberOfChapters} chapters</p>
                    <button
                      className="ghost small"
                      onClick={() =>
                        navigate(
                          `/read/${translationId}/${book.id}/${book.firstChapterNumber}`,
                        )
                      }
                    >
                      Open
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function NotesRoute() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'notes' | 'highlights' | 'plans'>(() => {
    const tab = new URLSearchParams(location.search).get('tab')
    return tab === 'highlights' || tab === 'plans' || tab === 'notes' ? tab : 'notes'
  })
  const [notesState, setNotesState] = useState<AsyncState<NoteRecord[]>>({
    data: [],
    loading: false,
    error: null,
  })
  const [reference, setReference] = useState('John 3:16')
  const [text, setText] = useState('')

  const [highlightsState, setHighlightsState] = useState<
    AsyncState<HighlightRecord[]>
  >({ data: [], loading: false, error: null })
  const [highlightRef, setHighlightRef] = useState('Psalm 23:1')
  const [highlightNote, setHighlightNote] = useState('')
  const [highlightColor, setHighlightColor] = useState('gold')

  const [plansState, setPlansState] = useState<AsyncState<PlanRecord[]>>({
    data: [],
    loading: false,
    error: null,
  })
  const [planTitle, setPlanTitle] = useState('New Testament in 30 days')
  const [planScope, setPlanScope] = useState(PLAN_SETS[0].id)
  const [planReadingsPerDay, setPlanReadingsPerDay] = useState(2)
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({})

  const planBooksState = useAsyncData(
    () => getBooksForTranslation(DEFAULT_TRANSLATION),
    [],
  )

  const planItems = useMemo(() => {
    const selected = PLAN_SETS.find((set) => set.id === planScope)
    const books = planBooksState.data?.books ?? []
    if (!selected || books.length === 0) {
      return [] as Array<{
        translationId: string
        bookId: string
        chapterNumber: number
        label: string
      }>
    }
    const bookMap = new Map(books.map((book) => [book.id, book]))
    const items: Array<{
      translationId: string
      bookId: string
      chapterNumber: number
      label: string
    }> = []

    for (const bookId of selected.bookIds) {
      const book = bookMap.get(bookId)
      if (!book) continue
      const start = book.firstChapterNumber
      const end = book.firstChapterNumber + book.numberOfChapters - 1
      for (let chapter = start; chapter <= end; chapter += 1) {
        items.push({
          translationId: DEFAULT_TRANSLATION,
          bookId: book.id,
          chapterNumber: chapter,
          label: `${book.commonName} ${chapter}`,
        })
      }
    }
    return items
  }, [planScope, planBooksState.data])

  const planEstimatedDays = planItems.length
    ? Math.ceil(planItems.length / Math.max(planReadingsPerDay, 1))
    : 0

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab')
    if (tab === 'highlights' || tab === 'plans' || tab === 'notes') {
      setActiveTab(tab)
    }
  }, [location.search])

  useEffect(() => {
    if (!user) {
      setNotesState({ data: [], loading: false, error: null })
      setHighlightsState({ data: [], loading: false, error: null })
      setPlansState({ data: [], loading: false, error: null })
      return
    }

    const loadNotes = async () => {
      setNotesState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const notes = await getNotes()
        setNotesState({ data: notes, loading: false, error: null })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load notes'
        setNotesState({ data: [], loading: false, error: message })
      }
    }

    const loadHighlights = async () => {
      setHighlightsState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const highlights = await getHighlights()
        setHighlightsState({ data: highlights, loading: false, error: null })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load highlights'
        setHighlightsState({ data: [], loading: false, error: message })
      }
    }

    const loadPlans = async () => {
      setPlansState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const plans = await getPlans()
        setPlansState({ data: plans, loading: false, error: null })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load plans'
        setPlansState({ data: [], loading: false, error: message })
      }
    }

    loadNotes()
    loadHighlights()
    loadPlans()
  }, [user])

  const addNote = async () => {
    if (!user || !text.trim()) {
      return
    }
    try {
      const note = await createNote(reference.trim(), text.trim())
      setNotesState((prev) => ({
        ...prev,
        data: [note, ...(prev.data ?? [])],
        error: null,
      }))
      setText('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save note'
      setNotesState((prev) => ({ ...prev, error: message }))
    }
  }

  const addHighlight = async () => {
    if (!user || !highlightRef.trim()) {
      return
    }
    try {
      const highlight = await createHighlight(
        highlightRef.trim(),
        highlightColor,
        highlightNote.trim(),
      )
      setHighlightsState((prev) => ({
        ...prev,
        data: [highlight, ...(prev.data ?? [])],
        error: null,
      }))
      setHighlightNote('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save highlight'
      setHighlightsState((prev) => ({ ...prev, error: message }))
    }
  }

  const addPlan = async () => {
    if (!user || !planTitle.trim()) {
      return
    }
    try {
      if (planItems.length === 0) {
        setPlansState((prev) => ({
          ...prev,
          error: 'Select a plan set with available books before saving.',
        }))
        return
      }
      const plan = await createPlan(
        planTitle.trim(),
        planItems[0]?.label ?? 'Select next reading',
        0,
        planItems,
      )
      setPlansState((prev) => ({
        ...prev,
        data: [plan, ...(prev.data ?? [])],
        error: null,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save plan'
      setPlansState((prev) => ({ ...prev, error: message }))
    }
  }

  const removeNote = async (id: string) => {
    try {
      await deleteNote(id)
      setNotesState((prev) => ({
        ...prev,
        data: (prev.data ?? []).filter((note) => note.id !== id),
        error: null,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove note'
      setNotesState((prev) => ({ ...prev, error: message }))
    }
  }

  const removeHighlight = async (id: string) => {
    try {
      await deleteHighlight(id)
      setHighlightsState((prev) => ({
        ...prev,
        data: (prev.data ?? []).filter((highlight) => highlight.id !== id),
        error: null,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove highlight'
      setHighlightsState((prev) => ({ ...prev, error: message }))
    }
  }

  const removePlan = async (id: string) => {
    try {
      await deletePlan(id)
      setPlansState((prev) => ({
        ...prev,
        data: (prev.data ?? []).filter((plan) => plan.id !== id),
        error: null,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove plan'
      setPlansState((prev) => ({ ...prev, error: message }))
    }
  }

  const togglePlanItem = async (planId: string, item: PlanItem) => {
    try {
      const result = await updatePlanItem(planId, item.id, !item.completed_at)
      setPlansState((prev) => ({
        ...prev,
        data: (prev.data ?? []).map((plan) => {
          if (plan.id !== planId) return plan
          const nextItems = (plan.items ?? []).map((planItem) =>
            planItem.id === item.id
              ? { ...planItem, completed_at: result.item.completed_at }
              : planItem,
          )
          return {
            ...plan,
            items: nextItems,
            progress: result.plan.progress,
            next_reading: result.plan.next_reading,
            total_items: result.plan.total_items,
            completed_items: result.plan.completed_items,
          }
        }),
        error: null,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update plan'
      setPlansState((prev) => ({ ...prev, error: message }))
    }
  }

  return (
    <section className="notes">
      <header>
        <div>
          <p className="kicker">Notes</p>
          <h2>Highlights, notes, and plans</h2>
          <p className="subtitle">
            {user
              ? `Local sync for ${user.name}`
              : 'Sign in to use the local sync server.'}
          </p>
        </div>
      </header>

      <div className="tab-row">
        {['notes', 'highlights', 'plans'].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => {
              const nextTab = tab as typeof activeTab
              setActiveTab(nextTab)
              navigate(`/notes?tab=${nextTab}`)
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'notes' && (
        <>
          {!user && (
            <div className="empty">Sign in to sync notes to the local server.</div>
          )}
          <div className="notes-form">
            <label>
              Reference
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                disabled={!user}
              />
            </label>
            <label>
              Note
              <textarea
                rows={3}
                value={text}
                onChange={(event) => setText(event.target.value)}
                disabled={!user}
              />
            </label>
            <button className="primary" onClick={addNote} disabled={!user}>
              Save note
            </button>
          </div>

          <div className="notes-list">
            {notesState.loading && <div className="status">Loading...</div>}
            {notesState.error && (
              <div className="status error">{notesState.error}</div>
            )}
            {(notesState.data?.length ?? 0) === 0 && !notesState.loading && (
              <div className="empty">No notes yet. Add your first one.</div>
            )}
            {notesState.data?.map((note) => (
              <article key={note.id}>
                <div>
                  <h3>{note.reference}</h3>
                  <p>{note.text}</p>
                  <small>{new Date(note.created_at).toLocaleString()}</small>
                </div>
                <button
                  className="ghost small"
                  onClick={() => removeNote(note.id)}
                  disabled={!user}
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {activeTab === 'highlights' && (
        <>
          {!user && (
            <div className="empty">Sign in to sync highlights to the local server.</div>
          )}
          <div className="notes-form">
            <label>
              Reference
              <input
                value={highlightRef}
                onChange={(event) => setHighlightRef(event.target.value)}
                disabled={!user}
              />
            </label>
            <label>
              Color
              <select
                value={highlightColor}
                onChange={(event) => setHighlightColor(event.target.value)}
                disabled={!user}
              >
                <option value="gold">Gold</option>
                <option value="sage">Sage</option>
                <option value="rose">Rose</option>
                <option value="sky">Sky</option>
              </select>
            </label>
            <label>
              Note (optional)
              <textarea
                rows={2}
                value={highlightNote}
                onChange={(event) => setHighlightNote(event.target.value)}
                disabled={!user}
              />
            </label>
            <button className="primary" onClick={addHighlight} disabled={!user}>
              Save highlight
            </button>
          </div>

          <div className="notes-list">
            {highlightsState.loading && <div className="status">Loading...</div>}
            {highlightsState.error && (
              <div className="status error">{highlightsState.error}</div>
            )}
            {(highlightsState.data?.length ?? 0) === 0 &&
              !highlightsState.loading && (
              <div className="empty">No highlights yet.</div>
            )}
            {highlightsState.data?.map((highlight) => (
              <article key={highlight.id}>
                <div>
                  <h3>{highlight.reference}</h3>
                  <p>{highlight.note || 'No note added.'}</p>
                  <small>
                    {highlight.color} ·{' '}
                    {new Date(highlight.created_at).toLocaleString()}
                  </small>
                </div>
                <button
                  className="ghost small"
                  onClick={() => removeHighlight(highlight.id)}
                  disabled={!user}
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {activeTab === 'plans' && (
        <>
          {!user && (
            <div className="empty">Sign in to sync plans to the local server.</div>
          )}
          <div className="notes-form">
            <label>
              Plan title
              <input
                value={planTitle}
                onChange={(event) => setPlanTitle(event.target.value)}
                disabled={!user}
              />
            </label>
            <label>
              Plan set
              <select
                value={planScope}
                onChange={(event) => setPlanScope(event.target.value)}
                disabled={!user}
              >
                {PLAN_SETS.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Readings per day
              <input
                type="number"
                min={1}
                max={20}
                value={planReadingsPerDay}
                onChange={(event) => setPlanReadingsPerDay(Number(event.target.value))}
                disabled={!user}
              />
            </label>
            <div className="helper">
              {planBooksState.loading
                ? 'Loading books for plan builder...'
                : planItems.length > 0
                  ? `${planItems.length} readings · ~${planEstimatedDays} days at ${planReadingsPerDay}/day`
                  : 'Select a plan set to preview readings.'}
            </div>
            <button className="primary" onClick={addPlan} disabled={!user}>
              Save plan
            </button>
          </div>

          <div className="notes-list">
            {plansState.loading && <div className="status">Loading...</div>}
            {plansState.error && (
              <div className="status error">{plansState.error}</div>
            )}
            {(plansState.data?.length ?? 0) === 0 && !plansState.loading && (
              <div className="empty">No plans yet.</div>
            )}
            {plansState.data?.map((plan) => {
              const totalItems = plan.total_items ?? plan.items?.length ?? 0
              const completedItems =
                plan.completed_items ??
                plan.items?.filter((item) => item.completed_at).length ??
                0
              const nextItem = plan.items?.find((item) => !item.completed_at) ?? null
              const showItems = expandedPlans[plan.id]
              const visibleItems = showItems
                ? plan.items ?? []
                : (plan.items ?? []).slice(0, 8)

              return (
                <article key={plan.id}>
                  <div>
                    <h3>{plan.title}</h3>
                    <p>Next: {plan.next_reading || 'All readings completed'}</p>
                    <small>
                      {completedItems}/{totalItems} complete · {plan.progress}% ·{' '}
                      {new Date(plan.created_at).toLocaleString()}
                    </small>
                  </div>
                  {nextItem && (
                    <div className="action-row">
                      <button
                        className="ghost small"
                        onClick={() =>
                          navigate(
                            `/read/${nextItem.translation_id}/${nextItem.book_id}/${nextItem.chapter_number}`,
                          )
                        }
                      >
                        Open
                      </button>
                      <button
                        className="ghost small"
                        onClick={() => togglePlanItem(plan.id, nextItem)}
                        disabled={!user}
                      >
                        Mark done
                      </button>
                    </div>
                  )}
                  {plan.items && plan.items.length > 0 && (
                    <div className="plan-items">
                      {visibleItems.map((item) => (
                        <label key={item.id} className="plan-item">
                          <input
                            type="checkbox"
                            checked={Boolean(item.completed_at)}
                            onChange={() => togglePlanItem(plan.id, item)}
                            disabled={!user}
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                      {plan.items.length > 8 && (
                        <button
                          className="ghost small"
                          onClick={() =>
                            setExpandedPlans((prev) => ({
                              ...prev,
                              [plan.id]: !prev[plan.id],
                            }))
                          }
                        >
                          {showItems ? 'Show fewer' : 'Show all'}
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    className="ghost small"
                    onClick={() => removePlan(plan.id)}
                    disabled={!user}
                  >
                    Remove
                  </button>
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

function OverviewRoute() {
  const { user } = useAuth()
  const [dailyFocus, setDailyFocus] = useState<
    { plan: PlanRecord; item: PlanItem } | null
  >(null)

  useEffect(() => {
    if (!user) {
      setDailyFocus(null)
      return
    }
    let active = true
    getPlans()
      .then((plans) => {
        if (!active) return
        const candidates = plans.flatMap((plan) =>
          (plan.items ?? [])
            .filter((item) => !item.completed_at)
            .map((item) => ({ plan, item })),
        )
        if (candidates.length === 0) {
          setDailyFocus(null)
          return
        }
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        setDailyFocus(pick)
      })
      .catch(() => {
        if (active) setDailyFocus(null)
      })
    return () => {
      active = false
    }
  }, [user])

  const navigate = useNavigate()
  return (
    <section className="overview">
      <header>
        <div>
          <p className="kicker">Overview</p>
          <h2>Everything you need to read and study BSB.</h2>
          <p className="subtitle">
            Search the full text, compare translations, listen to audio, and keep
            notes synced locally.
          </p>
        </div>
      </header>

      {dailyFocus && (
        <article className="daily-focus-card">
          <div>
            <p className="kicker">Daily focus</p>
            <h3>{dailyFocus.item.label}</h3>
            <p className="subtitle">{dailyFocus.plan.title}</p>
          </div>
          <div className="action-row">
            <button
              className="primary small"
              onClick={() =>
                navigate(
                  `/read/${dailyFocus.item.translation_id}/${dailyFocus.item.book_id}/${dailyFocus.item.chapter_number}`,
                )
              }
            >
              Open reading
            </button>
            <button
              className="ghost small"
              onClick={() => navigate('/notes?tab=plans')}
            >
              View plans
            </button>
          </div>
        </article>
      )}
      <div className="overview-grid">
        {[
          {
            title: 'Global search',
            body: 'Search the full English database or focus on a specific book.',
          },
          {
            title: 'Reader + audio',
            body: 'Read any chapter and listen with available audio readers.',
          },
          {
            title: 'Study tools',
            body: 'Compare translations, read commentaries, and follow cross refs.',
          },
          {
            title: 'Local sync',
            body: 'Create an account to sync notes, highlights, and plans locally.',
          },
        ].map((card) => (
          <article key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
      <div className="overview-cta">
        <button className="primary" onClick={() => navigate('/signup')}>
          Create account
        </button>
        <button
          className="ghost"
          onClick={() => navigate(`/read/${DEFAULT_TRANSLATION}/${DEFAULT_BOOK}/1`)}
        >
          Jump into Genesis 1
        </button>
      </div>
    </section>
  )
}

function SignupRoute() {
  const { user, loading, error, signIn, signUp, signOut } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      return
    }
    if (mode === 'signup' && !name.trim()) {
      return
    }
    try {
      if (mode === 'signup') {
        await signUp(name.trim(), email.trim(), password)
      } else {
        await signIn(email.trim(), password)
      }
      setPassword('')
      navigate('/notes')
    } catch {
      // Error state handled by auth context.
    }
  }

  return (
    <section className="signup">
      <header>
        <div>
          <p className="kicker">Account</p>
          <h2>{user ? 'Account overview' : 'Create your local account'}</h2>
          <p className="subtitle">
            Local auth keeps notes, highlights, and plans synced to this device.
          </p>
        </div>
      </header>

      <div className="signup-card">
        {user ? (
          <div className="auth-summary">
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button className="ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : (
          <>
            <div className="auth-toggle">
              <button
                className={`tab ${mode === 'signin' ? 'active' : ''}`}
                onClick={() => setMode('signin')}
                type="button"
              >
                Sign in
              </button>
              <button
                className={`tab ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => setMode('signup')}
                type="button"
              >
                Sign up
              </button>
            </div>
            {mode === 'signup' && (
              <label>
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            <label>
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <div className="status error">{error}</div>}
            <button className="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}

function SearchRoute() {
  const translationsState = useAsyncData(getAvailableTranslations, [])
  const orderedTranslations = useMemo(
    () => prioritizeTranslations(translationsState.data?.translations ?? []),
    [translationsState.data],
  )
  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION)
  const [bookId, setBookId] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const booksState = useAsyncData(
    () =>
      translationId
        ? getBooksForTranslation(translationId)
        : Promise.resolve(null),
    [translationId],
  )
  const [query, setQuery] = useState('')
  const [autoRun, setAutoRun] = useState(false)
  const [searchState, setSearchState] = useState<AsyncState<SearchResult[]>>({
    data: [],
    loading: false,
    error: null,
  })

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const paramQuery = params.get('q') ?? ''
    const auto = params.get('auto') === '1'

    if (paramQuery && paramQuery !== query) {
      setQuery(paramQuery)
    }

    if (!auto) {
      return
    }

    if (translationId !== '' || bookId !== '') {
      if (translationId !== '') setTranslationId('')
      if (bookId !== '') setBookId('')
      return
    }

    if (paramQuery.trim()) {
      setAutoRun(true)
    }
  }, [bookId, location.search, query, translationId])

  useEffect(() => {
    if (!translationId) {
      setBookId('')
    }
  }, [translationId])

  const handleSearch = async () => {
    if (!query.trim()) {
      return
    }
    setSearchState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const results = await searchPassages({
        query: query.trim(),
        translation: 'BSB', // Only search BSB translation
        book: bookId || undefined,
        limit: 50,
      })
      setSearchState({ data: results, loading: false, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed'
      setSearchState({ data: [], loading: false, error: message })
    }
  }

  useEffect(() => {
    if (!autoRun) {
      return
    }
    if (!query.trim()) {
      setAutoRun(false)
      return
    }
    handleSearch()
    setAutoRun(false)
  }, [autoRun, query, translationId, bookId])

  return (
    <section className="search-page">
      <header>
        <div>
          <p className="kicker">Search</p>
          <h2>Global passage search</h2>
          <p className="subtitle">
            Powered by the local bible.eng.db download for fast lookups.
          </p>
        </div>
      </header>

      <div className="selector-row">
        <Selector
          label="Translation"
          value={translationId}
          onChange={setTranslationId}
          options={
            [
              { value: '', label: 'All translations' },
              ...orderedTranslations.map((translation) => ({
                value: translation.id,
                label: `${translation.shortName} - ${translation.englishName}`,
              })),
            ]
          }
          loading={translationsState.loading}
        />
        <Selector
          label="Book"
          value={bookId}
          onChange={setBookId}
          options={
            [
              { value: '', label: 'All books' },
              ...(booksState.data?.books.map((book) => ({
                value: book.id,
                label: book.commonName,
              })) ?? []),
            ]
          }
          loading={booksState.loading}
        />
      </div>

      <label className="search-inline">
        <span>Search term</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. faith, love, covenant"
        />
      </label>
      <button className="primary" onClick={handleSearch}>
        Search
      </button>

      {searchState.loading && <div className="status">Searching...</div>}
      {searchState.error && (
        <div className="status error">{searchState.error}</div>
      )}

      {searchState.data && searchState.data.length > 0 && (
        <div className="search-results">
          <h3>Results</h3>
          <ul>
            {searchState.data.map((result, index) => (
              <li key={`${result.bookId}-${result.chapterNumber}-${result.verseNumber}-${index}`}>
                <button
                  className="search-hit"
                  onClick={() => {
                    const books = booksState.data?.books ?? []
                    const normalizedId = result.bookId.trim().toLowerCase()
                    const matchedBook = books.find((book) => {
                      const candidates = [book.id, book.commonName, book.name, book.title]
                        .filter(Boolean)
                        .map((value) => String(value).trim().toLowerCase())
                      return candidates.includes(normalizedId)
                    })
                    const targetBookId = matchedBook?.id ?? result.bookId
                    navigate(
                      `/read/${result.translationId}/${targetBookId}/${result.chapterNumber}?verse=${result.verseNumber}`,
                    )
                  }}
                >
                  <strong>
                    {result.translationId} {result.bookId} {result.chapterNumber}:
                    {result.verseNumber}
                  </strong>{' '}
                  {result.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function DiagnosticsRoute() {
  const { user } = useAuth()
  const apiState = useAsyncData(
    () => getChapter(DEFAULT_TRANSLATION, DEFAULT_BOOK, 1),
    [],
  )
  const healthState = useAsyncData(checkHealth, [])

  return (
    <section className="diagnostics">
      <header>
        <div>
          <p className="kicker">Diagnostics</p>
          <h2>Connectivity checks</h2>
          <p className="subtitle">
            Verify API reachability, audio playback, and local sync server.
          </p>
        </div>
      </header>

      <div className="diagnostics-grid">
        <article className="tool-panel">
          <h3>Local server</h3>
          {healthState.loading && <div className="status">Checking...</div>}
          {healthState.error && (
            <div className="status error">{healthState.error}</div>
          )}
          {healthState.data && <div className="status">OK</div>}
          <p className="helper">Ensure `npm run server` is running.</p>
        </article>

        <article className="tool-panel">
          <h3>Auth state</h3>
          <div className="status">
            {user ? `Signed in as ${user.name}` : 'Not signed in'}
          </div>
        </article>

        <article className="tool-panel">
          <h3>Bible API</h3>
          {apiState.loading && <div className="status">Loading...</div>}
          {apiState.error && <div className="status error">{apiState.error}</div>}
          {apiState.data && (
            <div className="status">
              Loaded {apiState.data.book.commonName} {apiState.data.chapter.number}
            </div>
          )}
        </article>

        <article className="tool-panel">
          <h3>Audio</h3>
          {apiState.data?.thisChapterAudioLinks ? (
            <div className="audio-panel">
              <audio controls src={Object.values(apiState.data.thisChapterAudioLinks)[0]} />
            </div>
          ) : (
            <div className="status muted">No audio links found.</div>
          )}
        </article>
      </div>
    </section>
  )
}

function ToolsRoute() {
  const navigate = useNavigate()
  
  const tools = [
    {
      id: 'compare',
      title: 'Compare Translations',
      description: 'View multiple Bible translations side-by-side to analyze differences and gain deeper understanding.',
      to: '/tools/compare',
    },
    {
      id: 'word-study',
      title: 'Word Study',
      description: 'Analyze word frequency and search for specific words or phrases within chapters.',
      to: '/tools/word-study',
    },
    {
      id: 'commentary',
      title: 'Commentary',
      description: 'Read detailed study notes and commentary from various scholars and theologians.',
      to: '/tools/commentary',
    },
    {
      id: 'cross-references',
      title: 'Cross References',
      description: 'Discover related passages and connections throughout Scripture using datasets.',
      to: '/tools/cross-references',
    },
    {
      id: 'notes',
      title: 'Notes and Highlights',
      description: 'Capture insights, manage highlights, and track reading plans with local sync.',
      to: '/notes?tab=notes',
    },
  ]

  return (
    <section className="tools">
      <header>
        <div>
          <p className="kicker">Tools</p>
          <h2>API powered study tools</h2>
          <p className="subtitle">
            Compare translations, explore commentaries, and follow cross references.
          </p>
        </div>
      </header>

      <div className="tools-overview">
        {tools.map((tool) => (
          <article
            key={tool.id}
            className="tool-overview-card"
            onClick={() => navigate(tool.to)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                navigate(tool.to)
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open ${tool.title}`}
          >
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <button
              className="primary small"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                navigate(tool.to)
              }}
            >
              Open {tool.title}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function CompareToolRoute() {
  const translationsState = useAsyncData(getAvailableTranslations, [])
  const orderedTranslations = useMemo(
    () => prioritizeTranslations(translationsState.data?.translations ?? []),
    [translationsState.data],
  )
  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION)
  const [compareTranslationId, setCompareTranslationId] = useState('ESV')
  const [bookId, setBookId] = useState(DEFAULT_BOOK)
  const [chapterNumber, setChapterNumber] = useState(1)

  const booksState = useAsyncData(
    () => getBooksForTranslation(translationId),
    [translationId],
  )
  const chapterState = useAsyncData(
    () => getChapter(translationId, bookId, chapterNumber),
    [translationId, bookId, chapterNumber],
  )
  const compareState = useAsyncData(
    () => getChapter(compareTranslationId, bookId, chapterNumber),
    [compareTranslationId, bookId, chapterNumber],
  )

  const bookOptions = booksState.data?.books ?? []

  useEffect(() => {
    if (orderedTranslations.length === 0) return
    if (!orderedTranslations.find((t) => t.id === translationId)) {
      setTranslationId(orderedTranslations[0].id)
    }
  }, [orderedTranslations, translationId])

  useEffect(() => {
    if (orderedTranslations.length === 0) return
    if (!orderedTranslations.find((t) => t.id === compareTranslationId)) {
      const fallback =
        orderedTranslations.find((t) => t.id !== translationId) ?? orderedTranslations[0]
      setCompareTranslationId(fallback.id)
    }
  }, [orderedTranslations, compareTranslationId, translationId])

  useEffect(() => {
    if (bookOptions.length > 0 && !bookOptions.find((b) => b.id === bookId)) {
      setBookId(bookOptions[0].id)
      setChapterNumber(bookOptions[0].firstChapterNumber)
    }
  }, [bookOptions, bookId])

  useEffect(() => {
    const max = bookOptions.find((b) => b.id === bookId)?.numberOfChapters ?? 1
    if (chapterNumber > max) setChapterNumber(max)
  }, [bookOptions, bookId, chapterNumber])

  return (
    <section className="tools">
      <header>
        <div>
          <p className="kicker">Compare Translations</p>
          <h2>Side-by-side Bible comparison</h2>
          <p className="subtitle">
            View multiple Bible translations simultaneously to analyze differences.
          </p>
        </div>
      </header>

      <article className="tool-panel-full">
        <h3>Compare translations</h3>
        <div className="selector-row">
          <Selector
            label="Primary"
            value={translationId}
            onChange={setTranslationId}
            options={
              orderedTranslations.map((t) => ({
                value: t.id,
                label: t.shortName,
              })) ?? []
            }
            loading={translationsState.loading}
          />
          <Selector
            label="Compare"
            value={compareTranslationId}
            onChange={setCompareTranslationId}
            options={
              orderedTranslations.map((t) => ({
                value: t.id,
                label: t.shortName,
              })) ?? []
            }
            loading={translationsState.loading}
          />
        </div>
        <div className="selector-row">
          <Selector
            label="Book"
            value={bookId}
            onChange={setBookId}
            options={bookOptions.map((b) => ({
              value: b.id,
              label: b.commonName,
            }))}
            loading={booksState.loading}
          />
          <Selector
            label="Chapter"
            value={chapterNumber.toString()}
            onChange={(value) => setChapterNumber(Number(value))}
            options={Array.from(
              { length: bookOptions.find((b) => b.id === bookId)?.numberOfChapters ?? 1 },
              (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }),
            )}
            loading={booksState.loading}
          />
        </div>
        <StatusBlock
          loading={chapterState.loading || compareState.loading}
          error={chapterState.error || compareState.error}
          emptyMessage="Select a passage to compare."
        />
        {chapterState.data && compareState.data && (
          <div className="compare-grid">
            <CompareColumn chapter={chapterState.data} />
            <CompareColumn chapter={compareState.data} />
          </div>
        )}
      </article>
    </section>
  )
}

function WordStudyRoute() {
  const translationsState = useAsyncData(getAvailableTranslations, [])
  const orderedTranslations = useMemo(
    () => prioritizeTranslations(translationsState.data?.translations ?? []),
    [translationsState.data],
  )
  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION)
  const [bookId, setBookId] = useState(DEFAULT_BOOK)
  const [chapterNumber, setChapterNumber] = useState(1)
  const [studyWord, setStudyWord] = useState('')

  const booksState = useAsyncData(
    () => getBooksForTranslation(translationId),
    [translationId],
  )
  const chapterState = useAsyncData(
    () => getChapter(translationId, bookId, chapterNumber),
    [translationId, bookId, chapterNumber],
  )

  const wordStudy = useMemo(() => {
    if (!chapterState.data) {
      return { tokens: [] as Array<{ word: string; count: number }>, matches: [] as number[] }
    }
    const verses = chapterState.data.chapter.content
      .filter(isVerse)
      .map((verse) => ({
        number: verse.number,
        text: flattenVerseContent(verse.content),
      }))

    const text = verses.map((v) => v.text).join(' ')
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t))

    const counts = new Map<string, number>()
    tokens.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1))

    const topTokens = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word, count]) => ({ word, count }))

    const matches = studyWord
      ? verses
          .filter((v) => v.text.toLowerCase().includes(studyWord.toLowerCase()))
          .map((v) => v.number)
      : []

    return { tokens: topTokens, matches }
  }, [chapterState.data, studyWord])

  const bookOptions = booksState.data?.books ?? []

  useEffect(() => {
    if (orderedTranslations.length === 0) return
    if (!orderedTranslations.find((t) => t.id === translationId)) {
      setTranslationId(orderedTranslations[0].id)
    }
  }, [orderedTranslations, translationId])

  useEffect(() => {
    if (bookOptions.length > 0 && !bookOptions.find((b) => b.id === bookId)) {
      setBookId(bookOptions[0].id)
      setChapterNumber(bookOptions[0].firstChapterNumber)
    }
  }, [bookOptions, bookId])

  useEffect(() => {
    const max = bookOptions.find((b) => b.id === bookId)?.numberOfChapters ?? 1
    if (chapterNumber > max) setChapterNumber(max)
  }, [bookOptions, bookId, chapterNumber])

  return (
    <section className="tools">
      <header>
        <div>
          <p className="kicker">Word Study</p>
          <h2>Analyze word frequency</h2>
          <p className="subtitle">
            Local word frequency analysis and verse matching for the current chapter.
          </p>
        </div>
      </header>

      <article className="tool-panel-full">
        <h3>Word study</h3>
        <p className="helper">
          Analyze the most common words in a chapter and search for specific terms.
        </p>
        <div className="selector-row">
          <Selector
            label="Translation"
            value={translationId}
            onChange={setTranslationId}
            options={
              orderedTranslations.map((t) => ({
                value: t.id,
                label: t.shortName,
              })) ?? []
            }
            loading={translationsState.loading}
          />
          <Selector
            label="Book"
            value={bookId}
            onChange={setBookId}
            options={bookOptions.map((b) => ({
              value: b.id,
              label: b.commonName,
            }))}
            loading={booksState.loading}
          />
          <Selector
            label="Chapter"
            value={chapterNumber.toString()}
            onChange={(value) => setChapterNumber(Number(value))}
            options={Array.from(
              { length: bookOptions.find((b) => b.id === bookId)?.numberOfChapters ?? 1 },
              (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }),
            )}
            loading={booksState.loading}
          />
        </div>
        <label className="search-inline">
          <span>Word or phrase</span>
          <input
            value={studyWord}
            onChange={(e) => setStudyWord(e.target.value)}
            placeholder="Search within this chapter"
          />
        </label>
        <StatusBlock
          loading={chapterState.loading}
          error={chapterState.error}
          emptyMessage="Load a chapter to analyze word frequency."
        />
        {chapterState.data && (
          <div className="word-study">
            <div>
              <h4>Top words</h4>
              <div className="chips">
                {wordStudy.tokens.map((token) => (
                  <button
                    key={token.word}
                    className="chip"
                    onClick={() => setStudyWord(token.word)}
                  >
                    {token.word} · {token.count}
                  </button>
                ))}
              </div>
            </div>
            {studyWord.trim() && (
              <div>
                <h4>Matches</h4>
                {wordStudy.matches.length === 0 ? (
                  <p>No verses matched.</p>
                ) : (
                  <p>Verses: {wordStudy.matches.join(', ')}</p>
                )}
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  )
}

function CommentaryRoute() {
  const commentariesState = useAsyncData(getAvailableCommentaries, [])
  const [commentaryId, setCommentaryId] = useState('adam-clarke')
  const [commentaryBookId, setCommentaryBookId] = useState(DEFAULT_BOOK)
  const [commentaryChapter, setCommentaryChapter] = useState(1)

  const commentaryBooksState = useAsyncData(
    () => getCommentaryBooks(commentaryId),
    [commentaryId],
  )
  const commentaryChapterState = useAsyncData(
    () => getCommentaryChapter(commentaryId, commentaryBookId, commentaryChapter),
    [commentaryId, commentaryBookId, commentaryChapter],
  )

  useEffect(() => {
    const commentaries = commentariesState.data?.commentaries ?? []
    if (commentaries.length === 0) return
    if (!commentaries.find((c) => c.id === commentaryId)) {
      setCommentaryId(commentaries[0].id)
    }
  }, [commentariesState.data, commentaryId])

  useEffect(() => {
    const books = commentaryBooksState.data?.books ?? []
    if (books.length > 0 && !books.find((b) => b.id === commentaryBookId)) {
      setCommentaryBookId(books[0].id)
      setCommentaryChapter(books[0].firstChapterNumber ?? 1)
    }
  }, [commentaryBooksState.data, commentaryBookId])

  return (
    <section className="tools">
      <header>
        <div>
          <p className="kicker">Commentary</p>
          <h2>Study notes and insights</h2>
          <p className="subtitle">
            Read detailed commentary from various scholars and theologians.
          </p>
        </div>
      </header>

      <article className="tool-panel-full">
        <h3>Commentary</h3>
        <div className="selector-row">
          <Selector
            label="Commentary"
            value={commentaryId}
            onChange={setCommentaryId}
            options={
              commentariesState.data?.commentaries.map((c) => ({
                value: c.id,
                label: c.englishName,
              })) ?? []
            }
            loading={commentariesState.loading}
          />
          <Selector
            label="Book"
            value={commentaryBookId}
            onChange={setCommentaryBookId}
            options={
              commentaryBooksState.data?.books.map((b) => ({
                value: b.id,
                label: b.commonName,
              })) ?? []
            }
            loading={commentaryBooksState.loading}
          />
          <Selector
            label="Chapter"
            value={commentaryChapter.toString()}
            onChange={(value) => setCommentaryChapter(Number(value))}
            options={Array.from(
              {
                length:
                  commentaryBooksState.data?.books.find((b) => b.id === commentaryBookId)
                    ?.numberOfChapters ?? 1,
              },
              (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }),
            )}
            loading={commentaryBooksState.loading}
          />
        </div>
        <StatusBlock
          loading={commentaryChapterState.loading}
          error={commentaryChapterState.error}
          emptyMessage="Select a commentary chapter."
        />
        {commentaryChapterState.data && (
          <div className="commentary-content">
            {commentaryChapterState.data.chapter.introduction && (
              <p className="intro">
                {commentaryChapterState.data.chapter.introduction}
              </p>
            )}
            {commentaryChapterState.data.chapter.content.map((verse, i) => (
              <div className="verse" key={`${verse.number}-${i}`}>
                <strong>{verse.number}</strong>
                <p>{flattenVerseContent(verse.content)}</p>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}

function CrossReferencesRoute() {
  const datasetsState = useAsyncData(getAvailableDatasets, [])
  const [datasetId, setDatasetId] = useState('open-cross-ref')
  const [datasetBookId, setDatasetBookId] = useState(DEFAULT_BOOK)
  const [datasetChapter, setDatasetChapter] = useState(1)

  const datasetBooksState = useAsyncData(
    () => getDatasetBooks(datasetId),
    [datasetId],
  )
  const datasetChapterState = useAsyncData(
    () => getDatasetChapter(datasetId, datasetBookId, datasetChapter),
    [datasetId, datasetBookId, datasetChapter],
  )

  useEffect(() => {
    const datasets = datasetsState.data?.datasets ?? []
    if (datasets.length === 0) return
    if (!datasets.find((d) => d.id === datasetId)) {
      setDatasetId(datasets[0].id)
    }
  }, [datasetsState.data, datasetId])

  useEffect(() => {
    const books = datasetBooksState.data?.books ?? []
    if (books.length > 0 && !books.find((b) => b.id === datasetBookId)) {
      setDatasetBookId(books[0].id)
      setDatasetChapter(books[0].firstChapterNumber)
    }
  }, [datasetBooksState.data, datasetBookId])

  return (
    <section className="tools">
      <header>
        <div>
          <p className="kicker">Cross References</p>
          <h2>Discover related passages</h2>
          <p className="subtitle">
            Follow connections throughout Scripture using cross-reference datasets.
          </p>
        </div>
      </header>

      <article className="tool-panel-full">
        <h3>Cross references</h3>
        <div className="selector-row">
          <Selector
            label="Dataset"
            value={datasetId}
            onChange={setDatasetId}
            options={
              datasetsState.data?.datasets.map((d) => ({
                value: d.id,
                label: d.englishName,
              })) ?? []
            }
            loading={datasetsState.loading}
          />
          <Selector
            label="Book"
            value={datasetBookId}
            onChange={setDatasetBookId}
            options={
              datasetBooksState.data?.books.map((b) => ({
                value: b.id,
                label: b.id,
              })) ?? []
            }
            loading={datasetBooksState.loading}
          />
          <Selector
            label="Chapter"
            value={datasetChapter.toString()}
            onChange={(value) => setDatasetChapter(Number(value))}
            options={Array.from(
              {
                length:
                  datasetBooksState.data?.books.find((b) => b.id === datasetBookId)
                    ?.numberOfChapters ?? 1,
              },
              (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }),
            )}
            loading={datasetBooksState.loading}
          />
        </div>
        <StatusBlock
          loading={datasetChapterState.loading}
          error={datasetChapterState.error}
          emptyMessage="Select a dataset chapter."
        />
        {datasetChapterState.data && (
          <div className="reference-list">
            {datasetChapterState.data.chapter.content.map((verse) => (
              <div key={verse.verse} className="reference-row">
                <strong>Verse {verse.verse}</strong>
                <div className="chips">
                  {verse.references.slice(0, 6).map((ref, i) => (
                    <span key={`${ref.book}-${ref.chapter}-${i}`}>
                      {formatReference(ref)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}

function Selector({
  label,
  value,
  onChange,
  options,
  loading,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  loading?: boolean
}) {
  return (
    <label className="selector">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
      >
        {options.length === 0 && <option value="">Loading...</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function StatusBlock({
  loading,
  error,
  emptyMessage,
}: {
  loading: boolean
  error: string | null
  emptyMessage: string
}) {
  if (loading) {
    return <div className="status">Loading...</div>
  }

  if (error) {
    return <div className="status error">{error}</div>
  }

  return <div className="status muted">{emptyMessage}</div>
}

function CompareColumn({ chapter }: { chapter: TranslationBookChapter }) {
  return (
    <div className="compare-column">
      <h4>{chapter.translation.shortName}</h4>
      {chapter.chapter.content
        .filter(isVerse)
        .map((verse) => {
          return (
            <p key={verse.number}>
              <strong>{verse.number}</strong> {flattenVerseContent(verse.content)}
            </p>
          )
        })}
    </div>
  )
}

function renderChapterItem(
  item: ChapterContent,
  index: number,
  footnotes: Map<number, ChapterFootnote>,
  highlightVerse?: number | null,
  translationLabel?: string,
  bookLabel?: string,
  chapterNumber?: number,
) {
  if (item.type === 'heading') {
    return (
      <h3 className="heading" key={`heading-${index}`}>
        {item.content.join(' ')}
      </h3>
    )
  }

  if (item.type === 'line_break') {
    return <div className="line-break" key={`break-${index}`} />
  }

  if (item.type === 'hebrew_subtitle') {
    return (
      <p className="hebrew-subtitle" key={`subtitle-${index}`}>
        {renderInlineContent(item.content, footnotes)}
      </p>
    )
  }

  const isHighlighted = highlightVerse === item.number

  return (
    <div
      id={`verse-${item.number}`}
      className={`verse${isHighlighted ? ' highlight' : ''}`}
      data-translation={translationLabel ?? ''}
      data-book={bookLabel ?? ''}
      data-chapter={chapterNumber ?? ''}
      data-verse-number={item.number}
      key={`verse-${item.number}-${index}`}
    >
      <strong>{item.number}</strong>
      <p>{renderInlineContent(item.content, footnotes)}</p>
    </div>
  )
}

function renderInlineContent(
  content: Array<
    string | FormattedText | InlineHeading | InlineLineBreak | VerseFootnoteReference
  >,
  footnotes: Map<number, ChapterFootnote>,
) {
  const allNotes = Array.from(footnotes.values())
  return content.map((part, index) => {
    if (typeof part === 'string') {
      return <span key={`text-${index}`}>{part}</span>
    }

    if ('text' in part) {
      const style = part.poem ? { paddingLeft: `${part.poem * 16}px` } : undefined
      return (
        <span
          key={`formatted-${index}`}
          className={part.wordsOfJesus ? 'words-of-jesus' : undefined}
          style={style}
        >
          {part.text}
        </span>
      )
    }

    if ('heading' in part) {
      return (
        <strong key={`inline-heading-${index}`} className="inline-heading">
          {part.heading}
        </strong>
      )
    }

    if ('lineBreak' in part) {
      return <br key={`inline-break-${index}`} />
    }

    if ('noteId' in part) {
      const footnote = footnotes.get(part.noteId)
      const caller = footnote ? formatCaller(footnote, allNotes) : '*'
      const noteText = footnote?.text ?? 'Footnote unavailable.'
      return (
        <span
          key={`note-${index}`}
          className="footnote-ref"
          data-note={noteText}
          aria-label={noteText}
          tabIndex={0}
        >
          <sup>{caller}</sup>
        </span>
      )
    }

    return null
  })
}

function formatCaller(note: ChapterFootnote, all: ChapterFootnote[]) {
  if (note.caller && note.caller !== '+') {
    return note.caller
  }

  const index = all.findIndex((entry) => entry.noteId === note.noteId)
  return String(index + 1)
}

function flattenVerseContent(
  content: Array<
    string | FormattedText | InlineHeading | InlineLineBreak | VerseFootnoteReference
  >,
) {
  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part
      }
      if ('text' in part) {
        return part.text
      }
      if ('heading' in part) {
        return part.heading
      }
      if ('lineBreak' in part) {
        return ' '
      }
      return ''
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatReference(reference: DatasetReference) {
  const end = reference.endVerse ? `-${reference.endVerse}` : ''
  return `${reference.book} ${reference.chapter}:${reference.verse}${end}`
}


const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'with',
  'you',
  'your',
  'from',
  'was',
  'are',
  'his',
  'her',
  'their',
  'they',
  'have',
  'has',
  'had',
  'but',
  'not',
  'this',
  'who',
  'will',
  'into',
  'them',
])

function isVerse(
  item: ChapterContent,
): item is Extract<ChapterContent, { type: 'verse' }> {
  return item.type === 'verse'
}

export default App
