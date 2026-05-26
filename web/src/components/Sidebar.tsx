import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/',         label: '홈',           icon: '🏠' },
  { to: '/meal',     label: '식사 기록',     icon: '🍽️' },
  { to: '/weight',   label: '체중 관리',     icon: '⚖️' },
  { to: '/weather',  label: '날씨',          icon: '🌤️' },
  { to: '/schedule', label: '일정',          icon: '📅' },
  { to: '/diary',    label: '일기',          icon: '📔' },
  { to: '/email',    label: '이메일',        icon: '📧' },
  { to: '/report',   label: '주간 리포트',   icon: '📊' },
  { to: '/settings', label: '설정',          icon: '⚙️' },
]

export default function Sidebar() {
  return (
    <nav style={{
      width: 200,
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      padding: 'var(--sp-6) 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flexShrink: 0,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        color: 'var(--text-strong)',
        fontWeight: 'var(--fw-bold)',
        fontSize: 'var(--fs-lg)',
        padding: '0 var(--sp-5) var(--sp-6)',
      }}>
        🌧️ 먹구름
      </div>
      {NAV_ITEMS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
            padding: 'var(--sp-3) var(--sp-5)',
            color: isActive ? 'var(--accent-ink)' : 'var(--text-muted)',
            background: isActive ? 'var(--accent-soft)' : 'transparent',
            textDecoration: 'none',
            borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
            fontSize: 'var(--fs-base)',
            fontWeight: isActive ? 'var(--fw-bold)' : 'var(--fw-medium)',
            transition: 'var(--transition)',
          })}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
