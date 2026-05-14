import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../hooks/useUser'
import { sendWorldcupResult } from '../lib/n8n'

interface Food {
  name: string
  category: string
  emoji: string
}

interface RoundResult {
  round: number
  winner: string
  loser: string
  winner_category: string
  loser_category: string
}

const FOOD_POOL: Food[] = [
  { name: '삼겹살',    category: '한식',   emoji: '🥩' },
  { name: '김치찌개',  category: '한식',   emoji: '🍲' },
  { name: '비빔밥',    category: '한식',   emoji: '🍚' },
  { name: '순대국밥',  category: '한식',   emoji: '🍜' },
  { name: '짜장면',    category: '중식',   emoji: '🍝' },
  { name: '짬뽕',     category: '중식',   emoji: '🌊' },
  { name: '탕수육',    category: '중식',   emoji: '🍱' },
  { name: '마라탕',    category: '중식',   emoji: '🌶️' },
  { name: '피자',     category: '양식',   emoji: '🍕' },
  { name: '스테이크',  category: '양식',   emoji: '🥩' },
  { name: '파스타',    category: '양식',   emoji: '🍝' },
  { name: '햄버거',    category: '양식',   emoji: '🍔' },
  { name: '치킨',     category: '분식',   emoji: '🍗' },
  { name: '족발',     category: '한식',   emoji: '🍖' },
  { name: '떡볶이',    category: '분식',   emoji: '🌶️' },
  { name: '아이스크림', category: '디저트', emoji: '🍦' },
]

const ROUND_LABEL: Record<number, string> = {
  1: '16강', 2: '8강', 3: '4강', 4: '결승',
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

  const totalMatches = 15
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
      const res = await sendWorldcupResult({
        user_id: profile.user_id,
        champion: champ.name,
        rounds: results,
      })
      setTopCategories(res.top_categories ?? [])
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
          <div style={{ fontSize: 88, lineHeight: 1 }}>{champion.emoji}</div>
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
      <div style={{ fontSize: 64, lineHeight: 1 }}>{food.emoji}</div>
      <div style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>{food.name}</div>
      <div style={{
        fontSize: 11, padding: '3px 12px', borderRadius: 10,
        background: '#2a2a4a', color: '#6c63ff',
      }}>{food.category}</div>
    </button>
  )
}
