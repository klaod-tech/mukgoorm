import { useEffect, useState } from 'react'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'

interface EmailLog {
  id: string
  subject: string | null
  sender: string | null
  summary: string | null
  received_at: string | null
  created_at: string
}

export default function Email() {
  const { user } = useUser()
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function deleteLog(id: string) {
    setLogs(prev => prev.filter(l => l.id !== id))
    await supabase.from('email_log').delete().eq('id', id)
  }

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const { data } = await supabase
          .from('email_log')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30)
        setLogs(data ?? [])
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--sp-6)' }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ color: 'var(--text-strong)', margin: '0 0 4px', fontSize: 'var(--fs-xl)' }}>📧 이메일 모니터링</h2>
      <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-8)' }}>
        채팅에서 "이메일 확인해줘"라고 말하면 여기에 요약이 저장돼요
      </div>

      {logs.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--radius-lg)', padding: '40px var(--sp-6)', textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 'var(--sp-3)' }}>📭</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-base)', marginBottom: 6 }}>아직 이메일 기록이 없어요</div>
          <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>
            홈 채팅에서 "이메일 확인해줘"라고 말해보세요
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {logs.map(log => (
            <div
              key={log.id}
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${expanded === log.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', padding: 'var(--sp-4) var(--sp-5)',
                cursor: 'pointer', transition: 'var(--transition)',
                boxShadow: expanded === log.id ? 'var(--shadow-accent)' : 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: 'var(--text-strong)', fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-medium)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {log.subject ?? '(제목 없음)'}
                  </div>
                  {log.sender && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: 3 }}>
                      보낸 사람: {log.sender}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
                  <span style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>
                    {log.received_at
                      ? new Date(log.received_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                      : new Date(log.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteLog(log.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16, padding: '2px 4px' }}
                  >🗑️</button>
                </div>
              </div>

              {expanded === log.id && log.summary && (
                <div style={{
                  color: 'var(--text)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-base)',
                  marginTop: 'var(--sp-3)', paddingTop: 'var(--sp-3)',
                  borderTop: '1px solid var(--border)',
                }}>
                  {log.summary}
                </div>
              )}
              {expanded === log.id && !log.summary && (
                <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-3)' }}>
                  요약 정보가 없어요
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
