import React from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchPreferences, updatePreferences } from '../api'
import { useAuth } from './AuthContext'

const PreferencesContext = createContext(null)

const EMPTY_PREFS = {
  industry: '',
  tone_preference: '',
  default_goal: '',
  default_audience: '',
  default_style: '',
  compliance_notes: '',
  active_persona_id: '',
  active_persona: null,
}

function hasMeaningfulPrefs(prefs) {
  if (!prefs) return false
  return Object.entries({
    default_goal: prefs.default_goal,
    default_audience: prefs.default_audience,
    default_style: prefs.default_style,
    tone_preference: prefs.tone_preference,
    compliance_notes: prefs.compliance_notes,
  }).some(([_, value]) => {
    if (value == null) return false
    if (typeof value === 'string') return value.trim().length > 0
    return Boolean(value)
  })
}

export function PreferencesProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [preferences, setPreferences] = useState(null)
  const [prefsLoading, setPrefsLoading] = useState(false)
  const [prefsError, setPrefsError] = useState(null)
  const [shouldOnboard, setShouldOnboard] = useState(false)

  const loadPreferences = useCallback(async () => {
    if (!isAuthenticated) {
      setPreferences(null)
      setShouldOnboard(false)
      return
    }
    setPrefsLoading(true)
    setPrefsError(null)
    try {
      const data = await fetchPreferences()
      setPreferences({ ...EMPTY_PREFS, ...data })
      setShouldOnboard(!hasMeaningfulPrefs(data))
    } catch (err) {
      setPrefsError(err)
    } finally {
      setPrefsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  const savePreferences = useCallback(async (payload) => {
    setPrefsError(null)
    const data = await updatePreferences(payload)
    setPreferences({ ...EMPTY_PREFS, ...data })
    setShouldOnboard(!hasMeaningfulPrefs(data))
    return data
  }, [])

  const dismissOnboarding = useCallback(() => {
    setShouldOnboard(false)
  }, [])

  const value = useMemo(() => ({
    preferences,
    prefsLoading,
    prefsError,
    refreshPreferences: loadPreferences,
    savePreferences,
    shouldOnboard,
    dismissOnboarding,
  }), [preferences, prefsLoading, prefsError, loadPreferences, savePreferences, shouldOnboard, dismissOnboarding])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider')
  }
  return ctx
}
