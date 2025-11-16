import React from 'react'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="page-container flex min-h-screen flex-col items-center justify-center text-center px-6 py-12">
      <div className="max-w-2xl space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted">PromptTune</p>
          <h1 className="text-5xl font-semibold leading-tight text-primary">
            Craft Verifiable <span className="text-accent">Prompts</span>
          </h1>
          <p className="mt-4 text-base text-secondary">
            Optimize, audit, and simulate prompts with a workflow built for reliability and iteration.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link to="/auth" className="cta-button">Get Started</Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3 text-left mt-8">
          <div className="panel space-y-2">
            <p className="text-xs uppercase tracking-wide text-primary">Optimize</p>
            <p className="text-sm text-secondary">Transform raw ideas into structured, guardrailed system prompts.</p>
          </div>
          <div className="panel space-y-2">
            <p className="text-xs uppercase tracking-wide text-primary">Simulate</p>
            <p className="text-sm text-secondary">Stress-test with chat and rate responses for iterative refinement.</p>
          </div>
          <div className="panel space-y-2">
            <p className="text-xs uppercase tracking-wide text-primary">Library</p>
            <p className="text-sm text-secondary">Save versions, tag use cases, and reload templates into the studio.</p>
          </div>
        </div>
        <p className="text-xs text-info">Login to access your personalized studio.</p>
      </div>
    </div>
  )
}
