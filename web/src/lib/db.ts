import { supabase } from './supabase'

export async function getUserProfile(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

const LOGIT_CATEGORIES = ['한식', '중식', '양식', '분식', '일식', '디저트', '기타'] as const

export async function createUserProfile(profile: {
  user_id: string
  tamagotchi_name: string
  city: string
  village: string
  gender: string
  age: number
  height: number
  init_weight: number
  goal_weight: number
  food_preferences: string[]
  wake_time: string
  breakfast_time: string
  lunch_time: string
  dinner_time: string
  snack_time?: string
  email_provider?: string
  email_address?: string
  email_app_pw?: string
}) {
  const { error } = await supabase.from('users').upsert(profile, { onConflict: 'user_id' })
  if (error) throw new Error(error.message + ' | code: ' + error.code)

  // Softmax 학습을 위한 카테고리별 로짓 초기화 (DB 트리거 보완)
  const logitRows = LOGIT_CATEGORIES.map(category => ({
    user_id: profile.user_id,
    category,
    logit: 0.0,
    sample_count: 0,
  }))
  await supabase
    .from('user_preference_logits')
    .upsert(logitRows, { onConflict: 'user_id,category', ignoreDuplicates: true })
}

export async function updateUserProfile(userId: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from('users').update(updates).eq('user_id', userId)
  if (error) throw error
}

export async function getTodayDiary(
  userId: string,
  date: string,
): Promise<{ id: string; summary: string } | null> {
  const { data } = await supabase
    .from('diary')
    .select('id, summary')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  return data
}
