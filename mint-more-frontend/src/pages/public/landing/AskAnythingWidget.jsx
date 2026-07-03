import { useEffect, useRef, useState } from 'react'
import { localAnswer, quickQuestions } from './landingContent'

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const cleanMarkdown = value => String(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/\be\.g\./gi, 'for example')
  .replace(/\bi\.e\./gi, 'that means')
  .replace(/\betc\./gi, 'and similar items')
  .replace(/\s+\*\s+/g, '\n')
  .replace(/\s+-\s+/g, '\n')
  .replace(/^\s*[-*]\s+/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const sentenceChunks = text => {
  const protectedText = text
    .replace(/\bMr\./g, 'Mr<dot>')
    .replace(/\bMrs\./g, 'Mrs<dot>')
    .replace(/\bDr\./g, 'Dr<dot>')
    .replace(/\bvs\./g, 'vs<dot>')

  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9₹])/)
    .map(item => item.replaceAll('<dot>', '.').trim())
    .filter(Boolean)
}

const splitAnswer = value => {
  const text = cleanMarkdown(value)
  const sentences = sentenceChunks(text)
  const chunks = []
  let current = ''

  sentences.forEach(sentence => {
    const next = current ? `${current} ${sentence}` : sentence
    if (next.length > 145 && current) {
      chunks.push(current)
      current = sentence
    } else {
      current = next
    }
  })

  if (current) chunks.push(current)
  return (chunks.length ? chunks : [text])
    .map(chunk => chunk.replace(/^[,;:)\]\s]+/, '').trim())
    .filter(Boolean)
}

function MessageText({ text }) {
  const parts = cleanMarkdown(text).split('\n').filter(Boolean)
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 && <><br /><br /></>}
        </span>
      ))}
    </>
  )
}

export default function AskAnythingWidget({ visible }) {
  const [open, setOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(false)
  const messagesRef = useRef(null)
  const messageIdRef = useRef(0)
  const [messages, setMessages] = useState([
    { id: 'intro', role: 'assistant', text: 'Ask me about CREATYV, MintCoins, custom design requests, Mintbox, or how to contact the team.' },
  ])

  const nextMessageId = prefix => {
    messageIdRef.current += 1
    return `${prefix}-${messageIdRef.current}`
  }

  useEffect(() => {
    if (!open || !messagesRef.current) return
    messagesRef.current.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [open, messages, loading])

  const typeAssistantAnswer = async answer => {
    setTyping(true)
    const chunks = splitAnswer(answer)

    for (const chunk of chunks) {
      const id = nextMessageId('assistant')
      setMessages(prev => [...prev, { id, role: 'assistant', text: '' }])

      const words = chunk.split(/\s+/).filter(Boolean)
      for (let index = 0; index < words.length; index += 1) {
        const nextText = words.slice(0, index + 1).join(' ')
        setMessages(prev => prev.map(message => (
          message.id === id ? { ...message, text: nextText } : message
        )))
        await wait(42)
      }

      await wait(150)
    }

    setTyping(false)
  }

  const ask = async (text = question) => {
    const cleaned = String(text || '').trim()
    if (!cleaned || loading || typing) {
      setShowSuggestions(true)
      return
    }
    setOpen(true)
    setShowSuggestions(false)
    setQuestion('')
    setMessages(prev => [...prev, { id: nextMessageId('user'), role: 'user', text: cleaned }])
    setLoading(true)

    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
      const res = await fetch(base + '/public/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cleaned }),
      })
      if (!res.ok) throw new Error('Q&A unavailable')
      const data = await res.json()
      const answer = data?.data?.answer || data?.data?.data?.answer
      setLoading(false)
      await typeAssistantAnswer(answer || localAnswer(cleaned))
    } catch {
      setLoading(false)
      await typeAssistantAnswer(localAnswer(cleaned))
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = event => {
    event.preventDefault()
    ask()
  }

  return (
    <div className={'landing-ask-widget' + (visible ? ' is-visible' : '') + (showSuggestions ? ' is-suggesting' : '') + (open ? ' is-open' : '')}>
      {open && (
        <div className="landing-ask-panel">
          <div className="landing-ask-head">
            <div className="landing-ask-avatar" aria-hidden="true"><span /></div>
            <div>
              <strong>Mint AI</strong>
              <span>CREATYV Q&A agent</span>
            </div>
            <button type="button" onClick={() => { setOpen(false); setShowSuggestions(true) }} aria-label="Close Q&A">
              <span />
              <span />
            </button>
          </div>
          <div className="landing-ask-messages" ref={messagesRef}>
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={'landing-ask-bubble ' + message.role + (message.role === 'assistant' && cleanMarkdown(message.text).length > 120 ? ' wide' : '')}
              >
                <MessageText text={message.text} />
              </div>
            ))}
            {loading && <div className="landing-ask-bubble assistant">Thinking through the simplest answer...</div>}
          </div>
          <p>AI can make mistakes. For pricing or launch commitments, confirm with Mint More.</p>
        </div>
      )}
      <div className="landing-ask-controls">
        {(showSuggestions || open) && (
          <div className="landing-ask-collapsed-chips">
            {quickQuestions.map(item => <button key={item} type="button" onClick={() => ask(item)}>{item}</button>)}
          </div>
        )}
        <form className="landing-ask-bar" onSubmit={onSubmit}>
          <input
            value={question}
            onClick={() => setShowSuggestions(true)}
            onFocus={() => setShowSuggestions(true)}
            onChange={event => setQuestion(event.target.value)}
            placeholder="Ask me anything..."
          />
          <button type="submit" aria-label="Ask question">↑</button>
        </form>
      </div>
    </div>
  )
}
