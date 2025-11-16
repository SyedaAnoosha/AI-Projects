import axios from 'axios'

const resolvedApiBase = (() => {
  const envBase = import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.trim()
  if (envBase) return envBase
  if (typeof window === 'undefined') return 'http://localhost:8000'
  const protocol = window.location.protocol || 'http:'
  const hostname = window.location.hostname || 'localhost'
  // Mirror the current host for LAN/dev usage so mobile devices don't call their own localhost.
  return `${protocol}//${hostname}:8000`
})()

const API_BASE = resolvedApiBase

let authToken = null

export function setAuthToken(token) {
  authToken = token
}

export function clearAuthToken() {
  authToken = null
}

const client = axios.create({ baseURL: API_BASE })

client.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`
  }
  return config
})

export async function registerUser(payload) {
  const res = await client.post('/auth/register', payload)
  return res.data
}

export async function loginUser(email, password) {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  const res = await client.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  return res.data
}

export async function fetchCurrentUser() {
  const res = await client.get('/auth/me')
  return res.data
}

export async function fetchPreferences() {
  const res = await client.get('/me/preferences')
  return res.data
}

export async function updatePreferences(payload) {
  const res = await client.put('/me/preferences', payload)
  return res.data
}

export async function optimizePrompt(payload) {
  const res = await client.post('/optimize', payload)
  return res.data
}

export async function chat(payload) {
  const res = await client.post('/chat', payload)
  return res.data
}

export async function listPrompts(params = {}) {
  const res = await client.get('/prompts', { params })
  return res.data
}

export async function createPrompt(payload) {
  const res = await client.post('/prompts', payload)
  return res.data
}

export async function updatePrompt(promptId, payload) {
  const res = await client.patch(`/prompts/${promptId}`, payload)
  return res.data
}

export async function deletePrompt(promptId) {
  const res = await client.delete(`/prompts/${promptId}`)
  return res.data
}

export async function createAnalytics(payload) {
  const res = await client.post('/analytics', payload)
  return res.data
}

export async function listPersonas(params = {}) {
  const res = await client.get('/personas', { params })
  return res.data
}

export async function createPersona(payload) {
  const res = await client.post('/personas', payload)
  return res.data
}

export async function updatePersona(personaId, payload) {
  const res = await client.patch(`/personas/${personaId}`, payload)
  return res.data
}

export async function deletePersona(personaId) {
  const res = await client.delete(`/personas/${personaId}`)
  return res.data
}
