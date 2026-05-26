import { useEffect, useRef, useState } from 'react'
import { useUser } from '../hooks/useUser'
import { selectCharacterImage } from '../lib/image'
import { getCharacterGen, resumeOrStartGeneration, type CharacterGen } from '../lib/characterGen'
import {
  classifyMessage,
  dispatchToWebhooks,
  synthesizeResponse,
  callBotWebhook,
  recommendFood,
  selectFood,
  sendFeedback,
  type Restaurant,
  type WeatherData,
  type MenuItem,
  type ClassifyResult,
  type IntentPath,
  type CombinedResponse,
} from '../lib/n8n'
import { supabase } from '../lib/supabase'
import { getTodayDiary } from '../lib/db'

// ── 타입 ──────────────────────────────────────────────────────────

interface Message {
  id: number
  role: 'user' | 'bot'
  text: string
  restaurants?: Restaurant[]
  weather?: WeatherData[]
  classified?: string[]
  failed?: string[]
  food_path?: IntentPath
  food_description?: string
}

interface Tamagotchi { hp: number; hunger: number; mood: number }

interface MenuState {
  restaurant: Restaurant
  menus: MenuItem[]
  loading: boolean
  selected: string | null
}

interface PendingDiaryUpdate {
  existingId: string
  existingSummary: string
  userId: string
  message: string
  classified: ClassifyResult
}

// ── 유틸 ──────────────────────────────────────────────────────────

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

// ── 메인 컴포넌트 ─────────────────────────────────────────────────

// 큐브 진화 상태
type EvoState = 'checking' | 'no_worldcup' | 'cube' | 'evolved'

export default function Home() {
  const { user, profile } = useUser()
  const [tamagotchi, setTamagotchi] = useState<Tamagotchi | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showDiaryModal, setShowDiaryModal] = useState(false)
  const [pendingDiary, setPendingDiary] = useState<PendingDiaryUpdate | null>(null)
  const [menuState, setMenuState] = useState<MenuState | null>(null)
  const [evoState, setEvoState] = useState<EvoState>('checking')
  const [charGen, setCharGen] = useState<CharacterGen | null>(null)
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

    // 월드컵 완료 여부 + 캐릭터 생성 상태 확인
    ;(async () => {
      const { data: session } = await supabase
        .from('worldcup_sessions')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!session) { setEvoState('no_worldcup'); return }

      const gen = await getCharacterGen(user.id)
      setCharGen(gen)

      if (gen?.status === 'done') {
        setEvoState('evolved')
      } else {
        setEvoState('cube')
        // 생성 시작 or 이어서 — 백그라운드에서 실행
        const { data: logits } = await supabase
          .from('user_preference_logits')
          .select('category, logit')
          .eq('user_id', user.id)
          .order('logit', { ascending: false })
          .limit(1)
        const topCategory = logits?.[0]?.category ?? '한식'

        resumeOrStartGeneration(user.id, topCategory).then(async () => {
          const updated = await getCharacterGen(user.id)
          setCharGen(updated)
          if (updated?.status === 'done') setEvoState('evolved')
        })
      }
    })()
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!loading) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [loading])

  const characterImage = (() => {
    if (evoState === 'checking') return '/cube.png'
    if (evoState === 'no_worldcup') return '/cube.png'
    if (evoState === 'cube') return '/cube.png'
    const generated = {
      normal: charGen?.normal_url,
      happy:  charGen?.happy_url,
      tired:  charGen?.tired_url,
      eating: charGen?.eating_url,
    }
    return tamagotchi
      ? selectCharacterImage('none', tamagotchi.hunger, tamagotchi.mood, tamagotchi.hp, generated)
      : (charGen?.normal_url ?? '/normal.png')
  })()

  // ── 메시지 전송 ──────────────────────────────────────────────

  async function handleSend() {
    if (!input.trim() || loading || !profile) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text }])
    setLoading(true)

    try {
      const classified = await classifyMessage(text)

      let diaryConflict: { id: string; summary: string } | null = null
      if (classified.bots.includes('일기')) {
        diaryConflict = await getTodayDiary(profile.user_id, classified.date)
      }

      const hasFood = classified.bots.includes('음식추천')
      const nonFoodClassified = { ...classified, bots: classified.bots.filter(b => b !== '음식추천') }

      const [dispatchResult, foodResult] = await Promise.allSettled([
        nonFoodClassified.bots.length > 0
          ? dispatchToWebhooks(profile.user_id, text, nonFoodClassified, {
              city: profile.city ?? '',
              village: profile.village ?? '',
              meal_type: getMealType(profile),
            })
          : Promise.resolve<CombinedResponse>({ messages: [], restaurants: [], weather: [], failed: [] }),
        hasFood
          ? recommendFood({
              user_id: profile.user_id,
              message: text,
              location: profile.village ?? '',
              date: classified.date,
            })
          : Promise.resolve(null),
      ])

      const combined: CombinedResponse = dispatchResult.status === 'fulfilled'
        ? dispatchResult.value
        : { messages: [], restaurants: [], weather: [], failed: [...nonFoodClassified.bots] }

      if (hasFood) {
        if (foodResult.status === 'fulfilled' && foodResult.value) {
          const food = foodResult.value
          combined.messages.push(food.message)
          combined.restaurants.push(...food.restaurants)
          combined.food_path = food.path
          combined.food_description = food.description
        } else {
          combined.failed.push('음식추천')
        }
      }

      const reply = await synthesizeResponse(
        profile.tamagotchi_name ?? '먹구름',
        text, classified, combined,
      )

      const botMsg: Message = {
        id: Date.now() + 1,
        role: 'bot',
        text: reply,
        restaurants: combined.restaurants.length > 0 ? combined.restaurants : undefined,
        weather: combined.weather.length > 0 ? combined.weather : undefined,
        classified: classified.bots,
        failed: combined.failed.length > 0 ? combined.failed : undefined,
        food_path: combined.food_path,
        food_description: combined.food_description,
      }
      setMessages(prev => [...prev, botMsg])

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

  // ── 식당 붐업/붐다운 → 로짓 업데이트 ────────────────────────

  async function handleRestaurantFeedback(restaurant: Restaurant, feedback: 'like' | 'dislike') {
    if (!profile) return
    try {
      await sendFeedback({
        user_id: profile.user_id,
        restaurant_id: restaurant.restaurant_id,
        food_name: restaurant.food_name,
        category: restaurant.category,
        feedback,
      })
    } catch { /* silent — 피드백 실패는 UX 방해 안 함 */ }
  }

  // ── 2단계: 식당 선택 → 메뉴 조회 ────────────────────────────

  function handleMenuRequest(restaurant: Restaurant) {
    setMenuState({
      restaurant,
      menus: restaurant.menus ?? [],
      loading: false,
      selected: null,
    })
  }

  // ── 3단계: 메뉴 선택 → 기록 저장 ────────────────────────────

  async function handleMenuSelect(menuName: string) {
    if (!menuState || !profile) return
    const { restaurant } = menuState
    const selectedMenu = menuState.menus.find(m => m.menu_name === menuName)
    setMenuState(prev => prev ? { ...prev, selected: menuName } : null)

    try {
      await selectFood({
        user_id: profile.user_id,
        restaurant_id: restaurant.restaurant_id,
        menu_name: menuName,
        keywords: selectedMenu?.keywords ?? [],
        location: profile.village ?? '',
        date: new Date().toISOString().slice(0, 10),
      })
      setMenuState(null)
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'bot',
        text: `${restaurant.food_name}에서 ${menuName} 선택했구나 🍽️ 맛있게 먹어!`,
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'bot',
        text: '기록 저장에 실패했어 😥',
      }])
    }
  }

  // ── 일기 덮어쓰기 ────────────────────────────────────────────

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
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: '오늘 일기를 새 내용으로 덮어썼어 📝' }])
    } catch {
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: '일기 수정 실패했어 😥 n8n 연결을 확인해줘' }])
    } finally {
      setPendingDiary(null)
    }
  }

  // ── 렌더 ─────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxWidth: 680, margin: '0 auto' }}>

      {/* 캐릭터 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 0 12px' }}>
        <img src={characterImage} alt="캐릭터" style={{ width: 100, height: 100, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />
        <div>
          <div style={{ color: '#aaa', fontSize: 13 }}>{profile?.tamagotchi_name}의 오늘</div>
          <div style={{ color: '#fff', fontSize: 15, marginTop: 4 }}>
            {loading
              ? '생각 중...'
              : evoState === 'checking'
                ? '불러오는 중...'
                : evoState === 'no_worldcup'
                  ? '월드컵을 완료해야 캐릭터가 태어나요 🥚'
                  : evoState === 'cube'
                    ? 'AI가 나만의 캐릭터를 만드는 중... 🌀'
                    : '날씨, 식사, 일정, 맛집 뭐든지 물어봐 🌧️'}
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: 1, background: '#2a2a4a', marginBottom: 16 }} />

      {/* 채팅 영역 */}
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

            {/* 분류 태그 */}
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

            {/* 실패 태그 */}
            {msg.role === 'bot' && msg.failed && msg.failed.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#ff6b6b' }}>⚠️ 연결 실패:</span>
                {msg.failed.map(bot => (
                  <span key={bot} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: '#3a1a1a', color: '#ff6b6b', border: '1px solid #ff6b6b33',
                  }}>{bot}</span>
                ))}
              </div>
            )}

            {/* 날씨 카드 */}
            {msg.weather && msg.weather.length > 0 && (
              <div style={{ marginTop: 10, width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {msg.weather.map((w, i) => <WeatherCard key={i} weather={w} />)}
              </div>
            )}

            {/* 음식 추천 경로 설명 */}
            {msg.food_description && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 6, paddingLeft: 2 }}>
                {msg.food_path === 'A' && '🎯 '}
                {msg.food_path === 'B' && '🔍 '}
                {msg.food_path === 'C' && '✨ '}
                {msg.food_description}
              </div>
            )}

            {/* 식당 카드 — v2 메뉴 흐름 연결 */}
            {msg.restaurants && msg.restaurants.length > 0 && (
              <div style={{ marginTop: 10, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {msg.restaurants.map((r, i) => (
                  <RestaurantCard
                    key={i}
                    restaurant={r}
                    onMenuRequest={handleMenuRequest}
                    onFeedback={handleRestaurantFeedback}
                    isMenuOpen={menuState?.restaurant.restaurant_id === r.restaurant_id}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <LoadingBubble elapsed={elapsed} />}
        <div ref={bottomRef} />
      </div>

      {/* 메뉴 패널 (식당 선택 후 표시) */}
      {menuState && (
        <MenuPanel
          state={menuState}
          onMenuSelect={handleMenuSelect}
          onClose={() => setMenuState(null)}
        />
      )}

      {/* 일기 덮어쓰기 모달 */}
      {showDiaryModal && pendingDiary && (
        <ModalOverlay>
          <div style={{ background: '#1a1a2e', borderRadius: 16, padding: 28, width: 340, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: '#fff', margin: 0, fontSize: 16 }}>오늘 일기가 이미 있어 📖</h3>
            <p style={{ color: '#aaa', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              기존 요약: <span style={{ color: '#ccc' }}>{pendingDiary.existingSummary}</span><br />
              새 내용으로 덮어쓸까?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <GhostBtn onClick={() => { setShowDiaryModal(false); setPendingDiary(null) }}>취소</GhostBtn>
              <PrimaryBtn onClick={handleDiaryOverwrite}>덮어쓰기</PrimaryBtn>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 입력창 */}
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

// ── 서브 컴포넌트 ─────────────────────────────────────────────────

function RestaurantCard({
  restaurant: r,
  onMenuRequest,
  onFeedback,
  isMenuOpen,
}: {
  restaurant: Restaurant
  onMenuRequest: (r: Restaurant) => void
  onFeedback: (r: Restaurant, feedback: 'like' | 'dislike') => void
  isMenuOpen: boolean
}) {
  const [voted, setVoted] = useState<'like' | 'dislike' | null>(null)

  function handleVote(f: 'like' | 'dislike') {
    if (voted) return
    setVoted(f)
    onFeedback(r, f)
  }

  return (
    <div style={{
      background: isMenuOpen ? '#1e1e3a' : '#16213e',
      border: `1px solid ${isMenuOpen ? '#6c63ff' : '#2a2a4a'}`,
      borderRadius: 12, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 4,
      transition: 'border-color 0.15s',
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{r.food_name}</div>
      <div style={{ fontSize: 12, color: '#6c63ff' }}>{r.category}</div>
      <div style={{ fontSize: 12, color: '#888' }}>{r.location}</div>
      {r.description && <div style={{ fontSize: 12, color: '#bbb', lineHeight: 1.5, marginTop: 2 }}>{r.description}</div>}
      {r.reason && <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>{r.reason}</div>}
      {r.phone && <div style={{ fontSize: 11, color: '#555' }}>📞 {r.phone}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <button
          onClick={() => onMenuRequest(r)}
          style={{
            background: isMenuOpen ? '#6c63ff' : '#2a2a4a',
            border: 'none', borderRadius: 8, padding: '6px 12px',
            color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}
        >
          {isMenuOpen ? '메뉴 보는 중' : '메뉴 보기 →'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {r.link && (
            <a href={r.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#555', textDecoration: 'none' }}>
              지도 →
            </a>
          )}
          <button
            onClick={() => handleVote('like')}
            disabled={!!voted}
            style={{
              background: voted === 'like' ? '#1a4a1a' : 'none',
              border: `1px solid ${voted === 'like' ? '#4caf50' : '#2a2a4a'}`,
              borderRadius: 8, padding: '4px 8px',
              color: voted === 'like' ? '#6ddf70' : '#555',
              fontSize: voted === 'like' ? 15 : 13,
              cursor: voted ? 'default' : 'pointer',
              boxShadow: voted === 'like' ? '0 0 8px #4caf5088' : 'none',
              transition: 'all 0.2s',
            }}
          >👍</button>
          <button
            onClick={() => handleVote('dislike')}
            disabled={!!voted}
            style={{
              background: voted === 'dislike' ? '#4a1a1a' : 'none',
              border: `1px solid ${voted === 'dislike' ? '#ff6b6b' : '#2a2a4a'}`,
              borderRadius: 8, padding: '4px 8px',
              color: voted === 'dislike' ? '#ff9090' : '#555',
              fontSize: voted === 'dislike' ? 15 : 13,
              cursor: voted ? 'default' : 'pointer',
              boxShadow: voted === 'dislike' ? '0 0 8px #ff6b6b88' : 'none',
              transition: 'all 0.2s',
            }}
          >👎</button>
        </div>
      </div>
    </div>
  )
}

function MenuPanel({
  state,
  onMenuSelect,
  onClose,
}: {
  state: MenuState
  onMenuSelect: (menuName: string) => void
  onClose: () => void
}) {
  const { restaurant, menus, loading, selected } = state

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      width: 'min(680px, 96vw)',
      background: '#0f0f1e', border: '1px solid #2a2a4a',
      borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
      zIndex: 50, maxHeight: '55vh', display: 'flex', flexDirection: 'column',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #2a2a4a' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{restaurant.food_name}</div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{restaurant.location}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
      </div>

      {/* 메뉴 목록 */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <div style={{ color: '#aaa', fontSize: 14, textAlign: 'center', paddingTop: 20 }}>메뉴 불러오는 중...</div>}
        {!loading && menus.length === 0 && (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', paddingTop: 20 }}>등록된 메뉴 정보가 없어요</div>
        )}
        {menus.map(menu => (
          <MenuItemRow
            key={menu.id}
            menu={menu}
            isSelected={selected === menu.menu_name}
            onSelect={() => onMenuSelect(menu.menu_name)}
          />
        ))}
      </div>
    </div>
  )
}

function MenuItemRow({ menu, isSelected, onSelect }: { menu: MenuItem; isSelected: boolean; onSelect: () => void }) {
  return (
    <div style={{
      background: isSelected ? '#1e1e3a' : '#16213e',
      border: `1px solid ${isSelected ? '#6c63ff' : '#2a2a4a'}`,
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{menu.menu_name}</div>
        {menu.description && <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{menu.description}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {menu.tags?.map(tag => (
            <span key={tag} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: '#2a2a4a', color: '#6c63ff' }}>{tag}</span>
          ))}
          {menu.keywords?.map(kw => (
            <span key={kw} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: '#1a2a3a', color: '#63b3ff' }}>{kw}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 12 }}>
        {menu.price != null && (
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {menu.price.toLocaleString()}원
          </div>
        )}
        <button
          onClick={onSelect}
          disabled={isSelected}
          style={{
            background: isSelected ? '#2a2a4a' : '#6c63ff',
            border: 'none', borderRadius: 8, padding: '6px 14px',
            color: isSelected ? '#6c63ff' : '#fff', fontSize: 12,
            cursor: isSelected ? 'default' : 'pointer', fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {isSelected ? '선택됨 ✓' : '선택'}
        </button>
      </div>
    </div>
  )
}

function WeatherCard({ weather: w }: { weather: WeatherData }) {
  const gradeColor = (grade?: string) =>
    grade === '좋음' ? '#4caf50' : grade === '보통' ? '#f5a623' : grade === '나쁨' ? '#ff6b6b' : '#888'

  return (
    <div style={{ background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          {w.pm10 != null && <span style={{ fontSize: 12, color: gradeColor(w.pm10_grade) }}>미세먼지 {w.pm10}㎍/m³{w.pm10_grade && ` (${w.pm10_grade})`}</span>}
          {w.pm25 != null && <span style={{ fontSize: 12, color: gradeColor(w.pm25_grade) }}>초미세먼지 {w.pm25}㎍/m³{w.pm25_grade && ` (${w.pm25_grade})`}</span>}
        </div>
      )}
      {w.message && <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{w.message}</div>}
    </div>
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
      {elapsed >= 10 && <div style={{ fontSize: 11, color: '#555', paddingLeft: 4 }}>맛집 검색 중이면 조금 더 걸릴 수 있어 🍽️</div>}
    </div>
  )
}

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      {children}
    </div>
  )
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ flex: 1, background: '#16213e', border: 'none', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ flex: 1, background: '#6c63ff', border: 'none', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
      {children}
    </button>
  )
}
