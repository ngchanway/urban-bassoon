import L from "leaflet"
import { useEffect, useRef, useState } from "react"
import { DEMO_TRIP_ID } from "../../lib/demo/nakasendo"
import { cartoRasterUrlTemplate } from "../../lib/maps/cartoBasemap"
import { getCachedGeocode } from "../../lib/maps/geocode"
import { getMapEntitlements } from "../../lib/maps/mapEntitlements"
import {
  DEMO_HIKE_ROUTES,
  boundsFromCoords,
  matchDemoHikeRoute,
} from "../../lib/maps/nakasendoRoutes"
import {
  type OfflineMapMeta,
  type PackProgress,
  downloadTilePack,
  getOfflineMapMeta,
  isOfflinePackStale,
  planOfflinePack,
} from "../../lib/maps/offlineTiles"
import { ensurePlaceNote, formatStopPopup, getPlaceNote } from "../../lib/maps/placeNotes"
import {
  type PlanStop,
  findStopForActivity,
  planStopsResolveKey,
  resolvePlanStops,
} from "../../lib/maps/planStops"
import { fetchRoute, getCachedRoute } from "../../lib/maps/route"

type Props = {
  trip: { destination?: string; startDate?: string; endDate?: string }
  itinerary: Array<{
    id: string
    label?: string
    activities?: Array<{
      id: string | number
      text?: string
      kind?: string
      lodging?: boolean
      mapQuery?: string
      mapQueryTo?: string
    }>
  }>
  memories: Array<{
    id: string
    lat?: number
    lng?: number
    title?: string
    locationName?: string
    dayId?: string
    mood?: string
  }>
  tripKey: string
  focusActivityId?: string | number | null
  onFocusConsumed?: () => void
  onLocateMiss?: () => void
  onRevealItinerary?: (opts: { dayId?: string; activityId?: string }) => void
  onLocatableIds?: (ids: string[]) => void
}

const MAP_MAX_ZOOM = 18

function normNoteKey(q: string) {
  return q
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!"')\]]+$/g, "")
}

function stopMatchesQuery(stop: PlanStop, key: string) {
  if (!key) return false
  if (stop.noteKey === key) return true
  if (normNoteKey(stop.label) === key) return true
  return false
}

/** Resolve From/To even when coord-merge kept a sibling noteKey (e.g. Suhara Station). */
function findStopForWalkQuery(
  stops: PlanStop[],
  query: string,
  activityId: string,
): PlanStop | null {
  const key = normNoteKey(query)
  if (!key) return null
  const withAct = stops.filter((s) => s.activityIds.includes(activityId))
  const hit =
    withAct.find((s) => stopMatchesQuery(s, key)) || stops.find((s) => stopMatchesQuery(s, key))
  if (hit) return hit

  const cached = getCachedGeocode(query)
  if (!cached || !Number.isFinite(cached.lat) || !Number.isFinite(cached.lng)) return null
  const near = (s: PlanStop) =>
    Math.abs(s.lat - cached.lat) <= 0.01 && Math.abs(s.lng - cached.lng) <= 0.01
  return withAct.find(near) || stops.find(near) || null
}

type LiveRoute = {
  id: string
  coordinates: [number, number][]
  label: string
  /** seed = guide DEMO_HIKE (offline); osrm = live foot for non-seed walks */
  source: "osrm" | "seed"
  meta?: string
}

function stopColor(kind: PlanStop["kind"]) {
  if (kind === "hub") return "#5B8CFF"
  if (kind === "stay") return "#FFA828"
  if (kind === "transit") return "#5BC0BE"
  if (kind === "memory") return "#FFB347"
  if (kind === "day") return "#7DD3A8"
  return "#E8C9A8"
}

function formatSavedAt(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function popupOpts(
  stop: PlanStop,
  note: ReturnType<typeof getPlaceNote>,
  opts?: { expanded?: boolean; compact?: boolean },
) {
  return {
    title: stop.label,
    localLabel: stop.localLabel,
    dayLabel: stop.dayLabel,
    activityTime: stop.activityTime,
    activitySnippet: stop.activitySnippet,
    kind: stop.kind,
    note,
    dayId: stop.dayId,
    activityId: stop.activityIds[0],
    stopId: stop.id,
    expanded: opts?.expanded,
    compact: opts?.compact,
  }
}

const LEAFLET_POPUP_OPTS: L.PopupOptions = {
  maxWidth: 240,
  maxHeight: 140,
  autoPan: true,
  keepInView: true,
  autoPanPadding: [16, 16],
  closeButton: false,
  closeOnClick: true,
}

const POPUP_AUTO_CLOSE_MS = 2000

export function PlanRouteMap({
  trip,
  itinerary,
  memories,
  tripKey,
  focusActivityId = null,
  onFocusConsumed,
  onLocateMiss,
  onRevealItinerary,
  onLocatableIds,
}: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const onLocatableIdsRef = useRef(onLocatableIds)
  onLocatableIdsRef.current = onLocatableIds
  const markersByActivityId = useRef<Record<string, L.Marker>>({})
  const markersByStopId = useRef<Record<string, L.Marker>>({})
  const stopsRef = useRef<PlanStop[]>([])
  const [stops, setStops] = useState<PlanStop[]>([])
  const [secondaryTruncated, setSecondaryTruncated] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  )
  const [meta, setMeta] = useState<OfflineMapMeta | null>(() => getOfflineMapMeta())
  const [packing, setPacking] = useState(false)
  const [progress, setProgress] = useState<PackProgress | null>(null)
  const [packError, setPackError] = useState("")
  const [notesTick, setNotesTick] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [liveRoutes, setLiveRoutes] = useState<LiveRoute[]>([])
  const [routing, setRouting] = useState(false)
  const skipNextFit = useRef(false)
  const liveRoutesRef = useRef<LiveRoute[]>([])
  const popupCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onRevealRef = useRef(onRevealItinerary)
  const onFocusConsumedRef = useRef(onFocusConsumed)
  const onLocateMissRef = useRef(onLocateMiss)
  const itineraryRef = useRef(itinerary)
  onRevealRef.current = onRevealItinerary
  onFocusConsumedRef.current = onFocusConsumed
  onLocateMissRef.current = onLocateMiss
  itineraryRef.current = itinerary

  const resolveKey = planStopsResolveKey(trip, itinerary, memories, tripKey)
  const entitlements = getMapEntitlements({ tripKey })
  const showHikes = tripKey === DEMO_TRIP_ID
  const eligible = stops.filter((s) => s.offlineEligible)
  const stale = isOfflinePackStale(meta)
  stopsRef.current = stops
  liveRoutesRef.current = liveRoutes

  const clearPopupCloseTimer = () => {
    if (popupCloseTimer.current != null) {
      window.clearTimeout(popupCloseTimer.current)
      popupCloseTimer.current = null
    }
  }

  const schedulePopupAutoClose = (map: L.Map) => {
    clearPopupCloseTimer()
    popupCloseTimer.current = window.setTimeout(() => {
      popupCloseTimer.current = null
      map.closePopup()
    }, POPUP_AUTO_CLOSE_MS)
  }

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setResolving(true)
    resolvePlanStops(trip, itinerary, memories, {
      geocodeOnline: online,
      tripKey,
      onPartial: (partial) => {
        if (!cancelled) setStops(partial)
      },
    })
      .then((result) => {
        if (cancelled) return
        setStops(result.stops)
        setSecondaryTruncated(result.secondaryTruncated && !result.entitlements.isPlus)
      })
      .finally(() => {
        if (!cancelled) setResolving(false)
      })
    return () => {
      cancelled = true
    }
  }, [resolveKey, online, tripKey])

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const map = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: false,
      maxZoom: MAP_MAX_ZOOM,
      minZoom: 2,
    })
    const tiles = L.tileLayer(cartoRasterUrlTemplate(), {
      maxZoom: MAP_MAX_ZOOM,
      maxNativeZoom: MAP_MAX_ZOOM,
      subdomains: "abcd",
    }).addTo(map)
    tileLayerRef.current = tiles
    map.setView([20, 0], 2)
    map.doubleClickZoom.disable()
    const onDblClick = () => setFullscreen((f) => !f)
    const dismissPopup = () => {
      clearPopupCloseTimer()
      map.closePopup()
    }
    map.on("dblclick", onDblClick)
    map.on("dragstart", dismissPopup)
    map.on("zoomstart", dismissPopup)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      clearPopupCloseTimer()
      map.off("dblclick", onDblClick)
      map.off("dragstart", dismissPopup)
      map.off("zoomstart", dismissPopup)
      map.remove()
      mapRef.current = null
      layerRef.current = null
      tileLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const ids = new Set<string>()
    for (const s of stops) {
      for (const id of s.activityIds) ids.add(String(id))
    }
    onLocatableIdsRef.current?.([...ids])
  }, [stops])

  // Walk From→To: online OSRM (via guide midpoints when matched); dense seed offline
  useEffect(() => {
    let cancelled = false
    type WalkJob = {
      id: string
      from: { lat: number; lng: number }
      to: { lat: number; lng: number }
      label: string
    }
    const jobs: WalkJob[] = []

    for (const day of itinerary || []) {
      for (const act of day.activities || []) {
        if ((act.kind || "").toLowerCase() !== "walk") continue
        const fromQ = (act.mapQuery || "").trim()
        const toQ = (act.mapQueryTo || "").trim()
        if (!fromQ || !toQ) continue
        const aid = String(act.id)
        const fromStop = findStopForWalkQuery(stops, fromQ, aid)
        const toStop = findStopForWalkQuery(stops, toQ, aid)
        if (!fromStop || !toStop) continue
        if (fromStop.id === toStop.id) continue
        const text = (act.text || "").trim()
        jobs.push({
          id: `live-${aid}`,
          from: { lat: fromStop.lat, lng: fromStop.lng },
          to: { lat: toStop.lat, lng: toStop.lng },
          label: text.length > 60 ? `${text.slice(0, 57)}…` : text || "Walk route",
        })
      }
    }

    /** Snap pin only if within ~800 m of route end — avoids false spurs to sibling pins. */
    const SNAP_PAD_DEG = 0.008
    const nearPt = (a: { lat: number; lng: number }, b: [number, number]) =>
      Math.abs(a.lat - b[0]) <= SNAP_PAD_DEG && Math.abs(a.lng - b[1]) <= SNAP_PAD_DEG

    const snapEnds = (
      coords: [number, number][],
      from: WalkJob["from"],
      to: WalkJob["to"],
    ): [number, number][] => {
      if (!coords.length)
        return [
          [from.lat, from.lng],
          [to.lat, to.lng],
        ]
      const next = coords.map((c) => [c[0], c[1]] as [number, number])
      const start = next[0]!
      const end = next[next.length - 1]!
      if (nearPt(from, start)) next[0] = [from.lat, from.lng]
      if (nearPt(to, end)) next[next.length - 1] = [to.lat, to.lng]
      return next
    }

    const orientSeed = (job: WalkJob) => {
      const seed = matchDemoHikeRoute(job.from, job.to)
      if (!seed?.coordinates?.length) return null
      const wps = seed.waypoints?.length >= 2 ? seed.waypoints : seed.coordinates
      const start = wps[0]!
      const end = wps[wps.length - 1]!
      const fwdDist =
        Math.hypot(job.from.lat - start[0], job.from.lng - start[1]) +
        Math.hypot(job.to.lat - end[0], job.to.lng - end[1])
      const revDist =
        Math.hypot(job.from.lat - end[0], job.from.lng - end[1]) +
        Math.hypot(job.to.lat - start[0], job.to.lng - start[1])
      const forward = fwdDist <= revDist
      const coords = forward ? seed.coordinates : [...seed.coordinates].reverse()
      return {
        coords,
        meta: seed.dayHint ? `${seed.label} · ${seed.dayHint}` : seed.label || "Guide trail",
      }
    }

    if (!jobs.length) {
      setLiveRoutes([])
      setRouting(false)
      return () => {
        cancelled = true
      }
    }

    const resolved: LiveRoute[] = []
    const needFetch: WalkJob[] = []

    for (const job of jobs) {
      const oriented = orientSeed(job)
      // Matched guide corridors: always baked seed (no live OSRM — avoids false branches)
      if (oriented) {
        resolved.push({
          id: job.id,
          coordinates: snapEnds(oriented.coords, job.from, job.to),
          label: job.label,
          source: "seed",
          meta: oriented.meta,
        })
        continue
      }

      if (!online) continue
      const hit = getCachedRoute(job.from, job.to)
      if (hit?.coordinates?.length) {
        resolved.push({
          id: job.id,
          coordinates: snapEnds(hit.coordinates, job.from, job.to),
          label: job.label,
          source: "osrm",
          meta: "Recommended walk",
        })
      } else {
        needFetch.push(job)
      }
    }
    setLiveRoutes(resolved)

    if (!needFetch.length) {
      setRouting(false)
      return () => {
        cancelled = true
      }
    }

    setRouting(true)
    ;(async () => {
      const fetched: LiveRoute[] = []
      for (const job of needFetch) {
        if (cancelled) return
        const hit = await fetchRoute(job.from, job.to)
        if (hit?.coordinates?.length) {
          fetched.push({
            id: job.id,
            coordinates: snapEnds(hit.coordinates, job.from, job.to),
            label: job.label,
            source: "osrm",
            meta: "Recommended walk",
          })
        }
      }
      if (cancelled) return
      const byId = new Map<string, LiveRoute>()
      for (const r of [...resolved, ...fetched]) byId.set(r.id, r)
      setLiveRoutes([...byId.values()])
      setRouting(false)
    })()

    return () => {
      cancelled = true
    }
  }, [stops, itinerary, online])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const t = setTimeout(() => map.invalidateSize(), 120)
    return () => clearTimeout(t)
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen])

  const handlePopupDomClick = (e: Event) => {
    const t = e.target as HTMLElement | null
    if (!t) return

    const expandBtn = t.closest(".popup-expand-toggle") as HTMLElement | null
    if (expandBtn) {
      e.preventDefault()
      e.stopPropagation()
      const body = expandBtn.closest(".popup-body") as HTMLElement | null
      const stopId = body?.dataset.stopId
      if (!stopId) return
      const stop = stopsRef.current.find((s) => s.id === stopId)
      const marker = markersByStopId.current[stopId]
      if (!stop || !marker) return
      const expand = expandBtn.dataset.expand === "1"
      const note = getPlaceNote(stop.noteKey)
      marker.setPopupContent(
        formatStopPopup(popupOpts(stop, note, { compact: !expand, expanded: expand })),
      )
      marker.getPopup()?.update()
      // If expanded content overflows the map, collapse again
      requestAnimationFrame(() => {
        const mapNode = mapEl.current
        const popupEl = marker.getPopup()?.getElement?.()
        if (!mapNode || !popupEl || !expand) return
        const mr = mapNode.getBoundingClientRect()
        const pr = popupEl.getBoundingClientRect()
        const overflows =
          pr.top < mr.top - 2 ||
          pr.bottom > mr.bottom + 2 ||
          pr.left < mr.left - 2 ||
          pr.right > mr.right + 2
        if (overflows) {
          marker.setPopupContent(formatStopPopup(popupOpts(stop, note, { compact: true })))
          marker.getPopup()?.update()
        }
      })
      return
    }

    const itin = t.closest(".popup-itin-link") as HTMLElement | null
    if (!itin) return
    e.preventDefault()
    e.stopPropagation()
    setFullscreen(false)
    onRevealRef.current?.({
      dayId: itin.dataset.dayId,
      activityId: itin.dataset.activityId,
    })
  }

  const clampPopupToMap = (marker: L.Marker, stop: PlanStop) => {
    const mapElNode = mapEl.current
    const popupEl = marker.getPopup()?.getElement?.()
    if (!mapElNode || !popupEl) return
    const mr = mapElNode.getBoundingClientRect()
    const pr = popupEl.getBoundingClientRect()
    const overflows =
      pr.top < mr.top - 2 ||
      pr.bottom > mr.bottom + 2 ||
      pr.left < mr.left - 2 ||
      pr.right > mr.right + 2
    if (!overflows) return
    const note = getPlaceNote(stop.noteKey)
    marker.setPopupContent(formatStopPopup(popupOpts(stop, note, { compact: true })))
    marker.getPopup()?.update()
  }

  const tileMaxZoom = () => {
    // Online: always allow street-level; pack zMax only clamps when offline
    if (online) return MAP_MAX_ZOOM
    const packMax = meta && meta.tripKey === tripKey ? meta.zMax : undefined
    return packMax != null ? Math.min(MAP_MAX_ZOOM, packMax) : MAP_MAX_ZOOM
  }

  const applyTileMaxZoom = (map: L.Map) => {
    const maxZ = tileMaxZoom()
    map.setMaxZoom(maxZ)
    if (tileLayerRef.current) {
      tileLayerRef.current.options.maxZoom = maxZ
      tileLayerRef.current.options.maxNativeZoom = online ? MAP_MAX_ZOOM : maxZ
    }
    return maxZ
  }

  const fitTripView = (
    map: L.Map,
    stopList: PlanStop[],
    extraRoutes: LiveRoute[] = [],
    mode: "corridor" | "journey" = "corridor",
  ) => {
    let candidates: PlanStop[]
    if (mode === "journey") {
      // Full trip including departing hub (e.g. Singapore)
      candidates = stopList
    } else {
      const tripStops = stopList.filter((s) => s.offlineEligible)
      candidates = tripStops.length ? tripStops : stopList
      const nonHub = candidates.filter((s) => s.kind !== "hub")
      if (nonHub.length >= 2) candidates = nonHub
    }

    let fitPts: [number, number][] = [
      ...candidates.map((s) => [s.lat, s.lng] as [number, number]),
      ...extraRoutes.flatMap((r) => r.coordinates),
    ]
    if (fitPts.length === 0) return

    // Corridor only: drop far outliers — keep cluster within ~8° of median
    if (mode === "corridor" && fitPts.length >= 2) {
      const lats = fitPts.map((p) => p[0]).sort((a, b) => a - b)
      const lngs = fitPts.map((p) => p[1]).sort((a, b) => a - b)
      const mid = Math.floor(lats.length / 2)
      const medLat = lats.length % 2 ? lats[mid]! : (lats[mid - 1]! + lats[mid]!) / 2
      const medLng = lngs.length % 2 ? lngs[mid]! : (lngs[mid - 1]! + lngs[mid]!) / 2
      const clustered = fitPts.filter(
        (p) => Math.abs(p[0] - medLat) <= 8 && Math.abs(p[1] - medLng) <= 8,
      )
      if (clustered.length > 0) fitPts = clustered
    }

    try {
      const bounds = L.latLngBounds(fitPts)
      const maxZ = applyTileMaxZoom(map)
      // Allow fit to set the overview zoom first
      map.setMinZoom(2)
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: Math.min(12, maxZ) })
      // Floor near overview — slight zoom-out OK; never lock to maxZoom
      const fitted = map.getZoom()
      const minZ = Math.max(2, Math.min(fitted - 1, 6))
      map.setMinZoom(Math.min(minZ, maxZ - 1))
    } catch {
      /* ignore */
    }
  }

  // Re-apply maxZoom when online/offline or pack meta changes (don't wait for refit)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applyTileMaxZoom(map)
  }, [online, meta, tripKey])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    markersByActivityId.current = {}
    markersByStopId.current = {}

    // Guide DEMO_HIKE seed (dark brown on CARTO) or OSRM for other walks (amber) — transfers: pins only
    for (const route of liveRoutes) {
      const isSeed = route.source === "seed"
      L.polyline(route.coordinates, {
        color: isSeed ? "#9A5A2A" : "#C48A3A",
        weight: isSeed ? 4 : 3.5,
        opacity: isSeed ? 0.92 : 0.9,
      })
        .bindPopup(
          `<div class="popup-title">${route.label}</div><div class="popup-meta">${route.meta || (isSeed ? "Guide trail" : "Recommended walk")}</div>`,
          LEAFLET_POPUP_OPTS,
        )
        .addTo(layer)
    }

    for (const stop of stops) {
      const color = stopColor(stop.kind)
      const note = getPlaceNote(stop.noteKey)
      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:12px;height:12px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -10],
      })
      const marker = L.marker([stop.lat, stop.lng], { icon })
        .bindPopup(formatStopPopup(popupOpts(stop, note, { compact: true })), LEAFLET_POPUP_OPTS)
        .addTo(layer)

      markersByStopId.current[stop.id] = marker
      for (const aid of stop.activityIds) {
        markersByActivityId.current[aid] = marker
      }

      marker.on("popupopen", (ev) => {
        const popupEl = (ev as L.PopupEvent).popup?.getElement?.()
        if (popupEl) {
          L.DomEvent.off(popupEl, "click", handlePopupDomClick)
          L.DomEvent.on(popupEl, "click", handlePopupDomClick)
        }
        requestAnimationFrame(() => clampPopupToMap(marker, stop))
        if (getPlaceNote(stop.noteKey)) return
        void ensurePlaceNote(
          stop.noteKey,
          stop.label,
          [stop.dayLabel, stop.activitySnippet].filter(Boolean).join(" · "),
        ).then((n) => {
          if (!n) return
          marker.setPopupContent(formatStopPopup(popupOpts(stop, n, { compact: true })))
          marker.getPopup()?.update()
          requestAnimationFrame(() => clampPopupToMap(marker, stop))
          setNotesTick((tick) => tick + 1)
        })
      })
    }

    if (!skipNextFit.current) {
      fitTripView(map, stops, liveRoutes, "corridor")
    }
    skipNextFit.current = false
    setTimeout(() => map.invalidateSize(), 80)
  }, [stops, notesTick, itinerary, liveRoutes])

  useEffect(() => {
    if (focusActivityId == null || focusActivityId === "") return
    const map = mapRef.current
    if (!map) return
    const id = String(focusActivityId)
    clearPopupCloseTimer()

    // From→To walk: fit the live corridor instead of a blocking pin popup
    const act = itineraryRef.current
      .flatMap((d) => d.activities || [])
      .find((a) => String(a.id) === id)
    const walkRoute =
      act &&
      (act.kind || "").toLowerCase() === "walk" &&
      (act.mapQuery || "").trim() &&
      (act.mapQueryTo || "").trim()
        ? liveRoutesRef.current.find((r) => r.id === `live-${id}`)
        : null
    if (walkRoute?.coordinates?.length) {
      skipNextFit.current = true
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        map.closePopup()
        onFocusConsumedRef.current?.()
      }
      try {
        map.once("moveend", finish)
        const fallback = window.setTimeout(finish, 1200)
        map.fitBounds(L.latLngBounds(walkRoute.coordinates), {
          padding: [36, 36],
          maxZoom: Math.min(14, map.getMaxZoom()),
        })
        return () => {
          map.off("moveend", finish)
          window.clearTimeout(fallback)
        }
      } catch {
        finish()
        return
      }
    }

    const stopList = stopsRef.current
    let marker = markersByActivityId.current[id]
    let stop = findStopForActivity(stopList, id)
    if (!marker && stop) marker = markersByStopId.current[stop.id]
    if (!stop) {
      const day = itineraryRef.current.find((d) =>
        (d.activities || []).some((a) => String(a.id) === id),
      )
      if (day) {
        stop =
          stopList.find(
            (s) => String(s.dayId) === String(day.id) && (s.kind === "day" || s.kind === "stay"),
          ) || null
        if (stop) marker = markersByStopId.current[stop.id]
      }
    }
    if (stop && marker) {
      skipNextFit.current = true
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        const note = getPlaceNote(stop.noteKey)
        marker.setPopupContent(formatStopPopup(popupOpts(stop, note, { compact: true })))
        marker.openPopup()
        schedulePopupAutoClose(map)
        onFocusConsumedRef.current?.()
      }
      map.once("moveend", finish)
      const fallback = window.setTimeout(finish, 1200)
      const alreadyClose =
        map.getZoom() >= 13 && map.distance(map.getCenter(), L.latLng(stop.lat, stop.lng)) < 80
      const focusZ = Math.min(14, map.getMaxZoom())
      map.flyTo([stop.lat, stop.lng], focusZ, { duration: alreadyClose ? 0.35 : 1.1 })
      if (alreadyClose) window.setTimeout(finish, 80)
      return () => {
        map.off("moveend", finish)
        window.clearTimeout(fallback)
        clearPopupCloseTimer()
      }
    }
    onLocateMissRef.current?.()
    onFocusConsumedRef.current?.()
  }, [focusActivityId])

  const hikeBounds = (showHikes ? DEMO_HIKE_ROUTES : [])
    .map((r) => boundsFromCoords(r.coordinates, 0.1))
    .filter((b): b is NonNullable<typeof b> => Boolean(b))

  const metaForTrip = meta && (!meta.tripKey || meta.tripKey === tripKey) ? meta : null
  const canPack = eligible.length > 0 || hikeBounds.length > 0

  const runPack = async (clearFirst: boolean) => {
    if (!online || packing || !canPack) return
    setPackError("")
    setPacking(true)
    setProgress({ done: 0, total: 0 })
    try {
      const planned = planOfflinePack(
        eligible.map((s) => ({ lat: s.lat, lng: s.lng })),
        hikeBounds,
        { maxTiles: entitlements.maxOfflineTiles },
      )
      const next = await downloadTilePack(tripKey, {
        planned,
        clearFirst,
        onProgress: setProgress,
      })
      setMeta(next)
    } catch (e) {
      setPackError(e instanceof Error ? e.message : "Could not save map")
    } finally {
      setPacking(false)
      setProgress(null)
    }
  }

  const onSave = () => runPack(false)
  const onUpdate = () => {
    if (!window.confirm("Replace saved offline map tiles with a fresh download?")) return
    runPack(true)
  }

  const onResetView = () => {
    const map = mapRef.current
    if (!map) return
    map.closePopup()
    fitTripView(map, stops, liveRoutes, "journey")
  }

  const empty = stops.length === 0 && liveRoutes.length === 0
  const offlineStatus = metaForTrip
    ? `Offline saved${metaForTrip.savedAt ? ` · ${formatSavedAt(metaForTrip.savedAt)}` : ""}${stale ? " · Stale" : ""}`
    : "No offline pack"
  const statusParts = [
    online ? "Online" : "Offline",
    resolving ? "Locating…" : stops.length > 0 ? `${stops.length} pins` : null,
    routing ? "Routing…" : liveRoutes.length > 0 ? "Route" : null,
    offlineStatus,
  ].filter(Boolean)

  const firstSave = !metaForTrip
  const savePrimary = packing || firstSave

  return (
    <div className={`card app-map-sticky${fullscreen ? " plan-map-fullscreen" : ""}`}>
      <div className="plan-map-shell">
        <button
          type="button"
          className="plan-map-tool-btn plan-map-tool-reset"
          onClick={onResetView}
          title="Show full journey"
          aria-label="Show full journey"
        >
          ⌂
        </button>
        <button
          type="button"
          className="plan-map-tool-btn plan-map-tool-full"
          onClick={() => setFullscreen((f) => !f)}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {fullscreen ? "✕" : "⛶"}
        </button>
        {empty && !resolving && (
          <div className="plan-map-empty">
            <div className="empty-msg">
              Add itinerary days to see pins for places you will visit
            </div>
          </div>
        )}
        <div id="plan-route-map" ref={mapEl} />
      </div>
      {!fullscreen && (
        <div className="plan-map-meta">
          <div className="plan-map-meta-row">
            <div className="plan-map-status">{statusParts.join(" · ")}</div>
            <div className="plan-map-meta-actions">
              <button
                type="button"
                className={
                  savePrimary ? "btn btn-sm plan-map-meta-btn" : "btn-ghost plan-map-meta-btn"
                }
                disabled={!online || !canPack || packing}
                onClick={onSave}
              >
                {packing && progress
                  ? `Saving… ${progress.done}/${progress.total}`
                  : "Save map offline"}
              </button>
              {meta && online && (
                <button
                  type="button"
                  className="btn-ghost plan-map-meta-btn"
                  disabled={packing || !canPack}
                  onClick={onUpdate}
                >
                  Update
                </button>
              )}
            </div>
          </div>
          {secondaryTruncated && (
            <div className="plan-map-status plan-map-status-hint">
              Hotels &amp; transit shown — Plus for all stops.
            </div>
          )}
          {packError && <div className="plan-map-pack-error">{packError}</div>}
        </div>
      )}
    </div>
  )
}
