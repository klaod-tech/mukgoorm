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

  useEffect(() => {
    if (!user) return
    supabase
      .from('email_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setLogs(data ?? [])
        setLoading(false)
      })
  }, [user])

  if (loading) return <div style={{ color: '#aaa', padding: 24 }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20 }}>📧 이메일 모니터링</h2>
      <div style={{ color: '#555', fontSize: 13, marginBottom: 28 }}>
        채팅에서 "이메일 확인해줘"라고 말하면 여기에 요약이 저장돼요
      </div>

      {logs.length === 0 ? (
        <div style={{
          background: '#1a1a2e', border: '1px dashed #2a2a4a',
          borderRadius: 14, padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ color: '#aaa', fontSize: 14, marginBottom: 6 }}>아직 이메일 기록이 없어요</div>
          <div style={{ color: '#555', fontSize: 13 }}>
            홈 채팅에서 "이메일 확인해줘"라고 말해보세요
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map(log => (
            <div
              key={log.id}
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              style={{
                background: '#1a1a2e',
                border: `1px solid ${expanded === log.id ? '#6c63ff' : '#2a2a4a'}`,
                borderRadius: 12, padding: '14px 18px',
                cursor: 'pointer', transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: '#fff', fontSize: 14, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {log.subject ?? '(제목 없음)'}
                  </div>
                  {log.sender && (
                    <div style={{ color: '#888', fontSize: 12, marginTop: 3 }}>
                      보낸 사람: {log.sender}
                    </div>
                  )}
                </div>
                <div style={{ color: '#555', fontSize: 11, flexShrink: 0 }}>
                  {log.received_at
                    ? new Date(log.received_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                    : new Date(log.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </div>
              </div>

              {expanded === log.id && log.summary && (
                <div style={{
                  color: '#bbb', fontSize: 13, lineHeight: 1.7,
                  marginTop: 12, paddingTop: 12,
                  borderTop: '1px solid #2a2a4a',
                }}>
                  {log.summary}
                </div>
              )}
              {expanded === log.id && !log.summary && (
                <div style={{ color: '#555', fontSize: 13, marginTop: 10 }}>
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
