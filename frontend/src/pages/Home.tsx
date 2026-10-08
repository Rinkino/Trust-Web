import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Lock, Check } from 'lucide-react'
import type React from 'react'

/* Worked examples from backend/src/services/scoring.ts, for a predictor
   with 50+ resolved picks (full credibility weight). */
const SCORING_EXAMPLES: { call: string; odds: string; result: string; delta: string; positive: boolean }[] = [
  { call: 'Favourite, first win',     odds: '1.30', result: 'Won',  delta: '+1.49', positive: true },
  { call: 'Outsider, first win',      odds: '3.00', result: 'Won',  delta: '+3.45', positive: true },
  { call: 'Fifth win in a row',       odds: '2.00', result: 'Won',  delta: '+4.43', positive: true },
  { call: 'Favourite, missed',        odds: '1.30', result: 'Lost', delta: '−0.77', positive: false },
  { call: 'Outsider, missed',         odds: '3.00', result: 'Lost', delta: '−0.33', positive: false },
  { call: 'Third miss in a row',      odds: '1.50', result: 'Lost', delta: '−2.78', positive: false },
]

const PLATFORMS: { name: string; status: string; note: string; live: boolean }[] = [
  { name: 'Polymarket',       status: 'Live',    note: 'Read from the Gamma API. Resolves when the market settles.', live: true },
  { name: 'Sportybet',        status: 'Live',    note: 'Booking codes are loaded and checked after full time.',     live: true },
  { name: 'Betano',           status: 'Planned', note: 'Same approach as Sportybet.',                                live: false },
  { name: 'Kalshi',           status: 'Planned', note: 'Public API, similar to Polymarket.',                         live: false },
]

function Receipt() {
  const rows: [string, React.ReactNode][] = [
    ['Platform',  'Sportybet'],
    ['Selection', 'Arsenal to win'],
    ['Odds',      <span className="mono">2.10</span>],
    ['Locked',    <span className="mono">14 Sep, 15:42 UTC</span>],
    ['Kick-off',  <span className="mono">14 Sep, 16:30 UTC</span>],
    ['Result',    <span style={{ color: 'var(--warning)' }}>Waiting for full time</span>],
  ]
  return (
    <div className="receipt" aria-label="Example locked prediction">
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
          <Lock size={14} strokeWidth={2} style={{ color: 'var(--accent-light)' }} />
          Locked prediction
        </span>
        <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>BC9F2K</span>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="receipt-row">
          <span>{k}</span>
          <span style={{ textAlign: 'right' }}>{v}</span>
        </div>
      ))}
      <p style={{
        padding: '12px 18px', borderTop: '1px solid var(--border)',
        fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5,
      }}>
        Example. The booking code is the proof: it can&apos;t be edited after it&apos;s shared,
        and the result comes from Sportybet&apos;s own page.
      </p>
    </div>
  )
}

export default function Home() {
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactSent, setContactSent] = useState(false)
  const [contactError, setContactError] = useState('')

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setContactError('Please fill in all three fields.'); return
    }
    const subject = encodeURIComponent(`TrustWeb contact from ${contactForm.name}`)
    const body    = encodeURIComponent(`Name: ${contactForm.name}\nEmail: ${contactForm.email}\n\n${contactForm.message}`)
    window.location.href = `mailto:hello@trustweb.app?subject=${subject}&body=${body}`
    setContactSent(true); setContactError('')
  }

  return (
    <div>

      {/* Hero */}
      <section style={{ padding: '88px 0 96px' }}>
        <div className="page-wide">
          <div className="home-hero" style={{
            display: 'grid', gridTemplateColumns: '1.15fr 1fr',
            gap: '72px', alignItems: 'center',
          }}>
            <div>
              <p style={{ fontSize: '14px', color: 'var(--accent-light)', marginBottom: '20px' }}>
                For tipsters, traders and anyone who makes calls in public
              </p>
              <h1 style={{
                fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 600,
                lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: '24px',
              }}>
                Your picks, on the record before kick&#8209;off.
              </h1>
              <p className="home-lede" style={{ marginBottom: '36px' }}>
                Paste a Sportybet booking code or a Polymarket link before the event starts.
                We timestamp it, read the result from the platform when it&apos;s over, and
                score you on it. No screenshots, no self-reporting.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link to="/login" className="btn-accent" style={{ padding: '12px 20px', fontSize: '15px' }}>
                  Start your record <ArrowRight size={16} strokeWidth={2} />
                </Link>
                <Link to="/home" className="btn-ghost" style={{ padding: '12px 18px', fontSize: '15px' }}>
                  Browse the feed
                </Link>
              </div>
            </div>

            <Receipt />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="home-section">
        <div className="page-wide">
          <div className="home-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '72px' }}>
            <div>
              <h2 className="home-h2" style={{ marginBottom: '16px' }}>How it works</h2>
              <p className="home-lede" style={{ fontSize: '15px' }}>
                The whole point is that you can&apos;t edit history. Everything below is enforced by the
                server, not by trust.
              </p>
            </div>
            <ol className="steps">
              <li>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Lock it before the start</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
                    Submit a booking code or market link. If the event has already started, it&apos;s rejected.
                    Otherwise it&apos;s stored with the time you locked it.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>We read the result</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
                    A background job checks pending picks and settles them from the platform itself.
                    You never mark your own pick as won.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Your credit score moves</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
                    Wins at long odds earn more. Misses on short odds cost more. Streaks multiply both ways.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Stay active or fade</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
                    Visibility drops 3% a day when you go quiet. After two weeks away, credit starts to slip too.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Scoring */}
      <section id="scoring" className="home-section" style={{ background: 'var(--surface)' }}>
        <div className="page-wide">
          <div className="home-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '72px' }}>
            <div>
              <h2 className="home-h2" style={{ marginBottom: '16px' }}>What a pick is worth</h2>
              <p className="home-lede" style={{ fontSize: '15px', marginBottom: '16px' }}>
                Everyone starts at 50. Credit is capped at 100, so it&apos;s slow to build and quick to lose.
              </p>
              <p className="home-lede" style={{ fontSize: '15px' }}>
                Newer accounts lose less per miss while they find their feet. Once you have about 50
                resolved picks, you&apos;re held to the full standard.
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="score-table">
                <thead>
                  <tr>
                    <th>Pick</th>
                    <th>Odds</th>
                    <th>Result</th>
                    <th style={{ textAlign: 'right' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORING_EXAMPLES.map(r => (
                    <tr key={r.call}>
                      <td>{r.call}</td>
                      <td className="num">{r.odds}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{r.result}</td>
                      <td className="num" style={{
                        textAlign: 'right',
                        color: r.positive ? 'var(--success)' : 'var(--danger)',
                      }}>{r.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
                Real outputs of the scoring function for an established account. Void bets change nothing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section id="platforms" className="home-section">
        <div className="page-wide">
          <h2 className="home-h2" style={{ marginBottom: '28px' }}>Where you can bet from</h2>
          <div className="border-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {PLATFORMS.map(p => (
              <div key={p.name} style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span className="mono" style={{
                    fontSize: '12px',
                    color: p.live ? 'var(--success)' : 'var(--text-muted)',
                  }}>{p.status}</span>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.55 }}>{p.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="home-section" style={{ background: 'var(--surface)' }}>
        <div className="page-wide">
          <div className="home-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '72px' }}>
            <div>
              <h2 className="home-h2" style={{ marginBottom: '16px' }}>Talk to us</h2>
              <p className="home-lede" style={{ fontSize: '15px', marginBottom: '24px' }}>
                Want your platform supported, found a result we got wrong, or just have an opinion?
                We read everything.
              </p>
              <p style={{ fontSize: '14px', lineHeight: 1.9 }}>
                <span style={{ color: 'var(--text-muted)' }}>General </span>
                <a href="mailto:hello@trustweb.app" style={{ color: 'var(--text)' }}>hello@trustweb.app</a>
                <br />
                <span style={{ color: 'var(--text-muted)' }}>Partnerships </span>
                <a href="mailto:partners@trustweb.app" style={{ color: 'var(--text)' }}>partners@trustweb.app</a>
              </p>
            </div>

            <div>
              {contactSent ? (
                <div style={{ padding: '24px 0' }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '6px' }}>
                    <Check size={16} strokeWidth={2} style={{ color: 'var(--success)' }} />
                    Your email app should have opened
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Send it from there and we&apos;ll reply to the address you used.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {[
                      { key: 'name',  label: 'Name',  type: 'text',  placeholder: '' },
                      { key: 'email', label: 'Email', type: 'email', placeholder: '' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="label" htmlFor={`contact-${f.key}`} style={{ display: 'block', marginBottom: '6px' }}>{f.label}</label>
                        <input
                          id={`contact-${f.key}`}
                          className="input"
                          type={f.type}
                          value={(contactForm as Record<string, string>)[f.key]}
                          onChange={e => setContactForm(p => ({ ...p, [f.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="label" htmlFor="contact-message" style={{ display: 'block', marginBottom: '6px' }}>Message</label>
                    <textarea
                      id="contact-message"
                      className="input"
                      rows={5}
                      value={contactForm.message}
                      onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                  {contactError && (
                    <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{contactError}</p>
                  )}
                  <div>
                    <button type="submit" className="btn-accent">Send</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
