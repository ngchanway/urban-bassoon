/**
 * Foot route client — GET /api/route (OSRM proxy), cached in tc_plan_routes.
 * Optional intermediate vias steer foot routing along guide corridors.
 */

import { LS } from "../storage"

export type RouteHit = {
  coordinates: [number, number][]
  distanceM?: number
  durationS?: number
  profile: string
  at: string
}

export type LatLng = { lat: number; lng: number }

const ROUTE_KEY = "tc_plan_routes"
const MIN_INTERVAL_MS = 250

let lastRequestAt = 0
let chain: Promise<unknown> = Promise.resolve()

function loadCache(): Record<string, RouteHit> {
  return LS.get<Record<string, RouteHit>>(ROUTE_KEY, {})
}

function saveCache(cache: Record<string, RouteHit>) {
  LS.set(ROUTE_KEY, cache)
}

function roundCoord(n: number) {
  return Number(n.toFixed(4))
}

export function routeCacheKey(from: LatLng, to: LatLng, profile = "foot", vias: LatLng[] = []) {
  const viaPart = vias.map((v) => `${roundCoord(v.lat)},${roundCoord(v.lng)}`).join(";")
  return (
    `${profile}:${roundCoord(from.lat)},${roundCoord(from.lng)}` +
    (viaPart ? `;${viaPart}` : "") +
    `;${roundCoord(to.lat)},${roundCoord(to.lng)}`
  )
}

async function throttle() {
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt))
  if (wait) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()
}

export function getCachedRoute(
  from: LatLng,
  to: LatLng,
  profile = "foot",
  vias: LatLng[] = [],
): RouteHit | null {
  return loadCache()[routeCacheKey(from, to, profile, vias)] || null
}

/** Fetch foot route via /api/route; cached in tc_plan_routes. */
export function fetchRoute(
  from: LatLng,
  to: LatLng,
  profile = "foot",
  vias: LatLng[] = [],
): Promise<RouteHit | null> {
  if (
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lng) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lng)
  ) {
    return Promise.resolve(null)
  }
  if (profile !== "foot") return Promise.resolve(null)
  const cleanVias = vias.filter(
    (v) =>
      Number.isFinite(v.lat) &&
      Number.isFinite(v.lng) &&
      Math.abs(v.lat) <= 90 &&
      Math.abs(v.lng) <= 180,
  )

  const key = routeCacheKey(from, to, profile, cleanVias)
  const cache = loadCache()
  if (cache[key]?.coordinates?.length) return Promise.resolve(cache[key])

  const job = chain.then(async () => {
    const again = loadCache()
    if (again[key]?.coordinates?.length) return again[key]
    if (typeof navigator !== "undefined" && !navigator.onLine) return null

    await throttle()
    const params = new URLSearchParams({
      fromLat: String(from.lat),
      fromLng: String(from.lng),
      toLat: String(to.lat),
      toLng: String(to.lng),
      profile,
    })
    for (const v of cleanVias) {
      params.append("viaLat", String(v.lat))
      params.append("viaLng", String(v.lng))
    }
    try {
      const res = await fetch(`/api/route?${params}`, {
        headers: { Accept: "application/json" },
      })
      if (!res.ok) return null
      const data = (await res.json()) as {
        coordinates?: [number, number][]
        distanceM?: number
        durationS?: number
        profile?: string
        error?: string
      }
      if (!data.coordinates?.length) return null
      const entry: RouteHit = {
        coordinates: data.coordinates,
        distanceM: data.distanceM,
        durationS: data.durationS,
        profile: data.profile || profile,
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
