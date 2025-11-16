import React from 'react'
import { Link } from 'react-router-dom'
import PersonaSelector from '../components/PersonaSelector'

export default function Personas() {
  return (
    <div className="page-container text-primary px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <nav className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted">PromptTune</p>
            <h1 className="text-2xl font-semibold text-primary">AI Agent Personas</h1>
            <p className="text-sm text-secondary">Create, edit, and activate persona presets that steer optimization and chat.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <Link to="/studio" className="badge-button">Back to Studio</Link>
          </div>
        </nav>
        <PersonaSelector />
      </div>
    </div>
  )
}
