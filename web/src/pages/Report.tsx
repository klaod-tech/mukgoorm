import { useEffect, useState } from 'react'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'

interface WeekStats {
  totalCalories: number
  mealDays: number
  mealCount: number
  topFood: string | null
  latestWeight: number | null
  weekAgoWeight: number | null
  diaryCount: number
  upcomingSchedules: { title: string; date: string }[]
  feedbackLikes: number
  feedbackDislikes: number
}

function getWeekRange() {
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  const start = new Date(now)
  start.setDate(start.getDate() - 6)
  return { start: start.toISOString().slice(0, 10), end }
}

function StatCard({ label, value, sub, color = 'var(--accent-ink)' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: 'var(--sp-5)',
      display: 'flex', flexDirection: 'column', gap: 6,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>{label}</div>
      <div style={{ color, fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>{value}</div>
      {sub && <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>{sub}</div>}
    </div>
  )
}

export default function Report() {
  const { user } = useUser()
  const [stats, setStats] = useState<WeekStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const { start, end } = getWeekRange()
    const today = new Date().toISOString().slice(0, 10)

    Promise.all([
      supabase.from('meal_log').select('*').eq('user_id', user.id)
        .gte('date', start).lte('date', end),
      supabase.from('weight_log').select('date, weight').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(10),
      supabase.from('diary').select('date').eq('user_id', user.id)
        .gte('date', start).lte('date', end),
      supabase.from('schedule').select('title, date').eq('user_id', user.id)
        .gte('date', today).order('date').limit(5),
      supabase.from('food_feedback').select('feedback').eq('user_id', user.id)
        .gte('created_at', start + 'T00:00:00'),
    ]).then(([meals, weights, diaries, schedules, feedbacks]) => {
      const mealData = meals.data ?? []
      const weightData = weights.data ?? []
      const diaryData = diaries.data ?? []
      const scheduleData = schedules.data ?? []
      const feedbackData = feedbacks.data ?? []

      const totalCalories = mealData.reduce((s, m) => s + (m.calories ?? 0), 0)
      const mealDays = new Set(mealData.map(m => m.date)).size
      const foodCounts: Record<string, number> = {}
      mealData.forEach(m => { if (m.food_name) foodCounts[m.food_name] = (foodCounts[m.food_name] ?? 0) + 1 })
      const topFood = Object.entries(foodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      const latestWeight = weightData[0]?.weight ?? null
      const latestDate = weightData[0]?.date
      const weekAgoWeight = latestDate
        ? weightData.find(w => {
            const diff = (new Date(latestDate).getTime() - new Date(w.date).getTime()) / 86400000
            return diff >= 6
          })?.weight ?? null
        : null

      const feedbackLikes = feedbackData.filter(f => f.feedback === 'like').length
      const feedbackDislikes = feedbackData.filter(f => f.feedback === 'dislike').length

      setStats({
        totalCalories,
        mealDays,
        mealCount: mealData.length,
        topFood,
        latestWeight,
        weekAgoWeight,
        diaryCount: diaryData.length,
        upcomingSchedules: scheduleData.map(s => ({ title: s.title, date: s.date })),
        feedbackLikes,
        feedbackDislikes,
      })
      setLoading(false)
    })
  }, [user])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--sp-6)' }}>리포트 생성 중...</div>
  if (!stats) return null

  const { start, end } = getWeekRange()
  const weightDiff = stats.latestWeight && stats.weekAgoWeight
    ? (stats.latestWeight - stats.weekAgoWeight).toFixed(1)
    : null

  const sectionLabel: React.CSSProperties = {
    color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-3)',
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ color: 'var(--text-strong)', margin: '0 0 4px', fontSize: 'var(--fs-xl)' }}>📊 주간 리포트</h2>
      <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-8)' }}>
        {start} ~ {end}
      </div>

      {/* 식사 */}
      <div style={{ marginBottom: 'var(--sp-8)' }}>
        <div style={sectionLabel}>🍽️ 식사</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
          <StatCard label="이번 주 섭취 칼로리" value={`${stats.totalCalories.toLocaleString()} kcal`} />
          <StatCard label="기록한 날" value={`${stats.mealDays}일`} sub={`총 ${stats.mealCount}끼`} />
          <StatCard
            label="자주 먹은 음식"
            value={stats.topFood ?? '-'}
            color={stats.topFood ? 'var(--accent-ink)' : 'var(--text-faint)'}
          />
        </div>
      </div>

      {/* 체중 */}
      <div style={{ marginBottom: 'var(--sp-8)' }}>
        <div style={sectionLabel}>⚖️ 체중</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}>
          <StatCard
            label="현재 체중"
            value={stats.latestWeight ? `${stats.latestWeight} kg` : '-'}
          />
          <StatCard
            label="이번 주 변화"
            value={weightDiff ? `${Number(weightDiff) > 0 ? '+' : ''}${weightDiff} kg` : '-'}
            color={weightDiff
              ? Number(weightDiff) <= 0 ? 'var(--success)' : 'var(--danger)'
              : 'var(--text-faint)'}
            sub={!weightDiff ? '7일 이내 비교 기록 없음' : undefined}
          />
        </div>
      </div>

      {/* 활동 */}
      <div style={{ marginBottom: 'var(--sp-8)' }}>
        <div style={sectionLabel}>📖 활동</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
          <StatCard label="일기 작성" value={`${stats.diaryCount}일`} />
          <StatCard label="맛집 추천 좋아요" value={stats.feedbackLikes} color="var(--success)" />
          <StatCard label="맛집 추천 싫어요" value={stats.feedbackDislikes} color="var(--danger)" />
        </div>
      </div>

      {/* 다가오는 일정 */}
      <div>
        <div style={sectionLabel}>📅 다가오는 일정</div>
        {stats.upcomingSchedules.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)', padding: '14px 0' }}>예정된 일정이 없어요</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {stats.upcomingSchedules.map((s, i) => (
              <div key={i} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <span style={{ color: 'var(--text)', fontSize: 'var(--fs-base)' }}>{s.title}</span>
                <span style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)' }}>{s.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
