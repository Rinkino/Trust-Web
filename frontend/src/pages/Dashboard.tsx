import { useState, useEffect, useRef } from 'react'
import type React from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import ScoreBadge from '../components/ScoreBadge'
import PredictionCard from '../components/PredictionCard'
import AnimatedCounter from '../components/AnimatedCounter'
import { Target, Hash, Award, Link as LinkIcon, Lock, BarChart2, TrendingUp, Settings, AlertTriangle, CheckCircle } from 'lucide-react'

const PLATFORMS = [
  'Sportybet', 'Bet9ja', 'Betano', 'Betway',
  '1xBet', 'BetKing', 'NairaBet', 'Melbet',
  'Polymarket', 'Other',
]

// Platforms supported by ConvertBetCodes bet-viewer (auto-preview)
const BOOKIE_MAP: Record<string, string> = {
  'Sportybet': 'sportybet:ng',
  'Bet9ja':    'bet9ja',
  'BetKing':   'betking',
  '1xBet':     '1xbet',
  'MSport':    'msport',
  '22bet':     '22bet',
}

type SlipLeg = {
  index: number; tournament: string; match: string
  market: string; selection: string; odds: number; kickoff: string
}

type SlipPreview = {
  code: string; platform: string; totalOdds: number; legCount: number
  legs: SlipLeg[]; matchesLeft: number; viewerLink: string
}

function parseKickoffUTC(kickoff: string): Date {
  // "Apr 10, 00:00.utc" → Date
  const cleaned = kickoff.replace('.utc', '').trim()
  const [datePart, timePart] = cleaned.split(', ')
  const year = new Date().getUTCFullYear()
  return new Date(`${datePart} ${year} ${timePart}:00 UTC`)
}

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

export default function Dashboard() {
  const [profile, setProfile]     = useState<Profile | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [showForm, setShowForm]   = useState(false)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'analytics' | 'settings'>('pending')
  const [analytics, setAnalytics] = useState<{
    score_history: { credit_before: number; credit_after: number; credit_delta: number; result: string; created_at: string }[]
    platform_breakdown: Record<string, number>
    avg_odds: number | null
    recent_form: string[]
  } | null>(null)
  const [winRateAnimated, setWinRateAnimated] = useState(false)
  const barRef = useRef<HTMLDivElement | null>(null)

  // Form fields
  const [platform, setPlatform]               = useState('')
  const [code, setCode]                       = useState('')
  const [link, setLink]                       = useState('')
  const [odds, setOdds]                       = useState('')
  const [formError, setFormError]             = useState('')
  const [submitting, setSubmitting]           = useState(false)
  const [marketPreview, setMarketPreview]     = useState<MarketPreview | null>(null)
  const [previewLoading, setPreviewLoading]   = useState(false)
  const [previewError, setPreviewError]       = useState('')
  const [selection, setSelection]             = useState<'YES' | 'NO' | null>(null)
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Bookmaker slip preview
  const [slipPreview, setSlipPreview]           = useState<SlipPreview | null>(null)
  const [slipPreviewLoading, setSlipPreviewLoading] = useState(false)
  const [slipPreviewError, setSlipPreviewError] = useState('')
  const slipDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Settings fields
  const [newUsername, setNewUsername]         = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmDelete, setConfirmDelete]     = useState('')
  const [settingsMsg, setSettingsMsg]         = useState('')
  const [settingsErr, setSettingsErr]         = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setWinRateAnimated(true), 200)
      return () => clearTimeout(timer)
    }
  }, [loading])

  // Polymarket preview debounce
  useEffect(() => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)

    if (platform !== 'Polymarket' || !link.toLowerCase().includes('polymarket.com/event/')) {
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

    return () => { if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current) }
  }, [link, platform])

  // Bookmaker slip preview — fires when code changes on a supported platform
  useEffect(() => {
    if (slipDebounceRef.current) clearTimeout(slipDebounceRef.current)

    const bookie = BOOKIE_MAP[platform]
    if (!bookie || code.trim().length < 4) {
      setSlipPreview(null)
      setSlipPreviewError('')
      return
    }

    setSlipPreviewLoading(true)
    setSlipPreviewError('')

    slipDebounceRef.current = setTimeout(async () => {
      try {
        const data = await api.previewSlip(code.trim(), bookie)
        setSlipPreview(data)
      } catch (err: unknown) {
        setSlipPreviewError(err instanceof Error ? err.message : 'Could not load slip')
        setSlipPreview(null)
      } finally {
        setSlipPreviewLoading(false)
      }
    }, 700)

    return () => { if (slipDebounceRef.current) clearTimeout(slipDebounceRef.current) }
  }, [code, platform])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [p, preds, analyticsData] = await Promise.all([
      api.getMe(),
      api.getUserPredictions(user.id),
      api.getMyAnalytics(),
    ])
    setProfile(p)
    setPredictions(preds)
    setAnalytics(analyticsData)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!platform) { setFormError('Please select a platform'); return }

    const isPolymarket = platform === 'Polymarket'

    if (isPolymarket) {
      if (!link.trim()) { setFormError('Please paste the Polymarket URL'); return }
      if (!marketPreview) { setFormError('Market preview not loaded yet — wait a moment'); return }
      if (!selection) { setFormError('Please select YES or NO'); return }
      if (marketPreview.closed) { setFormError('This market is already closed'); return }
    } else {
      if (!code.trim()) { setFormError('Please enter the share code'); return }
      if (BOOKIE_MAP[platform]) {
        if (!slipPreview) { setFormError('Slip preview not loaded — wait a moment'); return }
      } else {
        const oddsNum = parseFloat(odds)
        if (!odds || isNaN(oddsNum) || oddsNum < 1.01) { setFormError('Odds must be 1.01 or higher'); return }
      }
    }

    setSubmitting(true)

    try {
      if (isPolymarket) {
        await api.submitPrediction({
          title:            marketPreview!.title,
          betslip_code:     `PM-${marketPreview!.conditionId.slice(0, 12)}`,
          betslip_link:     link.trim(),
          odds:             selection === 'YES' ? marketPreview!.yesOdds : marketPreview!.noOdds,
          platform,
          event_start_time: marketPreview!.endDate || new Date(Date.now() + 3600_000).toISOString(),
          market_id:        marketPreview!.conditionId,
          selection:        selection ?? undefined,
        })
      } else if (slipPreview) {
        // Supported bookmaker — use preview data
        const kickoffs = slipPreview.legs
          .map(l => parseKickoffUTC(l.kickoff))
          .filter(d => !isNaN(d.getTime()))
        const earliest = kickoffs.length > 0
          ? new Date(Math.min(...kickoffs.map(d => d.getTime())))
          : new Date(Date.now() + 3600_000)
        const title = `${platform} — ${code.trim()} (${slipPreview.legCount} ${slipPreview.legCount === 1 ? 'pick' : 'picks'})`
        await api.submitPrediction({
          title,
          betslip_code:     code.trim(),
          betslip_link:     slipPreview.viewerLink || undefined,
          odds:             slipPreview.totalOdds,
          platform,
          event_start_time: earliest.toISOString(),
        })
      } else {
        // Manual entry (unsupported platform)
        await api.submitPrediction({
          title:            `${platform} — ${code.trim()}`,
          betslip_code:     code.trim(),
          betslip_link:     link.trim() || undefined,
          odds:             parseFloat(odds),
          platform,
          event_start_time: new Date(Date.now() + 3600_000).toISOString(),
        })
      }

      setPlatform(''); setCode(''); setLink(''); setOdds('')
      setMarketPreview(null); setSelection(null); setSlipPreview(null)
      setShowForm(false)
      await loadData()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err))
    }
    setSubmitting(false)
  }

  async function handleChangeUsername(e: React.FormEvent) {
    e.preventDefault()
    setSettingsErr(''); setSettingsMsg(''); setSettingsLoading(true)
    try {
      await api.updateUsername(newUsername.trim())
      setSettingsMsg('Username updated.')
      setNewUsername('')
      await loadData()
    } catch (err: unknown) {
      setSettingsErr(err instanceof Error ? err.message : String(err))
    }
    setSettingsLoading(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) { setSettingsErr('Password must be at least 8 characters'); return }
    setSettingsErr(''); setSettingsMsg(''); setSettingsLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSettingsLoading(false)
    if (error) setSettingsErr(error.message)
    else { setSettingsMsg('Password updated.'); setNewPassword('') }
  }

  async function handleDeleteAccount() {
    if (confirmDelete !== profile?.username) {
      setSettingsErr(`Type your username "${profile?.username}" to confirm deletion`)
      return
    }
    setSettingsErr(''); setSettingsLoading(true)
    try {
      await api.deleteAccount()
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (err: unknown) {
      setSettingsErr(err instanceof Error ? err.message : String(err))
      setSettingsLoading(false)
    }
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

  return (
    <div className="page">

      {/* Profile header */}
      <div className="animate-fade-in-up" style={{ marginBottom: '32px' }}>
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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {[
            { icon: <Target size={14} strokeWidth={1.5} />, label: 'Win Rate', value: `${winRate}%`, color: 'var(--success)' },
            { icon: <Hash size={14} strokeWidth={1.5} />, label: 'Total', value: String(profile?.total_resolved ?? 0), color: 'var(--text-muted)' },
            { icon: <Award size={14} strokeWidth={1.5} />, label: 'Best Streak', value: `${profile?.best_streak_ever ?? 0}`, color: 'var(--streak)' },
          ].map(s => (
            <div key={s.label} className="glass-glow" style={{
              padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {(profile?.total_resolved ?? 0) > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Win Rate</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success)' }}>
                <AnimatedCounter value={winRate} decimals={0} />%
              </span>
            </div>
            <div style={{ height: '6px', borderRadius: '3px', background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div ref={barRef} style={{
                height: '100%', borderRadius: '3px',
                background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
                width: winRateAnimated ? `${winRate}%` : '0%',
                transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 8px var(--accent-glow)',
              }} />
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
        <div className="glass-glow animate-scale-in" style={{ padding: '24px', marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Lock a Prediction</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Once locked it cannot be changed.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Platform selector */}
            <div>
              <label className="label" style={{ marginBottom: '10px', display: 'block' }}>Platform</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setPlatform(p); setMarketPreview(null); setSlipPreview(null); setSlipPreviewError(''); setLink(''); setCode(''); setOdds('') }}
                    style={{
                      padding: '7px 14px', borderRadius: '20px', fontSize: '13px',
                      fontWeight: platform === p ? 700 : 400,
                      border: platform === p ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                      background: platform === p ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent',
                      color: platform === p ? 'var(--accent-light)' : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {platform && platform !== 'Polymarket' && (
              <>
                <div>
                  <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Hash size={12} strokeWidth={1.5} />
                    Share Code
                  </label>
                  <input
                    className="input"
                    type="text"
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setSlipPreview(null); setSlipPreviewError('') }}
                    placeholder="e.g. P5BAH9"
                    autoCapitalize="characters"
                    required
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    The code your platform generates for this betslip. It changes if you edit the slip.
                  </p>
                </div>

                {/* Auto-preview for supported platforms */}
                {BOOKIE_MAP[platform] && (
                  <>
                    {slipPreviewLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                        Loading slip...
                      </div>
                    )}

                    {slipPreviewError && !slipPreviewLoading && (
                      <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--danger)', fontSize: '12px' }}>
                        {slipPreviewError}
                      </div>
                    )}

                    {slipPreview && !slipPreviewLoading && (
                      <div style={{ borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        {/* Slip header */}
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle size={14} strokeWidth={1.5} style={{ color: 'var(--success)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 700 }}>
                              {slipPreview.legCount} {slipPreview.legCount === 1 ? 'selection' : 'selections'}
                            </span>
                          </div>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-light)' }}>
                            @{slipPreview.totalOdds.toFixed(2)}
                          </span>
                        </div>

                        {/* All legs already played warning */}
                        {slipPreview.matchesLeft === 0 && (
                          <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--danger)' }}>
                            <AlertTriangle size={12} strokeWidth={1.5} />
                            All events already played — this slip cannot be locked
                          </div>
                        )}

                        {/* Legs */}
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                          {slipPreview.legs.map((leg, i) => (
                            <li key={i} style={{
                              padding: '10px 14px',
                              borderBottom: i < slipPreview.legs.length - 1 ? '1px solid var(--border)' : 'none',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginBottom: '2px' }}>
                                  {leg.tournament}
                                </p>
                                <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {leg.match}
                                </p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  {leg.market} · <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{leg.selection}</span>
                                </p>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <p style={{ fontSize: '13px', fontWeight: 700 }}>@{leg.odds.toFixed(2)}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{leg.kickoff.replace('.utc', ' UTC')}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {/* Manual odds + link for unsupported platforms */}
                {!BOOKIE_MAP[platform] && (
                  <>
                    <div>
                      <label className="label" style={{ marginBottom: '8px', display: 'block' }}>Odds</label>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="1.01"
                        value={odds}
                        onChange={e => setOdds(e.target.value)}
                        placeholder="e.g. 2.50"
                        inputMode="decimal"
                        required
                      />
                    </div>

                    <div>
                      <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <LinkIcon size={12} strokeWidth={1.5} />
                        Betslip Link <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '11px' }}>(optional)</span>
                      </label>
                      <input
                        className="input"
                        type="url"
                        value={link}
                        onChange={e => setLink(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {platform === 'Polymarket' && (
              <div>
                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <LinkIcon size={12} strokeWidth={1.5} />
                  Polymarket URL
                </label>
                <input
                  className="input"
                  type="url"
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  placeholder="https://polymarket.com/event/..."
                  required
                />

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
                            const optOdds = opt === 'YES' ? marketPreview.yesOdds : marketPreview.noOdds
                            const active = selection === opt
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setSelection(opt)}
                                style={{
                                  flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                                  border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                                  background: active ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent',
                                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                                  cursor: 'pointer', transition: 'all 0.15s',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                                }}
                              >
                                <span>{opt}</span>
                                <span style={{ fontSize: '11px', fontWeight: 400 }}>{optOdds.toFixed(2)}x</span>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {formError && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--danger)', fontSize: '13px',
              }}>
                {formError}
              </div>
            )}

            {platform && (
              <button
                type="submit"
                disabled={
                  submitting ||
                  (BOOKIE_MAP[platform] && (!slipPreview || slipPreview.matchesLeft === 0)) ||
                  (platform === 'Polymarket' && (!marketPreview || marketPreview.closed))
                }
                className="btn-accent"
                style={{ padding: '13px', gap: '8px' }}
              >
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
            )}
          </form>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '2px' }}>
        {([
          { id: 'pending' as const,   label: 'Live',      count: pending.length },
          { id: 'history' as const,   label: 'History',   count: resolved.length },
          { id: 'analytics' as const, label: 'Analytics', count: 0 },
          { id: 'settings' as const,  label: 'Settings',  count: 0 },
        ]).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '8px 14px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'nowrap',
            fontWeight: activeTab === t.id ? 700 : 400, border: 'none', cursor: 'pointer',
            background: activeTab === t.id ? 'var(--surface-2)' : 'transparent',
            color: activeTab === t.id ? 'var(--text)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'all 0.2s', flexShrink: 0,
          }}>
            {t.id === 'settings' && <Settings size={13} strokeWidth={1.5} />}
            {t.label}
            {t.count > 0 && t.id !== 'analytics' && t.id !== 'settings' && (
              <span style={{
                padding: '2px 7px', borderRadius: '10px', fontSize: '11px',
                background: activeTab === t.id ? 'var(--accent)' : 'var(--border)',
                color: activeTab === t.id ? '#fff' : 'var(--text-muted)',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Prediction lists */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activeTab === 'pending' && (
          pending.length === 0
            ? <Empty icon={<Lock size={32} strokeWidth={1} />} text="No live predictions" sub="Lock a new prediction to get started" />
            : pending.map((p, i) => <PredictionCard key={p.id} prediction={p} index={i} />)
        )}
        {activeTab === 'history' && (
          resolved.length === 0
            ? <Empty icon={<BarChart2 size={32} strokeWidth={1} />} text="No resolved predictions yet" sub="Resolve your pending predictions to see history" />
            : resolved.map((p, i) => <PredictionCard key={p.id} prediction={p} index={i} />)
        )}
        {activeTab === 'analytics' && (
          !analytics || analytics.score_history.length === 0
            ? <Empty icon={<TrendingUp size={32} strokeWidth={1} />} text="No data yet" sub="Analytics appear after your first prediction resolves" />
            : <AnalyticsPanel analytics={analytics} profile={profile} />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel
            profile={profile}
            newUsername={newUsername}
            setNewUsername={setNewUsername}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmDelete={confirmDelete}
            setConfirmDelete={setConfirmDelete}
            settingsMsg={settingsMsg}
            settingsErr={settingsErr}
            settingsLoading={settingsLoading}
            setSettingsMsg={setSettingsMsg}
            setSettingsErr={setSettingsErr}
            onChangeUsername={handleChangeUsername}
            onChangePassword={handleChangePassword}
            onDeleteAccount={handleDeleteAccount}
          />
        )}
      </div>
    </div>
  )
}

// ── Settings panel ─────────────────────────────────────────────────────────

type SettingsPanelProps = {
  profile: Profile | null
  newUsername: string; setNewUsername: (v: string) => void
  newPassword: string; setNewPassword: (v: string) => void
  confirmDelete: string; setConfirmDelete: (v: string) => void
  settingsMsg: string; settingsErr: string; settingsLoading: boolean
  setSettingsMsg: (v: string) => void; setSettingsErr: (v: string) => void
  onChangeUsername: (e: React.FormEvent) => void
  onChangePassword: (e: React.FormEvent) => void
  onDeleteAccount: () => void
}

function SettingsPanel({
  profile, newUsername, setNewUsername, newPassword, setNewPassword,
  confirmDelete, setConfirmDelete, settingsMsg, settingsErr, settingsLoading,
  setSettingsMsg, setSettingsErr, onChangeUsername, onChangePassword, onDeleteAccount,
}: SettingsPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {settingsMsg && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)', fontSize: '13px' }}>
          {settingsMsg}
        </div>
      )}
      {settingsErr && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', fontSize: '13px' }}>
          {settingsErr}
        </div>
      )}

      {/* Change username */}
      <div className="glass-glow" style={{ padding: '20px' }}>
        <p style={{ fontWeight: 700, marginBottom: '4px' }}>Change Username</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Current: @{profile?.username}
        </p>
        <form onSubmit={onChangeUsername} style={{ display: 'flex', gap: '8px' }}>
          <input
            className="input"
            type="text"
            value={newUsername}
            onChange={e => { setNewUsername(e.target.value); setSettingsErr(''); setSettingsMsg('') }}
            placeholder="new_username"
            minLength={3}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={settingsLoading} className="btn-accent" style={{ padding: '11px 16px', flexShrink: 0 }}>
            Save
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="glass-glow" style={{ padding: '20px' }}>
        <p style={{ fontWeight: 700, marginBottom: '4px' }}>Change Password</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Only works for email/password accounts.
        </p>
        <form onSubmit={onChangePassword} style={{ display: 'flex', gap: '8px' }}>
          <input
            className="input"
            type="password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setSettingsErr(''); setSettingsMsg('') }}
            placeholder="New password (min 8 chars)"
            minLength={8}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={settingsLoading} className="btn-accent" style={{ padding: '11px 16px', flexShrink: 0 }}>
            Update
          </button>
        </form>
      </div>

      {/* Delete account */}
      <div className="glass-glow" style={{ padding: '20px', borderColor: 'rgba(239,68,68,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <AlertTriangle size={16} strokeWidth={1.5} style={{ color: 'var(--danger)' }} />
          <p style={{ fontWeight: 700, color: 'var(--danger)' }}>Delete Account</p>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          This deletes all your predictions and score history. Type <strong>@{profile?.username}</strong> to confirm.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="input"
            type="text"
            value={confirmDelete}
            onChange={e => { setConfirmDelete(e.target.value); setSettingsErr('') }}
            placeholder={profile?.username}
            style={{ flex: 1 }}
          />
          <button
            onClick={onDeleteAccount}
            disabled={settingsLoading || confirmDelete !== profile?.username}
            style={{
              padding: '11px 16px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.4)',
              background: 'rgba(239,68,68,0.1)', color: 'var(--danger)',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0,
              opacity: confirmDelete !== profile?.username ? 0.4 : 1,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Analytics panel ────────────────────────────────────────────────────────

type AnalyticsProps = {
  analytics: {
    score_history: { credit_before: number; credit_after: number; credit_delta: number; result: string; created_at: string }[]
    platform_breakdown: Record<string, number>
    avg_odds: number | null
    recent_form: string[]
  }
  profile: Profile | null
}

function AnalyticsPanel({ analytics, profile }: AnalyticsProps) {
  const { score_history, platform_breakdown, avg_odds, recent_form } = analytics

  const chartW = 560; const chartH = 120
  const pad    = { top: 12, bottom: 12, left: 8, right: 8 }

  const points = [score_history[0].credit_before, ...score_history.map(h => h.credit_after)]
  const minVal = Math.max(0,   Math.min(...points) - 5)
  const maxVal = Math.min(100, Math.max(...points) + 5)
  const range  = maxVal - minVal || 1

  const toX = (i: number) => pad.left + (i / (points.length - 1)) * (chartW - pad.left - pad.right)
  const toY = (v: number) => pad.top + (1 - (v - minVal) / range) * (chartH - pad.top - pad.bottom)

  const linePath = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ')
  const fillPath = `${linePath} L ${toX(points.length - 1).toFixed(1)} ${(chartH - pad.bottom).toFixed(1)} L ${toX(0).toFixed(1)} ${(chartH - pad.bottom).toFixed(1)} Z`

  const latestScore = points[points.length - 1]
  const scoreChange = latestScore - points[0]
  const platformTotal = Object.values(platform_breakdown).reduce((a, b) => a + b, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass-glow" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Credit Score</p>
            <p style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1 }}>{latestScore.toFixed(1)}</p>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: scoreChange >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: scoreChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {scoreChange >= 0 ? '+' : ''}{scoreChange.toFixed(1)} all time
          </span>
        </div>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: '100px', overflow: 'visible' }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill="url(#fillGrad)" />
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={toX(points.length - 1)} cy={toY(latestScore)} r="4" fill="var(--accent)" />
        </svg>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Based on {score_history.length} resolved prediction{score_history.length !== 1 ? 's' : ''}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
        {[
          { label: 'Avg Odds', value: avg_odds !== null ? `${avg_odds}x` : '—', color: 'var(--accent)' },
          { label: 'Total Resolved', value: String(profile?.total_resolved ?? 0), color: 'var(--text)' },
          { label: 'Correct', value: String(profile?.total_correct ?? 0), color: 'var(--success)' },
          { label: 'Best Streak', value: `${profile?.best_streak_ever ?? 0}`, color: 'var(--streak)' },
        ].map(s => (
          <div key={s.label} className="glass-glow" style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
            <p style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {recent_form.length > 0 && (
        <div className="glass-glow" style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Recent Form</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {recent_form.map((r, i) => (
              <div key={i} style={{
                width: '28px', height: '28px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: r === 'WON' ? 'rgba(34,197,94,0.15)' : r === 'LOST' ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.15)',
                color: r === 'WON' ? 'var(--success)' : r === 'LOST' ? 'var(--danger)' : 'var(--text-muted)',
                border: `1px solid ${r === 'WON' ? 'rgba(34,197,94,0.3)' : r === 'LOST' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
              }}>
                {r === 'WON' ? 'W' : r === 'LOST' ? 'L' : 'V'}
              </div>
            ))}
          </div>
        </div>
      )}

      {platformTotal > 0 && (
        <div className="glass-glow" style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>By Platform</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(platform_breakdown).sort((a, b) => b[1] - a[1]).map(([plat, count]) => {
              const pct = Math.round((count / platformTotal) * 100)
              return (
                <div key={plat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{plat}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', background: 'var(--surface-2)' }}>
                    <div style={{ height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, var(--accent), var(--accent-light))', width: `${pct}%`, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
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
