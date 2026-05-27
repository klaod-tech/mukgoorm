import { useEffect, useState } from 'react'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'

interface DiaryEntry {
  id: string
  date: string
  content: string
  summary: string | null
}

export default function Diary() {
  const { user } = useUser()
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function deleteEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
    await supabase.from('diary').delete().eq('id', id)
  }

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const { data } = await supabase
          .from('diary')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
        setEntries(data ?? [])
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--sp-6)' }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ color: 'var(--text-strong)', margin: '0 0 var(--sp-6)', fontSize: 'var(--fs-xl)' }}>📔 일기</h2>
      {entries.length === 0 ? (
        <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-base)' }}>작성된 일기가 없어요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {entries.map(entry => (
            <div
              key={entry.id}
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: 'var(--sp-5)',
                cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'var(--transition)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-strong)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-md)' }}>{entry.date}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <span style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>{expanded === entry.id ? '▲' : '▼'}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteEntry(entry.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16, padding: '2px 4px' }}
                  >🗑️</button>
                </div>
              </div>
              {entry.summary && (
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', marginTop: 6 }}>{entry.summary}</div>
              )}
              {expanded === entry.id && (
                <div style={{
                  color: 'var(--text)', fontSize: 'var(--fs-base)', marginTop: 'var(--sp-3)',
                  lineHeight: 'var(--lh-base)', whiteSpace: 'pre-wrap',
                  borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-3)',
                }}>
                  {entry.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
