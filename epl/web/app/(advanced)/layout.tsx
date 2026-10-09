import Link from 'next/link'

const SECTIONS = [
  ['/advanced', 'Overview'],
  ['/evaluation', 'Model evaluation'],
  ['/predictions', 'All upcoming numbers'],
  ['/history', 'Historical accuracy'],
  ['/demo', 'Three-match demo'],
  ['/data', 'Data quality'],
]

// Everything detailed lives under "Advanced statistics": backtests, model comparisons,
// the bookmaker reference and data-quality information.
export default function AdvancedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="subnav" aria-label="Advanced statistics">
        <span className="muted small">Advanced statistics:</span>
        {SECTIONS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      {children}
    </>
  )
}
