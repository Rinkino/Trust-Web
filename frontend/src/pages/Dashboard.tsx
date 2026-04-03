import { useState, useEffect, useRef } from 'react'
import type React from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import ScoreBadge from '../components/ScoreBadge'
import PredictionCard from '../components/PredictionCard'
import AnimatedCounter from '../components/AnimatedCounter'
import { Target, Hash, Award, Link as LinkIcon, Lock, BarChart2 } from 'lucide-react'

type MarketPreview = {
  conditionId: string
  title: string
  endDate: string
  yesOdds: number
  noOdds: number
  closed: boolean
  winner: 'YES' | 'NO' | null
}

type Profile = {
  id: string; username: string; credit_score: number; visibility_score: number
  correct_streak: number; wrong_streak: number; best_streak_ever: number
  total_resolved: number; total_correct: number; user_state: string
}

type Prediction = {
  id: string; title: string; betslip_code: string; betslip_link?: string
  odds: number; platform: string; status: 'PENDING' | 'WON' | 'LOST' | 'VOID'
  locked_at: string; resolved_at?: string; score_contribution?: number
}

function detectPlatform(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes('betfair'))    return 'Betfair'
    if (host.includes('smarkets'))   return 'Smarkets'
    if (host.includes('polymarket')) return 'Polymarket'
    if (host.includes('kalshi'))     return 'Kalshi'
    if (host.includes('pinnacle'))   return 'Pinnacle'
    if (host.includes('betway'))     return 'Betway'
    if (host.includes('bet365'))     return 'Bet365'
    if (host.includes('draftkings')) return 'DraftKings'
    if (host.includes('fanduel'))    return 'FanDuel'
    const parts = host.replace('www.', '').split('.')
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  } catch {
    return 'Unknown'
  }
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [winRateAnimated, setWinRateAnimated] = useState(false)
  const barRef = useRef<HTMLDivElement | null>(null)

  const [code, setCode]                         = useState('')
  const [link, setLink]                         = useState('')
  const [formError, setFormError]               = useState('')
  const [submitting, setSubmitting]             = useState(false)
  const [marketPreview, setMarketPreview]       = useState<MarketPreview | null>(null)
  const [previewLoading, setPreviewLoading]     = useState(false)
  const [previewError, setPreviewError]         = useState('')
  const [selection, setSelection]               = useState<'YES' | 'NO' | null>(null)
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { loadData() }, [])

  // Trigger win-rate bar animation after load
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setWinRateAnimated(true), 200)
      return () => clearTimeout(timer)
    }
  }, [loading])

  // Debounced Polymarket preview
  useEffect(() => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)

    const isPolymarket = link.toLowerCase().includes('polymarket.com/event/')
    if (!isPolymarket) {
      setMarketPreview(null)
      setPreviewError('')
      return
    }

    setPreviewLoading(true)
    setPreviewError('')

    previewDebounceRef.current = setTimeout(async () => {
      try {
        const data = await api.previewMarket(link.trim())
        setMarketPreview(data)
        setSelection(null)
      } catch (err: unknown) {
        setPreviewError(err instanceof Error ? err.message : 'Could not load market')
        setMarketPreview(null)
      } finally {
        setPreviewLoading(false)
      }
    }, 600)

    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
    }
  }, [link])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [p, preds] = await Promise.all([api.getMe(), api.getUserPredictions(user.id)])
    setProfile(p)
    setPredictions(preds)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!link.trim()) {
      setFormError('Please paste the betslip link')
      return
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(link.trim())
    } catch {
      setFormError('Please enter a valid URL including https://')
      return
    }

    const platform = detectPlatform(link.trim())

    if (marketPreview) {
      if (!selection) {
        setFormError('Please select YES or NO for this market')
        return
      }
      if (marketPreview.closed) {
        setFormError('This market is already closed — predictions cannot be accepted')
        return
      }
    }

    setSubmitting(true)

    try {
      const isPolymarket = !!marketPreview
      await api.submitPrediction({
        title:            isPolymarket ? marketPreview!.title : `${platform} — ${code.trim()}`,
        betslip_code:     code.trim(),
        betslip_link:     parsedUrl.href,
        odds:             isPolymarket
                            ? (selection === 'YES' ? marketPreview!.yesOdds : marketPreview!.noOdds)
                            : 2.0,
        platform,
        event_start_time: isPolymarket
                            ? marketPreview!.endDate || new Date(Date.now() + 60 * 60 * 1000).toISOString()
                            : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        market_id:        isPolymarket ? marketPreview!.conditionId : undefined,
        selection:        isPolymarket ? (selection ?? undefined) : undefined,
      })
      setCode('')
      setLink('')
      setMarketPreview(null)
      setSelection(null)
      setShowForm(false)
      await loadData()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err))
    }
    setSubmitting(false)
  }

  async function handleResolve(id: string, result: 'WON' | 'LOST' | 'VOID') {
    try { await api.resolvePrediction(id, result); await loadData() }
    catch (err: unknown) { alert(err instanceof Error ? err.message : String(err)) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px', color: 'var(--text-muted)' }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
      Loading...
    </div>
  )

  const pending  = predictions.filter(p => p.status === 'PENDING')
  const resolved = predictions.filter(p => p.status !== 'PENDING')
  const winRate  = profile && profile.total_resolved > 0
    ? Math.round((profile.total_correct / profile.total_resolved) * 100) : 0

  const detectedPlatform = link ? detectPlatform(link) : null

  return (
    <div className="page">

      {/* Profile header */}
      <div className="animate-fade-in-up" style={{ marginBottom: '36px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
        }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>
              @{profile?.username}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Your prediction track record
            </p>
          </div>
          <button onClick={() => setShowForm(v => !v)} className="btn-accent" style={{ gap: '6px' }}>
            {showForm ? 'Cancel' : (
              <>
                <Lock size={14} strokeWidth={2} />
                New Prediction
              </>
            )}
          </button>
        </div>

        {/* Stat row */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {[
            { icon: <Target size={14} strokeWidth={1.5} />, label: 'Win Rate', value: `${winRate}%`, color: 'var(--success)' },
            { icon: <Hash size={14} strokeWidth={1.5} />, label: 'Total', value: String(profile?.total_resolved ?? 0), color: 'var(--text-muted)' },
            { icon: <Award size={14} strokeWidth={1.5} />, label: 'Best Streak', value: `${profile?.best_streak_ever ?? 0}d`, color: 'var(--streak)' },
          ].map(s => (
            <div key={s.label} className="glass-glow" style={{
              padding: '10px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Win rate bar */}
        {(profile?.total_resolved ?? 0) > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Win Rate
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success)' }}>
                <AnimatedCounter value={winRate} decimals={0} />%
              </span>
            </div>
            <div style={{
              height: '6px', borderRadius: '3px', background: 'var(--surface-2)',
              overflow: 'hidden',
            }}>
              <div
                ref={barRef}
                style={{
                  height: '100%', borderRadius: '3px',
                  background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
                  width: winRateAnimated ? `${winRate}%` : '0%',
                  transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 0 8px var(--accent-glow)',
                }}
              />
            </div>
          </div>
        )}

        {profile && (
          <ScoreBadge
            creditScore={profile.credit_score}
            visibilityScore={profile.visibility_score}
            userState={profile.user_state}
            correctStreak={profile.correct_streak}
          />
        )}
      </div>

      {/* Prediction form */}
      {showForm && (
        <div className="glass-glow animate-scale-in" style={{ padding: '28px', marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
            Lock a Prediction
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Paste your betslip code and the link to your selections. Once locked it cannot be changed.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Link field */}
            <div>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <LinkIcon size={12} strokeWidth={1.5} />
                Betslip Link
              </label>
              <input
                className="input"
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://betfair.com/exchange/..."
                required
              />
              {detectedPlatform && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--success)' }}>
                    Detected: <strong>{detectedPlatform}</strong>
                  </span>
                </div>
              )}

              {/* Polymarket preview */}
              {previewLoading && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                  Loading market...
                </div>
              )}

              {previewError && !previewLoading && (
                <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--danger)', fontSize: '12px' }}>
                  {previewError}
                </div>
              )}

              {marketPreview && !previewLoading && (
                <div style={{ marginTop: '12px', padding: '14px', borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', lineHeight: 1.4 }}>
                    {marketPreview.title}
                  </p>
                  {marketPreview.endDate && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Ends {new Date(marketPreview.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  {marketPreview.closed ? (
                    <p style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>
                      Market closed — winner: {marketPreview.winner ?? 'unknown'}
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Your selection
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(['YES', 'NO'] as const).map(opt => {
                          const odds = opt === 'YES' ? marketPreview.yesOdds : marketPreview.noOdds
                          const active = selection === opt
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setSelection(opt)}
                              style={{
                                flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                                border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                                background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                                color: active ? 'var(--accent)' : 'var(--text-muted)',
                                cursor: 'pointer', transition: 'all 0.15s',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                              }}
                            >
                              <span>{opt}</span>
                              <span style={{ fontSize: '11px', fontWeight: 400 }}>{odds.toFixed(2)}x</span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Code field */}
            <div>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Hash size={12} strokeWidth={1.5} />
                Betslip Code
              </label>
              <input
                className="input"
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. ABC123XYZ"
                required
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                The code your platform generates for this specific betslip. Changing the slip changes the code.
              </p>
            </div>

            {formError && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--danger)', fontSize: '13px',
              }}>
                {formError}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-accent" style={{ padding: '13px', gap: '8px' }}>
              {submitting ? (
                <>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Locking...
                </>
              ) : (
                <>
                  <Lock size={14} strokeWidth={2} />
                  Lock Prediction
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        {([
          { id: 'pending' as const, label: 'Pending', count: pending.length },
          { id: 'history' as const, label: 'History', count: resolved.length },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
            fontWeight: activeTab === tab.id ? 700 : 400, border: 'none', cursor: 'pointer',
            background: activeTab === tab.id ? 'var(--surface-2)' : 'transparent',
            color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: 'all 0.2s',
          }}>
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                padding: '2px 7px', borderRadius: '10px', fontSize: '11px',
                background: activeTab === tab.id ? 'var(--accent)' : 'var(--border)',
                color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Prediction list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activeTab === 'pending' && (
          pending.length === 0
            ? <Empty icon={<Lock size={32} strokeWidth={1} />} text="No pending predictions" sub="Lock a new prediction to get started" />
            : pending.map((p, i) => <PredictionCard key={p.id} prediction={p} isOwn onResolve={handleResolve} index={i} />)
        )}
        {activeTab === 'history' && (
          resolved.length === 0
            ? <Empty icon={<BarChart2 size={32} strokeWidth={1} />} text="No resolved predictions yet" sub="Resolve your pending predictions to see history" />
            : resolved.map((p, i) => <PredictionCard key={p.id} prediction={p} isOwn index={i} />)
        )}
      </div>
    </div>
  )
}

function Empty({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
      <div style={{ marginBottom: '12px', opacity: 0.4 }}>{icon}</div>
      <p style={{ fontWeight: 600, marginBottom: '4px' }}>{text}</p>
      <p style={{ fontSize: '13px' }}>{sub}</p>
    </div>
  )
}
