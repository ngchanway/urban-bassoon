import { type GeoHit, geocodeQuery, getCachedGeocode } from "./geocode"
import { type MapEntitlements, getMapEntitlements } from "./mapEntitlements"

export type PlanStopKind = "hub" | "stay" | "transit" | "day" | "activity" | "memory"

export type PlanStop = {
  id: string
  kind: PlanStopKind
  label: string
  /** Local-script name for asking locals (e.g. 新宿). */
  localLabel?: string
  lat: number
  lng: number
  dayId?: string
  dayLabel?: string
  offlineEligible: boolean
  noteKey: string
  activitySnippet?: string
  /** Structured activity clock time (HH:mm), not parsed from text */
  activityTime?: string
  activityIds: string[]
}

type TripLike = { destination?: string }
type DayLike = {
  id: string
  label?: string
  activities?: Array<{
    id: string | number
    text?: string
    kind?: string
    lodging?: boolean
    mapQuery?: string
    mapQueryTo?: string
    time?: string
  }>
}
type MemoryLike = {
  id: string
  lat?: number
  lng?: number
  title?: string
  locationName?: string
  dayId?: string
}

const MAX_TOKEN_LEN = 64
const TIME_RE = /^\d{1,2}:\d{2}$/
const FLIGHT_RE = /^[A-Z]{1,3}\d{2,4}$/i
const NOISE_RE =
  /^(own|arrangement|by|japan|navi|room|only|moderate|double|included|highway|bus|daytime|arrive|flight|free|back|to|the|and|area|scenic|walking|stay|begin|nakasendo|walk|train|public|transport|further|north|through|selected|section|shorten|if|needed|continue|suitable|starting|point|casual|western|twin|wide|private|japanese-style|above|soba|restaurant|near|shared|living|shower|toilets|limited|english|nights?|breakfast|dinner)$/i

const HUB_AIRPORT_QUERY: Record<string, string> = {
  singapore: "Singapore Changi Airport",
  changi: "Singapore Changi Airport",
}

function normKey(q: string) {
  return q
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!"')\]]+$/g, "")
}

function actId(id: string | number) {
  return String(id)
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
        .trim()
        .replace(/[.,;:!"')\]]+$/g, ""),
    )
    .filter(Boolean)
}

function stripDayPrefix(label: string): string {
  return label.replace(/^Day\s*\d+\s*[·\-–—:.]?\s*/i, "").trim()
}

function isUsefulPlace(token: string, opts?: { maxWords?: number }): boolean {
  const t = token.trim()
  const maxWords = opts?.maxWords ?? 5
  if (!t || t.length < 2 || t.length > MAX_TOKEN_LEN) return false
  if (TIME_RE.test(t) || FLIGHT_RE.test(t)) return false
  if (/^\d+$/.test(t)) return false
  if (NOISE_RE.test(t)) return false
  if (t.split(/\s+/).length > maxWords) return false
  return true
}

/** Hotel name from stay line (before ·, trim room descriptors). */
export function lodgingName(text: string): string {
  let name = text.split(/[·•]/)[0] || text
  name = name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  name = name
    .replace(/\s*[·•].*$|·\s*(moderate|casual|western|wide|private|room|breakfast|dinner).*$/i, "")
    .trim()
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length > 8) name = words.slice(0, 8).join(" ")
  return name
}

type PlaceQuery = {
  query: string
  kind: PlanStopKind
  id: string
  dayId?: string
  dayLabel?: string
  offlineEligible: boolean
  activitySnippet?: string
  activityTime?: string
  activityIds: string[]
  priority: "core" | "secondary"
}

function activityClock(act: { time?: string }): string | undefined {
  const t = (act.time || "").trim()
  return t || undefined
}

export type ExtractResult = {
  places: PlaceQuery[]
  secondaryTruncated: boolean
  entitlements: MapEntitlements
}

/** Outbound home departure place (left of first flight → ), if any. */
export function findDepartureHub(itinerary: DayLike[]): string | null {
  for (const day of itinerary || []) {
    for (const act of day.activities || []) {
      const t = (act.text || "").trim()
      if (!t) continue
      const isFlight = /flight|airport|depart/i.test(t) || act.kind === "transfer"
      if (!isFlight || !t.includes("→")) continue
      const left = splitPlaces(t)[0]
      if (left && isUsefulPlace(left)) return left
      return null
    }
  }
  return null
}

function hubGeocodeQuery(place: string): string {
  return HUB_AIRPORT_QUERY[normKey(place)] || place
}

function isTransitAct(act: { text?: string; kind?: string }) {
  const t = act.text || ""
  return (
    act.kind === "transfer" ||
    /flight|train|bus|airport|station|highway bus|narita|haneda|shinjuku/i.test(t)
  )
}

function isStayAct(act: { text?: string; kind?: string; lodging?: boolean }) {
  return (
    act.kind === "stay" || act.lodging === true || /\bhotel\b|\binn\b|旅館|宿/i.test(act.text || "")
  )
}

/** Collect places with tiered secondary budget; stays/transit never capped. */
export function extractPlaceQueries(
  trip: TripLike,
  itinerary: DayLike[],
  opts?: { tripKey?: string },
): ExtractResult {
  void trip
  const entitlements = getMapEntitlements({ tripKey: opts?.tripKey })
  const byKey = new Map<string, PlaceQuery>()
  const hubName = findDepartureHub(itinerary)
  const hubKey = hubName ? normKey(hubName) : ""

  const push = (pq: PlaceQuery) => {
    const q = pq.query.trim().replace(/[.,;:!"')\]]+$/g, "")
    if (!q) return
    const explicitMap = String(pq.id || "").startsWith("mq-")
    if (explicitMap) {
      if (q.length < 2) return
    } else if (pq.kind === "stay") {
      if (q.length < 2) return
    } else if (
      pq.kind !== "hub" &&
      !isUsefulPlace(q, { maxWords: pq.kind === "transit" ? 6 : 5 })
    ) {
      return
    }
    const key = normKey(q)
    const existing = byKey.get(key)
    if (existing) {
      for (const id of pq.activityIds) {
        if (!existing.activityIds.includes(id)) existing.activityIds.push(id)
      }
      if (!existing.dayLabel && pq.dayLabel) existing.dayLabel = pq.dayLabel
      if (!existing.activitySnippet && pq.activitySnippet) {
        existing.activitySnippet = pq.activitySnippet
      }
      if (!existing.activityTime && pq.activityTime) {
        existing.activityTime = pq.activityTime
      }
      // Promote priority if core
      if (pq.priority === "core") existing.priority = "core"
      return
    }
    if (hubKey && key === hubKey && pq.kind !== "hub") return
    byKey.set(key, { ...pq, query: q, activityIds: [...pq.activityIds] })
  }

  if (hubName) {
    const q = hubGeocodeQuery(hubName)
    push({
      query: q,
      kind: "hub",
      id: "hub-departure",
      offlineEligible: false,
      activitySnippet: "Home departure",
      activityIds: [],
      priority: "core",
    })
  }

  // Explicit mapQuery / mapQueryTo — prefer over noisy text parsing
  for (const day of itinerary || []) {
    const dayLabel = day.label || ""
    for (const act of day.activities || []) {
      const mq = (act.mapQuery || "").trim()
      const mqTo = (act.mapQueryTo || "").trim()
      if (!mq && !mqTo) continue
      const t = (act.text || "").trim()
      const snippet = t.length > 80 ? `${t.slice(0, 77)}…` : t
      const clock = activityClock(act)
      const kind = isStayAct(act) ? "stay" : isTransitAct(act) ? "transit" : "activity"
      const priority = kind === "activity" ? "secondary" : "core"
      if (mq) {
        push({
          query: mq,
          kind,
          id: `mq-${actId(act.id)}-from`,
          dayId: day.id,
          dayLabel,
          offlineEligible: true,
          activitySnippet: snippet,
          activityTime: clock,
          activityIds: [actId(act.id)],
          priority,
        })
      }
      if (mqTo) {
        push({
          query: mqTo,
          kind: kind === "stay" ? "activity" : kind,
          id: `mq-${actId(act.id)}-to`,
          dayId: day.id,
          dayLabel,
          offlineEligible: true,
          activitySnippet: snippet,
          activityTime: clock,
          activityIds: [actId(act.id)],
          priority,
        })
      }
    }
  }

  // Core: all stays (skip if mapQuery already set)
  for (const day of itinerary || []) {
    const dayLabel = day.label || ""
    for (const act of day.activities || []) {
      if ((act.mapQuery || "").trim()) continue
      if (!isStayAct(act)) continue
      const t = (act.text || "").trim()
      if (!t) continue
      const name = lodgingName(t)
      if (!name) continue
      push({
        query: name,
        kind: "stay",
        id: `stay-${normKey(name).replace(/\s+/g, "-")}`,
        dayId: day.id,
        dayLabel,
        offlineEligible: true,
        activitySnippet: t.length > 80 ? `${t.slice(0, 77)}…` : t,
        activityTime: activityClock(act),
        activityIds: [actId(act.id)],
        priority: "core",
      })
    }
  }

  // Core: all transit hubs (skip if mapQuery already set)
  for (const day of itinerary || []) {
    const dayLabel = day.label || ""
    for (const act of day.activities || []) {
      if ((act.mapQuery || "").trim()) continue
      if (!isTransitAct(act)) continue
      const t = (act.text || "").trim()
      if (!t) continue
      const parts = splitPlaces(t)
      const sides =
        t.includes("→") && parts.length >= 2
          ? [parts[parts.length - 1], ...parts.slice(0, -1)]
          : parts
      const clock = activityClock(act)
      for (let i = 0; i < sides.length; i++) {
        const part = sides[i]
        if (hubKey && normKey(part) === hubKey) continue
        // Prefer arrival first in list order for geocode priority (already sorted)
        push({
          query: part,
          kind: "transit",
          id: `transit-${normKey(part).replace(/\s+/g, "-")}`,
          dayId: day.id,
          dayLabel,
          offlineEligible: true,
          activitySnippet: t.length > 80 ? `${t.slice(0, 77)}…` : t,
          activityTime: clock,
          activityIds: [actId(act.id)],
          priority: "core",
        })
      }
    }
  }

  // Secondary: day labels + walk/other
  let secondaryCount = 0
  let secondaryTruncated = false

  const pushSecondary = (pq: PlaceQuery) => {
    const key = normKey(pq.query)
    if (byKey.has(key)) {
      push(pq)
      return
    }
    if (secondaryCount >= entitlements.maxSecondary) {
      secondaryTruncated = true
      return
    }
    push(pq)
    if (byKey.has(key)) secondaryCount++
  }

  for (const day of itinerary || []) {
    const dayLabel = day.label || ""
    const labelBody = stripDayPrefix(dayLabel)
    for (const part of splitPlaces(labelBody)) {
      if (hubKey && normKey(part) === hubKey) continue
      pushSecondary({
        query: part,
        kind: "day",
        id: `day-${day.id}-${normKey(part).replace(/\s+/g, "-")}`,
        dayId: day.id,
        dayLabel,
        offlineEligible: true,
        activityIds: [],
        priority: "secondary",
      })
    }
  }

  for (const day of itinerary || []) {
    const dayLabel = day.label || ""
    for (const act of day.activities || []) {
      if ((act.mapQuery || "").trim()) continue
      if (act.kind === "note") continue
      if (isStayAct(act) || isTransitAct(act)) continue
      const t = (act.text || "").trim()
      if (!t) continue
      const parts = splitPlaces(t)
      const prefer = t.includes("→") && parts.length >= 2 ? parts.slice(1) : parts
      const clock = activityClock(act)
      for (const part of prefer) {
        if (hubKey && normKey(part) === hubKey) continue
        pushSecondary({
          query: part,
          kind: "activity",
          id: `act-${actId(act.id)}-${normKey(part).replace(/\s+/g, "-")}`,
          dayId: day.id,
          dayLabel,
          offlineEligible: true,
          activitySnippet: t.length > 80 ? `${t.slice(0, 77)}…` : t,
          activityTime: clock,
          activityIds: [actId(act.id)],
          priority: "secondary",
        })
      }
    }
  }

  const places = [...byKey.values()].sort((a, b) => {
    const rank = (p: PlaceQuery) =>
      p.kind === "hub" ? 0 : p.kind === "stay" ? 1 : p.kind === "transit" ? 2 : 3
    return rank(a) - rank(b)
  })

  return { places, secondaryTruncated, entitlements }
}

export function collectPlanQueries(trip: TripLike, itinerary: DayLike[]): string[] {
  return extractPlaceQueries(trip, itinerary).places.map((p) => p.query)
}

function toStop(pq: PlaceQuery, hit: GeoHit): PlanStop {
  return {
    id: pq.id,
    kind: pq.kind,
    label: pq.query,
    localLabel: hit.local?.trim() || undefined,
    lat: hit.lat,
    lng: hit.lng,
    dayId: pq.dayId,
    dayLabel: pq.dayLabel,
    offlineEligible: pq.offlineEligible,
    noteKey: normKey(pq.query),
    activitySnippet: pq.activitySnippet,
    activityTime: pq.activityTime,
    activityIds: [...pq.activityIds],
  }
}

export type ResolveResult = {
  stops: PlanStop[]
  secondaryTruncated: boolean
  entitlements: MapEntitlements
}

/** Resolve stops; respects network geocode budget; never drops cached stays/transit. */
export async function resolvePlanStops(
  trip: TripLike,
  itinerary: DayLike[],
  memories: MemoryLike[],
  opts?: {
    geocodeOnline?: boolean
    tripKey?: string
    onPartial?: (stops: PlanStop[]) => void
  },
): Promise<ResolveResult> {
  const geocodeOnline = opts?.geocodeOnline !== false && navigator.onLine
  const { places, secondaryTruncated, entitlements } = extractPlaceQueries(trip, itinerary, {
    tripKey: opts?.tripKey,
  })
  const stops: PlanStop[] = []
  const seenCoords = new Set<string>()
  let networkUsed = 0

  const emit = () => opts?.onPartial?.([...stops])

  const resolve = async (query: string, priority: "core" | "secondary") => {
    if (!query.trim()) return null
    const cached = getCachedGeocode(query)
    if (cached) return cached
    if (!geocodeOnline) return null
    if (networkUsed >= entitlements.maxNetworkGeocode) {
      // Core stays/transit: still try (budget exhausted for secondary only)
      if (priority === "secondary") return null
      if (networkUsed >= entitlements.maxNetworkGeocode + 30) return null
    }
    networkUsed++
    return geocodeQuery(query)
  }

  for (const p of places) {
    const hit = await resolve(p.query, p.priority)
    if (!hit) continue
    const key = `${hit.lat.toFixed(4)},${hit.lng.toFixed(4)}`
    const existing = stops.find((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}` === key)
    if (existing) {
      for (const id of p.activityIds) {
        if (!existing.activityIds.includes(id)) existing.activityIds.push(id)
      }
      if (!existing.activityTime && p.activityTime) existing.activityTime = p.activityTime
      if (!existing.activitySnippet && p.activitySnippet) {
        existing.activitySnippet = p.activitySnippet
      }
      emit()
      continue
    }
    if (seenCoords.has(key)) continue
    seenCoords.add(key)
    stops.push(toStop(p, hit))
    emit()
  }

  const dayById = new Map((itinerary || []).map((d) => [String(d.id), d.label || ""]))

  for (const mem of memories || []) {
    if (typeof mem.lat !== "number" || typeof mem.lng !== "number") continue
    if (!Number.isFinite(mem.lat) || !Number.isFinite(mem.lng)) continue
    const key = `${mem.lat.toFixed(4)},${mem.lng.toFixed(4)}`
    if (seenCoords.has(key)) continue
    seenCoords.add(key)
    const label = mem.title || mem.locationName || "Memory"
    stops.push({
      id: `mem-${mem.id}`,
      kind: "memory",
      label,
      lat: mem.lat,
      lng: mem.lng,
      dayId: mem.dayId,
      dayLabel: mem.dayId ? dayById.get(String(mem.dayId)) : undefined,
      offlineEligible: true,
      noteKey: normKey(mem.locationName || label),
      activityIds: [],
    })
    emit()
  }

  return { stops, secondaryTruncated, entitlements }
}

export function boundsFromStops(stops: Array<{ lat: number; lng: number }>): {
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

export function planStopsResolveKey(
  trip: TripLike,
  itinerary: DayLike[],
  memories: MemoryLike[],
  tripKey?: string,
): string {
  const { places, entitlements } = extractPlaceQueries(trip, itinerary, { tripKey })
  const placeKey = places.map((p) => `${p.query}:${p.kind}:${p.activityIds.join(",")}`).join("|")
  const mems = (memories || [])
    .filter((m) => typeof m.lat === "number" && typeof m.lng === "number")
    .map((m) => `${m.id}:${m.lat},${m.lng}`)
    .join("|")
  return `${placeKey}::${mems}::plus=${entitlements.isPlus ? 1 : 0}`
}

export function findStopForActivity(
  stops: PlanStop[],
  activityId: string | number,
): PlanStop | null {
  const id = String(activityId)
  return stops.find((s) => s.activityIds.includes(id)) || null
}
