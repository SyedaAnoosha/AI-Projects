import React, { useState } from 'react'
import { usePreferences } from '../context/PreferencesContext'
import { useNavigate } from 'react-router-dom'
import CtaButton from '../components/CtaButton'

const STEPS = [
  { id: 'persona', label: 'Persona', description: 'Define a role or voice the assistant should emulate.' },
  { id: 'goals', label: 'Goals', description: 'Primary outcomes your prompts should drive.' },
  { id: 'compliance', label: 'Compliance', description: 'Guardrails, disclaimers, forbidden claims.' }
]

export default function OnboardingWizard() {
  const { savePreferences } = usePreferences()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [persona, setPersona] = useState('')
  const [default_goal, setGoal] = useState('')
  const [default_audience, setAudience] = useState('')
  const [default_style, setStyle] = useState('')
  const [compliance_notes, setCompliance] = useState('')
  const [saving, setSaving] = useState(false)

  const isLast = step === STEPS.length - 1

  const handleNext = () => {
    if (isLast) return
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }
  const handlePrev = () => setStep((s) => Math.max(0, s - 1))

  async function handleFinish() {
    setSaving(true)
    try {
      await savePreferences({ persona, default_goal, default_audience, default_style, compliance_notes })
      navigate('/studio')
    } catch (e) {
      alert(e?.response?.data?.detail || e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container min-h-screen px-6 py-10 text-primary">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="card p-6 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted">Onboarding</p>
          <h1 className="text-3xl font-semibold text-primary">Personalize Your Studio</h1>
          <p className="text-sm text-secondary">We use these defaults to pre-fill optimization and tune system prompts.</p>
          <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide">
            {STEPS.map((s, idx) => (
              <span key={s.id} className={`badge-button ${idx === step ? 'active-step' : ''}`}>{s.label}</span>
            ))}
          </div>
        </header>
        <section className="section p-6 space-y-5">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted">Persona / Voice</label>
                <input className="input mt-2" value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="e.g. Senior Product Strategist, Friendly Tutor" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted">Default Style / Tone</label>
                <input className="input mt-2" value={default_style} onChange={(e) => setStyle(e.target.value)} placeholder="Concise, cites sources, actionable" />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted">Primary Goals</label>
                <textarea className="input mt-2 min-h-[140px]" value={default_goal} onChange={(e) => setGoal(e.target.value)} placeholder="Summarize research, produce marketing copy, validate assumptions" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted">Audience / Target Persona</label>
                <input className="input mt-2" value={default_audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. B2B SaaS founders, technical analysts" />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted">Compliance / Guardrails</label>
                <textarea className="input mt-2 min-h-[160px]" value={compliance_notes} onChange={(e) => setCompliance(e.target.value)} placeholder="Disclaimers, restricted claims, citation requirements" />
              </div>
              <p className="text-xs text-info">You can edit these later in Profile Defaults.</p>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {step > 0 && (
              <button type="button" onClick={handlePrev} className="ghost-button">Back</button>
            )}
            {!isLast && (
              <CtaButton type="button" onClick={handleNext}>Next</CtaButton>
            )}
            {isLast && (
              <CtaButton type="button" onClick={handleFinish} loading={saving} loadingLabel="Saving…">Finish</CtaButton>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
