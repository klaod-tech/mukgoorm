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

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const current = Math.round(el.scrollTop / ITEM_H)
      const next = Math.max(0, Math.min(items.length - 1, current + (e.deltaY > 0 ? 1 : -1)))
      el.scrollTo({ top: next * ITEM_H, behavior: 'smooth' })
      onSelect(items[next])
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [items, onSelect])

  return (
    <div style={{ position: 'relative', height: ITEM_H * VISIBLE, width: 60 }}>
      {/* 선택 하이라이트 */}
      <div style={{
        position: 'absolute',
        top: ITEM_H * PAD, height: ITEM_H,
        left: 4, right: 4,
        background: 'var(--surface)',
        borderRadius: 'var(--radius-sm)',
        border: '2px solid var(--accent)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />
      {/* 상하 페이드 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, var(--surface-2) 0%, transparent 38%, transparent 62%, var(--surface-2) 100%)',
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
              color: n === selected ? 'var(--accent-ink)' : 'var(--text-faint)',
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
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '6px 10px',
      userSelect: 'none',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <WheelCol
        items={HOURS}
        selected={h}
        onSelect={(newH) => onChange(`${padZ(newH)}:${padZ(m)}`)}
      />
      <div style={{
        color: 'var(--accent)', fontSize: 22, fontWeight: 800,
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
