import { LS } from "../storage"

export type GeoHit = { lat: number; lng: number; label: string; at: string; local?: string }

const GEO_KEY = "tc_plan_geo"
const MIN_INTERVAL_MS = 200

let lastRequestAt = 0
let chain: Promise<unknown> = Promise.resolve()

function loadCache(): Record<string, GeoHit> {
  return LS.get<Record<string, GeoHit>>(GEO_KEY, {})
}

function saveCache(cache: Record<string, GeoHit>) {
  LS.set(GEO_KEY, cache)
}

function normQuery(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ")
}

async function throttle() {
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt))
  if (wait) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()
}

/** Merge known hits into tc_plan_geo (e.g. demo seed). */
export function mergeGeocodeCache(entries: Record<string, Omit<GeoHit, "at"> & { at?: string }>) {
  const next = loadCache()
  const now = new Date().toISOString()
  for (const [query, hit] of Object.entries(entries)) {
    const key = normQuery(query)
    if (!key) continue
    if (!Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) continue
    next[key] = {
      lat: hit.lat,
      lng: hit.lng,
      label: hit.label || query,
      at: hit.at || now,
      ...(hit.local?.trim() ? { local: hit.local.trim() } : {}),
    }
  }
  saveCache(next)
}

/** Geocode via /api/geocode (Nominatim proxy); cached in tc_plan_geo. */
export function geocodeQuery(query: string): Promise<GeoHit | null> {
  const q = query.trim()
  if (!q) return Promise.resolve(null)
  const key = normQuery(q)
  const cache = loadCache()
  if (cache[key]) return Promise.resolve(cache[key])

  const job = chain.then(async () => {
    const again = loadCache()
    if (again[key]) return again[key]
    if (typeof navigator !== "undefined" && !navigator.onLine) return null

    await throttle()
    const url = `/api/geocode?q=${encodeURIComponent(q)}`
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } })
      if (!res.ok) return null
      const data = (await res.json()) as {
        lat?: number
        lng?: number
        label?: string
        error?: string
      } | null
      if (!data || typeof data.lat !== "number" || typeof data.lng !== "number") return null
      if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return null
      const entry: GeoHit = {
        lat: data.lat,
        lng: data.lng,
        label: data.label || q,
        at: new Date().toISOString(),
      }
      const next = loadCache()
      next[key] = entry
      saveCache(next)
      return entry
    } catch {
      return null
    }
  })

  chain = job.then(
    () => undefined,
    () => undefined,
  )
  return job
}

export function getCachedGeocode(query: string): GeoHit | null {
  const key = normQuery(query)
  if (!key) return null
  return loadCache()[key] || null
}
