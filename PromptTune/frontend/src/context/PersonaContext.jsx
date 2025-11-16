import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { listPersonas, createPersona, updatePersona, deletePersona } from '../api'
import { useAuth } from './AuthContext'

const PersonasContext = createContext(null)

export function PersonasProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refreshPersonas = useCallback(async (searchTerm) => {
    if (!isAuthenticated) {
      setPersonas([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = searchTerm ? { search: searchTerm } : {}
      const data = await listPersonas(params)
      setPersonas(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    refreshPersonas()
  }, [refreshPersonas])

  const addPersona = useCallback(async (payload) => {
    const persona = await createPersona(payload)
    setPersonas((prev) => [persona, ...prev])
    return persona
  }, [])

  const editPersona = useCallback(async (personaId, payload) => {
    const updated = await updatePersona(personaId, payload)
    setPersonas((prev) => prev.map((item) => (item.id === personaId ? updated : item)))
    return updated
  }, [])

  const removePersona = useCallback(async (personaId) => {
    await deletePersona(personaId)
    setPersonas((prev) => prev.filter((item) => item.id !== personaId))
  }, [])

  const value = useMemo(() => ({
    personas,
    loading,
    error,
    refreshPersonas,
    addPersona,
    editPersona,
    removePersona,
  }), [personas, loading, error, refreshPersonas, addPersona, editPersona, removePersona])

  return (
    <PersonasContext.Provider value={value}>
      {children}
    </PersonasContext.Provider>
  )
}

export function usePersonas() {
  const ctx = useContext(PersonasContext)
  if (!ctx) {
    throw new Error('usePersonas must be used within PersonasProvider')
  }
  return ctx
}
