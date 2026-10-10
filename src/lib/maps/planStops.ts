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

const MAX_PLACE_QUERIES = 15
const MAX_TOKEN_LEN = 48
const TIME_RE = /^\d{1,2}:\d{2}$/
const FLIGHT_RE = /^[A-Z]{1,3}\d{2,4}$/i
const NOISE_RE =
  /^(own|arrangement|by|japan|navi|room|only|moderate|double|included|highway|bus|daytime|arrive|flight|free|back|to|the|and|area|scenic|walking|hotel|stay)$/i

function hitToStop(
  id: string,
  kind: PlanStop["kind"],
  label: string,
  hit: GeoHit,
  dayId?: string,
): PlanStop {
  return { id, kind, label: label || hit.label, lat: hit.lat, lng: hit.lng, dayId }
}

function splitPlaces(raw: string): string[] {
  return raw
    .split(/[/→,&·•|]+/)
    .map((p) =>
      p
        .replace(/\([^)]*\)/g, " ")
        .replace(/\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}:\d{2}/g, " ")
        .replace(/\b\d{1,2}:\d{2}\b/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
}

function stripDayPrefix(label: string): string {
  return label.replace(/^Day\s*\d+\s*[·\-–—:.]?\s*/i, "").trim()
}

function isUsefulPlace(token: string): boolean {
  const t = token.trim()
  if (!t || t.length < 2 || t.length > MAX_TOKEN_LEN) return false
  if (TIME_RE.test(t) || FLIGHT_RE.test(t)) return false
  if (/^\d+$/.test(t)) return false
  if (NOISE_RE.test(t)) return false
  // Drop long prose-like phrases
  if (t.split(/\s+/).length > 5) return false
  return true
}

type PlaceQuery = { query: string; kind: PlanStop["kind"]; id: string; dayId?: string }

/** Collect short place names for geocoding (capped). */
export function extractPlaceQueries(trip: TripLike, itinerary: DayLike[]): PlaceQuery[] {
  const out: PlaceQuery[] = []
  const seen = new Set<string>()

  const push = (query: string, kind: PlanStop["kind"], id: string, dayId?: string) => {
    const q = query.trim()
    if (!isUsefulPlace(q)) return
    const key = q.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ query: q, kind, id, dayId })
  }

  if (trip.destination?.trim()) {
    for (const part of splitPlaces(trip.destination)) {
      push(part, "destination", `dest-${part.toLowerCase().replace(/\s+/g, "-")}`)
      if (out.length >= MAX_PLACE_QUERIES) return out
    }
  }

  for (const day of itinerary || []) {
    const labelBody = stripDayPrefix(day.label || "")
    for (const part of splitPlaces(labelBody)) {
      push(part, "day", `day-${day.id}-${part.toLowerCase().replace(/\s+/g, "-")}`, day.id)
      if (out.length >= MAX_PLACE_QUERIES) return out
    }
  }

  for (const day of itinerary || []) {
    for (const act of day.activities || []) {
      const t = (act.text || "").trim()
      if (!t) continue
      for (const part of splitPlaces(t)) {
        // Prefer trailing place after arrows / separators already split
        push(part, "activity", `act-${act.id}-${part.toLowerCase().replace(/\s+/g, "-")}`, day.id)
        if (out.length >= MAX_PLACE_QUERIES) return out
      }
    }
  }

  return out
}

/** @deprecated Prefer extractPlaceQueries */
export function collectPlanQueries(trip: TripLike, itinerary: DayLike[]): string[] {
  return extractPlaceQueries(trip, itinerary).map((p) => p.query)
}

/** Resolve stops from cache + optional online geocode; emits partials. */
export async function resolvePlanStops(
  trip: TripLike,
  itinerary: DayLike[],
  memories: MemoryLike[],
  opts?: {
    geocodeOnline?: boolean
    onPartial?: (stops: PlanStop[]) => void
  },
): Promise<PlanStop[]> {
  const geocodeOnline = opts?.geocodeOnline !== false && navigator.onLine
  const stops: PlanStop[] = []
  const seenCoords = new Set<string>()

  const emit = () => opts?.onPartial?.([...stops])

  const addHit = (
    id: string,
    kind: PlanStop["kind"],
    label: string,
    hit: GeoHit | null,
    dayId?: string,
  ) => {
    if (!hit) return false
    const key = `${hit.lat.toFixed(4)},${hit.lng.toFixed(4)}`
    if (seenCoords.has(key)) return false
    seenCoords.add(key)
    stops.push(hitToStop(id, kind, label, hit, dayId))
    emit()
    return true
  }

  const resolve = async (query: string) => {
    if (!query.trim()) return null
    if (geocodeOnline) return geocodeQuery(query)
    return getCachedGeocode(query)
  }

  const places = extractPlaceQueries(trip, itinerary)
  for (const p of places) {
    addHit(p.id, p.kind, p.query, await resolve(p.query), p.dayId)
  }

  for (const mem of memories || []) {
    if (typeof mem.lat !== "number" || typeof mem.lng !== "number") continue
    if (!Number.isFinite(mem.lat) || !Number.isFinite(mem.lng)) continue
    const key = `${mem.lat.toFixed(4)},${mem.lng.toFixed(4)}`
    if (seenCoords.has(key)) continue
    seenCoords.add(key)
    stops.push({
      id: `mem-${mem.id}`,
      kind: "memory",
      label: mem.title || mem.locationName || "Memory",
      lat: mem.lat,
      lng: mem.lng,
      dayId: mem.dayId,
    })
    emit()
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
  const latPad = Math.max((north - south) * 0.15, 0.08)
  const lngPad = Math.max((east - west) * 0.15, 0.08)
  return {
    south: south - latPad,
    north: north + latPad,
    west: west - lngPad,
    east: east + lngPad,
  }
}

/** Stable key for PlanRouteMap effect deps. */
export function planStopsResolveKey(
  trip: TripLike,
  itinerary: DayLike[],
  memories: MemoryLike[],
): string {
  const places = extractPlaceQueries(trip, itinerary)
    .map((p) => p.query.toLowerCase())
    .join("|")
  const mems = (memories || [])
    .filter((m) => typeof m.lat === "number" && typeof m.lng === "number")
    .map((m) => `${m.id}:${m.lat},${m.lng}`)
    .join("|")
  return `${places}::${mems}`
}
