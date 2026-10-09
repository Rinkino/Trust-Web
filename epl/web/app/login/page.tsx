import type { Metadata } from 'next'
import GoogleButton from '@/components/GoogleButton'
import { heldOutResultAccuracy } from '@/lib/live'
import { safeNext } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sign in · EPL Predictor' }

type SP = Promise<Record<string, string | undefined>>

export default async function Login({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const next = safeNext(sp.next)
  const acc = await heldOutResultAccuracy().catch(() => null)
  return (
    <div className="landing">
      <section className="landing-hero">
        <h1>Premier League predictions, explained.</h1>
        <p className="lede">
          See the chances of a home win, draw or away win for every upcoming match, read why the model thinks so in plain
          English, then make your own pick and see how you do against it.
        </p>
        <div className="signin card">
          <GoogleButton next={next} />
          {sp.error ? <p className="small neg" role="alert">Sign-in did not complete. Please try again.</p> : null}
          <p className="small muted">Uses the same Google sign-in as TrustWeb. Your picks are saved to your account.</p>
        </div>
      </section>
      <ul className="landing-points">
        <li><strong>Every upcoming fixture</strong><span>Kick-off time, home/draw/away chances and the most likely score.</span></li>
        <li><strong>Reasons, not just numbers</strong><span>Which recent form, ratings and home advantage moved each prediction, taken from the model itself.</span></li>
        <li><strong>Your picks, scored</strong><span>1 point for the right result, 3 for the exact score, next to the model&apos;s record on the same matches.</span></li>
      </ul>
      {acc && (
        <p className="note">
          Honest about accuracy: on the {acc.season} season, which the model never saw during development, its most likely
          result was right in {Math.round(acc.accuracy * 100)}% of {acc.n} matches. Football is uncertain; no prediction is a sure thing.
        </p>
      )}
    </div>
  )
}
