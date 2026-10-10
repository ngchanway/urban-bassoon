/**
 * Cloudflare Pages Function — Nominatim geocode proxy
 * Sets identifying User-Agent; throttles ~1 req/s.
 */

type PagesFunction<Env = unknown> = (context: {
  request: Request
  env: Env
  params: Record<string, string>
  waitUntil: (promise: Promise<unknown>) => void
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>
  data: Record<string, unknown>
}) => Response | Promise<Response>

const USER_AGENT = "TravelPal/1.0 (urban-bassoon; https://github.com/chanwayELGO/urban-bassoon)"
const MIN_INTERVAL_MS = 1100
const CACHE_TTL_MS = 60 * 60 * 1000

type CacheEntry = { at: number; body: string }

let lastRequestAt = 0
const memCache = new Map<string, CacheEntry>()

async function throttle() {
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt))
  if (wait) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const q = (url.searchParams.get("q") || "").trim()
  if (!q || q.length > 200) {
    return Response.json({ error: "q is required (max 200 chars)" }, { status: 400 })
  }

  const cacheKey = q.toLowerCase()
  const cached = memCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return new Response(cached.body, {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Geocode-Cache": "hit" },
    })
  }

  await throttle()

  const nominatim = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
  try {
    const res = await fetch(nominatim, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    })
    if (!res.ok) {
      return Response.json({ error: `Nominatim ${res.status}` }, { status: 502 })
    }
    const rows = (await res.json()) as Array<{
      lat: string
      lon: string
      display_name?: string
    }>
    const hit = rows[0]
    const payload = hit
      ? {
          lat: Number(hit.lat),
          lng: Number(hit.lon),
          label: hit.display_name || q,
        }
      : null

    if (payload && (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng))) {
      return Response.json(null)
    }

    const body = JSON.stringify(payload)
    memCache.set(cacheKey, { at: Date.now(), body })
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Geocode-Cache": "miss" },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Geocode failed"
    return Response.json({ error: msg }, { status: 502 })
  }
}
