import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createUserProfile } from '../lib/db'
import TimePickerDial from '../components/TimePickerDial'

const STEPS = ['캐릭터', '위치', '신체·식단', '시간설정', '이메일']

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const villageRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    tamagotchi_name: '',
    city: '',
    village: '',
    gender: '',
    age: '',
    height: '',
    init_weight: '',
    goal_weight: '',
    food_preferences: [] as string[],
    wake_time: '07:00',
    breakfast_time: '08:00',
    lunch_time: '12:00',
    dinner_time: '19:00',
    email_provider: '네이버',
    email_address: '',
    email_app_pw: '',
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function validateStep(): string | null {
    if (step === 0 && !form.tamagotchi_name.trim())
      return '캐릭터 이름을 입력해주세요.'
    if (step === 1 && !form.city.trim())
      return '도시를 입력해주세요.'
    if (step === 1 && !form.village.trim())
      return '동 주소를 입력해주세요.'
    return null
  }

  function handleNext() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError('')
    setStep(s => s + 1)
  }

  async function handleFinish() {
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인 정보가 없어요.'); setLoading(false); return }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('저장 시간이 초과됐어요. 네트워크를 확인해주세요.')), 10000)
    )

    try {
      await Promise.race([
        createUserProfile({
          user_id: user.id,
          tamagotchi_name: form.tamagotchi_name,
          city: form.city,
          village: form.village,
          gender: form.gender,
          age: Number(form.age),
          height: Number(form.height),
          init_weight: Number(form.init_weight),
          goal_weight: Number(form.goal_weight),
          food_preferences: form.food_preferences,
          wake_time: form.wake_time,
          breakfast_time: form.breakfast_time,
          lunch_time: form.lunch_time,
          dinner_time: form.dinner_time,
          email_provider: form.email_provider,
          email_address: form.email_address || undefined,
          email_app_pw: form.email_app_pw || undefined,
        }),
        timeout,
      ])
      navigate('/worldcup')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : JSON.stringify(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-4)' }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--sp-10)',
        width: 440,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-6)',
        boxShadow: 'var(--shadow-md)',
      }}>

        {/* 진행 바 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? 'var(--accent)' : 'var(--border)',
              transition: 'var(--transition)',
            }} />
          ))}
        </div>

        <div>
          <h2 style={{ color: 'var(--text-strong)', margin: '0 0 4px', fontSize: 'var(--fs-lg)' }}>
            {step === 0 && '🐾 캐릭터 이름을 정해줘요'}
            {step === 1 && '📍 어디에 살고 있어요?'}
            {step === 2 && <span>⚖️ 신체 정보 & 식단 <span style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)', fontWeight: 400 }}>(선택)</span></span>}
            {step === 3 && '⏰ 하루 일정을 알려줘요'}
            {step === 4 && '📧 이메일 설정 (선택)'}
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 'var(--fs-sm)' }}>{STEPS[step]} 단계 ({step + 1}/{STEPS.length})</p>
        </div>

        {step === 0 && (
          <input
            placeholder="캐릭터 이름 (예: 뭉치)"
            value={form.tamagotchi_name}
            onChange={e => set('tamagotchi_name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            style={inputStyle}
            autoFocus
          />
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <input
              placeholder="도시 (예: 아산시)"
              value={form.city}
              onChange={e => set('city', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') villageRef.current?.focus() }}
              style={inputStyle}
              autoFocus
            />
            <input
              ref={villageRef}
              placeholder="동 단위 주소 (예: 탕정면)"
              value={form.village}
              onChange={e => set('village', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNext() }}
              style={inputStyle}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', margin: 0 }}>도시는 날씨, 동 주소는 맛집 추천에 사용돼요. 맛집 추천 시 별도 장소를 말하지 않으면 여기 기준으로 찾아줘요.</p>
            <div style={{
              background: 'var(--accent-soft)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--sp-3) var(--sp-4)',
              display: 'flex',
              gap: 'var(--sp-3)',
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <p style={{ color: 'var(--text)', fontSize: 'var(--fs-xs)', margin: 0, lineHeight: 'var(--lh-base)' }}>
                현재 맛집 DB는 <strong style={{ color: 'var(--accent-ink)' }}>아산시 탕정면</strong> 지역만 등록되어 있어요.<br />
                다른 지역을 입력하면 날씨는 정상 동작하지만, 맛집 추천은 결과가 없을 수 있어요.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', margin: '0 0 8px' }}>성별</p>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button onClick={() => set('gender', 'male')} style={{ ...toggleBtn, flex: 1, background: form.gender === 'male' ? 'var(--accent)' : 'var(--surface-2)', color: form.gender === 'male' ? 'var(--text-on-accent)' : 'var(--text)' }}>남성</button>
                <button onClick={() => set('gender', 'female')} style={{ ...toggleBtn, flex: 1, background: form.gender === 'female' ? 'var(--accent)' : 'var(--surface-2)', color: form.gender === 'female' ? 'var(--text-on-accent)' : 'var(--text)' }}>여성</button>
              </div>
            </div>
            <input placeholder="나이" type="number" value={form.age} onChange={e => set('age', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNext()} style={inputStyle} />
            <input placeholder="키 (cm)" type="number" value={form.height} onChange={e => set('height', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNext()} style={inputStyle} />
            <input placeholder="현재 체중 (kg)" type="number" value={form.init_weight} onChange={e => set('init_weight', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNext()} style={inputStyle} />
            <input placeholder="목표 체중 (kg)" type="number" value={form.goal_weight} onChange={e => set('goal_weight', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNext()} style={inputStyle} />
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>기상 시간</span>
              <TimePickerDial value={form.wake_time} onChange={v => set('wake_time', v)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>식사 시간</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {[
              { label: '아침 식사', key: 'breakfast_time' },
              { label: '점심 식사', key: 'lunch_time' },
              { label: '저녁 식사', key: 'dinner_time' },
            ].map(({ label, key }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{label}</span>
                <TimePickerDial
                  value={form[key as keyof typeof form] as string}
                  onChange={v => set(key, v)}
                />
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', margin: 0 }}>이메일 알림을 받으려면 입력해요. 나중에 설정에서도 변경 가능해요.</p>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              {['네이버', '구글'].map(p => (
                <button key={p} onClick={() => set('email_provider', p)} style={{ ...toggleBtn, flex: 1, background: form.email_provider === p ? 'var(--accent)' : 'var(--surface-2)', color: form.email_provider === p ? 'var(--text-on-accent)' : 'var(--text)' }}>{p}</button>
              ))}
            </div>
            <input placeholder="이메일 주소" type="email" value={form.email_address} onChange={e => set('email_address', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFinish()} style={inputStyle} />
            <input placeholder="앱 비밀번호" type="password" value={form.email_app_pw} onChange={e => set('email_app_pw', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFinish()} style={inputStyle} />
            <p style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)', margin: 0 }}>앱 비밀번호: 네이버 → 보안설정 → 2단계 인증 → 앱 비밀번호</p>
          </div>
        )}

        {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ ...secondaryBtn, flex: 1 }}>이전</button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={handleNext} style={{ ...primaryBtn, flex: 1 }}>다음</button>
          ) : (
            <button onClick={handleFinish} disabled={loading} style={{ ...primaryBtn, flex: 1, opacity: loading ? 0.7 : 1 }}>
              {loading ? '저장 중...' : '시작하기 🎉'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--sp-3) var(--sp-4)',
  color: 'var(--text)',
  fontSize: 'var(--fs-base)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  padding: 'var(--sp-3) var(--sp-5)',
  color: 'var(--text-on-accent)',
  fontSize: 'var(--fs-base)',
  fontWeight: 'var(--fw-bold)',
  cursor: 'pointer',
  boxShadow: 'var(--shadow-accent)',
  transition: 'var(--transition)',
}

const secondaryBtn: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-pill)',
  padding: 'var(--sp-3) var(--sp-5)',
  color: 'var(--text)',
  fontSize: 'var(--fs-base)',
  fontWeight: 'var(--fw-medium)',
  cursor: 'pointer',
  transition: 'var(--transition)',
}

const toggleBtn: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--sp-3)',
  fontSize: 'var(--fs-base)',
  cursor: 'pointer',
  transition: 'var(--transition)',
}
