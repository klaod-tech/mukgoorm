import { supabase } from './supabase'

export type GenStatus = 'pending' | 'partial_1' | 'partial_2' | 'partial_3' | 'done' | 'failed'

export interface CharacterGen {
  user_id:    string
  status:     GenStatus
  normal_url: string | null
  happy_url:  string | null
  tired_url:  string | null
  eating_url: string | null
  prompt_base: string | null
  retry_count: number
  error_msg:  string | null
}

export async function getCharacterGen(userId: string): Promise<CharacterGen | null> {
  const { data } = await supabase
    .from('character_generations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as CharacterGen | null
}

export async function resumeOrStartGeneration(userId: string, topCategory: string): Promise<void> {
  const rec = await getCharacterGen(userId)
  if (rec && rec.status !== 'pending') return  // done / partial_* → do not re-trigger

  await fetch('/webhook/generate-character', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, top_category: topCategory }),
  })
}
