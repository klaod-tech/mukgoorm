import { useEffect, useRef, useState } from 'react'
import { useUser } from '../hooks/useUser'
import { selectCharacterImage } from '../lib/image'
import {
  classifyMessage,
  dispatchToWebhooks,
  synthesizeResponse,
  callBotWebhook,
  sendFeedback,
  type Restaurant,
  type WeatherData,
  type ClassifyResult,
} from '../lib/n8n'
import { supabase } from '../lib/supabase'
import { getTodayDiary } from '../lib/db'

interface Message {
  id: number
  role: 'user' | 'bot'
  text: string
  restaurants?: Restaurant[]
  weather?: WeatherData[]
  classified?: string[]
  failed?: string[]
}

interface Tamagotchi { hp: number; hunger: number; mood: number }

function getMealType(profile: {
  breakfast_time?: string | null
  lunch_time?: string | null
  dinner_time?: string | null
  snack_time?: string | null
}): string {
  const now = new Date()
  const current = now.getHours() * 60 + now.getMinutes()
  const toMin = (t?: string | null) => {
    if (!t) return null
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const meals: [number, string][] = (
    [
      [toMin(profile.breakfast_time), '아침'],
      [toMin(profile.lunch_time), '점심'],
      [toMin(profile.snack_time), '간식'],
      [toMin(profile.dinner_time), '저녁'],
    ] as [number | null, string][]
  )
    .filter((e): e is [number, string] => e[0] !== null)
    .sort(([a], [b]) => a - b)

  let result = '간식'
  for (const [t, label] of meals) {
    if (current >= t) result = label
  }
  return result
}

interface PendingDiaryUpdate {
  existingId: string
  existingSummary: string
  userId: string
  message: string
  classified: ClassifyResult
}

export default function Home() {
  const { user, profile } = useUser()
  const [tamagotchi, setTamagotchi] = useState<Tamagotchi | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showDiaryModal, setShowDiaryModal] = useState(false)
  const [pendingDiary, setPendingDiary] = useState<PendingDiaryUpdate | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (profile) {
      setMessages([{ id: 0, role: 'bot', text: `안녕! 나 ${profile.tamagotchi_name}이야 🌧️ 오늘 뭐 먹었어?` }])
    }
  }, [profile?.tamagotchi_name])

  useEffect(() => {
    if (!user) return
    supabase.from('tamagotchi').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setTamagotchi(data) })
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!loading) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [loading])

  const characterImage = tamagotchi
    ? selectCharacterImage('none', tamagotchi.hunger, tamagotchi.mood, tamagotchi.hp)
    : '/normal.png'

  async function handleSend() {
    if (!input.trim() || loading || !profile) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text }])
    setLoading(true)

    try {
      const classified = await classifyMessage(text)

      // 일기 충돌 여부 사전 확인 (dispatch는 항상 진행)
      let diaryConflict: { id: string; summary: string } | null = null
      if (classified.bots.includes('일기')) {
        diaryConflict = await getTodayDiary(profile.user_id, classified.date)
      }

      const combined = await dispatchToWebhooks(profile.user_id, text, classified, {
        city: profile.city ?? '',
        village: profile.village ?? '',
        meal_type: getMealType(profile),
      })

      const reply = await synthesizeResponse(
        profile.tamagotchi_name ?? '먹구름',
        text, classified, combined,
      )

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        text: reply,
        restaurants: combined.restaurants.length > 0 ? combined.restaurants : undefined,
        weather: combined.weather.length > 0 ? combined.weather : undefined,
        classified: classified.bots,
        failed: combined.failed.length > 0 ? combined.failed : undefined,
      }])

      if (diaryConflict) {
        setPendingDiary({
          existingId: diaryConflict.id,
          existingSummary: diaryConflict.summary,
          userId: profile.user_id,
          message: text,
          classified,
        })
        setShowDiaryModal(true)
      }

      if (user) {
        supabase.from('tamagotchi').select('*').eq('user_id', user.id).maybeSingle()
          .then(({ data }) => { if (data) setTamagotchi(data) })
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'bot', text: '앗, 뭔가 잘못됐어 😥 다시 말해줄래?' }])
    } finally {
      setLoading(false)
    }
  }

  async function handleDiaryOverwrite() {
    if (!pendingDiary) return
    setShowDiaryModal(false)
    try {
      await callBotWebhook(
        '/webhook/diary',
        pendingDiary.userId,
        pendingDiary.message,
        pendingDiary.classified,
        { is_update: true, diary_id: pendingDiary.existingId },
      )
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'bot',
        text: '오늘 일기를 새 내용으로 덮어썼어 📝',
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'bot',
        text: '일기 수정 실패했어 😥 n8n 연결을 확인해줘',
      }])
    } finally {
      setPendingDiary(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxWidth: 680, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 0 12px' }}>
        <img src={characterImage} alt="캐릭터" style={{ width: 100, height: 100, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />
        <div>
          <div style={{ color: '#aaa', fontSize: 13 }}>{profile?.tamagotchi_name}의 오늘</div>
          <div style={{ color: '#fff', fontSize: 15, marginTop: 4 }}>
            {loading ? '생각 중...' : '날씨, 식사, 일정, 맛집 뭐든지 물어봐 🌧️'}
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: 1, background: '#2a2a4a', marginBottom: 16 }} />

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '78%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user' ? '#6c63ff' : '#1a1a2e',
              color: '#fff', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.text}
            </div>
            {msg.role === 'bot' && msg.classified && msg.classified.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {msg.classified.map(bot => (
                  <span key={bot} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: '#2a2a4a', color: '#6c63ff', border: '1px solid #6c63ff33',
                  }}>{bot}</span>
                ))}
              </div>
            )}
            {msg.role === 'bot' && msg.failed && msg.failed.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#ff6b6b' }}>⚠️ 연결 실패:</span>
                {msg.failed.map(bot => (
                  <span key={bot} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: '#3a1a1a', color: '#ff6b6b', border: '1px solid #ff6b6b33',
                  }}>{bot}</span>
                ))}
              </div>
            )}
            {msg.weather && msg.weather.length > 0 && (
              <div style={{ marginTop: 10, width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {msg.weather.map((w, i) => (
                  <WeatherCard key={i} weather={w} />
                ))}
              </div>
            )}
            {msg.restaurants && msg.restaurants.length > 0 && (
              <div style={{ marginTop: 10, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {msg.restaurants.map((r, i) => (
                  <RestaurantCard key={i} restaurant={r} userId={profile?.user_id ?? ''} />
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <LoadingBubble elapsed={elapsed} />}
        <div ref={bottomRef} />
      </div>

      {showDiaryModal && pendingDiary && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: '#1a1a2e', borderRadius: 16, padding: 28,
            width: 340, display: 'flex', flexDirection: 'column', gap: 14,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <h3 style={{ color: '#fff', margin: 0, fontSize: 16 }}>오늘 일기가 이미 있어 📖</h3>
            <p style={{ color: '#aaa', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              기존 요약: <span style={{ color: '#ccc' }}>{pendingDiary.existingSummary}</span><br />
              새 내용으로 덮어쓸까?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowDiaryModal(false); setPendingDiary(null) }}
                style={{
                  flex: 1, background: '#16213e', border: 'none', borderRadius: 8,
                  padding: 12, color: '#fff', fontSize: 14, cursor: 'pointer',
                }}
              >취소</button>
              <button
                onClick={handleDiaryOverwrite}
                style={{
                  flex: 1, background: '#6c63ff', border: 'none', borderRadius: 8,
                  padding: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >덮어쓰기</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, paddingTop: 12, paddingBottom: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="오늘 뭐 먹었어? 날씨는? 맛집 추천해줘!"
          disabled={loading}
          style={{
            flex: 1, background: '#1a1a2e', border: '1px solid #2a2a4a',
            borderRadius: 24, padding: '12px 18px', color: '#fff', fontSize: 14, outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            background: '#6c63ff', border: 'none', borderRadius: 24,
            padding: '12px 20px', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >전송</button>
      </div>
    </div>
  )
}

function WeatherCard({ weather: w }: { weather: WeatherData }) {
  const gradeColor = (grade?: string) =>
    grade === '좋음' ? '#4caf50' : grade === '보통' ? '#f5a623' : grade === '나쁨' ? '#ff6b6b' : '#888'

  return (
    <div style={{
      background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
        🌤️ 날씨{w.sky && <span style={{ fontWeight: 400, fontSize: 13, color: '#bbb', marginLeft: 6 }}>{w.sky}</span>}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {w.temperature != null && <span style={{ fontSize: 13, color: '#fff' }}>🌡️ {w.temperature}°C</span>}
        {(w.low_temperature != null || w.high_temperature != null) && (
          <span style={{ fontSize: 12, color: '#888' }}>최저 {w.low_temperature ?? '-'}° / 최고 {w.high_temperature ?? '-'}°</span>
        )}
        {w.humidity != null && <span style={{ fontSize: 12, color: '#888' }}>💧 {w.humidity}%</span>}
        {w.windSpeed != null && <span style={{ fontSize: 12, color: '#888' }}>💨 {w.windSpeed}m/s</span>}
        {w.rain && w.rain !== '없음' && <span style={{ fontSize: 12, color: '#6c9fff' }}>🌧️ {w.rain}</span>}
      </div>
      {(w.pm10 != null || w.pm25 != null) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {w.pm10 != null && (
            <span style={{ fontSize: 12, color: gradeColor(w.pm10_grade) }}>
              미세먼지 {w.pm10}㎍/m³{w.pm10_grade && ` (${w.pm10_grade})`}
            </span>
          )}
          {w.pm25 != null && (
            <span style={{ fontSize: 12, color: gradeColor(w.pm25_grade) }}>
              초미세먼지 {w.pm25}㎍/m³{w.pm25_grade && ` (${w.pm25_grade})`}
            </span>
          )}
        </div>
      )}
      {w.message && <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{w.message}</div>}
    </div>
  )
}

function RestaurantCard({ restaurant: r, userId }: { restaurant: Restaurant; userId: string }) {
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null)

  const handleFeedback = async (type: 'like' | 'dislike') => {
    if (feedback) return
    setFeedback(type)
    try {
      await sendFeedback({
        user_id: userId,
        restaurant_id: r.restaurant_id,
        food_name: r.food_name,
        feedback: type,
      })
    } catch { /* silent */ }
  }

  return (
    <div style={{ background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{r.food_name}</div>
      <div style={{ fontSize: 12, color: '#6c63ff' }}>{r.category}</div>
      <div style={{ fontSize: 12, color: '#888' }}>{r.location}</div>
      {r.description && <div style={{ fontSize: 12, color: '#bbb', lineHeight: 1.5, marginTop: 2 }}>{r.description}</div>}
      {r.reason && <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>{r.reason}</div>}
      {r.phone && <div style={{ fontSize: 11, color: '#555' }}>📞 {r.phone}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <FeedbackBtn emoji="👍" active={feedback === 'like'} color="#4caf50" onClick={() => handleFeedback('like')} disabled={!!feedback} />
          <FeedbackBtn emoji="👎" active={feedback === 'dislike'} color="#f44336" onClick={() => handleFeedback('dislike')} disabled={!!feedback} />
        </div>
        {r.link && (
          <a href={r.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#6c63ff', textDecoration: 'none' }}>
            지도 보기 →
          </a>
        )}
      </div>
    </div>
  )
}

function FeedbackBtn({ emoji, active, color, onClick, disabled }: {
  emoji: string; active: boolean; color: string; onClick: () => void; disabled: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: active ? color : '#2a2a4a', color: '#fff', border: 'none',
      borderRadius: 6, padding: '4px 10px', cursor: disabled ? 'default' : 'pointer', fontSize: 13,
    }}>{emoji}</button>
  )
}

function LoadingBubble({ elapsed }: { elapsed: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <div style={{ background: '#1a1a2e', borderRadius: '16px 16px 16px 4px', padding: '12px 18px', display: 'flex', gap: 6, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: '#6c63ff',
            display: 'inline-block',
            animation: `chatBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      {elapsed >= 10 && (
        <div style={{ fontSize: 11, color: '#555', paddingLeft: 4 }}>맛집 검색 중이면 조금 더 걸릴 수 있어 🍽️</div>
      )}
    </div>
  )
}
