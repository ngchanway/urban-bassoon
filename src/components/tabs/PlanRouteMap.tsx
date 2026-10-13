import L from "leaflet"
import { useEffect, useRef, useState } from "react"
import { DEMO_TRIP_ID } from "../../lib/demo/nakasendo"
import { cartoRasterUrlTemplate } from "../../lib/maps/cartoBasemap"
import { getMapEntitlements } from "../../lib/maps/mapEntitlements"
import { DEMO_HIKE_ROUTES, boundsFromCoords } from "../../lib/maps/nakasendoRoutes"
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

function normNoteKey(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ")
}

const MAP_MAX_ZOOM = 18

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
  maxWidth: 260,
  maxHeight: 120,
  autoPan: true,
  keepInView: true,
  autoPanPadding: [20, 20],
  closeButton: false,
}

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
  const skipNextFit = useRef(false)
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
    map.on("dblclick", onDblClick)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.off("dblclick", onDblClick)
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

  const tileMaxZoom = () => {
    const packMax = meta && meta.tripKey === tripKey ? meta.zMax : undefined
    return packMax != null ? Math.min(MAP_MAX_ZOOM, packMax) : MAP_MAX_ZOOM
  }

  const fitTripView = (map: L.Map, stopList: PlanStop[], withHikes: boolean) => {
    const routes = withHikes ? DEMO_HIKE_ROUTES : []
    const tripStops = stopList.filter((s) => s.offlineEligible)
    const fitPts: [number, number][] = [
      ...(tripStops.length ? tripStops : stopList).map((s) => [s.lat, s.lng] as [number, number]),
      ...routes.flatMap((r) => r.coordinates),
    ]
    if (fitPts.length === 0) return
    try {
      const bounds = L.latLngBounds(fitPts)
      const maxZ = tileMaxZoom()
      map.setMaxZoom(maxZ)
      if (tileLayerRef.current) {
        tileLayerRef.current.options.maxZoom = maxZ
        tileLayerRef.current.options.maxNativeZoom = maxZ
      }
      // Allow fit to set the overview zoom first
      map.setMinZoom(2)
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: Math.min(12, maxZ) })
      // Default view is the floor — no zooming out into empty world
      map.setMinZoom(map.getZoom())
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    markersByActivityId.current = {}
    markersByStopId.current = {}

    const routes = showHikes ? DEMO_HIKE_ROUTES : []
    for (const route of routes) {
      L.polyline(route.coordinates, {
        color: "#E8C9A8",
        weight: 4,
        opacity: 0.85,
      })
        .bindPopup(
          `<div class="popup-title">${route.label}</div><div class="popup-meta">${route.dayHint}</div>`,
          LEAFLET_POPUP_OPTS,
        )
        .addTo(layer)
    }

    // From → To corridor hints (dashed straight; live routing is a follow-up)
    for (const day of itinerary || []) {
      for (const act of day.activities || []) {
        const fromQ = (act.mapQuery || "").trim()
        const toQ = (act.mapQueryTo || "").trim()
        if (!fromQ || !toQ) continue
        const aid = String(act.id)
        const fromKey = normNoteKey(fromQ)
        const toKey = normNoteKey(toQ)
        const fromStop = stops.find((s) => s.activityIds.includes(aid) && s.noteKey === fromKey)
        const toStop = stops.find((s) => s.activityIds.includes(aid) && s.noteKey === toKey)
        if (!fromStop || !toStop) continue
        L.polyline(
          [
            [fromStop.lat, fromStop.lng],
            [toStop.lat, toStop.lng],
          ],
          {
            color: "#C48A3A",
            weight: 2.5,
            opacity: 0.75,
            dashArray: "6 8",
          },
        ).addTo(layer)
      }
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
        .bindPopup(formatStopPopup(popupOpts(stop, note)), LEAFLET_POPUP_OPTS)
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
        if (getPlaceNote(stop.noteKey)) return
        void ensurePlaceNote(
          stop.noteKey,
          stop.label,
          [stop.dayLabel, stop.activitySnippet].filter(Boolean).join(" · "),
        ).then((n) => {
          if (!n) return
          marker.setPopupContent(formatStopPopup(popupOpts(stop, n)))
          setNotesTick((tick) => tick + 1)
        })
      })
    }

    if (!skipNextFit.current) {
      fitTripView(map, stops, showHikes)
    }
    skipNextFit.current = false
    setTimeout(() => map.invalidateSize(), 80)
  }, [stops, showHikes, notesTick, itinerary])

  useEffect(() => {
    if (focusActivityId == null || focusActivityId === "") return
    const map = mapRef.current
    if (!map) return
    const id = String(focusActivityId)
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
    fitTripView(map, stops, showHikes)
  }

  const empty = stops.length === 0 && !showHikes
  const offlineStatus = metaForTrip
    ? `Offline saved${metaForTrip.savedAt ? ` · ${formatSavedAt(metaForTrip.savedAt)}` : ""}${stale ? " · Stale" : ""}`
    : "No offline pack"
  const statusParts = [
    online ? "Online" : "Offline",
    resolving ? "Locating…" : stops.length > 0 ? `${stops.length} pins` : null,
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
          title="Reset view"
          aria-label="Reset view"
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
