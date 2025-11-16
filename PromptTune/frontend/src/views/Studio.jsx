import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import {
  optimizePrompt,
  chat,
  listPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  createAnalytics,
} from '../api'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { useTheme } from '../context/ThemeContext'
import ProfileDefaultsModal from '../components/ProfileDefaultsModal'
import OnboardingModal from '../components/OnboardingModal'
import CtaButton from '../components/CtaButton'
import { THEME_TOKENS } from '../theme'

function Section({ title, description, children, className = '' }) {
  return (
    <section className={`section ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-70" aria-hidden="true" />
      <div className="relative p-6 lg:p-8 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
          {description && <p className="text-sm mt-1 text-secondary">{description}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}

export default function Studio() {
  const { user, logout } = useAuth()
  const { preferences, prefsLoading, savePreferences, shouldOnboard, dismissOnboarding } = usePreferences()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const router = useNavigate()
  const [rawPrompt, setRawPrompt] = useState('')
  const [goal, setGoal] = useState('')
  const [audience, setAudience] = useState('')
  const [style, setStyle] = useState('Concise, clear, verifiable')
  const [sessionId] = useState(() => Math.random().toString(36).slice(2))
  const [loading, setLoading] = useState(false)
  const [optResult, setOptResult] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([])
  const [showPreferences, setShowPreferences] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [savedPrompts, setSavedPrompts] = useState([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState(null)
  const [saveTitle, setSaveTitle] = useState('')
  const [saveTags, setSaveTags] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [activePromptId, setActivePromptId] = useState(null)
  const [ratingState, setRatingState] = useState({ submitting: false, lastRating: null, message: '' })

  const themeStyles = useMemo(() => THEME_TOKENS[theme], [theme])
  const activePersona = preferences?.active_persona

  const inputClass = [
    'input',
  ].join(' ')

  const parseTags = useCallback((value) => (
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  ), [])

  const refreshPromptLibrary = useCallback(async () => {
    setLibraryLoading(true)
    setLibraryError(null)
    try {
      const data = await listPrompts()
      setSavedPrompts(data)
    } catch (err) {
      setLibraryError(err?.response?.data?.detail || err.message)
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setSavedPrompts([])
      return
    }
    refreshPromptLibrary()
  }, [user, refreshPromptLibrary])

  useEffect(() => {
    if (!optResult) {
      setSaveTags('')
      return
    }
    setSaveTitle((prev) => (prev ? prev : goal || 'Untitled prompt'))
  }, [optResult, goal])

  async function onOptimize() {
    setLoading(true)
    try {
      const data = await optimizePrompt({
        raw_prompt: rawPrompt,
        goal,
        audience,
        style,
        session_id: sessionId,
        persona_id: preferences?.active_persona_id || undefined,
      })
      setOptResult(data)
    } catch (e) {
      alert(e?.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  async function onSend() {
    if (!chatInput.trim()) return
    const newMsgs = [...messages, { role: 'user', content: chatInput }]
    setMessages(newMsgs)
    setChatInput('')
    try {
      const data = await chat({
        session_id: sessionId,
        messages: newMsgs.slice(-4),
        system_prompt: optResult?.optimized_prompt || undefined,
        persona_id: preferences?.active_persona_id || undefined,
      })
      setMessages(data.messages)
    } catch (e) {
      alert(e?.response?.data?.detail || e.message)
    }
  }

  const handleSavePrompt = async () => {
    if (!optResult || savingPrompt) return
    setSavingPrompt(true)
    try {
      const payload = {
        title: saveTitle.trim() || `Prompt ${new Date().toLocaleString()}`,
        optimized_prompt: optResult.optimized_prompt,
        rationale: optResult.rationale,
        tags: parseTags(saveTags),
      }
      const saved = await createPrompt(payload)
      setActivePromptId(saved.id)
      setSaveTitle(saved.title)
      await refreshPromptLibrary()
    } catch (err) {
      alert(err?.response?.data?.detail || err.message)
    } finally {
      setSavingPrompt(false)
    }
  }

  const handleSelectPrompt = useCallback((prompt) => {
    setActivePromptId(prompt.id)
    setSaveTitle(prompt.title)
    setSaveTags(Array.isArray(prompt.tags) ? prompt.tags.join(', ') : '')
    setOptResult({
      optimized_prompt: prompt.optimized_prompt,
      rationale: prompt.rationale || '',
      checklist: [],
    })
  }, [])

  const handleDeletePrompt = async (prompt) => {
    const shouldDelete = window.confirm(`Delete "${prompt.title}"?`)
    if (!shouldDelete) return
    try {
      await deletePrompt(prompt.id)
      setSavedPrompts((prev) => prev.filter((item) => item.id !== prompt.id))
      if (activePromptId === prompt.id) {
        setActivePromptId(null)
      }
    } catch (err) {
      alert(err?.response?.data?.detail || err.message)
    }
  }

  const handleUpdatePrompt = async (promptId, payload) => {
    try {
      const updated = await updatePrompt(promptId, payload)
      setSavedPrompts((prev) => prev.map((item) => (item.id === promptId ? updated : item)))
      if (activePromptId === promptId) {
        setSaveTitle(updated.title)
        setSaveTags(Array.isArray(updated.tags) ? updated.tags.join(', ') : '')
      }
    } catch (err) {
      alert(err?.response?.data?.detail || err.message)
      throw err
    }
  }

  const handleRatePrompt = async (score) => {
    setRatingState({ submitting: true, lastRating: score, message: '' })
    try {
      await createAnalytics({
        rating: score,
        prompt_id: activePromptId,
        metrics: {
          session_id: sessionId,
          message_count: messages.length,
          used_optimized_prompt: Boolean(optResult?.optimized_prompt),
        },
      })
      setRatingState({ submitting: false, lastRating: score, message: 'Feedback captured' })
    } catch (err) {
      setRatingState({ submitting: false, lastRating: score, message: 'Failed to send' })
      alert(err?.response?.data?.detail || err.message)
    }
  }

  useEffect(() => {
    const loadId = location.state?.promptId
    if (!loadId) return
    const target = savedPrompts.find((item) => item.id === loadId)
    if (target) {
      handleSelectPrompt(target)
      router(location.pathname, { replace: true })
    }
  }, [location, savedPrompts, handleSelectPrompt, router])

  const sendButtonClass = 'cta-button'
  const ratingButtonClass = 'rating-button'

  useEffect(() => {
    if (!preferences) return
    if (preferences.default_goal && !goal) setGoal(preferences.default_goal)
    if (preferences.default_audience && !audience) setAudience(preferences.default_audience)
    if (preferences.default_style) {
      setStyle((prev) => (prev === 'Concise, clear, verifiable' || !prev ? preferences.default_style : prev))
    }
  }, [preferences, goal, audience])

  useEffect(() => {
    setOnboardingOpen(shouldOnboard)
  }, [shouldOnboard])

  const handleSavePreferences = async (values, closeAfter = true) => {
    setSavingPrefs(true)
    try {
      await savePreferences(values)
      if (closeAfter) {
        setShowPreferences(false)
      }
      setOnboardingOpen(false)
      dismissOnboarding()
    } catch (err) {
      alert(err?.response?.data?.detail || err.message)
    } finally {
      setSavingPrefs(false)
    }
  }

  const hasDefaults = Boolean(
    preferences && (preferences.default_goal || preferences.default_audience || preferences.default_style)
  )


  return (
    <div className="page-container text-primary">
      <div className="relative isolate overflow-hidden px-4 py-8 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="blob-one absolute -top-24 right-10 h-72 w-72 rounded-full blur-[120px]" />
          <div className="blob-two absolute -bottom-32 left-0 h-80 w-80 rounded-full blur-[140px]" />
        </div>

        <main className="relative z-10 mx-auto max-w-8xl space-y-8">
                      <header className="card flex flex-col gap-6 p-6">
            <nav className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide">
                                <Link to="/library" className="badge-button">
                                  Prompt Library
                                </Link>
                                <Link to="/personas" className="badge-button">
                                  Personas
                                </Link>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <button
                  onClick={toggleTheme}
                  className="toggle-button"
                >
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreferences(true)}
                  className="toggle-button"
                >
                  Profile Defaults
                </button>
                <div className={`rounded-full border px-4 py-2 ${themeStyles.badgeBorder} ${themeStyles.badgeText}`}>
                  {user?.email}
                </div>
                <button
                  onClick={logout}
                  className="toggle-button"
                >
                  Logout
                </button>
              </div>
            </nav>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">Prompt intelligence studio</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight md-text-5xl text-primary">
                PromptTune <span className="text-accent">Studio</span>
              </h1>
              <p className={`mt-2 max-w-2xl text-base ${themeStyles.secondaryText}`}>
                Craft verifiable prompts and run chat simulations from the same surface.
              </p>
            </div>
          </header>

          <div className="stage-pair">
            <Section
              title="Stage I"
              description="Define the raw idea, intent, tone, and constraints you want to optimize."
              themeStyles={themeStyles}
            >
              <div className="space-y-5">
                <textarea
                  value={rawPrompt}
                  onChange={(e) => setRawPrompt(e.target.value)}
                  placeholder="Paste your raw prompt or jot a rough draft..."
                  className={`${inputClass} min-h-[160px] resize-none`}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className={inputClass} />
                  <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Audience / Tone" className={inputClass} />
                  <input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Style" className={inputClass} />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <CtaButton
                    onClick={onOptimize}
                    disabled={loading || !rawPrompt.trim()}
                    loading={loading}
                    loadingLabel="Optimizing…"
                    className="cta-button"
                  >
                    Optimize Prompt
                  </CtaButton>
                </div>
                <div className="panel p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Active persona</p>
                    {activePersona ? (
                      <>
                        <h4 className="text-base font-semibold text-primary">{activePersona.name}</h4>
                        {activePersona.description ? (
                          <p className="text-sm text-secondary">{activePersona.description}</p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-secondary">No persona selected. Defaults will run as generalist.</p>
                    )}
                  </div>
                  <Link to="/personas" className="badge-button text-center">
                    Manage Personas
                  </Link>
                </div>
              </div>
            </Section>

            <Section title="Stage II" description="Review the optimized prompt, rationale, and QA checklist." themeStyles={themeStyles}>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                <div className="space-y-6">
                  {!optResult ? (
                    <div className="empty-state">
                      Run an optimization to preview the upgraded prompt, reasoning, and guardrails.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm uppercase tracking-wide text-muted font-bold">Optimized prompt</h3>
                        <pre className="code-block mt-2 max-h-64 overflow-auto">
                          {optResult.optimized_prompt}
                        </pre>
                      </div>
                      {optResult.rationale && (
                        <div>
                          <h3 className="text-sm uppercase tracking-wide text-muted font-bold">Rationale</h3>
                          <p className="mt-2 text-sm whitespace-pre-wrap text-secondary">{optResult.rationale}</p>
                        </div>
                      )}
                      {optResult.checklist?.length ? (
                        <div>
                                                    <h3 className="text-sm uppercase tracking-wide text-muted font-bold">Checklist</h3>
                          <ul className="mt-3 space-y-2 text-sm">
                            {optResult.checklist.map((c, i) => (
                              <li key={i} className="flex items-start gap-3 text-secondary">
                                <span className="checklist-dot mt-1 inline-flex h-2.5 w-2.5 rounded-full" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                                  <div className="panel p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Save optimized prompt</p>
                      <p className="text-sm text-secondary">Add titles and tags before archiving.</p>
                    </div>
                    {activePromptId && (
                                              <span className="text-xs uppercase tracking-wide text-muted">
                        Linked
                      </span>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
                    <input
                      value={saveTitle}
                      onChange={(e) => setSaveTitle(e.target.value)}
                      placeholder="Prompt title"
                      className={inputClass}
                      disabled={!optResult}
                    />
                    <input
                      value={saveTags}
                      onChange={(e) => setSaveTags(e.target.value)}
                      placeholder="Tags (comma separated)"
                      className={inputClass}
                      disabled={!optResult}
                    />
                      <CtaButton
                        type="button"
                        onClick={handleSavePrompt}
                        disabled={!optResult || savingPrompt}
                        loading={savingPrompt}
                        loadingLabel="Saving…"
                        className="cta-button"
                      >
                        Save to Library
                      </CtaButton>
                    {!optResult && (
                      <p className="text-xs text-info">
                        {/* Run Stage I and II to enable saving. */}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Section>

          </div>
          <Section
            title="Stage III"
            description="Stress-test the prompt with live chat. Memory stays scoped to this session."
            themeStyles={themeStyles}
          >
              <div className="flex flex-col gap-4">
                <div className="panel min-h-[360px] space-y-3 overflow-auto p-4">
                  {!messages.length && <p className="text-sm text-info">Send a message to kick off the test conversation.</p>}
                  {messages.map((m, i) => {
                    const isUser = m.role === 'user'
                    const bubbleClass = isUser ? 'user-bubble' : 'assistant-bubble'
                    return (
                      <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`markdown-body max-w-xl rounded-2xl px-4 py-3 text-sm ${bubbleClass}`}>
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSend()}
                    placeholder="Ask something…"
                    className={`${inputClass} flex-1`}
                  />
                  <button onClick={onSend} className={sendButtonClass}>
                    Send
                  </button>
                </div>
                <p className="text-xs text-info">Optimized prompt is auto-used as the system message when available.</p>
                <div className="panel p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`text-sm font-semibold ${themeStyles.primaryText}`}>Rate this simulation</p>
                      {ratingState.message && <span className="text-xs text-info">{ratingState.message}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          className={`${ratingButtonClass} ${ratingState.lastRating === score ? 'ring-2 ring-offset-2 ring-sky-400' : ''}`}
                          onClick={() => handleRatePrompt(score)}
                          disabled={ratingState.submitting}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                    {!activePromptId && (
                      <p className="text-xs text-info">
                        Save a prompt to attach analytics metadata to each rating.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Section>
          {/* Template Library removed from Studio — use the dedicated Prompt Library route instead */}
        </main>
      </div>
      <ProfileDefaultsModal
        open={showPreferences}
        onClose={() => setShowPreferences(false)}
        onSubmit={(values) => handleSavePreferences(values)}
        initialValues={preferences}
        loading={savingPrefs}
      />
      <OnboardingModal
        open={onboardingOpen}
        onComplete={(values) => handleSavePreferences(values)}
        onSkip={() => {
          setOnboardingOpen(false)
          dismissOnboarding()
        }}
        loading={savingPrefs || prefsLoading}
      />
    </div>
  )
}
