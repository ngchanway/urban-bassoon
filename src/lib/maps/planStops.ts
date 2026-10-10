import { type GeoHit, geocodeQuery, getCachedGeocode } from "./geocode"

export type PlanStop = {
  id: string
  kind: "destination" | "day" | "activity" | "memory"
  label: string
  lat: number
  lng: number
  dayId?: string
}

type TripLike = { destination?: string }
type DayLike = { id: string; label?: string; activities?: Array<{ id: string; text?: string }> }
type MemoryLike = {
  id: string
  lat?: number
  lng?: number
  title?: string
  locationName?: string
  dayId?: string
}

function hitToStop(
  id: string,
  kind: PlanStop["kind"],
  label: string,
  hit: GeoHit,
  dayId?: string,
): PlanStop {
  return { id, kind, label: label || hit.label, lat: hit.lat, lng: hit.lng, dayId }
}

/** Collect queries that should be geocoded for the plan map. */
export function collectPlanQueries(trip: TripLike, itinerary: DayLike[]): string[] {
  const out: string[] = []
  if (trip.destination?.trim()) out.push(trip.destination.trim())
  for (const day of itinerary || []) {
    if (day.label?.trim()) out.push(day.label.trim())
    for (const act of day.activities || []) {
      const t = (act.text || "").trim()
      if (t) out.push(t)
    }
  }
  return [...new Set(out)]
}

/** Resolve stops from cache + optional online geocode. */
export async function resolvePlanStops(
  trip: TripLike,
  itinerary: DayLike[],
  memories: MemoryLike[],
  opts?: { geocodeOnline?: boolean },
): Promise<PlanStop[]> {
  const geocodeOnline = opts?.geocodeOnline !== false && navigator.onLine
  const stops: PlanStop[] = []
  const seen = new Set<string>()

  const addHit = (
    id: string,
    kind: PlanStop["kind"],
    label: string,
    hit: GeoHit | null,
    dayId?: string,
  ) => {
    if (!hit) return
    const key = `${hit.lat.toFixed(4)},${hit.lng.toFixed(4)}`
    if (seen.has(key)) return
    seen.add(key)
    stops.push(hitToStop(id, kind, label, hit, dayId))
  }

  const resolve = async (query: string) => {
    if (!query.trim()) return null
    if (geocodeOnline) return geocodeQuery(query)
    return getCachedGeocode(query)
  }

  if (trip.destination?.trim()) {
    addHit("dest", "destination", trip.destination.trim(), await resolve(trip.destination))
  }

  for (const day of itinerary || []) {
    if (day.label?.trim()) {
      addHit(`day-${day.id}`, "day", day.label.trim(), await resolve(day.label), day.id)
    }
    for (const act of day.activities || []) {
      const t = (act.text || "").trim()
      if (!t) continue
      addHit(`act-${act.id}`, "activity", t, await resolve(t), day.id)
    }
  }

  for (const mem of memories || []) {
    if (typeof mem.lat !== "number" || typeof mem.lng !== "number") continue
    if (!Number.isFinite(mem.lat) || !Number.isFinite(mem.lng)) continue
    const key = `${mem.lat.toFixed(4)},${mem.lng.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)
    stops.push({
      id: `mem-${mem.id}`,
      kind: "memory",
      label: mem.title || mem.locationName || "Memory",
      lat: mem.lat,
      lng: mem.lng,
      dayId: mem.dayId,
    })
  }

  return stops
}

export function boundsFromStops(stops: PlanStop[]): {
  south: number
  west: number
  north: number
  east: number
} | null {
  if (!stops.length) return null
  let south = stops[0].lat
  let north = stops[0].lat
  let west = stops[0].lng
  let east = stops[0].lng
  for (const s of stops) {
    south = Math.min(south, s.lat)
    north = Math.max(north, s.lat)
    west = Math.min(west, s.lng)
    east = Math.max(east, s.lng)
  }
  // Pad ~15%
  const latPad = Math.max((north - south) * 0.15, 0.08)
  const lngPad = Math.max((east - west) * 0.15, 0.08)
  return {
    south: south - latPad,
    north: north + latPad,
    west: west - lngPad,
    east: east + lngPad,
  }
}
