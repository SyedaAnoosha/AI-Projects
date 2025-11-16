import React from 'react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuthScreen() {
  const { login, register, authLoading, error, setError } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '' })

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register({ email: form.email, password: form.password })
      }
    } catch (err) {
      const message = err?.response?.data?.detail || err.message || 'Something went wrong'
      setError?.(message)
    }
  }

  return (
    <div className="page-container flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 shadow-2xl">
        <div className="mb-6 text-center space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted">PromptTune</p>
          <h1 className="text-3xl font-semibold text-primary">{mode === 'login' ? 'Welcome back' : 'Launch PromptTune Studio'}</h1>
          <p className="text-sm text-secondary">
            {mode === 'login' ? 'Sign in to continue optimizing prompts.' : 'Spin up a personalized prompt workspace in seconds.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-xs uppercase tracking-wide text-muted">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              className="input mt-1"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs uppercase tracking-wide text-muted">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={handleChange}
              className="input mt-1"
              placeholder="Minimum 8 characters"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={authLoading}
            className="cta-button w-full"
          >
            {authLoading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setMode((prev) => (prev === 'login' ? 'register' : 'login'))
              setError?.(null)
            }}
            className="text-sm font-medium text-secondary hover:text-primary transition"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
