import React from 'react'
import PreferencesForm from './PreferencesForm'

export default function ProfileDefaultsModal({ open, onClose, onSubmit, initialValues, loading }) {
  if (!open) return null

  return (
    <div className="modal-overlay">
      <div className="card w-full max-w-3xl p-8 shadow-2xl modal-scroll">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Profile defaults</p>
            <h2 className="mt-2 text-2xl font-semibold text-primary">Tune PromptTune to your voice</h2>
            <p className="mt-1 text-sm text-secondary">These values pre-fill Stage I and influence the optimize meta-prompt.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ghost-button"
          >
            Close
          </button>
        </div>
        <PreferencesForm
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onClose}
          loading={loading}
        />
      </div>
    </div>
  )
}
