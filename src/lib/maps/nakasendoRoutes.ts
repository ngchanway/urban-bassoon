/** Seeded Nakasendo walk corridors (approx. Magome → Tsumago trail). */

export type HikeRoute = {
  id: string
  dayHint: string
  label: string
  /** [lat, lng] along the trail */
  coordinates: [number, number][]
}

/** Day 3 Magome → Tsumago (~8 km). Waypoints follow the post-town ridge corridor. */
export const MAGOME_TSUMAGO: HikeRoute = {
  id: "magome-tsumago",
  dayHint: "Day 3",
  label: "Nakasendo walk · Magome → Tsumago",
  coordinates: [
    [35.5264, 137.5647], // Magome
    [35.5288, 137.5685],
    [35.5315, 137.5718],
    [35.5342, 137.5745],
    [35.537, 137.577],
    [35.54, 137.5795],
    [35.543, 137.5818],
    [35.5462, 137.5838],
    [35.5495, 137.5855],
    [35.553, 137.5872],
    [35.5565, 137.5888],
    [35.56, 137.5902],
    [35.5635, 137.5915],
    [35.567, 137.5928],
    [35.5705, 137.5938],
    [35.574, 137.5945],
    [35.5772, 137.595], // Tsumago
  ],
}

export const DEMO_HIKE_ROUTES: HikeRoute[] = [MAGOME_TSUMAGO]

export function boundsFromCoords(
  coords: [number, number][],
  padDeg = 0.08,
): { south: number; west: number; north: number; east: number } | null {
  if (!coords.length) return null
  let south = coords[0][0]
  let north = coords[0][0]
  let west = coords[0][1]
  let east = coords[0][1]
  for (const [lat, lng] of coords) {
    south = Math.min(south, lat)
    north = Math.max(north, lat)
    west = Math.min(west, lng)
    east = Math.max(east, lng)
  }
  return {
    south: south - padDeg,
    north: north + padDeg,
    west: west - padDeg,
    east: east + padDeg,
  }
}
