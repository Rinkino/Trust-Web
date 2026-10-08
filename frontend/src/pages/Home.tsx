import { Link } from 'react-router-dom'
import { ArrowRight, Lock, Check, X } from 'lucide-react'
import type React from 'react'

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is it free?',
    a: 'Yes. Creating an account, locking picks and having a public record cost nothing.',
  },
  {
    q: 'Which bookmakers and markets work?',
    a: 'Sportybet booking codes and Polymarket markets today. Betano and Kalshi are next.',
  },
  {
    q: 'Do I have to give you my bookmaker login?',
    a: 'No. You paste the booking code or market link you would share with anyone. We never touch your account or your money.',
  },
  {
    q: 'Can I delete or edit a pick after locking it?',
    a: "No, and that's the point. A booking code can't change once it's shared, and neither can your entry here.",
  },
  {
    q: 'How is my score worked out?',
    a: 'Everyone starts at 50. Winning at long odds earns more than winning at short odds; missing an easy one costs more than missing a long shot. Streaks amplify both.',
  },
  {
    q: 'What if a match is postponed or a market is voided?',
    a: 'The pick is marked void and your score does not move.',
  },
]

function HeroSlip() {
  const rows: [string, React.ReactNode][] = [
    ['Selection', 'Arsenal to win'],
    ['Odds',      <span className="mono">2.10</span>],
    ['Locked',    <span className="mono">15:42 UTC</span>],
    ['Kick-off',  <span className="mono">16:30 UTC</span>],
  ]
  return (
    <div className="receipt" aria-hidden="true" style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.35)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
          <Lock size={14} strokeWidth={2} style={{ color: 'var(--accent-light)' }} />
          Locked
        </span>
        <span className="pill pill-won">Won</span>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="receipt-row">
          <span>{k}</span>
          <span>{v}</span>
        </div>
      ))}
      <div className="receipt-row" style={{ borderTopStyle: 'solid' }}>
        <span>Credit</span>
        <span className="mono" style={{ color: 'var(--success)' }}>62.4 &rarr; 64.8</span>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div>

      {/* Hero */}
      <section style={{ padding: '96px 0 112px' }}>
        <div className="page-wide">
          <div className="home-hero" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '80px', alignItems: 'center' }}>
            <div>
              <h1 style={{
                fontSize: 'clamp(40px, 5.6vw, 64px)', fontWeight: 600,
                lineHeight: 1.04, letterSpacing: '-0.035em', marginBottom: '24px',
              }}>
                Prove you can call&nbsp;it.
              </h1>
              <p className="home-lede" style={{ fontSize: '19px', marginBottom: '36px' }}>
                Anyone can post a winning slip after the match. TrustWeb locks your picks before
                kick-off and builds a public track record from the results, so people can see who
                actually knows what they&apos;re talking about.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Link to="/signup" className="btn-accent" style={{ padding: '13px 22px', fontSize: '15px' }}>
                  Create a free account <ArrowRight size={16} strokeWidth={2} />
                </Link>
                <Link to="/login" className="btn-ghost" style={{ padding: '13px 20px', fontSize: '15px' }}>
                  Log in
                </Link>
              </div>
              <p style={{ marginTop: '28px', fontSize: '14px', color: 'var(--text-muted)' }}>
                Works with Sportybet and Polymarket.
              </p>
            </div>
            <HeroSlip />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="home-section" style={{ background: 'var(--surface)' }}>
        <div className="page-wide">
          <h2 className="home-h2" style={{ maxWidth: '18em', marginBottom: '48px' }}>
            Screenshots prove nothing. A locked record does.
          </h2>
          <div className="home-three">
            <div>
              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '10px' }}>
                <X size={16} strokeWidth={2} style={{ color: 'var(--danger)' }} /> How it works now
              </p>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
                Tipsters post their wins, quietly delete their losses, and sell &ldquo;VIP&rdquo; groups on the back
                of a few lucky slips. Followers have no way to check.
              </p>
            </div>
            <div>
              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '10px' }}>
                <Check size={16} strokeWidth={2} style={{ color: 'var(--success)' }} /> How it works here
              </p>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
                Every pick is timestamped before the event and settled from the bookmaker&apos;s own result.
                Wins and losses both stay on the record, permanently.
              </p>
            </div>
            <div>
              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '10px' }}>
                <Check size={16} strokeWidth={2} style={{ color: 'var(--success)' }} /> What you get
              </p>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
                A credit score and a public profile you can link to anywhere. If you&apos;re good, you
                finally have proof. If you&apos;re following someone, you can check before you pay.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="home-section">
        <div className="page-wide">
          <div className="home-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '72px' }}>
            <div>
              <h2 className="home-h2" style={{ marginBottom: '16px' }}>Three steps, then it runs itself</h2>
              <p className="home-lede" style={{ fontSize: '16px' }}>
                You only ever do the first two. Results and scoring happen without you.
              </p>
            </div>
            <ol className="steps">
              <li>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px' }}>Create your account</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
                    Google or email. Pick a username; that&apos;s the name on your public record.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px' }}>Lock a pick before it starts</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
                    Paste your Sportybet booking code or a Polymarket link. Once the event has started,
                    it&apos;s too late, so nobody can sneak in a result they already know.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px' }}>Let the results come in</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
                    We check the outcome on the platform itself and update your score. Hard calls earn
                    more; careless misses cost more.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section id="who-its-for" className="home-section" style={{ background: 'var(--surface)' }}>
        <div className="page-wide">
          <h2 className="home-h2" style={{ marginBottom: '40px' }}>Who it&apos;s for</h2>
          <div className="border-grid home-three-grid">
            {[
              {
                title: 'Tipsters',
                body: "Stop arguing in the comments. Send people to a record they can't accuse you of editing.",
              },
              {
                title: 'Punters following tips',
                body: 'See hit rate, odds and history before you copy a slip or pay for a group.',
              },
              {
                title: 'Prediction market traders',
                body: 'Your Polymarket calls, scored on the same scale as everyone else.',
              },
            ].map(c => (
              <div key={c.title} style={{ padding: '28px', background: 'var(--surface)' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>{c.title}</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="home-section">
        <div className="page-wide">
          <div className="home-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '72px' }}>
            <h2 className="home-h2">Questions people ask first</h2>
            <div>
              {FAQ.map(f => (
                <details key={f.q} className="faq">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="home-section" style={{ background: 'var(--surface)', textAlign: 'center' }}>
        <div className="page-wide">
          <h2 className="home-h2" style={{ fontSize: 'clamp(28px, 4vw, 44px)', marginBottom: '16px' }}>
            Your next pick could be your first on the record.
          </h2>
          <p className="home-lede" style={{ margin: '0 auto 32px' }}>
            It takes a minute to sign up and costs nothing.
          </p>
          <Link to="/signup" className="btn-accent" style={{ padding: '13px 24px', fontSize: '15px' }}>
            Create a free account <ArrowRight size={16} strokeWidth={2} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '40px 0 48px' }}>
        <div className="page-wide" style={{ display: 'flex', justifyContent: 'space-between', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '6px' }}>TrustWeb</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              &copy; {new Date().getFullYear()} TrustWeb. Not a bookmaker; we never take bets.
            </p>
          </div>
          <nav style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '14px' }}>
            <a href="#how-it-works" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>How it works</a>
            <a href="#faq" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>FAQ</a>
            <a href="mailto:hello@trustweb.app" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Contact</a>
            <Link to="/login" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Log in</Link>
            <Link to="/signup" style={{ color: 'var(--text)', textDecoration: 'none' }}>Sign up</Link>
          </nav>
        </div>
      </footer>

    </div>
  )
}
