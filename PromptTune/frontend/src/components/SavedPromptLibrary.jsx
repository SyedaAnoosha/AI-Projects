import React, { useMemo, useState } from 'react'

function formatTimestamp(value) {
  if (!value) return 'Unknown'
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Unknown'
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (err) {
    return 'Unknown'
  }
}

export default function SavedPromptLibrary({
  prompts,
  loading,
  error,
  onRefresh,
  onSelect,
  onDelete,
  onUpdate,
  activePromptId,
  headerContent,
}) {
  const [editingId, setEditingId] = useState(null)
  const [formValues, setFormValues] = useState({ title: '', tags: '' })
  const [updating, setUpdating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTag, setActiveTag] = useState('')

  const sortedPrompts = useMemo(() => {
    if (!Array.isArray(prompts)) return []
    return [...prompts].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  }, [prompts])

  const availableTags = useMemo(() => {
    const tagSet = new Set()
    sortedPrompts.forEach((prompt) => {
      if (Array.isArray(prompt.tags)) {
        prompt.tags.forEach((tag) => tagSet.add(tag))
      }
    })
    return Array.from(tagSet).sort()
  }, [sortedPrompts])

  const filteredPrompts = useMemo(() => {
    const needle = searchTerm.toLowerCase()
    return sortedPrompts.filter((prompt) => {
      const matchesSearch = needle
        ? `${prompt.title} ${prompt.optimized_prompt}`.toLowerCase().includes(needle)
        : true
      const matchesTag = activeTag ? prompt.tags?.includes(activeTag) : true
      return matchesSearch && matchesTag
    })
  }, [sortedPrompts, searchTerm, activeTag])

  const beginEdit = (prompt) => {
    setEditingId(prompt.id)
    setFormValues({
      title: prompt.title,
      tags: Array.isArray(prompt.tags) ? prompt.tags.join(', ') : '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormValues({ title: '', tags: '' })
  }

  const commitEdit = async () => {
    if (!editingId) return
    setUpdating(true)
    try {
      const payload = {
        title: formValues.title.trim() || 'Untitled prompt',
        tags: formValues.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      }
      await onUpdate(editingId, payload)
      cancelEdit()
    } finally {
      setUpdating(false)
    }
  }

  const inputClass = 'input'

  return (
    <div className="panel p-5 xl:p-6">
      <div className="mb-4">
        {headerContent ?? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-info">Prompt Library</p>
              <h3 className="text-lg font-semibold text-primary">Templates & Saved Runs</h3>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="badge-button disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-3 text-xs text-error">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search saved prompts"
          className="input"
        />
        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
          <button type="button" className={`badge-button ${!activeTag ? 'active-step' : ''}`} onClick={() => setActiveTag('')}>
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
      </div>
      <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-2 text-secondary">
        {loading && (
          <div className="animate-pulse space-y-3">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="skeleton-pulse h-4 w-1/2 rounded" />
                <div className="skeleton-pulse mt-2 h-3 w-2/3 rounded" />
              </div>
            ))}
          </div>
        )}
        {!loading && sortedPrompts.length === 0 && (
          <div className="empty-state">Save your optimized prompts to build a reusable template library.</div>
        )}
        {filteredPrompts.map((prompt) => {
          const isEditing = editingId === prompt.id
          const isActive = activePromptId === prompt.id
          return (
            <div
              key={prompt.id}
              className={`panel p-4 transition ${isActive ? 'active-prompt' : ''}`}
            >
              {isEditing ? (
                <div className="space-y-3">
                  <input value={formValues.title} onChange={(e)=>setFormValues(p=>({...p,title:e.target.value}))} className={inputClass} placeholder="Title" />
                  <input value={formValues.tags} onChange={(e)=>setFormValues(p=>({...p,tags:e.target.value}))} className={inputClass} placeholder="tags (comma separated)" />
                  <div className="flex gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
                    <button type="button" onClick={commitEdit} disabled={updating} className="badge-button">Save</button>
                    <button type="button" onClick={cancelEdit} className="badge-button">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-primary">{prompt.title}</p>
                      <p className="text-xs uppercase tracking-wide text-info">
                        Updated {formatTimestamp(prompt.updated_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 text-[10px] font-semibold uppercase tracking-[0.3em]">
                      <button type="button" onClick={()=>onSelect(prompt)} className="badge-button">Load</button>
                      <button type="button" onClick={()=>beginEdit(prompt)} className="badge-button">Edit</button>
                      <button type="button" onClick={()=>onDelete(prompt)} className="badge-button text-error">Delete</button>
                    </div>
                  </div>
                  {prompt.tags?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-wide">
                      {prompt.tags.map((tag)=>(<span key={tag} className="badge-button">{tag}</span>))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )
        })}
        {!loading && sortedPrompts.length > 0 && filteredPrompts.length === 0 && (
          <div className="empty-state">No prompts match that search/filter.</div>
        )}
      </div>
    </div>
  )
}
