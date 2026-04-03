import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

  async getFeed() {
    const res = await fetch(`${API_URL}/api/predictions/feed`)
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
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
}
