import React from 'react'
import PreferencesForm from './PreferencesForm'

export default function OnboardingModal({ open, onComplete, onSkip, loading }) {
  if (!open) return null

  return (
    <div className="modal-overlay">
      <div className="card w-full max-w-4xl p-8 shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="mb-6 text-center space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted">Welcome to PromptTune</p>
          <h2 className="text-3xl font-semibold text-primary">Tune your studio defaults</h2>
          <p className="text-sm text-secondary">Tell us about your goals, tone, and compliance guardrails so every optimization starts in the right lane.</p>
        </div>
        <PreferencesForm
          initialValues={{}}
          onSubmit={onComplete}
          submitLabel="Save & launch"
          loading={loading}
        />
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-secondary hover:text-primary transition"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
