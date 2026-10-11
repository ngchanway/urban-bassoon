import { LS } from "../storage"

/** Mirrors DEMO_TRIP_ID — keep in sync with lib/demo/nakasendo.ts */
const DEMO_TRIP_ID = "demo_nakasendo"

export type MapEntitlements = {
  isPlus: boolean
  maxSecondary: number
  maxNetworkGeocode: number
  maxOfflineTiles: number
}

function isDemoQuery() {
  try {
    return new URLSearchParams(window.location.search).get("demo") === "nakasendo"
  } catch {
    return false
  }
}

/** Free vs Plus map budgets. Flip `tc_map_plus` or use Japan Navi demo for Plus showcase. */
export function getMapEntitlements(opts?: { tripKey?: string }): MapEntitlements {
  const demoPlus =
    opts?.tripKey === DEMO_TRIP_ID || (typeof window !== "undefined" && isDemoQuery())
  const isPlus = demoPlus || LS.get<boolean>("tc_map_plus", false) === true
  return {
    isPlus,
    maxSecondary: isPlus ? 40 : 12,
    maxNetworkGeocode: isPlus ? 60 : 20,
    maxOfflineTiles: isPlus ? 2500 : 1500,
  }
}
