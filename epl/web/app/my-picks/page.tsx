import type { Metadata } from 'next'
import MyPicks from '@/components/MyPicks'

export const metadata: Metadata = { title: 'My picks · EPL Predictor' }

export default function MyPicksPage() {
  return (
    <>
      <h1>My picks</h1>
      <p className="lede">
        Your own predictions, scored automatically once each result is in, next to how the model did on the same matches.
      </p>
      <MyPicks />
    </>
  )
}
