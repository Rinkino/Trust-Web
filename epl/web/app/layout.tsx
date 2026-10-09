import type { Metadata } from 'next'
import Link from 'next/link'
import AuthButton from '@/components/AuthButton'
import './globals.css'

export const metadata: Metadata = {
  title: 'EPL Predictor',
  description: 'Premier League match predictions explained in plain English, with your own picks scored against the model.',
}

const NAV = [
  ['/', 'Fixtures'],
  ['/my-picks', 'My picks'],
  ['/advanced', 'Advanced statistics'],
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="top">
          <div className="shell">
            <Link href="/" className="brand">EPL Predictor</Link>
            <nav>
              {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            </nav>
            <AuthButton />
          </div>
        </header>
        <main><div className="shell">{children}</div></main>
        <footer className="bottom">
          <div className="shell">
            Predictions are estimates, not guarantees. Historical accuracy describes past performance on held-out
            matches, not the chance that any single prediction is right. Data: football-data.co.uk (results and
            statistics), fixturedownload.com (schedule).
          </div>
        </footer>
      </body>
    </html>
  )
}
