/**
 * Japan Navi Journey — Nakasendo Walking Journey demo seed.
 * Source: Japan Navi Journey accommodation sheet (10 days, 25 Oct–3 Nov 2026).
 * Package total is tax-included JPY 397,485 after 1% discount (361,350 + 10% tax).
 * Adjust BASELINE_DAYS / guestCount; budgetFromItinerary keeps tc_budget in sync.
 */

import { mergeGeocodeCache } from "../maps/geocode"
import { mergePlaceNotes } from "../maps/placeNotes"
import { LS } from "../storage"
import { snapshotTrip } from "../trip"

/** Known places for Plan Route map (seeded into tc_plan_geo). */
const DEMO_GEO: Record<string, { lat: number; lng: number; label: string; local?: string }> = {
  singapore: { lat: 1.3644, lng: 103.9915, label: "Singapore Changi Airport" },
  "singapore changi airport": {
    lat: 1.3644,
    lng: 103.9915,
    label: "Singapore Changi Airport",
  },
  changi: { lat: 1.3644, lng: 103.9915, label: "Singapore Changi Airport" },
  narita: { lat: 35.7767, lng: 140.3185, label: "Narita", local: "成田" },
  "narita airport": {
    lat: 35.772,
    lng: 140.3929,
    label: "Narita Airport",
    local: "成田空港",
  },
  shinjuku: { lat: 35.6938, lng: 139.7034, label: "Shinjuku", local: "新宿" },
  nagoya: { lat: 35.1815, lng: 136.9066, label: "Nagoya", local: "名古屋" },
  nakatsugawa: {
    lat: 35.4875,
    lng: 137.5006,
    label: "Nakatsugawa",
    local: "中津川",
  },
  "nakatsugawa-juku": {
    lat: 35.4875,
    lng: 137.5006,
    label: "Nakatsugawa-juku",
    local: "中津川宿",
  },
  magome: { lat: 35.5264, lng: 137.5647, label: "Magome", local: "馬籠" },
  tsumago: { lat: 35.5772, lng: 137.595, label: "Tsumago", local: "妻籠" },
  "kiso valley": { lat: 35.7, lng: 137.7, label: "Kiso Valley", local: "木曽谷" },
  kiso: { lat: 35.7, lng: 137.7, label: "Kiso", local: "木曽" },
  narai: { lat: 35.9703, lng: 137.8125, label: "Narai", local: "奈良井" },
  "narai-juku": {
    lat: 35.9703,
    lng: 137.8125,
    label: "Narai-juku",
    local: "奈良井宿",
  },
  matsumoto: { lat: 36.2381, lng: 137.972, label: "Matsumoto", local: "松本" },
  "matsumoto castle": {
    lat: 36.2386,
    lng: 137.9689,
    label: "Matsumoto Castle",
    local: "松本城",
  },
  haneda: { lat: 35.5494, lng: 139.7798, label: "Haneda", local: "羽田" },
  tokyo: { lat: 35.6762, lng: 139.6503, label: "Tokyo", local: "東京" },
  "torii pass": { lat: 35.99, lng: 137.75, label: "Torii Pass", local: "鳥居峠" },
  "torii pass area": {
    lat: 35.99,
    lng: 137.75,
    label: "Torii Pass area",
    local: "鳥居峠",
  },
  "daiwa roynet hotel nagoya taiko-dori side": {
    lat: 35.1706,
    lng: 136.8816,
    label: "Daiwa Roynet Hotel Nagoya Taiko-dori Side",
    local: "ダイワロイネットホテル名古屋太閤通口",
  },
  "daiwa roynet hotel nagoya": {
    lat: 35.1706,
    lng: 136.8816,
    label: "Daiwa Roynet Hotel Nagoya",
    local: "ダイワロイネットホテル名古屋",
  },
  "plaza hotel sakae nakatsugawa": {
    lat: 35.4885,
    lng: 137.5025,
    label: "Plaza Hotel Sakae Nakatsugawa",
    local: "プラザホテル栄 中津川",
  },
  "nezame hotel": {
    lat: 35.7235,
    lng: 137.7035,
    label: "Nezame Hotel",
    local: "寝覚ホテル",
  },
  "yamaniwa inn": {
    lat: 35.965,
    lng: 137.808,
    label: "YAMANIWA INN",
    local: "山庭",
  },
  "traveler's inn takagi": {
    lat: 36.2395,
    lng: 137.9695,
    label: "Traveler's Inn Takagi",
    local: "旅人の宿 高木",
  },
  "shinjuku washington hotel": {
    lat: 35.6915,
    lng: 139.7005,
    label: "Shinjuku Washington Hotel",
    local: "新宿ワシントンホテル",
  },
}

/** Culture notes + cautions for Plan map popups (tc_place_notes). */
const DEMO_PLACE_NOTES: Record<string, { text: string; caution?: string; moreUrl?: string }> = {
  "singapore changi airport": {
    text: "Changi is consistently ranked among the world’s best airports — Jewel’s indoor waterfall and gardens make a long layover feel like a mini outing.",
    caution:
      "Leave buffer for security and immigration on early departures; follow airline bag rules for liquids and power banks.",
    moreUrl: "https://en.wikipedia.org/wiki/Changi_Airport",
  },
  singapore: {
    text: "Changi is consistently ranked among the world’s best airports — Jewel’s indoor waterfall and gardens make a long layover feel like a mini outing.",
    caution:
      "Leave buffer for security and immigration on early departures; follow airline bag rules for liquids and power banks.",
    moreUrl: "https://en.wikipedia.org/wiki/Changi_Airport",
  },
  narita: {
    text: "Narita Airport sits in Chiba, a train or bus ride from central Tokyo. It opened in 1978 and remains a major international gateway.",
    caution:
      "Budget 60–90 minutes into Shinjuku by train; late-night options thin out after the last limited express.",
    moreUrl: "https://en.wikipedia.org/wiki/Narita_International_Airport",
  },
  "narita airport": {
    text: "Narita Airport sits in Chiba, a train or bus ride from central Tokyo. It opened in 1978 and remains a major international gateway.",
    caution:
      "Budget 60–90 minutes into Shinjuku by train; late-night options thin out after the last limited express.",
    moreUrl: "https://en.wikipedia.org/wiki/Narita_International_Airport",
  },
  shinjuku: {
    text: "Shinjuku (“New Inn”) began as the last post town before Edo’s palace. Today it is Tokyo’s transit powerhouse — neon alleys beside skyscraper views.",
    caution:
      "The station maze is real; follow color-coded exits and allow extra time with luggage.",
    moreUrl: "https://en.wikipedia.org/wiki/Shinjuku",
  },
  "shinjuku gyoen": {
    text: "Shinjuku Gyoen was once a daimyo estate tied to Nakasendo travelers — now a national garden with Japanese, French, and English landscapes.",
    caution: "Entry closes earlier in winter; check last admission before a late stroll.",
    moreUrl: "https://en.wikipedia.org/wiki/Shinjuku_Gyoen",
  },
  nagoya: {
    text: "Seat of the Owari Tokugawa and birthplace of Nobunaga, Hideyoshi, and Ieyasu — Nagoya is the industrial heart of Chubu and your gateway to the Kiso Valley.",
    caution:
      "Highway buses can sell out on weekends — keep your Japan Navi booking confirmation handy.",
    moreUrl: "https://en.wikipedia.org/wiki/Nagoya",
  },
  nakatsugawa: {
    text: "Nakatsugawa was the 45th Nakasendo post town and a timber hub for the Kiso Valley. Late October is peak season for kurikinton (chestnut sweets).",
    caution:
      "Sun drops behind the mountains early (~4:45–5:00 PM); carry a light if you stroll beyond the main street after dusk.",
    moreUrl: "https://en.wikipedia.org/wiki/Nakatsugawa",
  },
  "nakatsugawa-juku": {
    text: "Nakatsugawa was the 45th Nakasendo post town and a timber hub for the Kiso Valley. Late October is peak season for kurikinton (chestnut sweets).",
    caution:
      "Sun drops behind the mountains early (~4:45–5:00 PM); carry a light if you stroll beyond the main street after dusk.",
    moreUrl: "https://en.wikipedia.org/wiki/Nakatsugawa",
  },
  magome: {
    text: "Magome-juku climbs a steep slope of wooden inns. Look for ishidatami (stone paving) built to keep the road from washing away in typhoons.",
    caution:
      "Stone streets are slippery when wet; wear shoes with grip and mind your knees on the downhill toward Tsumago. Aim to be off forested trail by 4:00 PM.",
    moreUrl: "https://en.wikipedia.org/wiki/Magome-juku",
  },
  tsumago: {
    text: "Tsumago hides power lines and vending machines off the main street to preserve an 18th-century feel. Odaki and Medaki falls appear in the novel Musashi.",
    caution:
      "Respect no-photography signs at private inns; keep voices low in the evening residential lanes. Ring a bear bell at trailheads before forest sections.",
    moreUrl: "https://en.wikipedia.org/wiki/Tsumago-juku",
  },
  "nezame-no-toko": {
    text: "Nezame-no-toko’s white granite gorge was carved by the Kiso River. Legend places Urashima Taro here after the Dragon Palace — opening his forbidden box turned him old.",
    caution: "Rock paths can be slick after rain; stay on marked viewpoints.",
    moreUrl: "https://en.wikipedia.org/wiki/Nezame_no_Toko",
  },
  nezame: {
    text: "Nezame-no-toko’s white granite gorge was carved by the Kiso River. Legend places Urashima Taro here after the Dragon Palace — opening his forbidden box turned him old.",
    caution: "Rock paths can be slick after rain; stay on marked viewpoints.",
    moreUrl: "https://en.wikipedia.org/wiki/Nezame_no_Toko",
  },
  narai: {
    text: "Narai (“of a Thousand Houses”) sat at ~900 m — the highest, wealthiest Kiso post town, where travelers prepared for Torii Pass. Look for family lacquerware (Kiso shikki) shops.",
    caution: "Torii Pass approaches involve climbs and weather shifts — pack layers and water.",
    moreUrl: "https://en.wikipedia.org/wiki/Narai-juku",
  },
  "narai-juku": {
    text: "Narai (“of a Thousand Houses”) sat at ~900 m — the highest, wealthiest Kiso post town, where travelers prepared for Torii Pass. Look for family lacquerware (Kiso shikki) shops.",
    caution: "Torii Pass approaches involve climbs and weather shifts — pack layers and water.",
    moreUrl: "https://en.wikipedia.org/wiki/Narai-juku",
  },
  matsumoto: {
    text: "Matsumoto Castle is one of only five “original keeps” left in Japan — built for war, not show. The red-railed Moon Viewing Wing was added later for sake and moonlight.",
    caution:
      "Castle stairs are steep and crowded; lockers near the entrance help if you are between trains.",
    moreUrl: "https://en.wikipedia.org/wiki/Matsumoto_Castle",
  },
  "matsumoto castle": {
    text: "Matsumoto Castle is one of only five “original keeps” left in Japan — built for war, not show. The red-railed Moon Viewing Wing was added later for sake and moonlight.",
    caution:
      "Castle stairs are steep and crowded; lockers near the entrance help if you are between trains.",
    moreUrl: "https://en.wikipedia.org/wiki/Matsumoto_Castle",
  },
  haneda: {
    text: "Haneda sits closer to central Tokyo than Narita and is a convenient international departure point after time in the city.",
    caution:
      "Confirm whether your flight uses Terminal 2 or 3; allow time for the monorail or airport bus with bags.",
    moreUrl: "https://en.wikipedia.org/wiki/Haneda_Airport",
  },
  "torii pass": {
    text: "Named for the Shinto gate at the top. Clear days can reveal Mt. Ontake; watch for the “Stone of the Severed Head” (Kubitsuka) from a 16th-century Takeda–Kiso clash.",
    caution:
      "Trails can be muddy after rain; ring a bear bell before forest stretches and be off the trail by ~4:00 PM in late October.",
    moreUrl: "https://en.wikipedia.org/wiki/Nakasend%C5%8D",
  },
  "mount ontake": {
    text: "Mt. Ontake is a sacred volcano and Japan’s second-highest peak after Fuji — visible from Torii Pass on clear days.",
    caution: "Weather closes views quickly; dress in layers for the pass.",
    moreUrl: "https://en.wikipedia.org/wiki/Mount_Ontake",
  },
  "daiwa roynet hotel nagoya taiko-dori side": {
    text: "Beside Nagoya Station — Chubu’s transport hub. Night views over the city lights show Japan’s industrial heart before you head into the mountains.",
    caution: "Station area is busy at rush hour; confirm which exit matches the hotel map.",
  },
  "daiwa roynet hotel nagoya": {
    text: "Beside Nagoya Station — Chubu’s transport hub. Night views over the city lights show Japan’s industrial heart before you head into the mountains.",
    caution: "Station area is busy at rush hour; confirm which exit matches the hotel map.",
  },
  "plaza hotel sakae nakatsugawa": {
    text: "Gateway lodging for Magome and the southern Nakasendo — notice hinoki (cypress) in local interiors; Kiso cypress was so prized that illegal cutting once meant death.",
    caution: "Local buses to Magome can fill on weekends — check timetables the night before.",
  },
  "nezame hotel": {
    text: "Valley base near Nezame-no-toko with breakfast and dinner on package nights — a calm pause after Magome–Tsumago.",
    caution: "Rural evenings are quiet; confirm dinner time with the front desk.",
    moreUrl: "https://en.wikipedia.org/wiki/Nezame_no_Toko",
  },
  "yamaniwa inn": {
    text: "Luxury highlight near Narai — after dinner, a yukata stroll along the silent post-town street is part of the stay.",
    caution: "Space can be limited; keep valuables zipped in shared areas.",
    moreUrl: "https://en.wikipedia.org/wiki/Narai-juku",
  },
  "traveler's inn takagi": {
    text: "Japanese-style rooms above a soba restaurant near the castle — Nagano soba thrives in cold, dry air. Taste noodles plain with a little salt or wasabi before dipping.",
    caution: "Shared bath/toilet facilities; limited English — keep booking details handy.",
  },
  "shinjuku washington hotel": {
    text: "A classic Shinjuku hotel convenient for shopping, ramen alleys, and the final Tokyo nights — completing the Nakasendo into the capital.",
    caution:
      "Shinjuku Station exits are confusing with luggage — follow hotel directions carefully.",
    moreUrl: "https://en.wikipedia.org/wiki/Shinjuku",
  },
}

export const DEMO_TRIP_ID = "demo_nakasendo"
export const DEMO_LOADED_KEY = "tc_demo_nakasendo_loaded"
export const GUIDE_CONTACT =
  "mailto:hello@japan-navi-journey.com?subject=Nakasendo%20Walking%20Journey"
export const ROUTE_BANNER =
  "Singapore → Narita → Shinjuku → Nagoya → Nakatsugawa → Magome & Tsumago → Kiso Valley → Narai-juku → Matsumoto → Shinjuku → Haneda → Singapore"

/** Tax-included package total (JPY, two guests) after 1% discount (invoice 00261002). */
const BASE_PACKAGE = 397_485
const PACKAGE_TAX_EXCL = 361_350
const PACKAGE_TAX = 36_135
const PACKAGE_DEPOSIT = 79_146
const PACKAGE_BALANCE = 318_339
const BASELINE_NIGHTS = 8
const BASELINE_WALK_DAYS = 6
const BASELINE_BREAKFASTS = 3
const BASELINE_DINNERS = 2
const BASELINE_HIGHWAY_BUSES = 2
const NIGHT_UNIT = BASE_PACKAGE / BASELINE_NIGHTS
const WALK_SLICE = BASE_PACKAGE * 0.04
const DINNER_UNIT = 4_000
const BREAKFAST_UNIT = 2_500
const BUS_TICKET_SLICE = BASE_PACKAGE * 0.06

export type DemoMeal = "B" | "D" | "BD"
export type DemoActKind = "walk" | "stay" | "transfer" | "meal" | "note"

export interface DemoActivity {
  id: number
  text: string
  done: boolean
  time?: string
  kind?: DemoActKind
  meal?: DemoMeal
  included?: boolean
  lodging?: boolean
  overnightBus?: boolean
  highwayBus?: boolean
}

export type DemoGuideBullet = { label: string; text: string; url?: string }

export interface DemoDay {
  id: number
  day: number
  label: string
  date: string
  activities: DemoActivity[]
  /** Day-by-day field guide — Plan tab only; optional on non-demo trips */
  guide?: {
    title?: string
    bullets: DemoGuideBullet[]
  }
}

let _id = 1
const nid = () => _id++

/** Editable itinerary baseline — change this array to adjust the demo package. */
export const BASELINE_DAYS: DemoDay[] = [
  {
    id: nid(),
    day: 1,
    label: "Day 1 · Singapore → Nagoya",
    date: "2026-10-25",
    guide: {
      title: "Arrival in the Shogun’s City",
      bullets: [
        {
          label: "History",
          text: "Nagoya was the seat of the Owari Tokugawa — one of the most powerful clans in Japan.",
          url: "https://en.wikipedia.org/wiki/Owari_Domain",
        },
        {
          label: "Fun fact",
          text: "Birthplace of the three unifiers: Oda Nobunaga, Toyotomi Hideyoshi, and Tokugawa Ieyasu.",
          url: "https://en.wikipedia.org/wiki/Nagoya",
        },
        {
          label: "Food",
          text: "Try hitsumabushi (grilled eel over rice) in four stages: plain, with condiments, as dashi broth, then your favorite of the three.",
          url: "https://en.wikipedia.org/wiki/Hitsumabushi",
        },
        {
          label: "Stay",
          text: "Daiwa Roynet sits at Nagoya Station — Chubu’s transport hub. Night city lights show Japan’s industrial heart before the mountains.",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Flight NH804 Singapore → Narita (00:55 – 08:40)",
        done: false,
        time: "00:55",
        kind: "transfer",
      },
      {
        id: nid(),
        text: "Arrive Narita Airport 08:40 · Narita → Shinjuku (own arrangement)",
        done: false,
        time: "08:40",
        kind: "transfer",
      },
      {
        id: nid(),
        text: "Daytime highway bus Shinjuku → Nagoya (by Japan Navi)",
        done: false,
        kind: "transfer",
        highwayBus: true,
        included: true,
      },
      {
        id: nid(),
        text: "Daiwa Roynet Hotel Nagoya Taiko-dori Side · Moderate Double · room only",
        done: false,
        kind: "stay",
        lodging: true,
        included: true,
      },
    ],
  },
  {
    id: nid(),
    day: 2,
    label: "Day 2 · Nakatsugawa-juku",
    date: "2026-10-26",
    guide: {
      title: "Gateway to the Mountains",
      bullets: [
        {
          label: "Post town",
          text: "Nakatsugawa was the 45th post town — a major commercial hub for Kiso Valley timber.",
          url: "https://en.wikipedia.org/wiki/Nakatsugawa",
        },
        {
          label: "Look for",
          text: "Kurikinton (栗きんとん). Late October is peak season for chestnut sweets famous across Japan.",
          url: "https://en.wikipedia.org/wiki/Kuri_kinton",
        },
        {
          label: "Stay",
          text: "Plaza Hotel Sakae is your base before Magome. Notice hinoki (cypress) in local interiors — Kiso cypress was once so prized that illegal cutting meant death (“one branch, one head”).",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Train Nagoya → Nakatsugawa",
        done: false,
        kind: "transfer",
      },
      {
        id: nid(),
        text: "Explore Nakatsugawa-juku and surrounding area (~2–4 km, 1–2 hours)",
        done: false,
        kind: "walk",
      },
      {
        id: nid(),
        text: "Plaza Hotel Sakae Nakatsugawa · Double · room only",
        done: false,
        kind: "stay",
        lodging: true,
        included: true,
      },
    ],
  },
  {
    id: nid(),
    day: 3,
    label: "Day 3 · Magome → Tsumago",
    date: "2026-10-27",
    guide: {
      title: "The Most Famous Path",
      bullets: [
        {
          label: "Hiking",
          text: "Quintessential Nakasendo. Look for ishidatami (stone paving) built to keep the road from washing away in typhoons.",
          url: "https://en.wikipedia.org/wiki/Nakasend%C5%8D",
        },
        {
          label: "Culture",
          text: "Magome climbs a steep slope; Tsumago hides power lines and vending machines off the main street for an 18th-century atmosphere.",
          url: "https://en.wikipedia.org/wiki/Magome-juku",
        },
        {
          label: "Fun fact",
          text: "Odaki and Medaki falls appear in the novel Musashi — where Miyamoto Musashi is said to have tempered his spirit under cold water.",
          url: "https://en.wikipedia.org/wiki/Tsumago-juku",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Bus to Magome · begin Nakasendo walk",
        done: false,
        kind: "transfer",
      },
      {
        id: nid(),
        text: "Walk Magome → Tsumago (~8 km, about 3 hours)",
        done: false,
        kind: "walk",
      },
      {
        id: nid(),
        text: "Public transport further north in the Kiso Valley",
        done: false,
        kind: "transfer",
      },
      {
        id: nid(),
        text: "Nezame Hotel · Western Twin · breakfast & dinner (1 of 2 nights)",
        done: false,
        kind: "stay",
        lodging: true,
        meal: "BD",
        included: true,
      },
    ],
  },
  {
    id: nid(),
    day: 4,
    label: "Day 4 · Scenic Kiso Valley",
    date: "2026-10-28",
    guide: {
      title: "The Dragon’s Gorge",
      bullets: [
        {
          label: "Nature",
          text: "Nezame Hotel sits near Nezame-no-toko — giant white granite rocks carved by the Kiso River.",
          url: "https://en.wikipedia.org/wiki/Nezame_no_Toko",
        },
        {
          label: "Mythology",
          text: "Legend says Urashima Taro (Japan’s Rip Van Winkle) sat here after the Dragon Palace; opening his forbidden box turned him old on these rocks.",
          url: "https://en.wikipedia.org/wiki/Urashima_Tar%C5%8D",
        },
        {
          label: "Hiking",
          text: "If you extend the walk, look for the Kiso Five Trees — evergreens once reserved for shogun castles and Ise Grand Shrine.",
          url: "https://en.wikipedia.org/wiki/Kiso_Valley",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Train/bus to a suitable Nakasendo starting point",
        done: false,
        kind: "transfer",
      },
      {
        id: nid(),
        text: "Walk selected Nakasendo section (~5–7 km, 2–3 hours; shorten if needed)",
        done: false,
        kind: "walk",
      },
      {
        id: nid(),
        text: "Nezame Hotel · Western Twin · breakfast & dinner (2 of 2 nights)",
        done: false,
        kind: "stay",
        lodging: true,
        meal: "BD",
        included: true,
      },
    ],
  },
  {
    id: nid(),
    day: 5,
    label: "Day 5 · Narai-juku",
    date: "2026-10-29",
    guide: {
      title: "The Thousand Houses",
      bullets: [
        {
          label: "History",
          text: "Narai at ~900 m was the highest and most prosperous post town — “Narai of a Thousand Houses,” where travelers prepared for Torii Pass.",
          url: "https://en.wikipedia.org/wiki/Narai-juku",
        },
        {
          label: "Look for",
          text: "Kiso shikki (lacquerware) from local tree sap — shops that have stayed in the same families for generations.",
        },
        {
          label: "Stay",
          text: "Yamaniwa Inn is the luxury highlight. After dinner, walk the street in a yukata — an old post town at night is magical.",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Continue north through the Kiso Valley (train + walk)",
        done: false,
        kind: "transfer",
      },
      {
        id: nid(),
        text: "Selected Nakasendo walking sections (~5–7 km, 2–3 hours)",
        done: false,
        kind: "walk",
      },
      {
        id: nid(),
        text: "YAMANIWA INN · Wide Twin · breakfast included",
        done: false,
        kind: "stay",
        lodging: true,
        meal: "B",
        included: true,
      },
    ],
  },
  {
    id: nid(),
    day: 6,
    label: "Day 6 · Torii Pass area → Matsumoto",
    date: "2026-10-30",
    guide: {
      title: "The High Pass",
      bullets: [
        {
          label: "Hiking",
          text: "Torii Pass is named for the Shinto gate at the top. Clear days can reveal Mt. Ontake, Japan’s second-highest peak after Fuji.",
          url: "https://en.wikipedia.org/wiki/Mount_Ontake",
        },
        {
          label: "Culture",
          text: "Look for the “Stone of the Severed Head” (Kubitsuka) — site of a bloody 16th-century battle between the Takeda and Kiso clans.",
          url: "https://en.wikipedia.org/wiki/Nakasend%C5%8D",
        },
        {
          label: "Transition",
          text: "Toward Matsumoto the landscape opens into a wide basin ringed by the Japan Alps.",
          url: "https://en.wikipedia.org/wiki/Matsumoto,_Nagano",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Explore Narai-juku; optional Torii Pass area walk (~4–7 km, can be shortened)",
        done: false,
        kind: "walk",
      },
      {
        id: nid(),
        text: "Train to Matsumoto",
        done: false,
        kind: "transfer",
      },
      {
        id: nid(),
        text: "Traveler's Inn Takagi (旅の宿たかぎ) · private Japanese-style room above soba restaurant near Matsumoto Castle (1 of 2 nights) · room only · shared living room / shower / toilets · limited English",
        done: false,
        kind: "stay",
        lodging: true,
        included: true,
      },
    ],
  },
  {
    id: nid(),
    day: 7,
    label: "Day 7 · Matsumoto Castle",
    date: "2026-10-31",
    guide: {
      title: "The Crow Castle",
      bullets: [
        {
          label: "History",
          text: "Matsumoto Castle is one of only five “original keeps” left in Japan — built for war, not show.",
          url: "https://en.wikipedia.org/wiki/Matsumoto_Castle",
        },
        {
          label: "Look for",
          text: "The Moon Viewing Wing — a red-railed room from the peaceful Edo period for sake and moonlight, unlike the dark defensive keep.",
        },
        {
          label: "Stay",
          text: "Traveler’s Inn Takagi above a soba restaurant is a culinary deep dive — Nagano soba thrives in cold, dry air. Taste plain with a little salt or wasabi before dipping.",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Explore Matsumoto Castle and old town (~3–5 km; recovery / rest day)",
        done: false,
        kind: "walk",
      },
      {
        id: nid(),
        text: "Traveler's Inn Takagi (旅の宿たかぎ) · private Japanese-style room above soba restaurant near Matsumoto Castle (2 of 2 nights) · room only · shared living room / shower / toilets · limited English",
        done: false,
        kind: "stay",
        lodging: true,
        included: true,
      },
    ],
  },
  {
    id: nid(),
    day: 8,
    label: "Day 8 · Back to Tokyo",
    date: "2026-11-01",
    guide: {
      title: "The Road to Edo",
      bullets: [
        {
          label: "Travel",
          text: "The highway bus to Shinjuku roughly follows the original Nakasendo into the capital.",
          url: "https://en.wikipedia.org/wiki/Nakasend%C5%8D",
        },
        {
          label: "Fun fact",
          text: "Shinjuku (“New Inn”) was founded as the last post town before the shogun’s palace — you finish like a traveler of the Edo road.",
          url: "https://en.wikipedia.org/wiki/Shinjuku",
        },
        {
          label: "Look for",
          text: "On a clear day, sit on the right-hand side of the bus for the best chance of Mt. Fuji as you approach Tokyo.",
          url: "https://en.wikipedia.org/wiki/Mount_Fuji",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Daytime highway bus Matsumoto → Shinjuku (by Japan Navi)",
        done: false,
        kind: "transfer",
        highwayBus: true,
        included: true,
      },
      {
        id: nid(),
        text: "Shinjuku Washington Hotel · Casual Double · room only",
        done: false,
        kind: "stay",
        lodging: true,
        included: true,
      },
    ],
  },
  {
    id: nid(),
    day: 9,
    label: "Day 9 · Free Tokyo · Haneda",
    date: "2026-11-02",
    guide: {
      title: "The Modern Post Town",
      bullets: [
        {
          label: "Culture",
          text: "Shinjuku Gyoen was once a daimyo estate tied to Nakasendo travelers — a calm national garden before departure.",
          url: "https://en.wikipedia.org/wiki/Shinjuku_Gyoen",
        },
        {
          label: "Departure",
          text: "A late Haneda flight leaves room for one last bowl of ramen or sushi in Shinjuku.",
          url: "https://en.wikipedia.org/wiki/Haneda_Airport",
        },
        {
          label: "Omiyage",
          text: "Pick up Shichimi Togarashi from Yawataya Isogoro (airport or Nagano brand shops) — seven-spice chili dating to the 1700s.",
          url: "https://en.wikipedia.org/wiki/Shichimi",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Free time in Tokyo (walk as you like)",
        done: false,
        kind: "note",
      },
      {
        id: nid(),
        text: "Shinjuku → Haneda Airport (own arrangement) for late-night flight",
        done: false,
        kind: "transfer",
      },
      {
        id: nid(),
        text: "Note: walking distances are estimates; sections can be shortened. Best walks combine with trains/buses (not continuous Nakatsugawa→Narai).",
        done: false,
        kind: "note",
      },
    ],
  },
  {
    id: nid(),
    day: 10,
    label: "Day 10 · Haneda → Singapore",
    date: "2026-11-03",
    activities: [
      {
        id: nid(),
        text: "Flight NH843 Haneda → Singapore (00:25 – 06:55)",
        done: false,
        time: "00:25",
        kind: "transfer",
      },
      {
        id: nid(),
        text: "Arrive Singapore 06:55 · have a safe flight",
        done: false,
        time: "06:55",
        kind: "note",
      },
    ],
  },
]

export function buildItinerary(days: DemoDay[] = BASELINE_DAYS): DemoDay[] {
  return days.map((d, i) => ({
    ...d,
    day: i + 1,
    activities: d.activities.map((a) => ({ ...a })),
    guide: d.guide
      ? {
          title: d.guide.title,
          bullets: d.guide.bullets.map((b) => ({ ...b })),
        }
      : undefined,
  }))
}

function countMeals(days: DemoDay[], which: "B" | "D") {
  let n = 0
  for (const d of days) {
    for (const a of d.activities) {
      if (!a.included || !a.meal) continue
      if (which === "B" && (a.meal === "B" || a.meal === "BD")) n++
      if (which === "D" && (a.meal === "D" || a.meal === "BD")) n++
    }
  }
  return n
}

function countLodgingNights(days: DemoDay[]) {
  return days.reduce((n, d) => n + d.activities.filter((a) => a.lodging && a.included).length, 0)
}

function countWalkDays(days: DemoDay[]) {
  return days.filter((d) => d.activities.some((a) => a.kind === "walk")).length
}

function countHighwayBuses(days: DemoDay[]) {
  return days.reduce((n, d) => n + d.activities.filter((a) => a.highwayBus).length, 0)
}

function isFullBaseline(days: DemoDay[], guestCount: number) {
  if (guestCount !== 2 || days.length !== BASELINE_DAYS.length) return false
  if (countLodgingNights(days) !== BASELINE_NIGHTS) return false
  if (countWalkDays(days) !== BASELINE_WALK_DAYS) return false
  if (countMeals(days, "B") !== BASELINE_BREAKFASTS) return false
  if (countMeals(days, "D") !== BASELINE_DINNERS) return false
  if (countHighwayBuses(days) !== BASELINE_HIGHWAY_BUSES) return false
  return days.every((d, i) => d.date === BASELINE_DAYS[i].date)
}

/** Translate itinerary adjustments into package total (JPY, two-guest baseline). */
export function budgetFromItinerary(days: DemoDay[], guestCount = 2): number {
  if (isFullBaseline(days, guestCount)) return BASE_PACKAGE

  let total = BASE_PACKAGE
  total += (countLodgingNights(days) - BASELINE_NIGHTS) * NIGHT_UNIT
  total += (countWalkDays(days) - BASELINE_WALK_DAYS) * WALK_SLICE
  total += (countMeals(days, "D") - BASELINE_DINNERS) * DINNER_UNIT
  total += (countMeals(days, "B") - BASELINE_BREAKFASTS) * BREAKFAST_UNIT
  if (countHighwayBuses(days) === 0) total -= BUS_TICKET_SLICE
  total = total * (guestCount / 2)
  return Math.max(0, Math.round(total / 500) * 500)
}

export function buildPacking() {
  const cats: Record<string, string[]> = {
    "📄 Documents": [
      "Passport",
      "Travel insurance",
      "E-tickets / boarding passes (NH804 · NH843)",
      "Japan Navi Journey itinerary (offline)",
      "Hotel confirmations (Daiwa Roynet · Plaza Sakae · Nezame · YAMANIWA · Traveler's Inn Takagi · Washington)",
      "Highway bus tickets (Shinjuku→Nagoya · Matsumoto→Shinjuku, by Japan Navi)",
    ],
    "👕 Clothing": [
      "Trail shoes / broken-in walking shoes",
      "Rain jacket / packable shell",
      "Warm layer for late Oct / early Nov evenings",
      "Quick-dry shirts",
      "Socks (extra pairs)",
      "Casual clothes for Tokyo evenings",
    ],
    "♨️ Onsen / ryokan": [
      "Yukata etiquette awareness (provided on-site)",
      "Small towel",
      "Toiletries (travel size)",
    ],
    "🎒 Daypack essentials": [
      "Daypack (20–30L)",
      "Water bottle",
      "Snacks / energy bars",
      "Cash for luggage delivery (not in package)",
      "Phone power bank",
      "Universal adapter",
    ],
    "💊 Health": ["Blister plasters", "Painkillers", "Prescription meds", "Hand sanitiser"],
  }
  const out: Record<string, Array<{ id: string; name: string; checked: boolean }>> = {}
  let checkedLeft = 4
  Object.entries(cats).forEach(([cat, items]) => {
    out[cat] = items.map((name, i) => {
      const checked = checkedLeft > 0 && i < 2
      if (checked) checkedLeft--
      return { id: `demo-${cat}-${i}`, name, checked }
    })
  })
  return out
}

function noteDoc(id: string, name: string, cat: string, body: string) {
  const data = `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`
  return {
    id,
    name,
    cat,
    linkedTo: "none",
    linkedId: "",
    data,
    type: "text/plain",
    uploadedAt: new Date().toISOString(),
  }
}

function listHighwayBusLabels(days: DemoDay[]) {
  const labels: string[] = []
  for (const d of days) {
    for (const a of d.activities) {
      if (a.highwayBus) labels.push(a.text.replace(/^Daytime highway bus /, ""))
    }
  }
  return labels
}

export function buildDocs(days: DemoDay[], totalBudget: number) {
  const nights = countLodgingNights(days)
  const breakfasts = countMeals(days, "B")
  const dinners = countMeals(days, "D")
  const busLabels = listHighwayBusLabels(days)
  const buses = busLabels.length ? busLabels.join("; ") : ""

  return [
    noteDoc(
      "demo-doc-inclusions",
      "Package inclusions",
      "ticket",
      [
        `Japan Navi Journey · Nakasendo Walking Journey`,
        `Package total after 1% discount (tax included): JPY ${totalBudget.toLocaleString()} (for two)`,
        `Tax excluded: JPY ${PACKAGE_TAX_EXCL.toLocaleString()} · Consumption tax 10%: JPY ${PACKAGE_TAX.toLocaleString()}`,
        `Deposit received: JPY ${PACKAGE_DEPOSIT.toLocaleString()} · Remaining balance: JPY ${PACKAGE_BALANCE.toLocaleString()}`,
        `Itinerary is provisional; changes may affect final price.`,
        ``,
        `Included:`,
        `· ${nights} overnight stay(s): Daiwa Roynet Nagoya · Plaza Hotel Sakae Nakatsugawa · Nezame Hotel (2) · YAMANIWA INN · Traveler's Inn Takagi / 旅の宿たかぎ (2) · Shinjuku Washington Hotel`,
        `· Meals: ${breakfasts} breakfast(s), ${dinners} dinner(s) (Nezame B&D ×2 nights; YAMANIWA breakfast)`,
        buses
          ? `· Daytime highway buses by Japan Navi: ${buses}`
          : `· Bus tickets: (adjusted — check Plan)`,
        `· Personalized itinerary & self-guided walking info`,
        `· Pre-trip support from Japan Navi Journey`,
        ``,
        `Walking notes: distances are estimates (typically max ~5–8 km walking days).`,
        `Walks combine with trains/buses — not continuous from Nakatsugawa to Narai.`,
      ].join("\n"),
    ),
    noteDoc(
      "demo-doc-exclusions",
      "Not included",
      "other",
      [
        `· International flights (NH804 Singapore→Narita · NH843 Haneda→Singapore) — shown on Plan as guest flights`,
        `· Narita ↔ Shinjuku and Shinjuku ↔ Haneda (own arrangement)`,
        `· Local trains / buses / taxis not specified in the package`,
        `· Luggage delivery (arrange locally; budget separately)`,
        `· Unlisted meals and drinks`,
        `· Private on-trail guides`,
        `· Travel insurance`,
        ``,
        `Estimated separate budget for two: JPY 50,000–80,000`,
        `(own airport transfers, local transport, luggage delivery, extra meals)`,
      ].join("\n"),
    ),
    noteDoc(
      "demo-doc-trail-tips",
      "Trail tips · late October",
      "other",
      [
        `Bear bell: You will hear them everywhere. If you forget to buy one, most trailheads have a permanent bell on a pole — give it a loud ring before entering the woods.`,
        ``,
        `Daylight: The sun sets behind the mountains early (around 4:45–5:00 PM). Be off forested trails by about 4:00 PM.`,
        ``,
        `Soba protocol (Matsumoto inn): Taste soba plain first with a little salt or wasabi to judge the buckwheat, then dip in the sauce.`,
        ``,
        `Cash: Trail tea houses and honesty boxes are often cash-only. Keep ¥100 and ¥500 coins ready even though the package is prepaid.`,
      ].join("\n"),
    ),
    noteDoc(
      "demo-doc-payment",
      "Payment notes",
      "other",
      [
        `Tax excluded: JPY ${PACKAGE_TAX_EXCL.toLocaleString()}`,
        `Consumption tax 10%: JPY ${PACKAGE_TAX.toLocaleString()}`,
        `Tax included total after 1% discount: JPY ${BASE_PACKAGE.toLocaleString()}`,
        `Deposit received: JPY ${PACKAGE_DEPOSIT.toLocaleString()}`,
        `Remaining balance (to be invoiced): JPY ${PACKAGE_BALANCE.toLocaleString()}`,
        `Itinerary is provisional; changes may affect final price.`,
        ``,
        `Bank transfer preferred.`,
        `Card payments: 2% surcharge.`,
      ].join("\n"),
    ),
    noteDoc(
      "demo-doc-contact",
      "Contact Japan Navi Journey",
      "other",
      [
        `Your journey, your pace — with full support.`,
        `Tap “Contact Japan Navi Journey” on Home, or email hello@japan-navi-journey.com`,
        GUIDE_CONTACT,
      ].join("\n"),
    ),
  ]
}

export function buildPeople() {
  return [
    { id: 1, name: "Guest 1" },
    { id: 2, name: "Guest 2" },
    { id: 3, name: "Japan Navi Guide" },
  ]
}

export function buildTripMeta(days: DemoDay[]) {
  const startDate = days[0]?.date || "2026-10-25"
  const endDate = days[days.length - 1]?.date || "2026-11-03"
  return {
    name: "Nakasendo Walking Journey",
    destination: "Nakasendo / Kiso Valley / Matsumoto",
    startDate,
    endDate,
  }
}

export type SeedResult = {
  trip: ReturnType<typeof buildTripMeta>
  itinerary: DemoDay[]
  packing: ReturnType<typeof buildPacking>
  docs: ReturnType<typeof buildDocs>
  people: ReturnType<typeof buildPeople>
  totalBudget: number
  baseCurrency: "JPY"
  routeBanner: string
}

/** Merge known Nakasendo place coords into tc_plan_geo (safe to call anytime). */
export function seedNakasendoGeocodeCache() {
  mergeGeocodeCache(DEMO_GEO)
  mergePlaceNotes(DEMO_PLACE_NOTES)
}

/** Write demo flats + trip registry. Call applyTripFlats() in App after. */
export function seedNakasendoDemo(opts?: {
  days?: DemoDay[]
  guestCount?: number
  reset?: boolean
}): SeedResult {
  const days = buildItinerary(opts?.days ?? BASELINE_DAYS)
  const guestCount = opts?.guestCount ?? 2
  const totalBudget = budgetFromItinerary(days, guestCount)
  const trip = buildTripMeta(days)
  const packing = buildPacking()
  const docs = buildDocs(days, totalBudget)
  const people = buildPeople()

  const trips = LS.get<Array<Record<string, unknown>>>("tc_trips", [])
  const meta = {
    id: DEMO_TRIP_ID,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    createdAt: new Date().toISOString(),
  }
  const without = trips.filter((t) => t.id !== DEMO_TRIP_ID)
  LS.set("tc_trips", [...without, meta])
  LS.set("tc_active_trip", DEMO_TRIP_ID)

  LS.set("tc_trip", trip)
  LS.set("tc_itin", days)
  LS.set("tc_pack", packing)
  LS.set("tc_budget", totalBudget)
  LS.set("tc_daily_budget", 0)
  LS.set("tc_basecurr", "JPY")
  LS.set("tc_expenses", [])
  LS.set("tc_people", people)
  LS.set("tc_memories", [])
  LS.set("tc_docs", docs)
  LS.set("tc_share_blobid", "")
  LS.set("tc_sync_enabled", false)
  LS.set("tc_sync_version", 0)
  LS.set("tc_sync_last_at", "")
  LS.set("tc_chat_msgs", [])
  LS.set("tc_activation_dismissed", true)

  seedNakasendoGeocodeCache()

  snapshotTrip(DEMO_TRIP_ID)
  LS.set(DEMO_LOADED_KEY, true)

  return {
    trip,
    itinerary: days,
    packing,
    docs,
    people,
    totalBudget,
    baseCurrency: "JPY",
    routeBanner: ROUTE_BANNER,
  }
}

export function isJapanNaviDemoQuery() {
  try {
    return new URLSearchParams(window.location.search).get("demo") === "nakasendo"
  } catch {
    return false
  }
}

export function shouldResetDemo() {
  try {
    return new URLSearchParams(window.location.search).get("reset") === "1"
  } catch {
    return false
  }
}
