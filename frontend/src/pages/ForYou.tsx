import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import PredictionCard from '../components/PredictionCard'
import { Sparkles, Clock } from 'lucide-react'

const PAGE_SIZE = 20

type FeedItem = {
  id: string; title: string; betslip_code: string; betslip_link?: string
  odds: number; platform: string; status: 'PENDING' | 'WON' | 'LOST' | 'VOID'
  locked_at: string; resolved_at?: string; score_contribution?: number
  selection?: string; market_id?: string
  profiles: { username: string; credit_score: number; visibility_score: number; correct_streak: number; user_state: string }
}

type Tab = 'foryou' | 'recent'

export default function ForYou() {
  const [tab, setTab]                   = useState<Tab>('foryou')
  const [feed, setFeed]                 = useState<FeedItem[]>([])
  const [hasMore, setHasMore]           = useState(true)
  const [loading, setLoading]           = useState(true)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [error, setError]               = useState('')
  const offsetRef                       = useRef(0)
  const sentinelRef                     = useRef<HTMLDivElement | null>(null)
  const observerRef                     = useRef<IntersectionObserver | null>(null)

  async function loadPage(offset: number, sort: Tab, initial = false) {
    if (!initial && loadingMore) return
    if (initial) setLoading(true); else setLoadingMore(true)
    try {
      const result = await api.getFeed(offset, PAGE_SIZE, sort === 'foryou' ? 'visibility' : 'recent')
      const items  = result?.items ?? []
      setFeed(prev => initial ? items : [...prev, ...items])
      setHasMore(result?.hasMore ?? false)
      offsetRef.current = offset + items.length
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    offsetRef.current = 0
    setFeed([])
    setHasMore(true)
    loadPage(0, tab, true)
  }, [tab])

  const handleSentinel = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasMore && !loadingMore) {
      loadPage(offsetRef.current, tab)
    }
  }, [hasMore, loadingMore, tab])

  useEffect(() => {
    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(handleSentinel, { threshold: 0.1 })
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [handleSentinel])

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Tab bar */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 100,
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 90%, transparent)',
      }}>
        {([
          { id: 'foryou', label: 'For You', icon: <Sparkles size={14} strokeWidth={1.5} /> },
          { id: 'recent', label: 'Recent',  icon: <Clock size={14} strokeWidth={1.5} /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '14px', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              fontSize: '14px', fontWeight: tab === t.id ? 700 : 400,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              position: 'relative', transition: 'color 0.15s',
            }}
          >
            {t.icon}{t.label}
            {tab === t.id && (
              <span style={{
                position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: '48px', height: '3px', borderRadius: '3px 3px 0 0',
                background: 'var(--accent)',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Feed */}
      {error && <p style={{ padding: '24px 16px', color: 'var(--danger)', fontSize: '14px' }}>{error}</p>}

      {loading && (
        <div style={{ padding: '32px 16px' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-2)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: '12px', background: 'var(--surface-2)', borderRadius: '4px', marginBottom: '8px', width: '40%' }} />
                <div style={{ height: '14px', background: 'var(--surface-2)', borderRadius: '4px', marginBottom: '6px' }} />
                <div style={{ height: '14px', background: 'var(--surface-2)', borderRadius: '4px', width: '70%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && feed.length === 0 && !error && (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Sparkles size={32} strokeWidth={1} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>No predictions yet</p>
          <p style={{ fontSize: '13px' }}>Be the first to lock a pick.</p>
        </div>
      )}

      {feed.map((item, i) => (
        <PredictionCard key={item.id} prediction={item} showUser index={i} />
      ))}

      <div ref={sentinelRef} style={{ height: '1px' }} />

      {loadingMore && (
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
        </div>
      )}

      {!hasMore && feed.length > 0 && (
        <p style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-subtle)' }}>
          You're all caught up
        </p>
      )}

      {/* Bottom nav spacer */}
      <div style={{ height: '72px' }} />
    </div>
  )
}
