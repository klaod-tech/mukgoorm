import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않아요.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    await supabase.auth.signOut()
    navigate('/login')
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
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
          <h1 style={{ color: 'var(--text-strong)', margin: '0 0 4px', fontSize: 'var(--fs-xl)' }}>새 비밀번호 설정</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', margin: 0 }}>
            새로 사용할 비밀번호를 입력해주세요
          </p>
        </div>

        {!ready ? (
          <div style={{
            background: 'var(--warning-soft)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--sp-4)',
            color: 'var(--text-muted)',
            fontSize: 'var(--fs-sm)',
            textAlign: 'center',
            lineHeight: 'var(--lh-base)',
          }}>
            링크 인증 대기 중...<br />
            이메일의 재설정 링크를 클릭하면 이 화면이 활성화돼요.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <input
              type="password"
              placeholder="새 비밀번호 (6자 이상)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="비밀번호 확인"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={inputStyle}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? '변경 중...' : '비밀번호 변경하기'}
            </button>
          </form>
        )}
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
