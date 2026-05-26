import { useEffect, useState } from 'react'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'

interface WeatherLog {
  id: string
  date: string
  city: string
  temperature: number
  condition: string
  humidity: number | null
  dust_level: string | null
}

export default function Weather() {
  const { user } = useUser()
  const [logs, setLogs] = useState<WeatherLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const { data } = await supabase
          .from('weather_log')
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

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--sp-6)' }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ color: 'var(--text-strong)', margin: '0 0 var(--sp-6)', fontSize: 'var(--fs-xl)' }}>🌤️ 날씨 기록</h2>
      {logs.length === 0 ? (
        <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-base)' }}>기록된 날씨가 없어요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {logs.map(log => (
            <div key={log.id} style={{
              background: 'var(--surface-sky)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: 'var(--sp-5)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginBottom: 4 }}>
                  {log.date} · {log.city}
                </div>
                <div style={{ color: 'var(--text-strong)', fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)' }}>{log.condition}</div>
                {(log.humidity || log.dust_level) && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: 4 }}>
                    {log.humidity && `습도 ${log.humidity}%`}
                    {log.humidity && log.dust_level && ' · '}
                    {log.dust_level && `미세먼지 ${log.dust_level}`}
                  </div>
                )}
              </div>
              <div style={{ color: 'var(--sky-ink)', fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>{log.temperature}°</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
