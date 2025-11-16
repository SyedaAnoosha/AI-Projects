import React from 'react'
import { useEffect, useState } from 'react'

const FIELD_CONFIG = [
  { name: 'industry', label: 'Industry / Domain', placeholder: 'e.g. SaaS, Healthcare, Fintech' },
  { name: 'tone_preference', label: 'Tone Preference', placeholder: 'Confident, consultative, playful…' },
  { name: 'default_goal', label: 'Default Goal', placeholder: 'What outcome should prompts aim for?' },
  { name: 'default_audience', label: 'Default Audience', placeholder: 'Target persona or tone guidance' },
  { name: 'default_style', label: 'Default Style', placeholder: 'e.g. Concise, cite sources, include bullets' },
]

const BASE_STATE = {
  industry: '',
  tone_preference: '',
  default_goal: '',
  default_audience: '',
  default_style: '',
  compliance_notes: '',
}

export default function PreferencesForm({ initialValues = {}, onSubmit, onCancel, submitLabel = 'Save defaults', loading = false }) {
  const [form, setForm] = useState({ ...BASE_STATE, ...initialValues })

  useEffect(() => {
    setForm({ ...BASE_STATE, ...initialValues })
  }, [initialValues])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {FIELD_CONFIG.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="text-xs uppercase tracking-wide text-muted">
            {field.label}
          </label>
          <input
            id={field.name}
            name={field.name}
            type="text"
            value={form[field.name]}
            onChange={handleChange}
            placeholder={field.placeholder}
            className="input mt-2"
          />
        </div>
      ))}
      <div>
        <label htmlFor="compliance_notes" className="text-xs uppercase tracking-wide text-muted">
          Compliance Notes / Guardrails
        </label>
        <textarea
          id="compliance_notes"
          name="compliance_notes"
          rows={4}
          value={form.compliance_notes}
          onChange={handleChange}
          placeholder="List disclosures, forbidden claims, or copy blocks to include"
          className="input mt-2"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="ghost-button"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
            className="cta-button"
        >
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
