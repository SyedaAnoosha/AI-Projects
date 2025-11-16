import React from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  loginUser,
  registerUser,
  fetchCurrentUser,
  setAuthToken,
  clearAuthToken,
} from '../api'

const AuthContext = createContext()

const TOKEN_KEY = 'PromptTune_token'
const USER_KEY = 'PromptTune_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY)
    return stored ? JSON.parse(stored) : null
  })
  const [authLoading, setAuthLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (token) {
      setAuthToken(token)
    } else {
      clearAuthToken()
    }
  }, [token])

  useEffect(() => {
    async function bootstrap() {
      if (!token) {
        setAuthLoading(false)
        return
      }
      try {
        const me = await fetchCurrentUser()
        setUser(me)
        localStorage.setItem(USER_KEY, JSON.stringify(me))
      } catch (err) {
        logout()
      } finally {
        setAuthLoading(false)
      }
    }
    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    const data = await loginUser(email, password)
    setToken(data.access_token)
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setAuthToken(data.access_token)
    const me = await fetchCurrentUser()
    setUser(me)
    localStorage.setItem(USER_KEY, JSON.stringify(me))
  }, [])

  const register = useCallback(async (payload) => {
    setError(null)
    await registerUser(payload)
    await login(payload.email, payload.password)
  }, [login])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    clearAuthToken()
  }, [])

  const value = useMemo(() => ({
    token,
    user,
    authLoading,
    error,
    setError,
    login,
    register,
    logout,
    isAuthenticated: Boolean(user && token),
  }), [token, user, authLoading, error, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
