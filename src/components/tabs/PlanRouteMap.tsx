import L from "leaflet"
import { useEffect, useRef, useState } from "react"
import { cartoDarkRasterUrlTemplate, hasCartoBasemapKey } from "../../lib/maps/cartoBasemap"
import {
  type OfflineMapMeta,
  type PackProgress,
  downloadTilePack,
  getOfflineMapMeta,
} from "../../lib/maps/offlineTiles"
import { type PlanStop, boundsFromStops, resolvePlanStops } from "../../lib/maps/planStops"

type Props = {
  trip: { destination?: string; startDate?: string; endDate?: string }
  itinerary: Array<{
    id: string
    label?: string
    activities?: Array<{ id: string; text?: string }>
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
}

function stopColor(kind: PlanStop["kind"]) {
  if (kind === "destination") return "#5B8CFF"
  if (kind === "memory") return "#FFA828"
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

export function PlanRouteMap({ trip, itinerary, memories, tripKey }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [stops, setStops] = useState<PlanStop[]>([])
  const [resolving, setResolving] = useState(false)
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  )
  const [meta, setMeta] = useState<OfflineMapMeta | null>(() => getOfflineMapMeta())
  const [packing, setPacking] = useState(false)
  const [progress, setProgress] = useState<PackProgress | null>(null)
  const [packError, setPackError] = useState("")

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
    resolvePlanStops(trip, itinerary, memories, { geocodeOnline: online })
      .then((list) => {
        if (!cancelled) setStops(list)
      })
      .finally(() => {
        if (!cancelled) setResolving(false)
      })
    return () => {
      cancelled = true
    }
  }, [trip.destination, itinerary, memories, online])

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
    for (const stop of stops) {
      const color = stopColor(stop.kind)
      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:12px;height:12px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -10],
      })
      L.marker([stop.lat, stop.lng], { icon })
        .bindPopup(
          `<div class="popup-title">${stop.label}</div><div class="popup-meta">${stop.kind}</div>`,
        )
        .addTo(layer)
    }
    if (stops.length > 0) {
      try {
        map.fitBounds(
          stops.map((s) => [s.lat, s.lng] as [number, number]),
          { padding: [36, 36], maxZoom: 12 },
        )
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => map.invalidateSize(), 80)
  }, [stops])

  const bounds = boundsFromStops(stops)
  const hasArea = Boolean(bounds)
  const metaForTrip = meta && (!meta.tripKey || meta.tripKey === tripKey) ? meta : null

  const runPack = async (clearFirst: boolean) => {
    if (!bounds || !online || packing) return
    setPackError("")
    setPacking(true)
    setProgress({ done: 0, total: 0 })
    try {
      const next = await downloadTilePack(bounds, tripKey, {
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

  const empty = !trip.destination?.trim() && stops.length === 0

  return (
    <div className="card">
      <div className="card-title">🗺️ Route map</div>
      {empty && !resolving && (
        <div className="empty" style={{ padding: "12px 8px 4px" }}>
          <div className="empty-msg">
            Add a destination or itinerary stops to see pins on the map
          </div>
        </div>
      )}
      <div id="plan-route-map" ref={mapEl} />
      <div className="map-hint" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <span>{online ? "Online" : "Offline"}</span>
        <span>·</span>
        {metaForTrip ? (
          <span>
            Offline map saved
            {metaForTrip.savedAt ? ` · Updated ${formatSavedAt(metaForTrip.savedAt)}` : ""}
          </span>
        ) : (
          <span>No offline map yet</span>
        )}
        {resolving && <span>· Locating stops…</span>}
        {!resolving && stops.length > 0 && <span>· {stops.length} stops</span>}
      </div>
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
          disabled={!online || !hasArea || packing}
          onClick={onSave}
        >
          {packing && progress ? `Saving… ${progress.done}/${progress.total}` : "Save map offline"}
        </button>
        {meta && online && (
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 12, padding: "6px 10px" }}
            disabled={packing || !hasArea}
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
