import { Link, useLocation } from 'react-router-dom'
import { Home, Search, Award, Bell, User } from 'lucide-react'

type Props = {
  user: { id: string } | null
  notifCount?: number
}

const tabs = [
  { to: '/home',         icon: Home,  label: 'Home',   auth: false },
  { to: '/explore',      icon: Search, label: 'Explore', auth: false },
  { to: '/leaderboard',  icon: Award, label: 'Ranks',  auth: false },
  { to: '/notifications',icon: Bell,  label: 'Alerts', auth: true  },
  { to: '/profile',      icon: User,  label: 'Profile',auth: true  },
]

export default function BottomNav({ user, notifCount = 0 }: Props) {
  const location = useLocation()
  if (!user) return null
  if (location.pathname === '/x7k2-admin' || location.pathname === '/') return null

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 200,
      borderTop: '1px solid var(--border)',
      backgroundColor: 'color-mix(in srgb, var(--bg) 92%, transparent)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {tabs.map(tab => {
        if (tab.auth && !user) return null
        const active = location.pathname === tab.to ||
          (tab.to === '/home' && location.pathname === '/')
        const Icon = tab.icon
        const isBell = tab.to === '/notifications'

        return (
          <Link
            key={tab.to}
            to={tab.auth && !user ? '/login' : tab.to}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '10px 0',
              textDecoration: 'none',
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'color 0.15s',
              position: 'relative',
              minHeight: '52px',
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={22} strokeWidth={active ? 2.2 : 1.6} />
              {isBell && notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-6px',
                  background: 'var(--accent)', color: '#fff',
                  borderRadius: '999px', fontSize: '9px', fontWeight: 700,
                  padding: '1px 4px', minWidth: '14px', textAlign: 'center',
                  lineHeight: '14px',
                }}>
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: '10px', marginTop: '3px', fontWeight: active ? 600 : 400 }}>
              {tab.label}
            </span>
          </Link>
        )
      })}

      {/* If not logged in, show login tab in place of profile/notif */}
      {!user && (
        <Link
          to="/login"
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '10px 0', textDecoration: 'none',
            color: location.pathname === '/login' ? 'var(--accent)' : 'var(--text-muted)',
            minHeight: '52px',
          }}
        >
          <User size={22} strokeWidth={1.6} />
          <span style={{ fontSize: '10px', marginTop: '3px' }}>Sign In</span>
        </Link>
      )}
    </nav>
  )
}
