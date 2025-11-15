import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const API_KEY = import.meta.env.VITE_API_KEY

export async function optimizePrompt(payload) {
  const res = await axios.post(`${API_BASE}/optimize`, payload, {
    headers: { 'X-API-Key': API_KEY }
  })
  return res.data
}

export async function chat(payload) {
  const res = await axios.post(`${API_BASE}/chat`, payload, {
    headers: { 'X-API-Key': API_KEY }
  })
  return res.data
}
