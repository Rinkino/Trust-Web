# TrustWeb — CLAUDE.md

This file exists so any developer or Claude instance can pick up the project immediately without losing context.

---

## What TrustWeb Is

A credibility platform for predictors. Users lock predictions before events start (sports bets, prediction markets), and earn a **credit score** based on their accuracy over time — weighted by odds difficulty and consistency streaks.

The core guarantee: **predictions cannot be backdated**. A betslip share code is a timestamped receipt. The outcome is read automatically from the platform, never self-reported by the user.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Express + TypeScript (tsx watch) |
| Database | Supabase (Postgres + Auth + RLS) |
| Auth | Google OAuth via Supabase |
| Styling | CSS variables, no UI library |
| Scraping | Puppeteer (headless Chrome) |

---

## Running the Project

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:3001

---

## Environment Variables

**backend/.env**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SPORTYBET_EMAIL=        # our service account email
SPORTYBET_PASSWORD=     # our service account password
```

**frontend/.env**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3001
```

---

## Database Schema (Supabase)

### profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid | matches auth.users.id |
| username | text | unique |
| credit_score | float | 0–100, starts at 50 |
| visibility_score | float | momentum score, streak-driven |
| correct_streak | int | current win streak |
| wrong_streak | int | current loss streak |
| best_streak_ever | int | all-time best |
| total_resolved | int | |
| total_correct | int | |
| user_state | text | ACTIVE / DECAYING |
| last_resolved_at | timestamptz | |
| days_inactive | int | |

### predictions
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK → profiles |
| title | text | display name |
| betslip_code | text | unique share code |
| betslip_link | text | full URL |
| odds | float | decimal odds |
| platform | text | Sportybet / Polymarket / etc |
| status | text | PENDING / WON / LOST / VOID |
| locked_at | timestamptz | when submitted |
| event_start_time | timestamptz | |
| resolved_at | timestamptz | |
| score_contribution | float | credit delta on resolution |
| market_id | text | Polymarket conditionId |
| selection | text | YES / NO (Polymarket) |

### score_history
Immutable audit log — one row per resolution. Never deleted.

---

## Scoring System

See `backend/src/services/scoring.ts` for full implementation.

**Credit score (0–100):**
- Starts at 50
- Win at long odds = big gain
- Win at short odds = small gain
- Loss at short odds = big penalty (you should have known)
- Loss at long odds = small penalty
- Consecutive wins multiply the reward
- High credit score means losses hurt more (harder to keep than build)
- Decays slowly with inactivity

**Visibility score:**
- Purely momentum-based — spikes on streaks, fades when inactive
- Separate from credit score — you can be trending without being trusted

---

## Platform Integration Status

### Polymarket — COMPLETE
- File: `backend/src/services/platforms/polymarket.ts`
- Uses Gamma API (public, no auth needed)
- Dashboard shows live preview when a Polymarket URL is pasted
- YES/NO selection buttons with live odds
- Auto-resolves every 5 minutes via cron (`resolver.ts`)
- Stores `market_id` and `selection` on the prediction

### Sportybet — IN PROGRESS
- File: `backend/src/services/platforms/sportybet.ts`
- Uses Puppeteer with our service account to load share codes
- Extracts: teams, selection, odds, match status
- Auto-resolves by checking if share code shows WON/LOST
- Cron job in `resolver.ts` needs updating to call Sportybet resolver too
- Credentials stored in `.env` as SPORTYBET_EMAIL / SPORTYBET_PASSWORD
- The share code is the user's proof — the result on Sportybet's own page is the ground truth

### Betano — PLANNED
- Same Puppeteer approach as Sportybet
- Separate service account needed

### football.com.ng — PLANNED
- Use as independent results cross-reference
- Scrape final match scores to cross-check Sportybet results

---

## Key Files

```
backend/
  src/
    index.ts                          # Express app entry, starts cron
    middleware/auth.ts                # Supabase bearer token validation
    routes/
      predictions.ts                 # POST /api/predictions, GET /feed, PATCH resolve, GET preview
      users.ts                       # GET /me, /leaderboard, /trending, /:username
    services/
      scoring.ts                     # Core scoring engine
      resolver.ts                    # Cron job — polls pending predictions, auto-resolves
      platforms/
        polymarket.ts                # Polymarket Gamma API integration (DONE)
        sportybet.ts                 # Puppeteer scraper (IN PROGRESS)

frontend/
  src/
    pages/
      Home.tsx                       # Landing page with scroll-reveal animations
      Login.tsx                      # Google OAuth
      Dashboard.tsx                  # User predictions, lock form, Polymarket preview
      Feed.tsx                       # Community feed, leaderboard, trending
    components/
      PredictionCard.tsx             # Card used in both Feed and Dashboard
      ScoreBadge.tsx                 # Credit + visibility score display
      AnimatedCounter.tsx            # requestAnimationFrame number animation
      Aurora.tsx                     # Background animated orbs
      Navbar.tsx                     # Sticky nav with theme switcher
      Footer.tsx                     # Links, brand
    lib/
      api.ts                         # All frontend API calls
      supabase.ts                    # Supabase client
      theme.tsx                      # ThemeProvider, useTheme hook
      useScrollReveal.ts             # IntersectionObserver scroll animations
    styles/
      global.css                     # All CSS variables, themes, animations

supabase/
  schema.sql                         # Full database schema with RLS policies
  migration_add_market_fields.sql    # Adds market_id + selection to predictions
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | No | Health check |
| POST | /api/predictions | Yes | Submit new prediction |
| GET | /api/predictions/feed | No | All pending predictions sorted by credit score |
| GET | /api/predictions/preview?url= | No | Polymarket live market preview |
| GET | /api/predictions/user/:userId | No | User's predictions |
| PATCH | /api/predictions/:id/resolve | Yes | Manual resolve (testing only) |
| GET | /api/users/me | Yes | Current user profile |
| GET | /api/users/leaderboard | No | Top users by credit score |
| GET | /api/users/trending | No | Top users by streak |
| GET | /api/users/:username | No | Public profile |

---

## Git Branches

- `main` — stable, deployable
- `dev` — integration branch
- `dev-1` — active development branch

Always work on `dev-1`, merge to `dev`, then `main`.

---

## What's Left to Build

### High priority
- [ ] Complete Sportybet scraper — extract bet details from share code page
- [ ] Update resolver cron to poll Sportybet PENDING predictions
- [ ] Update Dashboard form to show structured preview for Sportybet URLs (teams, selection, odds)
- [ ] Betano scraper (same pattern as Sportybet)
- [ ] football.com.ng result cross-reference

### Medium priority
- [ ] Public profile pages (`/u/:username`)
- [ ] Kalshi integration (has public API, similar to Polymarket)
- [ ] Notification when a prediction auto-resolves
- [ ] Accumulator support (multi-leg bets)

### Lower priority
- [ ] Deploy to production (Render for backend, Vercel for frontend)
- [ ] Email/SMS notification on resolution
- [ ] Admin dashboard for flagged disputes
- [ ] Mobile app

---

## Important Decisions Made

- **No self-reporting**: outcomes are always read from the platform, never from the user
- **Betslip code is immutable**: changing the slip generates a new code, preventing editing after lock
- **Sportybet approach**: we maintain a service account, use Puppeteer to load share codes — the result on Sportybet's page IS the ground truth
- **Two-metric scoring**: credit score (long-term trust) and visibility score (short-term momentum) are separate intentionally
- **No co-author tags in commits**: never add Claude co-authored-by lines
- **No emojis in code**: use Lucide icons instead
