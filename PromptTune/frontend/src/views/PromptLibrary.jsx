import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listPrompts, deletePrompt, updatePrompt } from '../api'
import CtaButton from '../components/CtaButton'

export default function PromptLibrary() {
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activePromptId, setActivePromptId] = useState(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editTags, setEditTags] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listPrompts()
      setPrompts(data)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const parseTags = useCallback(
    (value) =>
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    []
  )

  const inputClass = 'input'

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleSelectForPreview = useCallback((promptId) => {
    setActivePromptId(promptId)
    setCopyStatus('')
  }, [])

  const handleSendToStudio = useCallback(
    (promptId) => {
      navigate('/studio', { state: { promptId } })
    },
    [navigate]
  )

  const handleDelete = async (prompt) => {
    const confirmed = window.confirm(`Delete "${prompt.title}"?`)
    if (!confirmed) return
    try {
      await deletePrompt(prompt.id)
      setPrompts((prev) => prev.filter((p) => p.id !== prompt.id))
      if (activePromptId === prompt.id) {
        setActivePromptId(null)
      }
    } catch (err) {
      alert(err?.response?.data?.detail || err.message)
    }
  }

  const availableTags = useMemo(() => {
    const tags = new Set()
    prompts.forEach((prompt) => {
      if (Array.isArray(prompt.tags)) {
        prompt.tags.forEach((tag) => tags.add(tag))
      }
    })
    return Array.from(tags).sort()
  }, [prompts])

  const filteredPrompts = useMemo(() => {
    const needle = searchTerm.toLowerCase()
    return prompts.filter((prompt) => {
      const matchesSearch = needle
        ? `${prompt.title} ${prompt.optimized_prompt}`.toLowerCase().includes(needle)
        : true
      const matchesTag = activeTag ? prompt.tags?.includes(activeTag) : true
      return matchesSearch && matchesTag
    })
  }, [prompts, searchTerm, activeTag])

  const selectedPrompt =
    filteredPrompts.find((p) => p.id === activePromptId) ||
    filteredPrompts[0] ||
    prompts.find((p) => p.id === activePromptId) ||
    prompts[0] ||
    null

  useEffect(() => {
    const source = filteredPrompts.length ? filteredPrompts : prompts
    if (!activePromptId && source.length) {
      setActivePromptId(source[0].id)
    }
  }, [prompts, filteredPrompts, activePromptId])

  useEffect(() => {
    if (!activePromptId) return
    const el = document.getElementById(`prompt-${activePromptId}`)
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activePromptId])

  useEffect(() => {
    if (!selectedPrompt) {
      setEditTitle('')
      setEditTags('')
      return
    }
    setEditTitle(selectedPrompt.title)
    setEditTags(
      Array.isArray(selectedPrompt.tags) ? selectedPrompt.tags.join(', ') : ''
    )
  }, [selectedPrompt])

  const handleCopy = useCallback(async () => {
    if (!selectedPrompt) return
    const promptText = selectedPrompt.optimized_prompt || ''
    if (!promptText) {
      setCopyStatus('Nothing to copy')
      setTimeout(() => setCopyStatus(''), 2000)
      return
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = promptText
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopyStatus('Copied!')
    } catch (err) {
      console.error('Failed to copy prompt', err)
      setCopyStatus('Copy failed')
    } finally {
      setTimeout(() => setCopyStatus(''), 2000)
    }
  }, [selectedPrompt])

  const handleSaveMetadata = useCallback(async () => {
    if (!selectedPrompt) return
    const trimmedTitle = editTitle.trim()
    if (!trimmedTitle) {
      alert('Title cannot be empty.')
      return
    }

    setSavingMeta(true)
    try {
      const payload = {
        title: trimmedTitle,
        tags: parseTags(editTags),
      }
      const updated = await updatePrompt(selectedPrompt.id, payload)
      setPrompts((prev) =>
        prev.map((prompt) =>
          prompt.id === selectedPrompt.id ? updated : prompt
        )
      )
    } catch (err) {
      alert(err?.response?.data?.detail || err.message)
    } finally {
      setSavingMeta(false)
    }
  }, [selectedPrompt, editTitle, editTags, parseTags])

  return (
    <div className="page-container text-primary px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {/* Header */}
        <nav className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted">
              PromptTune
            </p>
            <h1 className="text-2xl font-semibold text-primary">
              Prompt Library
            </h1>
            <p className="text-sm text-secondary">
              Explore optimized prompts, copy them, or send back to the studio.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <Link to="/studio" className="badge-button">
              Back to Studio
            </Link>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="badge-button disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </nav>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {/* ---------- MAIN LAYOUT ---------- */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] library-grid">
          {/* ---------- LEFT: TEMPLATES ---------- */}
          <div className="space-y-4">
            <div className="card templates-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-primary">
                  Your Templates
                </h2>
                <p className="text-xs text-info">{prompts.length} saved</p>
              </div>

              {/* Search */}
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search prompts by title or content"
                className="input"
              />

              {/* Tags */}
              <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
                <button
                  type="button"
                  className={`badge-button ${!activeTag ? 'active-step' : ''}`}
                  onClick={() => setActiveTag('')}
                >
                  All Tags
                </button>
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`badge-button ${activeTag === tag ? 'active-step' : ''}`}
                    onClick={() => setActiveTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="templates-list space-y-4">
                {loading && (
                  <div className="space-y-4">
                    {[0, 1, 2].map((idx) => (
                      <div key={idx} className="card animate-pulse p-4">
                        <div className="skeleton-pulse h-4 w-1/2 rounded" />
                        <div className="skeleton-pulse mt-2 h-3 w-2/3 rounded" />
                      </div>
                    ))}
                  </div>
                )}

                {!loading && prompts.length === 0 && (
                  <div className="empty-state">
                    No prompts yet. Optimize a prompt and save it here.
                  </div>
                )}

                {filteredPrompts.map((prompt) => {
                  const isActive = selectedPrompt?.id === prompt.id
                  return (
                    <div
                      id={`prompt-${prompt.id}`}
                      key={prompt.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectForPreview(prompt.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleSelectForPreview(prompt.id)
                        }
                      }}
                      className={`card p-4 transition cursor-pointer ${isActive ? 'active-prompt' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-primary">
                            {prompt.title}
                          </p>
                          <p className="text-xs uppercase tracking-wide text-muted">
                            Updated{' '}
                            {new Date(prompt.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 text-[10px] font-semibold uppercase tracking-wide">
                          <button
                            type="button"
                            className="badge-button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSendToStudio(prompt.id)
                            }}
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            className="badge-button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(prompt)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {prompt.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-wide text-info">
                          {prompt.tags.map((tag) => (
                            <span key={tag} className="badge-button">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}

                {!loading &&
                  prompts.length > 0 &&
                  filteredPrompts.length === 0 && (
                    <div className="empty-state">
                      No prompts match that search/filter.
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* ---------- RIGHT: PREVIEW (sticky) ---------- */}
          <div className="card p-6 preview-sticky min-w-0">
            {selectedPrompt ? (
              <div className="space-y-4">
                {/* Header */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">
                    Preview
                  </p>
                  <h3 className="text-2xl font-semibold text-primary">
                    {selectedPrompt.title}
                  </h3>
                  <p className="text-sm text-secondary">
                    Updated{' '}
                    {new Date(selectedPrompt.updated_at).toLocaleString()}
                  </p>
                </div>

                {/* Edit fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Title
                    </label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={`${inputClass} mt-2`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Tags
                    </label>
                    <input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      className={`${inputClass} mt-2`}
                      placeholder="sales, onboarding, qa"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
                  <CtaButton
                    type="button"
                    onClick={handleSaveMetadata}
                    disabled={savingMeta}
                    loading={savingMeta}
                    loadingLabel="Saving…"
                    className="cta-button"
                  >
                    Save Changes
                  </CtaButton>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="pill-solid"
                  >
                    Copy Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendToStudio(selectedPrompt.id)}
                    className="pill-outline"
                  >
                    Load in Studio
                  </button>
                  {copyStatus && (
                    <span className="text-xs text-info">{copyStatus}</span>
                  )}
                </div>

                {/* Optimized Prompt */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Optimized Prompt
                  </h4>
                  <pre className="code-block max-h-[260px] overflow-auto">
                    {selectedPrompt.optimized_prompt}
                  </pre>
                </div>

                {/* Rationale */}
                {selectedPrompt.rationale && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
                      Rationale
                    </h4>
                    <p className="text-sm whitespace-pre-wrap text-secondary">
                      {selectedPrompt.rationale}
                    </p>
                  </div>
                )}

                {/* Tags display */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Tags
                  </h4>
                  {selectedPrompt.tags?.length ? (
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-info">
                      {selectedPrompt.tags.map((tag) => (
                        <span key={tag} className="badge-button">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-info">No tags provided.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-info">
                Select a prompt to view details.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}