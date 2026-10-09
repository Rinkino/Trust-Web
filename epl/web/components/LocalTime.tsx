'use client'
import { useEffect, useState } from 'react'

const opts = (withDate: boolean): Intl.DateTimeFormatOptions => ({
  ...(withDate ? { weekday: 'short', day: 'numeric', month: 'short' } : {}),
  hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
})

/** Kickoff time in the visitor's own time zone. The server renders UTC first. */
export default function LocalTime({ iso, withDate = true }: { iso: string; withDate?: boolean }) {
  const [text, setText] = useState(() => new Date(iso).toLocaleString('en-GB', { ...opts(withDate), timeZone: 'UTC' }))
  useEffect(() => { setText(new Date(iso).toLocaleString('en-GB', opts(withDate))) }, [iso, withDate])
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>
}
