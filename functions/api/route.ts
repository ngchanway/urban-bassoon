/**
 * Cloudflare Pages Function — OSRM foot route proxy.
 * Throttles requests; never exposes upstream details beyond geometry.
 * Optional intermediate vias: viaLat/viaLng (repeat) or waypoints JSON [[lat,lng],...].
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
const MIN_INTERVAL_MS = 400
const CACHE_TTL_MS = 60 * 60 * 1000
const OSRM_BASE = "https://router.project-osrm.org"
const MAX_VIAS = 20

type CacheEntry = { at: number; body: string }

let lastRequestAt = 0
const memCache = new Map<string, CacheEntry>()

async function throttle() {
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt))
  if (wait) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()
}

function parseCoord(v: string | null): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function roundKey(n: number) {
  return n.toFixed(4)
}

function validLatLng(lat: number, lng: number) {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/** Intermediate vias from viaLat/viaLng pairs or waypoints=[[lat,lng],...] */
function parseVias(url: URL): { lat: number; lng: number }[] | null {
  const vias: { lat: number; lng: number }[] = []
  const viaLats = url.searchParams.getAll("viaLat")
  const viaLngs = url.searchParams.getAll("viaLng")
  if (viaLats.length || viaLngs.length) {
    if (viaLats.length !== viaLngs.length) return null
    for (let i = 0; i < viaLats.length; i++) {
      const lat = parseCoord(viaLats[i] ?? null)
      const lng = parseCoord(viaLngs[i] ?? null)
      if (lat == null || lng == null || !validLatLng(lat, lng)) return null
      vias.push({ lat, lng })
    }
  }
  const wpRaw = url.searchParams.get("waypoints")
  if (wpRaw) {
    try {
      const parsed = JSON.parse(wpRaw) as unknown
      if (!Array.isArray(parsed)) return null
      for (const row of parsed) {
        if (!Array.isArray(row) || row.length < 2) return null
        const lat = Number(row[0])
        const lng = Number(row[1])
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !validLatLng(lat, lng)) return null
        vias.push({ lat, lng })
      }
    } catch {
      return null
    }
  }
  if (vias.length > MAX_VIAS) return null
  return vias
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const fromLat = parseCoord(url.searchParams.get("fromLat"))
  const fromLng = parseCoord(url.searchParams.get("fromLng"))
  const toLat = parseCoord(url.searchParams.get("toLat"))
  const toLng = parseCoord(url.searchParams.get("toLng"))
  const profileRaw = (url.searchParams.get("profile") || "foot").trim().toLowerCase()
  const profile = profileRaw === "foot" ? "foot" : null
  const vias = parseVias(url)

  if (
    fromLat == null ||
    fromLng == null ||
    toLat == null ||
    toLng == null ||
    !validLatLng(fromLat, fromLng) ||
    !validLatLng(toLat, toLng)
  ) {
    return Response.json(
      { error: "fromLat, fromLng, toLat, toLng are required (valid WGS84)" },
      { status: 400 },
    )
  }
  if (!profile) {
    return Response.json({ error: "profile must be foot" }, { status: 400 })
  }
  if (vias == null) {
    return Response.json(
      { error: "invalid vias (viaLat/viaLng pairs or waypoints JSON, max 20)" },
      { status: 400 },
    )
  }

  const viaKey = vias.map((v) => `${roundKey(v.lat)},${roundKey(v.lng)}`).join(";")
  const cacheKey =
    `${profile}:${roundKey(fromLat)},${roundKey(fromLng)}` +
    (viaKey ? `;${viaKey}` : "") +
    `;${roundKey(toLat)},${roundKey(toLng)}`
  const cached = memCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return new Response(cached.body, {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Route-Cache": "hit" },
    })
  }

  await throttle()

  const pathParts = [
    `${fromLng},${fromLat}`,
    ...vias.map((v) => `${v.lng},${v.lat}`),
    `${toLng},${toLat}`,
  ]
  const osrmUrl =
    `${OSRM_BASE}/route/v1/${profile}/` +
    pathParts.join(";") +
    `?overview=full&geometries=geojson&continue_straight=true`

  try {
    const res = await fetch(osrmUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    })
    if (!res.ok) {
      return Response.json({ error: `OSRM ${res.status}` }, { status: 502 })
    }
    const data = (await res.json()) as {
      code?: string
      routes?: Array<{
        distance?: number
        duration?: number
        geometry?: { type?: string; coordinates?: [number, number][] }
      }>
    }
    if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) {
      return Response.json({ error: "No route found" }, { status: 404 })
    }
    const route = data.routes[0]
    // GeoJSON is [lng, lat] — convert to [lat, lng] for Leaflet
    const coordinates = (route.geometry?.coordinates || []).map(
      ([lng, lat]) => [lat, lng] as [number, number],
    )
    const payload = {
      profile,
      coordinates,
      distanceM: typeof route.distance === "number" ? route.distance : undefined,
      durationS: typeof route.duration === "number" ? route.duration : undefined,
    }
    const body = JSON.stringify(payload)
    memCache.set(cacheKey, { at: Date.now(), body })
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Route-Cache": "miss" },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Route failed"
    return Response.json({ error: msg }, { status: 502 })
  }
}
