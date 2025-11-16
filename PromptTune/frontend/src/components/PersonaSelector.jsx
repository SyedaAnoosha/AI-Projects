import React, { useEffect, useMemo, useState } from 'react'
import { usePreferences } from '../context/PreferencesContext'
import { usePersonas } from '../context/PersonaContext'
import CtaButton from './CtaButton'

const EMPTY_FORM = {
  name: '',
  description: '',
  instructions: '',
  tags: '',
}

function PersonaFormModal({ open, mode, formValues, onChange, onClose, onSubmit, submitting }) {
  if (!open) return null

  const title = mode === 'edit' ? 'Edit Persona' : 'Create Persona'

  return (
    <div className="modal-overlay">
      <div className="card w-full max-w-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">AI Agent Persona</p>
            <h3 className="text-2xl font-semibold text-primary">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="ghost-button">Close</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted">Name</label>
            <input
              value={formValues.name}
              onChange={(e) => onChange({ ...formValues, name: e.target.value })}
              className="input mt-2"
              placeholder="e.g. Product Manager"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted">Description</label>
            <input
              value={formValues.description}
              onChange={(e) => onChange({ ...formValues, description: e.target.value })}
              className="input mt-2"
              placeholder="One-line summary"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted">Instructions</label>
            <textarea
              value={formValues.instructions}
              onChange={(e) => onChange({ ...formValues, instructions: e.target.value })}
              className="input mt-2 min-h-[160px]"
              placeholder="Explain how this persona analyzes prompts and what constraints it enforces"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted">Tags</label>
            <input
              value={formValues.tags}
              onChange={(e) => onChange({ ...formValues, tags: e.target.value })}
              className="input mt-2"
              placeholder="strategy, qa, storytelling"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="ghost-button">Cancel</button>
          <CtaButton type="button" onClick={onSubmit} disabled={submitting} loading={submitting} loadingLabel="Saving…">
            Save Persona
          </CtaButton>
        </div>
      </div>
    </div>
  )
}

export default function PersonaSelector() {
  const { preferences, savePreferences, refreshPreferences } = usePreferences()
  const { personas, loading, addPersona, editPersona, removePersona, refreshPersonas } = usePersonas()
  const [selectedPersonaId, setSelectedPersonaId] = useState(preferences?.active_persona_id || null)
  const activePersonaId = selectedPersonaId
  // Only show active persona details if the id is still set; avoid stale cached object after deactivation.
  const activePersona = activePersonaId
    ? (preferences?.active_persona && preferences.active_persona.id === activePersonaId
        ? preferences.active_persona
        : personas.find((p) => p.id === activePersonaId) || null)
    : null

  const [search, setSearch] = useState('')
  const [activatingId, setActivatingId] = useState(null)
  const [modalState, setModalState] = useState({ open: false, mode: 'create', personaId: null })
  const [formValues, setFormValues] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setSelectedPersonaId(preferences?.active_persona_id || null)
  }, [preferences?.active_persona_id])

  const filteredPersonas = useMemo(() => {
    if (!search.trim()) return personas
    const needle = search.toLowerCase()
    return personas.filter((persona) => {
      const text = `${persona.name} ${persona.description || ''} ${(persona.tags || []).join(' ')}`.toLowerCase()
      return text.includes(needle)
    })
  }, [personas, search])

  const handleActivate = async (personaId) => {
    if (!personaId) return
    setActivatingId(personaId)
    try {
      await savePreferences({ active_persona_id: personaId })
      await refreshPreferences()
      setSelectedPersonaId(personaId)
    } catch (err) {
      alert(err?.response?.data?.detail || err.message)
    } finally {
      setActivatingId(null)
    }
  }

  const handleDeactivate = async () => {
    if (!activePersonaId) return
    setActivatingId('deactivate')
    try {
      await savePreferences({ active_persona_id: null })
      // Ensure fresh data from backend to avoid stale cached relationship
      await refreshPreferences()
      setSelectedPersonaId(null)
    } catch (err) {
      alert(err?.response?.data?.detail || err.message)
    } finally {
      setActivatingId(null)
    }
  }

  const openModal = (mode, persona = null) => {
    if (persona) {
      setFormValues({
        name: persona.name,
        description: persona.description || '',
        instructions: persona.instructions || '',
        tags: Array.isArray(persona.tags) ? persona.tags.join(', ') : '',
      })
    } else {
      setFormValues(EMPTY_FORM)
    }
    setModalState({ open: true, mode, personaId: persona?.id || null })
  }

  const closeModal = () => {
    setModalState({ open: false, mode: 'create', personaId: null })
    setFormValues(EMPTY_FORM)
  }

  const handleSubmitPersona = async () => {
    if (!formValues.name.trim() || !formValues.instructions.trim()) {
      alert('Name and instructions are required.')
      return
    }
    const payload = {
      name: formValues.name.trim(),
      description: formValues.description.trim() || null,
      instructions: formValues.instructions.trim(),
      tags: formValues.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    }
    setSubmitting(true)
    try {
      if (modalState.mode === 'edit' && modalState.personaId) {
        const updated = await editPersona(modalState.personaId, payload)
        if (activePersonaId === updated.id) {
          await savePreferences({ active_persona_id: updated.id })
          setSelectedPersonaId(updated.id)
        }
      } else {
        const created = await addPersona(payload)
        await savePreferences({ active_persona_id: created.id })
        setSelectedPersonaId(created.id)
      }
      closeModal()
    } catch (err) {
      alert(err?.response?.data?.detail || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDuplicate = (persona) => {
    openModal('create', {
      ...persona,
      name: `${persona.name} Copy`,
    })
  }

  const handleDelete = async (persona) => {
    const confirmed = window.confirm(`Delete persona "${persona.name}"?`)
    if (!confirmed) return
    try {
      await removePersona(persona.id)
      if (activePersonaId === persona.id) {
        await savePreferences({ active_persona_id: null })
        setSelectedPersonaId(null)
      }
    } catch (err) {
      alert(err?.response?.data?.detail || err.message)
    }
  }

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">AI Agent Presets</p>
          <h3 className="text-lg font-semibold text-primary">Choose a persona</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <button
            type="button"
            onClick={() => refreshPersonas(search || undefined)}
            className="badge-button persona-refresh"
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <CtaButton type="button" onClick={() => openModal('create')} className="persona-new text-sm">
            New Persona
          </CtaButton>
          {activePersonaId && (
            <button
              type="button"
              onClick={handleDeactivate}
              className="badge-button persona-deactivate"
              disabled={activatingId === 'deactivate'}
            >
              {activatingId === 'deactivate' ? 'Clearing…' : 'Deactivate'}
            </button>
          )}
        </div>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search personas"
        className="input"
      />
      {activePersona && (
        <div className="section p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted">Active persona</p>
          <h4 className="text-base font-semibold text-primary">{activePersona.name}</h4>
          {activePersona.description && (
            <p className="text-sm text-secondary">{activePersona.description}</p>
          )}
          <p className="text-xs uppercase tracking-wide text-muted">Instructions</p>
          <p className="text-sm whitespace-pre-wrap text-secondary">
            {activePersona.instructions}
          </p>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredPersonas.map((persona) => {
          const isActive = activePersonaId === persona.id
          return (
            <div key={persona.id} className={`panel p-4 space-y-3 border ${isActive ? 'ring-2 ring-accent' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-primary">{persona.name}</p>
                  {persona.description && (
                    <p className="text-sm text-secondary">{persona.description}</p>
                  )}
                </div>
                {persona.is_default && (
                  <span className="badge-button">Default</span>
                )}
              </div>
              <p className="text-xs text-secondary whitespace-pre-wrap max-h-24 overflow-auto">
                {persona.instructions}
              </p>
              {persona.tags?.length ? (
                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em] text-info">
                  {persona.tags.map((tag) => (
                    <span key={`${persona.id}-${tag}`} className="badge-button">{tag}</span>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
                {isActive ? (
                  <span className="badge-button">Active</span>
                ) : (
                  <button
                    type="button"
                    className="badge-button persona-activate"
                    onClick={() => handleActivate(persona.id)}
                    disabled={activatingId === persona.id}
                  >
                    {activatingId === persona.id ? 'Applying…' : 'Activate'}
                  </button>
                )}
                {persona.user_id ? (
                  <>
                    <button type="button" className="badge-button" onClick={() => openModal('edit', persona)}>Edit</button>
                    <button type="button" className="badge-button text-error" onClick={() => handleDelete(persona)}>Delete</button>
                  </>
                ) : (
                  <button type="button" className="badge-button persona-duplicate" onClick={() => handleDuplicate(persona)}>Duplicate</button>
                )}
              </div>
            </div>
          )
        })}
        {!filteredPersonas.length && (
          <div className="empty-state col-span-full">No personas match that search.</div>
        )}
      </div>
      <PersonaFormModal
        open={modalState.open}
        mode={modalState.mode}
        formValues={formValues}
        onChange={setFormValues}
        onClose={closeModal}
        onSubmit={handleSubmitPersona}
        submitting={submitting}
      />
    </div>
  )
}
