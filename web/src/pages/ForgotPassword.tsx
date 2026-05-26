import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSent(true)
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
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔑</div>
          <h1 style={{ color: 'var(--text-strong)', margin: '0 0 4px', fontSize: 'var(--fs-xl)' }}>비밀번호 찾기</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', margin: 0 }}>
            가입한 이메일로 재설정 링크를 보내드려요
          </p>
        </div>

        {sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', textAlign: 'center' }}>
            <div style={{
              background: 'var(--success-soft)',
              border: '1px solid var(--success)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--sp-4) var(--sp-5)',
              color: 'var(--success)',
              fontSize: 'var(--fs-sm)',
              lineHeight: 'var(--lh-base)',
            }}>
              <strong>{email}</strong>로<br />재설정 링크를 발송했어요.<br />
              메일함을 확인해주세요 📬
            </div>
            <button
              onClick={() => navigate('/login')}
              style={buttonStyle}
            >
              로그인으로 돌아가기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <input
              type="email"
              placeholder="가입한 이메일"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={inputStyle}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? '발송 중...' : '재설정 링크 보내기'}
            </button>
          </form>
        )}

        <button
          onClick={() => navigate('/login')}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}
        >
          ← 로그인으로 돌아가기
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
  boxShadow: 'var(--shadow-accent)',
  transition: 'var(--transition)',
}
