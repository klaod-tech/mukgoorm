import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    navigate('/')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--sp-10)',
        width: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-5)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/smile.png" alt="먹구름" style={{ width: 120, height: 120, objectFit: 'contain', imageRendering: 'pixelated' }} />
          <h1 style={{ color: 'var(--text-strong)', margin: '8px 0 4px', fontSize: 'var(--fs-xl)' }}>먹구름</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', margin: 0 }}>
            {isSignUp ? '계정을 만들어요' : '다시 돌아왔네요'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(v => !v); setError('') }}
          style={{ background: 'none', border: 'none', color: 'var(--accent-ink)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}
        >
          {isSignUp ? '이미 계정이 있어요 → 로그인' : '계정이 없어요 → 회원가입'}
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--sp-3) var(--sp-4)',
  color: 'var(--text)',
  fontSize: 'var(--fs-base)',
  outline: 'none',
}

const buttonStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  padding: 'var(--sp-3) var(--sp-5)',
  color: 'var(--text-on-accent)',
  fontSize: 'var(--fs-base)',
  fontWeight: 'var(--fw-bold)',
  cursor: 'pointer',
  marginTop: 4,
  boxShadow: 'var(--shadow-accent)',
  transition: 'var(--transition)',
}
