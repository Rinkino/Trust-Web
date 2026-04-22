import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import PredictionCard from '../components/PredictionCard'
import DragonSpinner from '../components/DragonSpinner'
import { Search, Flame, TrendingUp, X } from 'lucide-react'

type User = {
  id: string; username: string; credit_score: number; visibility_score: number
  correct_streak: number; user_state: string; total_resolved: number
}

type FeedItem = {
  id: string; title: string; betslip_code: string; betslip_link?: string
  odds: number; platform: string; status: 'PENDING' | 'WON' | 'LOST' | 'VOID'
  locked_at: string; resolved_at?: string; score_contribution?: number
  selection?: string; market_id?: string
  profiles: { username: string; credit_score: number; visibility_score: number; correct_streak: number; user_state: string }
}

export default function Explore() {
  const navigate = useNavigate()
  const [query, setQuery]             = useState('')
  const [userResults, setUserResults] = useState<User[]>([])
  const [searching, setSearching]     = useState(false)
  const [trending, setTrending]       = useState<User[]>([])
  const [hotPicks, setHotPicks]       = useState<FeedItem[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef                      = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      api.getTrending(),
      api.getFeed(0, 10, 'visibility'),
    ]).then(([tr, feed]) => {
      setTrending(tr ?? [])
      setHotPicks(feed?.items ?? [])
    }).catch(() => {})
      .finally(() => setLoadingMeta(false))
  }, [])

  function handleQueryChange(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setUserResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.searchUsers(q)
        setUserResults(res ?? [])
      } catch {}
      finally { setSearching(false) }
    }, 350)
  }

  const showSearch = query.trim().length > 0

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Search bar */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 100,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 92%, transparent)',
      }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} strokeWidth={1.5} style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search users, picks..."
            style={{
              width: '100%', padding: '11px 40px 11px 42px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: '999px', color: 'var(--text)', fontSize: '14px',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setUserResults([]); inputRef.current?.focus() }}
              style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
            >
              <X size={15} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {showSearch && (
        <div>
          {searching && (
            <div style={{ padding: '20px 16px', display: 'flex', justifyContent: 'center' }}>
              <DragonSpinner size={18} color="var(--accent)" />
            </div>
          )}
          {!searching && userResults.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              No users found for "{query}"
            </div>
          )}
          {userResults.map(u => (
            <Link key={u.id} to={`/u/${u.username}`} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
              textDecoration: 'none', color: 'inherit',
              transition: 'background 0.12s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', fontWeight: 800, color: '#fff',
              }}>
                {u.username[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{u.username}</span>
                  {u.correct_streak > 0 && (
                    <span style={{ color: 'var(--streak)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Flame size={11} strokeWidth={1.5} />{u.correct_streak}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {Math.max(0, u.credit_score).toFixed(1)} cr · {u.total_resolved} picks
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Default: trending + hot picks */}
      {!showSearch && (
        <>
          {/* Hot streaks */}
          <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Flame size={16} strokeWidth={1.5} style={{ color: 'var(--streak)' }} />
              <span style={{ fontSize: '15px', fontWeight: 700 }}>Hot Streaks</span>
            </div>
            {loadingMeta ? (
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{ flexShrink: 0, width: '90px', height: '90px', borderRadius: '12px', background: 'var(--surface-2)' }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                {trending.slice(0, 8).map(u => (
                  <button
                    key={u.id}
                    onClick={() => navigate(`/u/${u.username}`)}
                    style={{
                      flexShrink: 0, width: '88px', padding: '12px 8px',
                      borderRadius: '12px', border: '1px solid var(--border)',
                      background: 'var(--surface-2)', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--streak), #f59e0b)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 800, color: '#fff',
                    }}>
                      {u.username[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                      {u.username}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--streak)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>
                      <Flame size={10} strokeWidth={1.5} />{u.correct_streak}d
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trending picks */}
          <div style={{ padding: '16px 16px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <TrendingUp size={16} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '15px', fontWeight: 700 }}>Trending Picks</span>
            </div>
          </div>

          {loadingMeta ? (
            <div>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-2)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '12px', background: 'var(--surface-2)', borderRadius: '4px', marginBottom: '8px', width: '40%' }} />
                    <div style={{ height: '14px', background: 'var(--surface-2)', borderRadius: '4px', width: '80%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            hotPicks.map((item, i) => (
              <PredictionCard key={item.id} prediction={item} showUser index={i} />
            ))
          )}

          <div style={{ height: '72px' }} />
        </>
      )}
    </div>
  )
}
