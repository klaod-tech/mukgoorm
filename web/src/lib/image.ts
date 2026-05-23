export type WeatherType = 'clear' | 'cloudy' | 'rainy' | 'snowy' | 'hot' | 'warm' | 'mask' | 'none'

export interface GeneratedImages {
  normal?: string | null
  happy?:  string | null
  tired?:  string | null
  eating?: string | null
}

export function selectCharacterImage(
  weather: WeatherType = 'none',
  hunger: number = 50,
  mood: number = 50,
  hp: number = 100,
  generated: GeneratedImages = {},
): string {
  const g = generated

  if (hp < 20)            return g.tired  ?? '/tired.png'

  if (weather === 'rainy') return '/rainy.png'
  if (weather === 'snowy') return '/snow.png'
  if (weather === 'hot')   return '/hot.png'
  if (weather === 'warm')  return '/warm.png'
  if (weather === 'mask')  return '/wear mask.png'

  if (hunger > 80)        return g.eating ?? '/eat.png'
  if (mood > 70)          return g.happy  ?? '/cheer.png'
  if (mood > 50)          return g.happy  ?? '/smile.png'
  if (hunger < 20)        return g.tired  ?? '/upset.png'
  if (hunger < 40)        return g.tired  ?? '/tired.png'

  return g.normal ?? '/normal.png'
}
