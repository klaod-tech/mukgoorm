import OpenAI from 'openai'
import { supabase } from './supabase'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

const IMAGE_MODEL = 'gpt-image-2'

const CATEGORY_STYLES: Record<string, { hair: string; palette: string; vibe: string }> = {
  '한식':   { hair: 'warm chestnut brown',       palette: 'warm orange and earthy brown', vibe: 'cozy and heartwarming' },
  '일식':   { hair: 'dark black with blue sheen', palette: 'clean white and soft sky blue', vibe: 'calm and elegant' },
  '양식':   { hair: 'light golden blonde',        palette: 'soft cream and lavender',      vibe: 'refined and gentle' },
  '분식':   { hair: 'bright golden yellow',       palette: 'warm yellow and peach',        vibe: 'cheerful and lively' },
  '중식':   { hair: 'deep burgundy red',          palette: 'rich crimson and gold',        vibe: 'bold and vibrant' },
  '디저트': { hair: 'soft pastel pink',           palette: 'pastel pink and mint green',   vibe: 'sweet and dreamy' },
  '기타':   { hair: 'teal green',                 palette: 'emerald green and cyan',       vibe: 'adventurous and fresh' },
}

const STATE_EXPRESSIONS: Record<string, string> = {
  normal: 'calm neutral expression, gentle soft smile',
  happy:  'bright beaming smile, sparkling eyes, very cheerful',
  tired:  'heavy droopy eyes, slight pout, exhausted sleepy look',
  eating: 'happily eating, puffed cheeks, content and satisfied expression',
}

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

function buildPrompt(topCategory: string, expression: string): string {
  const s = CATEGORY_STYLES[topCategory] ?? CATEGORY_STYLES['기타']
  return [
    'Cute chibi anime girl character, super deformed SD style,',
    'very large round head with small body, big expressive eyes,',
    `twin tail hairstyle, ${s.hair} hair color,`,
    `${s.palette} color scheme outfit,`,
    `${s.vibe} overall atmosphere,`,
    `${expression},`,
    'high quality illustration, soft cel shading, clean lineart,',
    'plain white background, centered full body view',
  ].join(' ')
}

async function uploadToStorage(userId: string, state: string, imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl)
  const blob = await response.blob()
  const path = `${userId}/${state}.png`
  const { error } = await supabase.storage.from('character-images').upload(path, blob, { upsert: true })
  if (error) throw new Error(error.message)
  return supabase.storage.from('character-images').getPublicUrl(path).data.publicUrl
}

async function genFromPrompt(prompt: string): Promise<string> {
  const res = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    size: '1024x1024',
  } as Parameters<typeof openai.images.generate>[0]) as { data: { url: string }[] }
  return res.data[0].url
}


async function saveGen(userId: string, patch: Partial<CharacterGen>) {
  await supabase.from('character_generations').upsert(
    { user_id: userId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
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
