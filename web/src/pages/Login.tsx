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
        padding: '10px var(--sp-10) var(--sp-10)',
        width: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-5)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/smile.png" alt="먹구름" style={{ width: 160, height: 160, objectFit: 'contain', imageRendering: 'pixelated' }} />
          <h1 style={{ color: 'var(--text-strong)', margin: '8px 0 12px', fontSize: 'var(--fs-xl)' }}>먹구름</h1>

          {/* 로그인/회원가입 탭 */}
          <div style={{
            display: 'inline-flex',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-pill)',
            padding: 3,
            gap: 2,
          }}>
            {(['로그인', '회원가입'] as const).map((label, i) => {
              const active = isSignUp === (i === 1)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setIsSignUp(i === 1); setError('') }}
                  style={{
                    background: active ? (i === 0 ? 'var(--accent)' : 'var(--sky)') : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    padding: '6px 20px',
                    color: active ? 'var(--text-on-accent)' : 'var(--text-muted)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: active ? 'var(--fw-bold)' : 'var(--fw-normal)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <p style={{ color: isSignUp ? 'var(--sky-ink)' : 'var(--accent-ink)', fontSize: 'var(--fs-sm)', margin: '10px 0 0' }}>
            {isSignUp ? '처음 오셨군요, 환영해요!' : '다시 돌아왔네요'}
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
          <button
            type="submit"
            disabled={loading}
            style={isSignUp ? signUpButtonStyle : buttonStyle}
          >
            {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
          </button>
        </form>
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
