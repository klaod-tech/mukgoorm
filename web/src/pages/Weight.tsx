import { useEffect, useState } from 'react'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'

interface WeightLog {
  id: string
  date: string
  weight: number
  bmi: number | null
  note: string | null
}

export default function Weight() {
  const { user, profile } = useUser()
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [loading, setLoading] = useState(true)

  async function deleteLog(id: string) {
    setLogs(prev => prev.filter(l => l.id !== id))
    await supabase.from('weight_log').delete().eq('id', id)
  }

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const { data } = await supabase
          .from('weight_log')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
        setLogs(data ?? [])
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const latest = logs[0]
  const goal = profile?.goal_weight

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--sp-6)' }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ color: 'var(--text-strong)', margin: '0 0 var(--sp-6)', fontSize: 'var(--fs-xl)' }}>⚖️ 체중 관리</h2>

      {latest && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: 'var(--sp-5)',
          marginBottom: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-8)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginBottom: 4 }}>현재 체중</div>
            <div style={{ color: 'var(--text-strong)', fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>{latest.weight} kg</div>
          </div>
          {goal && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginBottom: 4 }}>목표까지</div>
              <div style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>
                {latest.weight > goal
                  ? `-${(latest.weight - goal).toFixed(1)}`
                  : `+${(goal - latest.weight).toFixed(1)}`} kg
              </div>
            </div>
          )}
          {latest.bmi && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginBottom: 4 }}>BMI</div>
              <div style={{ color: 'var(--text-strong)', fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>{latest.bmi}</div>
            </div>
          )}
        </div>
      )}

      {logs.length === 0 ? (
        <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-base)' }}>기록된 체중이 없어요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {logs.map(log => (
            <div key={log.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: 'var(--sp-4) var(--sp-5)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{log.date}</span>
                {log.note && <span style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)', marginLeft: 'var(--sp-3)' }}>{log.note}</span>}
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
                {log.bmi && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>BMI {log.bmi}</span>}
                <span style={{ color: 'var(--text-strong)', fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)' }}>{log.weight} kg</span>
                <button
                  onClick={() => deleteLog(log.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16, padding: '2px 4px' }}
                >🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
