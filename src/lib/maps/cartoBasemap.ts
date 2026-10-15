/** CARTO raster basemaps — key from https://carto.com/basemaps/apikey/ */

/** Voyager: light travel basemap (roads/terrain read better than dark_all). */
export const MAP_TILE_STYLE = "voyager"
const STYLE_PATH = `rastertiles/${MAP_TILE_STYLE}`

export function getCartoBasemapsKey(): string | undefined {
  const key = (import.meta.env.VITE_CARTO_BASEMAPS_API_KEY as string | undefined)?.trim()
  return key || undefined
}

export function hasCartoBasemapKey(): boolean {
  return Boolean(getCartoBasemapsKey())
}

function keyQuery(): string {
  const key = getCartoBasemapsKey()
  return key ? `?key=${encodeURIComponent(key)}` : ""
}

/** Leaflet URL template with {s}/{z}/{x}/{y}/{r}; use subdomains: "abcd". */
export function cartoRasterUrlTemplate(): string {
  return `https://{s}.basemaps.cartocdn.com/${STYLE_PATH}/{z}/{x}/{y}{r}.png${keyQuery()}`
}

/** Absolute tile URL (host `a`) so offline pack matches Leaflet requests. */
export function cartoRasterTileUrl(z: number, x: number, y: number, retina = false): string {
  const scale = retina ? "@2x" : ""
  return `https://a.basemaps.cartocdn.com/${STYLE_PATH}/${z}/${x}/${y}${scale}.png${keyQuery()}`
}

/** @deprecated Use cartoRasterUrlTemplate — kept for existing imports. */
export const cartoDarkRasterUrlTemplate = cartoRasterUrlTemplate
/** @deprecated Use cartoRasterTileUrl — kept for existing imports. */
export const cartoDarkRasterTileUrl = cartoRasterTileUrl
