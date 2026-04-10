import { supabase } from './supabase'

// Empty string = relative URL → goes through Vite proxy → hits backend on Mac
// Set VITE_API_URL in .env only for production deploys
const API_URL = import.meta.env.VITE_API_URL || ''

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
  }
}

export const api = {
  async submitPrediction(payload: {
    title: string
    betslip_code: string
    betslip_link?: string
    odds: number
    platform: string
    event_start_time: string
    selection?: string
    market_id?: string
  }) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_URL}/api/predictions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async previewMarket(url: string) {
    const res = await fetch(`${API_URL}/api/predictions/preview?url=${encodeURIComponent(url)}`)
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async previewSlip(code: string, bookie: string) {
    const res = await fetch(`${API_URL}/api/predictions/preview?code=${encodeURIComponent(code)}&bookie=${encodeURIComponent(bookie)}`)
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async resolvePrediction(id: string, result: 'WON' | 'LOST' | 'VOID') {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_URL}/api/predictions/${id}/resolve`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ result }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async getUserPredictions(userId: string) {
    const res = await fetch(`${API_URL}/api/predictions/user/${userId}`)
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async getFeed(offset = 0, limit = 20) {
    const res = await fetch(`${API_URL}/api/predictions/feed?offset=${offset}&limit=${limit}`)
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json() as Promise<{
      items: any[]
      total: number
      hasMore: boolean
      offset: number
      limit: number
    }>
  },

  async getLeaderboard() {
    const res = await fetch(`${API_URL}/api/users/leaderboard`)
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async getTrending() {
    const res = await fetch(`${API_URL}/api/users/trending`)
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async getMyAnalytics() {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_URL}/api/users/me/analytics`, { headers })
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async getMe() {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_URL}/api/users/me`, { headers })
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async getProfile(username: string) {
    const res = await fetch(`${API_URL}/api/users/${username}`)
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async updateUsername(username: string) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_URL}/api/users/me/username`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ username }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  async deleteAccount() {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_URL}/api/users/me`, {
      method: 'DELETE',
      headers,
    })
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },
}
