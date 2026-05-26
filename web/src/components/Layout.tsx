import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { T } from '../lib/theme'

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, color: T.text }}>
      <Sidebar />
      <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
