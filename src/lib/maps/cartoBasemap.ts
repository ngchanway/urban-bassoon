/** CARTO raster basemaps — key from https://carto.com/basemaps/apikey/ */

const STYLE_PATH = "rastertiles/dark_all"

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
export function cartoDarkRasterUrlTemplate(): string {
  return `https://{s}.basemaps.cartocdn.com/${STYLE_PATH}/{z}/{x}/{y}{r}.png${keyQuery()}`
}

/** Absolute tile URL (host `a`) so offline pack matches Leaflet requests. */
export function cartoDarkRasterTileUrl(z: number, x: number, y: number, retina = false): string {
  const scale = retina ? "@2x" : ""
  return `https://a.basemaps.cartocdn.com/${STYLE_PATH}/${z}/${x}/${y}${scale}.png${keyQuery()}`
}
