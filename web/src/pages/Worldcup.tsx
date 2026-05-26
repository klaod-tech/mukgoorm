import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'

interface Food {
  name: string
  category: string
  image: string
}

interface RoundResult {
  round: number
  winner: string
  loser: string
  winner_category: string
  loser_category: string
}

type TournamentSize = 16 | 32 | 64

const FOOD_POOL: Food[] = [
  // ── 한식 16개
  { name: '삼겹살',     category: '한식',   image: '/foods/samgyeopsal.png' },
  { name: '김치찌개',   category: '한식',   image: '/foods/kimchijjigae.png' },
  { name: '비빔밥',     category: '한식',   image: '/foods/bibimbap.png' },
  { name: '순대국밥',   category: '한식',   image: '/foods/sundaegukbap.png' },
  { name: '족발',      category: '한식',   image: '/foods/jokbal.png' },
  { name: '갈비찜',     category: '한식',   image: '/foods/galbijjim.png' },
  { name: '된장찌개',   category: '한식',   image: '/foods/doenjangjjigae.png' },
  { name: '불고기',     category: '한식',   image: '/foods/bulgogi.png' },
  { name: '닭갈비',     category: '한식',   image: '/foods/dakgalbi.png' },
  { name: '삼계탕',     category: '한식',   image: '/foods/samgyetang.png' },
  { name: '해장국',     category: '한식',   image: '/foods/haejanguk.png' },
  { name: '냉면',      category: '한식',   image: '/foods/naengmyeon.png' },
  { name: '칼국수',     category: '한식',   image: '/foods/kalguksu.png' },
  { name: '보쌈',      category: '한식',   image: '/foods/bossam.png' },
  { name: '잡채',      category: '한식',   image: '/foods/japchae.png' },
  { name: '갈비탕',     category: '한식',   image: '/foods/galbitang.png' },
  // ── 중식 8개
  { name: '짜장면',     category: '중식',   image: '/foods/jajangmyeon.png' },
  { name: '짬뽕',      category: '중식',   image: '/foods/jjambbong.png' },
  { name: '탕수육',     category: '중식',   image: '/foods/tangsuyuk.png' },
  { name: '마라탕',     category: '중식',   image: '/foods/maratang.png' },
  { name: '마파두부',   category: '중식',   image: '/foods/mapadubu.png' },
  { name: '딤섬',      category: '중식',   image: '/foods/dimsum.png' },
  { name: '깐풍기',     category: '중식',   image: '/foods/kkampunggi.png' },
  { name: '양장피',     category: '중식',   image: '/foods/yangjangpi.png' },
  // ── 양식 8개
  { name: '피자',      category: '양식',   image: '/foods/pizza.png' },
  { name: '스테이크',   category: '양식',   image: '/foods/steak.png' },
  { name: '파스타',     category: '양식',   image: '/foods/pasta.png' },
  { name: '햄버거',     category: '양식',   image: '/foods/hamburger.png' },
  { name: '리조또',     category: '양식',   image: '/foods/risotto.png' },
  { name: '바비큐립',   category: '양식',   image: '/foods/bbqrib.png' },
  { name: '샐러드',     category: '양식',   image: '/foods/salad.png' },
  { name: '클럽샌드위치', category: '양식',  image: '/foods/clubsandwich.png' },
  // ── 분식 8개
  { name: '치킨',      category: '분식',   image: '/foods/chicken.png' },
  { name: '떡볶이',     category: '분식',   image: '/foods/tteokbokki.png' },
  { name: '순대',      category: '분식',   image: '/foods/sundae.png' },
  { name: '어묵',      category: '분식',   image: '/foods/eomuk.png' },
  { name: '라면',      category: '분식',   image: '/foods/ramyeon.png' },
  { name: '김밥',      category: '분식',   image: '/foods/gimbap.png' },
  { name: '핫도그',     category: '분식',   image: '/foods/hotdog.png' },
  { name: '붕어빵',     category: '분식',   image: '/foods/bungeoppang.png' },
  // ── 일식 8개
  { name: '초밥',      category: '일식',   image: '/foods/chobap.png' },
  { name: '라멘',      category: '일식',   image: '/foods/ramen.png' },
  { name: '우동',      category: '일식',   image: '/foods/udong.png' },
  { name: '돈까스',     category: '일식',   image: '/foods/donkkaseu.png' },
  { name: '타코야키',   category: '일식',   image: '/foods/takoyaki.png' },
  { name: '텐동',      category: '일식',   image: '/foods/tendon.png' },
  { name: '야키토리',   category: '일식',   image: '/foods/yakitori.png' },
  { name: '가츠동',     category: '일식',   image: '/foods/katsudon.png' },
  // ── 디저트 8개
  { name: '아이스크림',  category: '디저트', image: '/foods/icecream.png' },
  { name: '케이크',     category: '디저트', image: '/foods/cake.png' },
  { name: '마카롱',     category: '디저트', image: '/foods/macaron.png' },
  { name: '와플',      category: '디저트', image: '/foods/waffle.png' },
  { name: '빙수',      category: '디저트', image: '/foods/bingsu.png' },
  { name: '타르트',     category: '디저트', image: '/foods/tart.png' },
  { name: '크레이프',   category: '디저트', image: '/foods/crepe.png' },
  { name: '도넛',      category: '디저트', image: '/foods/donut.png' },
  // ── 기타 8개
  { name: '쌀국수',     category: '기타',   image: '/foods/pho.png' },
  { name: '팟타이',     category: '기타',   image: '/foods/padthai.png' },
  { name: '인도카레',   category: '기타',   image: '/foods/indiancurry.png' },
  { name: '타코',      category: '기타',   image: '/foods/taco.png' },
  { name: '케밥',      category: '기타',   image: '/foods/kebab.png' },
  { name: '훠궈',      category: '기타',   image: '/foods/huoguo.png' },
  { name: '곱창',      category: '기타',   image: '/foods/gobchang.png' },
  { name: '감바스',     category: '기타',   image: '/foods/gambas.png' },
]

const ROUND_LABELS: Record<TournamentSize, Record<number, string>> = {
  64: { 1: '64강', 2: '32강', 3: '16강', 4: '8강', 5: '4강', 6: '결승' },
  32: { 1: '32강', 2: '16강', 3: '8강', 4: '4강', 5: '결승' },
  16: { 1: '16강', 2: '8강', 3: '4강', 4: '결승' },
}

const TOTAL_MATCHES: Record<TournamentSize, number> = { 64: 63, 32: 31, 16: 15 }

// 카테고리별 비율 유지하며 N개 선택 (한식 25%, 나머지 각 12.5%)
function buildFoodPool(size: TournamentSize): Food[] {
  if (size === 64) return shuffle(FOOD_POOL)

  const groups: Record<string, Food[]> = {}
  FOOD_POOL.forEach(f => {
    if (!groups[f.category]) groups[f.category] = []
    groups[f.category].push(f)
  })

  const ratio = size / FOOD_POOL.length
  const result: Food[] = []
  Object.values(groups).forEach(foods => {
    const count = Math.round(foods.length * ratio)
    result.push(...shuffle(foods).slice(0, count))
  })
  return shuffle(result)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makePairs(foods: Food[]): Food[][] {
  const pairs: Food[][] = []
  for (let i = 0; i < foods.length; i += 2) pairs.push([foods[i], foods[i + 1]])
  return pairs
}

const SIZE_OPTIONS: { size: TournamentSize; label: string; desc: string; time: string }[] = [
  { size: 16, label: '16강', desc: '15번 선택', time: '약 3분' },
  { size: 32, label: '32강', desc: '31번 선택', time: '약 7분' },
  { size: 64, label: '64강', desc: '63번 선택', time: '약 15분' },
]

export default function Worldcup() {
  const navigate = useNavigate()
  const { profile } = useUser()

  const [checking, setChecking] = useState(true)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [previousChampion, setPreviousChampion] = useState<string | null>(null)

  const [tournamentSize, setTournamentSize] = useState<TournamentSize | null>(null)
  const [pairs, setPairs] = useState<Food[][]>([])
  const [pairIndex, setPairIndex] = useState(0)
  const [roundNumber, setRoundNumber] = useState(1)
  const [roundResults, setRoundResults] = useState<RoundResult[]>([])
  const [pendingWinners, setPendingWinners] = useState<Food[]>([])
  const [champion, setChampion] = useState<Food | null>(null)
  const [topCategories, setTopCategories] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!profile) return
    async function checkCompleted() {
      const { data } = await supabase
        .from('worldcup_sessions')
        .select('champion')
        .eq('user_id', profile!.user_id)
        .eq('completed', true)
        .limit(1)
      if (data && data.length > 0) {
        setAlreadyCompleted(true)
        setPreviousChampion(data[0].champion)
      }
      setChecking(false)
    }
    checkCompleted()
  }, [profile])

  function startTournament(size: TournamentSize) {
    const pool = buildFoodPool(size)
    setTournamentSize(size)
    setPairs(makePairs(pool))
    setPairIndex(0)
    setRoundNumber(1)
    setRoundResults([])
    setPendingWinners([])
  }

  async function handlePick(winner: Food, loser: Food) {
    const result: RoundResult = {
      round: roundNumber,
      winner: winner.name,
      loser: loser.name,
      winner_category: winner.category,
      loser_category: loser.category,
    }
    const newResults = [...roundResults, result]
    const newWinners = [...pendingWinners, winner]
    const isLastPair = pairIndex === pairs.length - 1

    if (isLastPair) {
      if (newWinners.length === 1) {
        setChampion(newWinners[0])
        setRoundResults(newResults)
        await handleComplete(newResults, newWinners[0])
      } else {
        setPairs(makePairs(newWinners))
        setPairIndex(0)
        setRoundNumber(r => r + 1)
        setRoundResults(newResults)
        setPendingWinners([])
      }
    } else {
      setPairIndex(p => p + 1)
      setRoundResults(newResults)
      setPendingWinners(newWinners)
    }
  }

  async function handleComplete(results: RoundResult[], champ: Food) {
    if (!profile) { navigate('/'); return }
    setSubmitting(true)
    try {
      const userId = profile.user_id
      const CATS = ['한식', '중식', '양식', '분식', '일식', '디저트', '기타']

      const { data: currentLogits } = await supabase
        .from('user_preference_logits')
        .select('category, logit, sample_count')
        .eq('user_id', userId)

      const currentMap: Record<string, { logit: number; sample_count: number }> = {}
      currentLogits?.forEach(r => {
        currentMap[r.category] = { logit: r.logit ?? 0, sample_count: r.sample_count ?? 0 }
      })

      // 초기 데이터 수집용이므로 낮은 점수 적용: 승리 +0.3, 탈락 -0.1
      const deltaMap: Record<string, number> = Object.fromEntries(CATS.map(c => [c, 0]))
      const matchCountMap: Record<string, number> = Object.fromEntries(CATS.map(c => [c, 0]))
      results.forEach(r => {
        if (r.winner_category in deltaMap) {
          deltaMap[r.winner_category] += 0.3
          matchCountMap[r.winner_category] += 1
        }
        if (r.loser_category in deltaMap) {
          deltaMap[r.loser_category] -= 0.1
          matchCountMap[r.loser_category] += 1
        }
      })

      const now = new Date().toISOString()
      const rows = CATS.map(cat => {
        const raw = (currentMap[cat]?.logit ?? 0) + deltaMap[cat]
        return {
          user_id: userId,
          category: cat,
          logit: Math.max(-10, Math.min(10, Math.round(raw * 1000) / 1000)),
          sample_count: (currentMap[cat]?.sample_count ?? 0) + matchCountMap[cat],
          updated_at: now,
        }
      })

      const [logitResult, sessionResult] = await Promise.all([
        supabase.from('user_preference_logits').upsert(rows, { onConflict: 'user_id,category' }),
        supabase.from('worldcup_sessions').insert({
          user_id: userId,
          champion: champ.name,
          rounds: results,
          completed: true,
        }),
      ])

      if (logitResult.error) throw new Error(`점수 저장 실패: ${logitResult.error.message}`)
      if (sessionResult.error) throw new Error(`결과 저장 실패: ${sessionResult.error.message}`)

      const T = 1.5, EPS = 0.1, K = 7
      let expSum = 0
      const expMap: Record<string, number> = {}
      rows.forEach(r => { expMap[r.category] = Math.exp(r.logit / T); expSum += expMap[r.category] })
      const top = Object.entries(expMap)
        .map(([cat, exp]) => ({ cat, p: (1 - EPS) * exp / expSum + EPS / K }))
        .sort((a, b) => b.p - a.p)
        .slice(0, 3)
        .map(e => e.cat)

      setTopCategories(top)
    } catch {
      // 실패해도 결과 화면은 보여줌
    } finally {
      setSubmitting(false)
    }
  }

  // ── 로딩 화면 ────────────────────────────────────────────────
  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f23', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#555', fontSize: 14 }}>확인 중...</div>
      </div>
    )
  }

  // ── 이미 완료 화면 ──────────────────────────────────────────
  if (alreadyCompleted) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f0f23',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div style={{ fontSize: 48 }}>🏆</div>
          <div>
            <div style={{ color: '#6c63ff', fontSize: 13, marginBottom: 8, letterSpacing: 1 }}>이미 완료한 월드컵</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>
              {previousChampion ? `${previousChampion}이(가) 우승했어요!` : '월드컵을 완료했어요'}
            </div>
            <div style={{ color: '#555', fontSize: 13, marginTop: 10, lineHeight: 1.8 }}>
              월드컵은 한 번만 참여할 수 있어요.<br />
              이후 취향은 음식 추천과 피드백으로 쌓여요 🌧️
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              background: '#6c63ff', border: 'none', borderRadius: 16,
              padding: '14px 48px', color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            먹구름 만나러 가기 →
          </button>
        </div>
      </div>
    )
  }

  // ── 강 선택 화면 ─────────────────────────────────────────────
  if (!tournamentSize) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f0f23',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ color: '#6c63ff', fontSize: 13, marginBottom: 10, letterSpacing: 1 }}>음식 이상형 월드컵</div>
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>몇 강으로 할까요?</div>
          <div style={{ color: '#555', fontSize: 13, marginTop: 8 }}>
            한 번만 참여할 수 있어요. 신중하게 골라봐요!
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 340 }}>
          {SIZE_OPTIONS.map(({ size, label, time }) => (
            <button
              key={size}
              onClick={() => startTournament(size)}
              style={{
                background: '#1a1a2e', border: '2px solid #2a2a4a',
                borderRadius: 16, padding: '20px 24px',
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#6c63ff')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a4a')}
            >
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{label}</div>
              <div style={{ color: '#6c63ff', fontSize: 13 }}>{time}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const totalMatches = TOTAL_MATCHES[tournamentSize]
  const roundLabel = ROUND_LABELS[tournamentSize]
  const progress = roundResults.length / totalMatches
  const currentPair = pairs[pairIndex]

  // ── 결과 화면 ────────────────────────────────────────────────
  if (champion) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f0f23',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
          <img src={champion.image} alt={champion.name} style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 24, boxShadow: '0 0 40px #6c63ff66' }} />
          <div>
            <div style={{ color: '#6c63ff', fontSize: 13, marginBottom: 8, letterSpacing: 1 }}>🏆 최종 우승</div>
            <div style={{ color: '#fff', fontSize: 34, fontWeight: 800 }}>{champion.name}</div>
            <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>{champion.category}</div>
          </div>

          {topCategories.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ color: '#aaa', fontSize: 13 }}>선호 카테고리 TOP 3</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {topCategories.map((cat, i) => (
                  <span key={cat} style={{
                    padding: '6px 16px', borderRadius: 20, fontSize: 13,
                    background: i === 0 ? '#6c63ff' : '#2a2a4a',
                    color: '#fff', fontWeight: i === 0 ? 700 : 400,
                  }}>
                    {i === 0 ? '👑 ' : ''}{cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{
            color: '#666', fontSize: 13, maxWidth: 280,
            lineHeight: 1.8, background: '#1a1a2e',
            borderRadius: 12, padding: '14px 20px',
          }}>
            이 결과로 나만의 AI 캐릭터가 만들어지고 있어요 🌧️<br />
            하루 뒤 큐브가 진화할 거예요!
          </div>

          <button
            onClick={() => navigate('/')}
            disabled={submitting}
            style={{
              background: '#6c63ff', border: 'none', borderRadius: 16,
              padding: '14px 48px', color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? '저장 중...' : '먹구름 만나러 가기 →'}
          </button>
        </div>
      </div>
    )
  }

  // ── 대결 화면 ────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f23',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      {/* 헤더 */}
      <div style={{ width: '100%', maxWidth: 500, marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            음식 이상형 월드컵
            <span style={{ color: '#6c63ff', marginLeft: 8, fontSize: 14 }}>
              {roundLabel[roundNumber]}
            </span>
          </div>
          <div style={{ color: '#555', fontSize: 13 }}>
            {roundResults.length} / {totalMatches}
          </div>
        </div>
        <div style={{ width: '100%', height: 5, background: '#1a1a2e', borderRadius: 3 }}>
          <div style={{
            width: `${progress * 100}%`, height: '100%',
            background: 'linear-gradient(90deg, #6c63ff, #9c92ff)',
            borderRadius: 3, transition: 'width 0.35s ease',
          }} />
        </div>
        <div style={{ color: '#555', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          먹고 싶은 음식을 골라줘!
        </div>
      </div>

      {/* 대결 카드 */}
      <div style={{ width: '100%', maxWidth: 500, display: 'flex', alignItems: 'center', gap: 16 }}>
        <FoodCard food={currentPair[0]} onPick={() => handlePick(currentPair[0], currentPair[1])} />
        <div style={{
          color: '#6c63ff', fontWeight: 800, fontSize: 22,
          flexShrink: 0, textShadow: '0 0 20px #6c63ff88',
        }}>VS</div>
        <FoodCard food={currentPair[1]} onPick={() => handlePick(currentPair[1], currentPair[0])} />
      </div>
    </div>
  )
}

function FoodCard({ food, onPick }: { food: Food; onPick: () => void }) {
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onPick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        flex: 1,
        background: pressed ? '#252545' : '#1a1a2e',
        border: `2px solid ${pressed ? '#6c63ff' : '#2a2a4a'}`,
        borderRadius: 20, padding: '36px 12px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        transition: 'all 0.12s',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        boxShadow: pressed ? '0 0 24px #6c63ff44' : 'none',
      }}
    >
      <img src={food.image} alt={food.name} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 16 }} />
      <div style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>{food.name}</div>
      <div style={{
        fontSize: 11, padding: '3px 12px', borderRadius: 10,
        background: '#2a2a4a', color: '#6c63ff',
      }}>{food.category}</div>
    </button>
  )
}
