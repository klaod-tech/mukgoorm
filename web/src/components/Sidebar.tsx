import { NavLink } from 'react-router-dom'
import { T } from '../lib/theme'

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
      background: T.surface,
      borderRight: `1px solid ${T.border}`,
      padding: '24px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flexShrink: 0,
    }}>
      <div style={{ color: T.text, fontWeight: 700, fontSize: 18, padding: '0 20px 24px' }}>
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
            gap: 10,
            padding: '10px 20px',
            color: isActive ? T.accent : T.text2,
            background: isActive ? T.accentBg : 'transparent',
            textDecoration: 'none',
            borderLeft: isActive ? `3px solid ${T.accent}` : '3px solid transparent',
            fontSize: 14,
            fontWeight: isActive ? 600 : 400,
            transition: 'background 0.15s, color 0.15s',
          })}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
