import { useEffect, useState } from 'react'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'

interface MealLog {
  id: string
  date: string
  meal_type: string
  food_name: string
  calories: number
}

const MEAL_LABEL: Record<string, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
  unknown: '기타',
}

export default function Meal() {
  const { user } = useUser()
  const [logs, setLogs] = useState<MealLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const { data } = await supabase
          .from('meal_log')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
        setLogs(data ?? [])
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const grouped = logs.reduce<Record<string, MealLog[]>>((acc, log) => {
    if (!acc[log.date]) acc[log.date] = []
    acc[log.date].push(log)
    return acc
  }, {})

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--sp-6)' }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ color: 'var(--text-strong)', margin: '0 0 var(--sp-6)', fontSize: 'var(--fs-xl)' }}>🍽️ 식사 기록</h2>
      {Object.keys(grouped).length === 0 ? (
        <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-base)' }}>기록된 식사가 없어요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {Object.entries(grouped).map(([date, items]) => {
            const total = items.reduce((s, i) => s + (i.calories ?? 0), 0)
            return (
              <div key={date} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: 'var(--sp-5)',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
                  <span style={{ color: 'var(--text-strong)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-md)' }}>{date}</span>
                  <span style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)' }}>총 {total} kcal</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginRight: 'var(--sp-2)' }}>
                          {MEAL_LABEL[item.meal_type] ?? item.meal_type}
                        </span>
                        <span style={{ color: 'var(--text)', fontSize: 'var(--fs-base)' }}>{item.food_name}</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{item.calories} kcal</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
