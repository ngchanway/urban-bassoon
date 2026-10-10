import { LS } from "../storage"

export type GeoHit = { lat: number; lng: number; label: string; at: string }

const GEO_KEY = "tc_plan_geo"
const MIN_INTERVAL_MS = 1100

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

/** Geocode a place string via Nominatim; cached in tc_plan_geo. */
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
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      })
      if (!res.ok) return null
      const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>
      const hit = rows[0]
      if (!hit) return null
      const entry: GeoHit = {
        lat: Number(hit.lat),
        lng: Number(hit.lon),
        label: hit.display_name || q,
        at: new Date().toISOString(),
      }
      if (!Number.isFinite(entry.lat) || !Number.isFinite(entry.lng)) return null
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
