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

function StatCard({ label, value, sub, color = '#6c63ff' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: '#1a1a2e', border: '1px solid #2a2a4a',
      borderRadius: 14, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ color: '#888', fontSize: 12 }}>{label}</div>
      <div style={{ color, fontSize: 26, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ color: '#555', fontSize: 12 }}>{sub}</div>}
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
      // 이번 주 식사 기록
      supabase.from('meal_log').select('*').eq('user_id', user.id)
        .gte('date', start).lte('date', end),
      // 최근 체중 2개
      supabase.from('weight_log').select('date, weight').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(10),
      // 이번 주 일기
      supabase.from('diary').select('date').eq('user_id', user.id)
        .gte('date', start).lte('date', end),
      // 다가오는 일정
      supabase.from('schedule').select('title, date').eq('user_id', user.id)
        .gte('date', today).order('date').limit(5),
      // 음식 피드백
      supabase.from('food_feedback').select('feedback').eq('user_id', user.id)
        .gte('created_at', start + 'T00:00:00'),
    ]).then(([meals, weights, diaries, schedules, feedbacks]) => {
      const mealData = meals.data ?? []
      const weightData = weights.data ?? []
      const diaryData = diaries.data ?? []
      const scheduleData = schedules.data ?? []
      const feedbackData = feedbacks.data ?? []

      // 식사 통계
      const totalCalories = mealData.reduce((s, m) => s + (m.calories ?? 0), 0)
      const mealDays = new Set(mealData.map(m => m.date)).size
      const foodCounts: Record<string, number> = {}
      mealData.forEach(m => { if (m.food_name) foodCounts[m.food_name] = (foodCounts[m.food_name] ?? 0) + 1 })
      const topFood = Object.entries(foodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      // 체중 변화
      const latestWeight = weightData[0]?.weight ?? null
      const latestDate = weightData[0]?.date
      const weekAgoWeight = latestDate
        ? weightData.find(w => {
            const diff = (new Date(latestDate).getTime() - new Date(w.date).getTime()) / 86400000
            return diff >= 6
          })?.weight ?? null
        : null

      // 피드백 집계
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

  if (loading) return <div style={{ color: '#aaa', padding: 24 }}>리포트 생성 중...</div>
  if (!stats) return null

  const { start, end } = getWeekRange()
  const weightDiff = stats.latestWeight && stats.weekAgoWeight
    ? (stats.latestWeight - stats.weekAgoWeight).toFixed(1)
    : null

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20 }}>📊 주간 리포트</h2>
      <div style={{ color: '#555', fontSize: 13, marginBottom: 28 }}>
        {start} ~ {end}
      </div>

      {/* 식사 섹션 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>🍽️ 식사</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <StatCard label="이번 주 섭취 칼로리" value={`${stats.totalCalories.toLocaleString()} kcal`} />
          <StatCard label="기록한 날" value={`${stats.mealDays}일`} sub={`총 ${stats.mealCount}끼`} />
          <StatCard
            label="자주 먹은 음식"
            value={stats.topFood ?? '-'}
            color={stats.topFood ? '#6c63ff' : '#555'}
          />
        </div>
      </div>

      {/* 체중 섹션 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>⚖️ 체중</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <StatCard
            label="현재 체중"
            value={stats.latestWeight ? `${stats.latestWeight} kg` : '-'}
          />
          <StatCard
            label="이번 주 변화"
            value={weightDiff ? `${Number(weightDiff) > 0 ? '+' : ''}${weightDiff} kg` : '-'}
            color={weightDiff
              ? Number(weightDiff) <= 0 ? '#4caf50' : '#ff6b6b'
              : '#555'}
            sub={!weightDiff ? '7일 이내 비교 기록 없음' : undefined}
          />
        </div>
      </div>

      {/* 일기 & 피드백 섹션 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>📖 활동</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <StatCard label="일기 작성" value={`${stats.diaryCount}일`} />
          <StatCard label="맛집 추천 좋아요" value={stats.feedbackLikes} color="#4caf50" />
          <StatCard label="맛집 추천 싫어요" value={stats.feedbackDislikes} color="#ff6b6b" />
        </div>
      </div>

      {/* 다가오는 일정 */}
      <div>
        <div style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>📅 다가오는 일정</div>
        {stats.upcomingSchedules.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, padding: '14px 0' }}>예정된 일정이 없어요</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.upcomingSchedules.map((s, i) => (
              <div key={i} style={{
                background: '#1a1a2e', border: '1px solid #2a2a4a',
                borderRadius: 10, padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ color: '#fff', fontSize: 14 }}>{s.title}</span>
                <span style={{ color: '#6c63ff', fontSize: 12 }}>{s.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
