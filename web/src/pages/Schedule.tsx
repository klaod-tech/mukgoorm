import { useEffect, useState } from 'react'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'

interface ScheduleItem {
  id: string
  title: string
  description: string | null
  location: string | null
  date: string
  time: string | null
  is_done: boolean
}

export default function Schedule() {
  const { user } = useUser()
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('schedule')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .then(({ data }) => {
        setItems(data ?? [])
        setLoading(false)
      })
  }, [user])

  async function toggleDone(id: string, current: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_done: !current } : i))
    const { error } = await supabase
      .from('schedule')
      .update({ is_done: !current, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_done: current } : i))
    }
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('schedule').delete().eq('id', id)
  }

  const todo = items.filter(i => !i.is_done)
  const done = items.filter(i => i.is_done)

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--sp-6)' }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ color: 'var(--text-strong)', margin: '0 0 var(--sp-6)', fontSize: 'var(--fs-xl)' }}>📅 일정</h2>
      {items.length === 0 ? (
        <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-base)' }}>등록된 일정이 없어요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {[...todo, ...done].map(item => (
            <div key={item.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: 'var(--sp-4) var(--sp-5)',
              display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start',
              opacity: item.is_done ? 0.5 : 1,
              boxShadow: 'var(--shadow-sm)', transition: 'var(--transition)',
            }}>
              <button
                onClick={() => toggleDone(item.id, item.is_done)}
                style={{
                  marginTop: 2, width: 18, height: 18, borderRadius: 4,
                  border: '2px solid var(--accent)',
                  background: item.is_done ? 'var(--accent)' : 'transparent',
                  cursor: 'pointer', flexShrink: 0, transition: 'var(--transition)',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  color: 'var(--text-strong)', fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-medium)',
                  textDecoration: item.is_done ? 'line-through' : 'none',
                }}>
                  {item.title}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: 2 }}>
                  {item.date}
                  {item.time && ` · ${item.time}`}
                  {item.location && ` · ${item.location}`}
                </div>
                {item.description && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: 4 }}>{item.description}</div>
                )}
              </div>
              <button
                onClick={() => deleteItem(item.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-faint)', fontSize: 16, padding: '2px 4px',
                  flexShrink: 0, transition: 'var(--transition)',
                }}
              >🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
