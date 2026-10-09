import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Everything except the landing/login page and the sign-in callback needs a signed-in
// user (Google, through the same Supabase Auth as TrustWeb). The user is verified
// with Supabase on every request, not just read from the cookie.
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://vezcwptlyyeqsaybhegv.supabase.co'
const PUBLIC = ['/login', '/auth/callback']

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })
  const supabase = createServerClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: list => {
        list.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: req })
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  const path = req.nextUrl.pathname
  const isPublic = PUBLIC.some(p => path === p || path.startsWith(`${p}/`))

  if (!user && !isPublic) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', path + req.nextUrl.search)
    return NextResponse.redirect(url)
  }
  if (user && path === '/login') {
    const next = req.nextUrl.searchParams.get('next')
    const url = req.nextUrl.clone()
    url.pathname = next && next.startsWith('/') && !next.startsWith('//') ? next.split('?')[0] : '/'
    url.search = next?.includes('?') ? next.slice(next.indexOf('?')) : ''
    return NextResponse.redirect(url)
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
