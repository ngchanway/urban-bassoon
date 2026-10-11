import L from "leaflet"
import { useEffect, useRef, useState } from "react"
import { DEMO_TRIP_ID } from "../../lib/demo/nakasendo"
import { cartoDarkRasterUrlTemplate, hasCartoBasemapKey } from "../../lib/maps/cartoBasemap"
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
  boundsFromStops,
  findStopForActivity,
  planStopsResolveKey,
  resolvePlanStops,
} from "../../lib/maps/planStops"

type Props = {
  trip: { destination?: string; startDate?: string; endDate?: string }
  itinerary: Array<{
    id: string
    label?: string
    activities?: Array<{ id: string | number; text?: string; kind?: string; lodging?: boolean }>
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

export function PlanRouteMap({
  trip,
  itinerary,
  memories,
  tripKey,
  focusActivityId = null,
  onFocusConsumed,
}: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markersByActivityId = useRef<Record<string, L.Marker>>({})
  const markersByStopId = useRef<Record<string, L.Marker>>({})
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
  const [showPlusInfo, setShowPlusInfo] = useState(false)
  const skipNextFit = useRef(false)

  const resolveKey = planStopsResolveKey(trip, itinerary, memories, tripKey)
  const entitlements = getMapEntitlements({ tripKey })
  const showHikes = tripKey === DEMO_TRIP_ID
  const eligible = stops.filter((s) => s.offlineEligible)
  const stale = isOfflinePackStale(meta)

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
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: false })
    L.tileLayer(cartoDarkRasterUrlTemplate(), {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map)
    map.setView([20, 0], 2)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

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
        .bindPopup(
          formatStopPopup({
            title: stop.label,
            dayLabel: stop.dayLabel,
            activitySnippet: stop.activitySnippet,
            kind: stop.kind,
            note,
          }),
        )
        .addTo(layer)

      markersByStopId.current[stop.id] = marker
      for (const aid of stop.activityIds) {
        markersByActivityId.current[aid] = marker
      }

      marker.on("popupopen", () => {
        if (getPlaceNote(stop.noteKey)) return
        void ensurePlaceNote(
          stop.noteKey,
          stop.label,
          [stop.dayLabel, stop.activitySnippet].filter(Boolean).join(" · "),
        ).then((n) => {
          if (!n) return
          marker.setPopupContent(
            formatStopPopup({
              title: stop.label,
              dayLabel: stop.dayLabel,
              activitySnippet: stop.activitySnippet,
              kind: stop.kind,
              note: n,
            }),
          )
          setNotesTick((t) => t + 1)
        })
      })
    }

    if (!skipNextFit.current) {
      const tripStops = stops.filter((s) => s.offlineEligible)
      const fitPts: [number, number][] = [
        ...(tripStops.length ? tripStops : stops).map((s) => [s.lat, s.lng] as [number, number]),
        ...routes.flatMap((r) => r.coordinates),
      ]
      if (fitPts.length > 0) {
        try {
          map.fitBounds(fitPts, { padding: [36, 36], maxZoom: 12 })
        } catch {
          /* ignore */
        }
      }
    }
    skipNextFit.current = false
    setTimeout(() => map.invalidateSize(), 80)
  }, [stops, showHikes, notesTick])

  useEffect(() => {
    if (focusActivityId == null || focusActivityId === "") return
    const map = mapRef.current
    if (!map) return
    const id = String(focusActivityId)
    let marker = markersByActivityId.current[id]
    let stop = findStopForActivity(stops, id)
    if (!marker && stop) marker = markersByStopId.current[stop.id]
    if (!stop) {
      // Fallback: day place for the activity's day
      const day = itinerary.find((d) => (d.activities || []).some((a) => String(a.id) === id))
      if (day) {
        stop =
          stops.find((s) => s.dayId === day.id && (s.kind === "day" || s.kind === "stay")) || null
        if (stop) marker = markersByStopId.current[stop.id]
      }
    }
    if (stop && marker) {
      skipNextFit.current = true
      map.flyTo([stop.lat, stop.lng], 14, { duration: 1.1 })
      setTimeout(() => marker?.openPopup(), 400)
    }
    onFocusConsumed?.()
  }, [focusActivityId, stops, itinerary, onFocusConsumed])

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

  const empty = stops.length === 0 && !showHikes
  const spanHint =
    eligible.length > 0 &&
    (() => {
      const b = boundsFromStops(eligible)
      if (!b) return false
      return b.north - b.south > 8 || b.east - b.west > 8
    })()

  return (
    <div className="card">
      <div className="card-title">🗺️ Route map</div>
      {empty && !resolving && (
        <div className="empty" style={{ padding: "12px 8px 4px" }}>
          <div className="empty-msg">Add itinerary days to see pins for places you will visit</div>
        </div>
      )}
      <div id="plan-route-map" ref={mapEl} />
      <div
        className="map-hint"
        style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8, fontSize: 11 }}
      >
        <span>© OpenStreetMap contributors · © CARTO</span>
      </div>
      <div className="map-hint" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <span>{online ? "Online" : "Offline"}</span>
        <span>·</span>
        {metaForTrip ? (
          <span>
            Offline map saved
            {metaForTrip.savedAt ? ` · Updated ${formatSavedAt(metaForTrip.savedAt)}` : ""}
            {stale ? " · Stale (30+ days)" : ""}
          </span>
        ) : (
          <span>No offline map yet</span>
        )}
        {resolving && <span>· Locating stops…</span>}
        {!resolving && stops.length > 0 && (
          <span>
            · {stops.length} pins ({eligible.length} offline)
          </span>
        )}
        {resolving && stops.length > 0 && <span>· {stops.length} found…</span>}
      </div>
      <div style={{ fontSize: 11, color: "rgba(230,217,194,0.45)", marginTop: 4 }}>
        Tap an itinerary item to fly to its pin · Amber = hotel · Teal = transit
      </div>
      {secondaryTruncated && (
        <button
          type="button"
          className="btn-ghost"
          style={{
            fontSize: 12,
            marginTop: 6,
            padding: "6px 8px",
            textAlign: "left",
            width: "100%",
            color: "rgba(232,201,168,0.9)",
          }}
          onClick={() => setShowPlusInfo(true)}
        >
          Showing hotels &amp; transit. Unlock TravelPal Plus for every walk stop on the map.
        </button>
      )}
      {showPlusInfo && (
        <div
          style={{
            fontSize: 12,
            color: "rgba(230,217,194,0.7)",
            marginTop: 6,
            padding: "10px 12px",
            border: "1px solid rgba(255,168,40,0.2)",
            borderRadius: 10,
            background: "rgba(7,16,31,0.5)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--amber)" }}>
            TravelPal Plus (coming soon)
          </div>
          Full secondary map pins, more geocoding, and larger offline packs. Set{" "}
          <code>tc_map_plus</code> in localStorage to preview, or use the Japan Navi demo.
          <button
            type="button"
            className="btn-ghost"
            style={{ display: "block", marginTop: 8, fontSize: 12 }}
            onClick={() => setShowPlusInfo(false)}
          >
            Dismiss
          </button>
        </div>
      )}
      {(spanHint || canPack) && (
        <div style={{ fontSize: 12, color: "rgba(230,217,194,0.5)", marginTop: 4 }}>
          Offline map covers places you navigate on the trip (not home airports).
        </div>
      )}
      {stale && online && meta && (
        <div style={{ fontSize: 12, color: "#e8c9a8", marginTop: 4 }}>
          Offline tiles are older than 30 days — update when online.
        </div>
      )}
      {!hasCartoBasemapKey() && (
        <div style={{ fontSize: 12, color: "rgba(230,217,194,0.55)", marginTop: 6 }}>
          Add <code>VITE_CARTO_BASEMAPS_API_KEY</code> to <code>.env.local</code> and rebuild to
          remove the API key watermark.
        </div>
      )}
      <div className="flex gap-8 mt-8" style={{ flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!online || !canPack || packing}
          onClick={onSave}
        >
          {packing && progress ? `Saving… ${progress.done}/${progress.total}` : "Save map offline"}
        </button>
        {meta && online && (
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 12, padding: "6px 10px" }}
            disabled={packing || !canPack}
            onClick={onUpdate}
          >
            Update offline map
          </button>
        )}
      </div>
      {packError && <div style={{ fontSize: 12, color: "#ff8a8a", marginTop: 8 }}>{packError}</div>}
    </div>
  )
}
