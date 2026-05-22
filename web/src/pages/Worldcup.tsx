import { useState } from 'react'
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
  { name: '오마카세',   category: '일식',   image: '/foods/omakase.png' },
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

const ROUND_LABEL: Record<number, string> = {
  1: '64강', 2: '32강', 3: '16강', 4: '8강', 5: '4강', 6: '결승',
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function makePairs(foods: Food[]): Food[][] {
  const pairs: Food[][] = []
  for (let i = 0; i < foods.length; i += 2) pairs.push([foods[i], foods[i + 1]])
  return pairs
}

export default function Worldcup() {
  const navigate = useNavigate()
  const { profile } = useUser()

  const [pairs, setPairs] = useState<Food[][]>(() => makePairs(shuffle(FOOD_POOL)))
  const [pairIndex, setPairIndex] = useState(0)
  const [roundNumber, setRoundNumber] = useState(1)
  const [roundResults, setRoundResults] = useState<RoundResult[]>([])
  const [pendingWinners, setPendingWinners] = useState<Food[]>([])
  const [champion, setChampion] = useState<Food | null>(null)
  const [topCategories, setTopCategories] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const totalMatches = 63
  const progress = roundResults.length / totalMatches
  const currentPair = pairs[pairIndex]

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

      const deltaMap: Record<string, number> = Object.fromEntries(CATS.map(c => [c, 0]))
      results.forEach(r => {
        if (r.winner_category in deltaMap) deltaMap[r.winner_category] += 0.5
        if (r.loser_category in deltaMap) deltaMap[r.loser_category] -= 0.3
      })

      const now = new Date().toISOString()
      const rows = CATS.map(cat => ({
        user_id: userId,
        category: cat,
        logit: Math.round(((currentMap[cat]?.logit ?? 0) + deltaMap[cat]) * 1000) / 1000,
        sample_count: (currentMap[cat]?.sample_count ?? 0) + 1,
        updated_at: now,
      }))

      await Promise.all([
        supabase.from('user_preference_logits').upsert(rows, { onConflict: 'user_id,category' }),
        supabase.from('worldcup_sessions').insert({
          user_id: userId,
          champion: champ.name,
          rounds: results,
          completed: true,
        }),
      ])

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
              {ROUND_LABEL[roundNumber]}
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
