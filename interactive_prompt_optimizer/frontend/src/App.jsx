import React, { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { optimizePrompt, chat } from './api'

const THEME_TOKENS = {
  dark: {
    pageGradient: 'from-[#050b29] via-[#0a1f5c] to-[#0b74ff]',
    blobOne: 'bg-[#4cc9ff]',
    blobTwo: 'bg-[#0a3ead]',
    primaryText: 'text-white',
    secondaryText: 'text-white/80',
    mutedText: 'text-white/60',
    accentText: 'text-[#7fd3ff]',
    badgeText: 'text-white/80',
    badgeBorder: 'border-white/20',
    cardBg: 'bg-white/5',
    cardBorder: 'border-white/15',
    statCardBg: 'bg-white/5',
    statBorder: 'border-white/15',
    statMuted: 'text-white/75',
    statValue: 'text-white',
    inputBorder: 'border-white/15',
    inputBg: 'bg-white/10',
    inputText: 'text-white',
    placeholder: 'placeholder:text-white/60',
    focusBorder: 'focus:border-[#67d0ff]',
    focusRing: 'focus:ring-[#67d0ff]/60',
    ctaGradient: 'from-[#1f7bff] to-[#65e0ff]',
    infoText: 'text-white/70',
    panelBg: 'bg-black/20',
    panelBorder: 'border-white/10',
    userBubble: 'bg-gradient-to-r from-[#1d6dff] to-[#58d5ff] text-white',
    assistantBubble: 'bg-white/10 text-white/90 border border-white/10',
    checklistDot: 'bg-[#59d3ff]',
    codeBg: 'bg-black/30',
    codeBorder: 'border-white/15',
    ghostButtonBg: 'bg-white/10',
    ghostButtonBorder: 'border-white/25',
    ghostButtonHover: 'hover:bg-white/20',
    ghostButtonText: 'text-white',
    toggleBg: 'bg-white/10',
    toggleText: 'text-white',
    emptyBorder: 'border-white/20',
    emptyText: 'text-white/70',
  },
  light: {
    pageGradient: 'from-[#add8e6] via-[#e2ecff] to-[#c7dbff]',
    blobOne: 'bg-[#a6c8ff]',
    blobTwo: 'bg-[#d4e2ff]',
    primaryText: 'text-slate-900',
    secondaryText: 'text-slate-600',
    mutedText: 'text-slate-500',
    accentText: 'text-[#2157c8]',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-200',
    cardBg: 'bg-white/80',
    cardBorder: 'border-slate-200',
    statCardBg: 'bg-white/90',
    statBorder: 'border-slate-200',
    statMuted: 'text-slate-500',
    statValue: 'text-slate-900',
    inputBorder: 'border-slate-300',
    inputBg: 'bg-white',
    inputText: 'text-slate-900',
    placeholder: 'placeholder:text-slate-400',
    focusBorder: 'focus:border-[#2563eb]',
    focusRing: 'focus:ring-[#2563eb]/30',
    ctaGradient: 'from-[#2f6bff] to-[#67a8ff]',
    infoText: 'text-slate-500',
    panelBg: 'bg-white/80',
    panelBorder: 'border-slate-200',
    userBubble: 'bg-gradient-to-r from-[#407bff] to-[#6fb9ff] text-white',
    assistantBubble: 'bg-white text-slate-800 border border-slate-200',
    checklistDot: 'bg-[#3b82f6]',
    codeBg: 'bg-slate-900/5',
    codeBorder: 'border-slate-200',
    ghostButtonBg: 'bg-white',
    ghostButtonBorder: 'border-slate-300',
    ghostButtonHover: 'hover:bg-slate-50',
    ghostButtonText: 'text-slate-700',
    toggleBg: 'bg-white',
    toggleText: 'text-slate-700',
    emptyBorder: 'border-slate-200',
    emptyText: 'text-slate-500',
  },
}

function Section({ title, description, children, className = '', themeStyles }) {
  const { cardBorder, cardBg, mutedText, secondaryText } = themeStyles
  return (
    <section className={`relative overflow-hidden rounded-3xl border ${cardBorder} ${cardBg} shadow-[0_25px_80px_rgba(0,0,0,0.12)] backdrop-blur-lg ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-70" aria-hidden="true" />
      <div className="relative p-6 lg:p-8 space-y-3">
        <div>
          <p className={`text-xs uppercase tracking-[0.4em] ${mutedText}`}>{title}</p>
          {description && <p className={`text-sm mt-1 ${secondaryText}`}>{description}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}

export default function App() {
  const [theme, setTheme] = useState('dark')
  const [rawPrompt, setRawPrompt] = useState("")
  const [goal, setGoal] = useState("")
  const [audience, setAudience] = useState("")
  const [style, setStyle] = useState("Concise, clear, verifiable")
  const [sessionId] = useState(() => Math.random().toString(36).slice(2))
  const [loading, setLoading] = useState(false)
  const [optResult, setOptResult] = useState(null)
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState([])

  const themeStyles = useMemo(() => THEME_TOKENS[theme], [theme])
  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))

  const inputClass = [
    'w-full rounded-2xl border px-4 py-3 focus:outline-none focus:ring-2',
    themeStyles.inputBorder,
    themeStyles.inputBg,
    themeStyles.inputText,
    themeStyles.placeholder,
    themeStyles.focusBorder,
    themeStyles.focusRing,
  ].join(' ')

  // const statHighlights = [
  //   { label: 'Latency', value: '<5s', detail: 'Groq inference average' },
  //   { label: 'Memory', value: '8 turns', detail: 'Per-session context' },
  //   { label: 'Sources', value: 'RAG-ready', detail: 'Pinecone curated set' },
  // ]

  async function onOptimize() {
    setLoading(true)
    try {
      const data = await optimizePrompt({ raw_prompt: rawPrompt, goal, audience, style, session_id: sessionId })
      setOptResult(data)
    } catch (e) {
      alert(e?.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  async function onSend() {
    if (!chatInput.trim()) return
    const newMsgs = [...messages, { role: 'user', content: chatInput }]
    setMessages(newMsgs)
    setChatInput("")
    try {
      const data = await chat({ session_id: sessionId, messages: newMsgs.slice(-4), system_prompt: optResult?.optimized_prompt || undefined })
      setMessages(data.messages)
    } catch (e) {
      alert(e?.response?.data?.detail || e.message)
    }
  }

  const ctaClass = `inline-flex items-center justify-center rounded-2xl bg-gradient-to-r ${themeStyles.ctaGradient} px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50`
  const sendButtonClass = `rounded-2xl border px-6 py-3 text-sm font-semibold uppercase tracking-wider transition ${themeStyles.ghostButtonBg} ${themeStyles.ghostButtonBorder} ${themeStyles.ghostButtonText} ${themeStyles.ghostButtonHover}`

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themeStyles.pageGradient} ${themeStyles.primaryText}`}>
      <div className="relative isolate overflow-hidden px-4 py-8 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className={`absolute -top-24 right-10 h-72 w-72 rounded-full ${themeStyles.blobOne} blur-[120px]`} />
          <div className={`absolute -bottom-32 left-0 h-80 w-80 rounded-full ${themeStyles.blobTwo} blur-[140px]`} />
        </div>

        <main className="relative z-10 mx-auto max-w-6xl space-y-8">
          <header className={`flex flex-col gap-6 rounded-3xl border ${themeStyles.cardBorder} ${themeStyles.cardBg} p-6 backdrop-blur-lg md:flex-row md:items-center md:justify-between`}>
            <div>
              <p className={`text-xs uppercase tracking-[0.5em] ${themeStyles.mutedText}`}>Prompt intelligence cockpit</p>
              <h1 className={`mt-3 text-4xl font-semibold leading-tight md:text-5xl ${themeStyles.primaryText}`}>
                PromptPilot <span className={themeStyles.accentText}>Control Deck</span>
              </h1>
              <p className={`mt-3 max-w-3xl text-base ${themeStyles.secondaryText}`}>
                Craft verifiable prompts, cite RAG insights, and run chat simulations from the same surface.
              </p>
            </div>
            <div className="flex flex-col gap-3 self-start sm:flex-row sm:items-center">
              <button onClick={toggleTheme} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] ${themeStyles.toggleBg} ${themeStyles.badgeBorder} ${themeStyles.toggleText}`}>
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
              <div className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] ${themeStyles.badgeBorder} ${themeStyles.badgeText}`}>
                Session • {sessionId.slice(0, 6)}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Section
              title="Stage I"
              description="Define the raw idea, intent, tone, and constraints you want to optimize."
              themeStyles={themeStyles}
            >
              <div className="space-y-5">
                <textarea
                  value={rawPrompt}
                  onChange={(e) => setRawPrompt(e.target.value)}
                  placeholder="Paste your raw prompt or jot a rough draft..."
                  className={`${inputClass} min-h-[160px] resize-none`}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className={inputClass} />
                  <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Audience / Tone" className={inputClass} />
                  <input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Style" className={inputClass} />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button onClick={onOptimize} disabled={loading || !rawPrompt.trim()} className={ctaClass}>
                    {loading ? 'Optimizing…' : 'Optimize Prompt'}
                  </button>
                </div>
              </div>
            </Section>

            <Section title="Stage II" description="Review the optimized prompt, rationale, and QA checklist." themeStyles={themeStyles}>
              {!optResult ? (
                <div className={`rounded-2xl border border-dashed p-6 text-sm ${themeStyles.emptyBorder} ${themeStyles.emptyText}`}>
                  Run an optimization to preview the upgraded prompt, reasoning, and guardrails.
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className={`text-sm uppercase tracking-[0.4em] ${themeStyles.mutedText}`}>Optimized prompt</h3>
                    <pre className={`mt-2 max-h-64 overflow-auto rounded-2xl border p-4 text-sm leading-relaxed whitespace-pre-wrap ${themeStyles.codeBorder} ${themeStyles.codeBg} ${themeStyles.secondaryText}`}>
                      {optResult.optimized_prompt}
                    </pre>
                  </div>
                  {optResult.rationale && (
                    <div>
                      <h3 className={`text-sm uppercase tracking-[0.4em] ${themeStyles.mutedText}`}>Rationale</h3>
                      <p className={`mt-2 text-sm whitespace-pre-wrap ${themeStyles.secondaryText}`}>{optResult.rationale}</p>
                    </div>
                  )}
                  {optResult.checklist?.length ? (
                    <div>
                      <h3 className={`text-sm uppercase tracking-[0.4em] ${themeStyles.mutedText}`}>Checklist</h3>
                      <ul className="mt-3 space-y-2 text-sm">
                        {optResult.checklist.map((c, i) => (
                          <li key={i} className={`flex items-start gap-3 ${themeStyles.secondaryText}`}>
                            <span className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${themeStyles.checklistDot}`} />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </Section>

            <Section
              title="Stage III"
              description="Stress-test the prompt with live chat. Memory stays scoped to this session."
              className="xl:col-span-2"
              themeStyles={themeStyles}
            >
              <div className="flex flex-col gap-4">
                <div className={`min-h-[360px] space-y-3 overflow-auto rounded-2xl border p-4 ${themeStyles.panelBg} ${themeStyles.panelBorder}`}>
                  {!messages.length && <p className={`text-sm ${themeStyles.infoText}`}>Send a message to kick off the test conversation.</p>}
                  {messages.map((m, i) => {
                    const isUser = m.role === 'user'
                    const bubbleClass = isUser ? themeStyles.userBubble : themeStyles.assistantBubble
                    return (
                      <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`markdown-body max-w-xl rounded-2xl px-4 py-3 text-sm ${bubbleClass}`}>
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSend()}
                    placeholder="Ask something…"
                    className={`${inputClass} flex-1`}
                  />
                  <button onClick={onSend} className={sendButtonClass}>
                    Send
                  </button>
                </div>
                <p className={`text-xs ${themeStyles.infoText}`}>Optimized prompt is auto-used as the system message when available.</p>
              </div>
            </Section>
          </div>
        </main>
      </div>
    </div>
  )
}
