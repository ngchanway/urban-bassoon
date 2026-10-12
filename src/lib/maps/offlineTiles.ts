import { LS } from "../storage"
import { MAP_TILE_STYLE, cartoRasterTileUrl } from "./cartoBasemap"

export { MAP_TILE_STYLE, cartoRasterUrlTemplate, cartoDarkRasterUrlTemplate } from "./cartoBasemap"

export const MAP_TILE_CACHE = "tc-map-tiles"
export const MAP_OFFLINE_KEY = "tc_map_offline"
export const MAX_OFFLINE_TILES = 2500
export const OFFLINE_STALE_MS = 30 * 24 * 60 * 60 * 1000

export type MapBounds = { south: number; west: number; north: number; east: number }

export type OfflineMapMeta = {
  bounds: MapBounds
  zMin: number
  zMax: number
  savedAt: string
  tileCount: number
  tripKey: string
  /** Basemap style id; mismatch marks pack stale after style upgrades. */
  style?: string
}

export function getOfflineMapMeta(): OfflineMapMeta | null {
  return LS.get<OfflineMapMeta | null>(MAP_OFFLINE_KEY, null)
}

export function setOfflineMapMeta(meta: OfflineMapMeta | null) {
  LS.set(MAP_OFFLINE_KEY, meta)
}

export function isOfflinePackStale(meta: OfflineMapMeta | null, now = Date.now()): boolean {
  if (!meta?.savedAt) return false
  if (meta.style !== MAP_TILE_STYLE) return true
  const t = new Date(meta.savedAt).getTime()
  if (!Number.isFinite(t)) return false
  return now - t > OFFLINE_STALE_MS
}

function lngToTileX(lng: number, z: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** z)
}

function latToTileY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z)
}

function tileUrl(z: number, x: number, y: number) {
  return cartoRasterTileUrl(z, x, y)
}

export function padAroundPoint(lat: number, lng: number, padDeg: number): MapBounds {
  return {
    south: lat - padDeg,
    north: lat + padDeg,
    west: lng - padDeg,
    east: lng + padDeg,
  }
}

/** Enumerate tile URLs for one or more bounds (deduped). */
export function enumerateTileUrls(
  boundsList: MapBounds | MapBounds[],
  zMin = 11,
  zMax = 14,
): string[] {
  const list = Array.isArray(boundsList) ? boundsList : [boundsList]
  const seen = new Set<string>()
  const urls: string[] = []
  const zLo = Math.max(0, Math.min(zMin, zMax))
  const zHi = Math.min(18, Math.max(zMin, zMax))
  for (const bounds of list) {
    for (let z = zLo; z <= zHi; z++) {
      const xMin = lngToTileX(bounds.west, z)
      const xMax = lngToTileX(bounds.east, z)
      const yMin = latToTileY(bounds.north, z)
      const yMax = latToTileY(bounds.south, z)
      for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x++) {
        for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y++) {
          const url = tileUrl(z, x, y)
          if (seen.has(url)) continue
          seen.add(url)
          urls.push(url)
        }
      }
    }
  }
  return urls
}

function unionBounds(list: MapBounds[]): MapBounds | null {
  if (!list.length) return null
  let south = list[0].south
  let north = list[0].north
  let west = list[0].west
  let east = list[0].east
  for (const b of list) {
    south = Math.min(south, b.south)
    north = Math.max(north, b.north)
    west = Math.min(west, b.west)
    east = Math.max(east, b.east)
  }
  return { south, north, west, east }
}

export type PlannedPack = {
  urls: string[]
  boundsUsed: MapBounds[]
  unionBounds: MapBounds
  zMin: number
  zMax: number
  padDeg: number
}

type Point = { lat: number; lng: number }

/** Per-stop (+ corridor) packs under soft/hard tile budget. */
export function planOfflinePack(
  points: Point[],
  extraBounds: MapBounds[] = [],
  opts?: { maxTiles?: number },
): PlannedPack {
  if (!points.length && !extraBounds.length) {
    throw new Error("No offline areas to save — add itinerary stops first")
  }

  const tileCap = Math.min(opts?.maxTiles ?? MAX_OFFLINE_TILES, MAX_OFFLINE_TILES)
  let padDeg = 0.2
  const zMin = 11
  let zMax = 13
  const working = [...points]

  const build = (): PlannedPack => {
    const boxes = [...working.map((p) => padAroundPoint(p.lat, p.lng, padDeg)), ...extraBounds]
    const urls = enumerateTileUrls(boxes, zMin, zMax)
    const ub = unionBounds(boxes)
    if (!ub) throw new Error("No offline areas to save")
    return { urls, boundsUsed: boxes, unionBounds: ub, zMin, zMax, padDeg }
  }

  let plan = build()
  while (plan.urls.length > tileCap) {
    if (zMax > zMin) {
      zMax--
      plan = build()
      continue
    }
    if (padDeg > 0.12) {
      padDeg = Math.max(0.12, padDeg * 0.7)
      plan = build()
      continue
    }
    if (working.length > 3) {
      const midLat = working.reduce((s, p) => s + p.lat, 0) / working.length
      const midLng = working.reduce((s, p) => s + p.lng, 0) / working.length
      working.sort(
        (a, b) =>
          (b.lat - midLat) ** 2 +
          (b.lng - midLng) ** 2 -
          ((a.lat - midLat) ** 2 + (a.lng - midLng) ** 2),
      )
      working.pop()
      plan = build()
      continue
    }
    throw new Error(
      `Area still too large (${plan.urls.length} tiles after shrinking). Shorten the trip.`,
    )
  }
  return plan
}

export type PackProgress = { done: number; total: number }

/** Download planned or legacy single-bounds pack into Cache Storage. */
export async function downloadTilePack(
  tripKey: string,
  opts: {
    planned?: PlannedPack
    bounds?: MapBounds
    zMin?: number
    zMax?: number
    onProgress?: (p: PackProgress) => void
    clearFirst?: boolean
  },
): Promise<OfflineMapMeta> {
  if (!navigator.onLine) throw new Error("Offline — connect to save the map")
  if (typeof caches === "undefined") throw new Error("Cache Storage not available")

  const planned =
    opts.planned ||
    (opts.bounds
      ? {
          urls: enumerateTileUrls(opts.bounds, opts.zMin ?? 11, opts.zMax ?? 14),
          boundsUsed: [opts.bounds],
          unionBounds: opts.bounds,
          zMin: opts.zMin ?? 11,
          zMax: opts.zMax ?? 14,
          padDeg: 0.3,
        }
      : null)

  if (!planned) throw new Error("Nothing to download")
  if (planned.urls.length > MAX_OFFLINE_TILES) {
    throw new Error(`Area too large (${planned.urls.length} tiles). Zoom in or shorten the trip.`)
  }

  if (opts.clearFirst) {
    await caches.delete(MAP_TILE_CACHE)
  }
  const cache = await caches.open(MAP_TILE_CACHE)
  let done = 0
  const total = planned.urls.length
  opts.onProgress?.({ done, total })

  const concurrency = 6
  let i = 0
  async function worker() {
    while (i < planned!.urls.length) {
      const idx = i++
      const url = planned!.urls[idx]
      try {
        const res = await fetch(url, { mode: "cors", credentials: "omit" })
        if (res.ok) await cache.put(url, res.clone())
      } catch {
        /* skip */
      }
      done++
      opts.onProgress?.({ done, total })
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const meta: OfflineMapMeta = {
    bounds: planned.unionBounds,
    zMin: planned.zMin,
    zMax: planned.zMax,
    savedAt: new Date().toISOString(),
    tileCount: done,
    tripKey,
    style: MAP_TILE_STYLE,
  }
  setOfflineMapMeta(meta)
  return meta
}
