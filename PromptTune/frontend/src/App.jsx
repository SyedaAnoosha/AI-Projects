import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { PersonasProvider } from './context/PersonaContext'
import { ThemeProvider } from './context/ThemeContext'
import AuthScreen from './views/AuthScreen'
import Studio from './views/Studio'
import Landing from './views/Landing'
import OnboardingWizard from './views/OnboardingWizard'
import PromptLibrary from './views/PromptLibrary'
import Personas from './views/Personas'

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        <p className="text-sm uppercase tracking-[0.4em] text-white/60">Booting studio</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth()
  if (authLoading) return <FullScreenLoader />
  return isAuthenticated ? children : <Navigate to="/auth" replace />
}

function PublicRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth()
  if (authLoading) return <FullScreenLoader />
  return !isAuthenticated ? children : <Navigate to="/studio" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Landing />}
      />
      <Route
        path="/studio"
        element={(
          <ProtectedRoute>
            <Studio />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/onboarding"
        element={(
          <ProtectedRoute>
            <OnboardingWizard />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/auth"
        element={(
          <PublicRoute>
            <AuthScreen />
          </PublicRoute>
        )}
      />
      <Route
        path="/library"
        element={(
          <ProtectedRoute>
            <PromptLibrary />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/personas"
        element={(
          <ProtectedRoute>
            <Personas />
          </ProtectedRoute>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PersonasProvider>
          <PreferencesProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </PreferencesProvider>
        </PersonasProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
