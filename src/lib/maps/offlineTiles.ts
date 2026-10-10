import { LS } from "../storage"
import { cartoDarkRasterTileUrl } from "./cartoBasemap"

export { cartoDarkRasterUrlTemplate } from "./cartoBasemap"

export const MAP_TILE_CACHE = "tc-map-tiles"
export const MAP_OFFLINE_KEY = "tc_map_offline"

export type MapBounds = { south: number; west: number; north: number; east: number }

export type OfflineMapMeta = {
  bounds: MapBounds
  zMin: number
  zMax: number
  savedAt: string
  tileCount: number
  tripKey: string
}

export function getOfflineMapMeta(): OfflineMapMeta | null {
  return LS.get<OfflineMapMeta | null>(MAP_OFFLINE_KEY, null)
}

export function setOfflineMapMeta(meta: OfflineMapMeta | null) {
  LS.set(MAP_OFFLINE_KEY, meta)
}

function lngToTileX(lng: number, z: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** z)
}

function latToTileY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z)
}

function tileUrl(z: number, x: number, y: number) {
  return cartoDarkRasterTileUrl(z, x, y)
}

/** List tile URLs covering bounds at zMin..zMax (inclusive). */
export function enumerateTileUrls(bounds: MapBounds, zMin = 10, zMax = 14): string[] {
  const urls: string[] = []
  const zLo = Math.max(0, Math.min(zMin, zMax))
  const zHi = Math.min(18, Math.max(zMin, zMax))
  for (let z = zLo; z <= zHi; z++) {
    const xMin = lngToTileX(bounds.west, z)
    const xMax = lngToTileX(bounds.east, z)
    const yMin = latToTileY(bounds.north, z)
    const yMax = latToTileY(bounds.south, z)
    for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x++) {
      for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y++) {
        urls.push(tileUrl(z, x, y))
      }
    }
  }
  return urls
}

export type PackProgress = { done: number; total: number }

/** Download tiles into Cache Storage. Returns count saved. */
export async function downloadTilePack(
  bounds: MapBounds,
  tripKey: string,
  opts?: {
    zMin?: number
    zMax?: number
    onProgress?: (p: PackProgress) => void
    clearFirst?: boolean
  },
): Promise<OfflineMapMeta> {
  if (!navigator.onLine) throw new Error("Offline — connect to save the map")
  if (typeof caches === "undefined") throw new Error("Cache Storage not available")

  const zMin = opts?.zMin ?? 10
  const zMax = opts?.zMax ?? 14
  const urls = enumerateTileUrls(bounds, zMin, zMax)
  if (urls.length > 2500) {
    throw new Error(`Area too large (${urls.length} tiles). Zoom in or shorten the trip.`)
  }

  if (opts?.clearFirst) {
    await caches.delete(MAP_TILE_CACHE)
  }
  const cache = await caches.open(MAP_TILE_CACHE)
  let done = 0
  const total = urls.length
  opts?.onProgress?.({ done, total })

  // Batch with concurrency 6
  const concurrency = 6
  let i = 0
  async function worker() {
    while (i < urls.length) {
      const idx = i++
      const url = urls[idx]
      try {
        const res = await fetch(url, { mode: "cors", credentials: "omit" })
        if (res.ok) await cache.put(url, res.clone())
      } catch {
        /* skip failed tile */
      }
      done++
      opts?.onProgress?.({ done, total })
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const meta: OfflineMapMeta = {
    bounds,
    zMin,
    zMax,
    savedAt: new Date().toISOString(),
    tileCount: done,
    tripKey,
  }
  setOfflineMapMeta(meta)
  return meta
}
