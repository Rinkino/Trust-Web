import type { Metadata } from 'next'
import MyPicks from '@/components/MyPicks'
import SavedProps from '@/components/SavedProps'

export const metadata: Metadata = { title: 'My picks · EPL Predictor' }

export default function MyPicksPage() {
  return (
    <>
      <h1>My picks</h1>
      <p className="lede">Everything you saved, checked automatically once each match is played.</p>
      <SavedProps />
      <h2>Your result picks</h2>
      <MyPicks />
    </>
  )
}
