import { useEffect, useRef, useCallback } from 'react'

const ITEM_H = 44
const VISIBLE = 3
const PAD = Math.floor(VISIBLE / 2)

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

function padZ(n: number) {
  return String(n).padStart(2, '0')
}

function WheelCol({
  items,
  selected,
  onSelect,
}: {
  items: number[]
  selected: number
  onSelect: (v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const idx = items.indexOf(selected)
    if (idx < 0) return
    if (!mounted.current) {
      el.scrollTop = idx * ITEM_H
      mounted.current = true
    } else {
      el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
    }
  }, [selected, items])

  const handleScroll = useCallback(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const idx = Math.round(el.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(items.length - 1, idx))
      el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' })
      onSelect(items[clamped])
    }, 120)
  }, [items, onSelect])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const current = Math.round(el.scrollTop / ITEM_H)
    const next = Math.max(0, Math.min(items.length - 1, current + (e.deltaY > 0 ? 1 : -1)))
    el.scrollTo({ top: next * ITEM_H, behavior: 'smooth' })
    onSelect(items[next])
  }, [items, onSelect])

  return (
    <div style={{ position: 'relative', height: ITEM_H * VISIBLE, width: 60 }}>
      {/* 선택 하이라이트 */}
      <div style={{
        position: 'absolute',
        top: ITEM_H * PAD, height: ITEM_H,
        left: 4, right: 4,
        background: '#6c63ff22',
        borderRadius: 8,
        border: '1px solid #6c63ff55',
        pointerEvents: 'none',
        zIndex: 2,
      }} />
      {/* 상하 페이드 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, #16213e 0%, transparent 38%, transparent 62%, #16213e 100%)',
        pointerEvents: 'none',
        zIndex: 3,
      }} />
      <div
        ref={ref}
        onScroll={handleScroll}
        style={{
          height: '100%',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
        } as React.CSSProperties}
      >
        <div style={{ height: ITEM_H * PAD }} />
        {items.map((n) => (
          <div
            key={n}
            onClick={() => {
              const el = ref.current
              if (!el) return
              el.scrollTo({ top: items.indexOf(n) * ITEM_H, behavior: 'smooth' })
              onSelect(n)
            }}
            style={{
              height: ITEM_H,
              scrollSnapAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700,
              color: n === selected ? '#fff' : '#3a3a5a',
              cursor: 'pointer',
              transition: 'color 0.1s',
            }}
          >
            {padZ(n)}
          </div>
        ))}
        <div style={{ height: ITEM_H * PAD }} />
      </div>
    </div>
  )
}

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function TimePickerDial({ value, onChange }: Props) {
  const h = value ? parseInt(value.split(':')[0]) : 0
  const rawMin = value ? parseInt(value.split(':')[1]) : 0
  const m = Math.round(rawMin / 5) * 5 % 60

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 0,
      background: '#16213e',
      border: '1px solid #2a2a4a',
      borderRadius: 12,
      padding: '6px 10px',
      userSelect: 'none',
    }}>
      <WheelCol
        items={HOURS}
        selected={h}
        onSelect={(newH) => onChange(`${padZ(newH)}:${padZ(m)}`)}
      />
      <div style={{
        color: '#6c63ff', fontSize: 22, fontWeight: 800,
        padding: '0 6px', lineHeight: 1, marginTop: -4,
      }}>:</div>
      <WheelCol
        items={MINUTES}
        selected={m}
        onSelect={(newM) => onChange(`${padZ(h)}:${padZ(newM)}`)}
      />
    </div>
  )
}
