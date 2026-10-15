/**
 * Japan Navi Journey — Nakasendo Walking Journey demo seed.
 * Source: Japan Navi Journey accommodation sheet (10 days, 25 Oct–3 Nov 2026).
 * Package total is tax-included JPY 397,485 after 1% discount (361,350 + 10% tax).
 * Adjust BASELINE_DAYS / guestCount; budgetFromItinerary keeps tc_budget in sync.
 */

import { mergeGeocodeCache, purgeStaleDemoGeocode } from "../maps/geocode"
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
  nagiso: { lat: 35.595, lng: 137.608, label: "Nagiso", local: "南木曽" },
  "nagiso station": {
    lat: 35.595,
    lng: 137.608,
    label: "Nagiso Station",
    local: "南木曽駅",
  },
  suhara: { lat: 35.8005, lng: 137.7205, label: "Suhara", local: "須原" },
  "suhara station": {
    lat: 35.8005,
    lng: 137.7205,
    label: "Suhara Station",
    local: "須原駅",
  },
  "suhara-juku": {
    lat: 35.8012,
    lng: 137.7212,
    label: "Suhara-juku",
    local: "須原宿",
  },
  "suhara-sui": {
    lat: 35.801,
    lng: 137.721,
    label: "Suhara-sui",
    local: "須原水",
  },
  "josho-ji": {
    lat: 35.8025,
    lng: 137.7228,
    label: "Josho-ji",
    local: "定勝寺",
  },
  "terao-en": {
    lat: 35.76,
    lng: 137.705,
    label: "Terao-en",
    local: "寺尾園",
  },
  agematsu: { lat: 35.7839, lng: 137.6944, label: "Agematsu", local: "上松" },
  "agematsu station": {
    lat: 35.7839,
    lng: 137.6944,
    label: "Agematsu Station",
    local: "上松駅",
  },
  "nezame-no-toko": {
    lat: 35.7255,
    lng: 137.702,
    label: "Nezame-no-toko",
    local: "寝覚の床",
  },
  yabuhara: { lat: 35.934, lng: 137.797, label: "Yabuhara", local: "藪原" },
  "yabuhara station": {
    lat: 35.934,
    lng: 137.797,
    label: "Yabuhara Station",
    local: "藪原駅",
  },
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
  nakamachi: {
    lat: 36.2358,
    lng: 137.9715,
    label: "Nakamachi",
    local: "中町",
  },
  "nakamachi-dori": {
    lat: 36.2358,
    lng: 137.9715,
    label: "Nakamachi-dori",
    local: "中町通り",
  },
  "nawate-dori": {
    lat: 36.2365,
    lng: 137.9705,
    label: "Nawate-dori",
    local: "縄手通り",
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
    text: "National Scenic Beauty: square white granite “beds” (*toko*) in the emerald Kiso River. Legend places Urashima Taro here after the Dragon Palace — climb onto the rocks for free and eat your convenience-store lunch.",
    caution:
      "Rock paths can be slick after rain; stay on marked viewpoints. Free entry; misty rocks feel otherworldly.",
    moreUrl: "https://en.wikipedia.org/wiki/Nezame_no_Toko",
  },
  nezame: {
    text: "National Scenic Beauty: square white granite “beds” (*toko*) in the emerald Kiso River. Legend places Urashima Taro here after the Dragon Palace — climb onto the rocks for free and eat your convenience-store lunch.",
    caution:
      "Rock paths can be slick after rain; stay on marked viewpoints. Free entry; misty rocks feel otherworldly.",
    moreUrl: "https://en.wikipedia.org/wiki/Nezame_no_Toko",
  },
  suhara: {
    text: "Suhara-juku is the start of the ~12 km walk toward Agematsu. Fill bottles at Suhara-sui (mountain spring) and buy lunch before you leave — no shops until Agematsu.",
    caution: "Start early; long day with gorge overlooks and hinoki forest. Daypack only.",
    moreUrl: "https://en.wikipedia.org/wiki/Kiso_Valley",
  },
  "suhara station": {
    text: "Suhara-juku is the start of the ~12 km walk toward Agematsu. Fill bottles at Suhara-sui (mountain spring) and buy lunch before you leave — no shops until Agematsu.",
    caution: "Start early; long day with gorge overlooks and hinoki forest. Daypack only.",
    moreUrl: "https://en.wikipedia.org/wiki/Kiso_Valley",
  },
  "suhara-juku": {
    text: "Suhara-juku is the start of the ~12 km walk toward Agematsu. Fill bottles at Suhara-sui (mountain spring) and buy lunch before you leave — no shops until Agematsu.",
    caution: "Start early; long day with gorge overlooks and hinoki forest. Daypack only.",
    moreUrl: "https://en.wikipedia.org/wiki/Kiso_Valley",
  },
  "suhara-sui": {
    text: "Famous mountain-spring fountain in Suhara-juku — free, and often called some of the best-tasting water in Japan. Fill every bottle before the 12 km stretch.",
    caution: "No reliable shops or taps on the trail until Agematsu.",
  },
  "josho-ji": {
    text: "Leave Suhara past Josho-ji Temple: behind the buildings the mountain rises in centuries-old cedars — a nature–culture transition into the deep Kiso Valley.",
    caution: "Quiet temple grounds; keep voices low as you pass.",
  },
  "terao-en": {
    text: "Protected Kiso-Hinoki (cypress) grove — straight, towering timber once reserved for imperial palaces. Listen for *uguisu* (Japanese bush warbler) in the *komorebi* light.",
    caution: "Stay on the marked trail through the grove.",
    moreUrl: "https://en.wikipedia.org/wiki/Chamaecyparis_obtusa",
  },
  agematsu: {
    text: "Agematsu-juku sits above Nezame-no-toko. From the gorge it is ~15–20 min uphill to the station (¥240 to Suhara) — or walk “home” to Nezame Hotel and skip the fare.",
    caution: "If finishing at dusk, prefer the hotel walk-home over waiting for a late train.",
    moreUrl: "https://en.wikipedia.org/wiki/Agematsu",
  },
  "agematsu station": {
    text: "Agematsu-juku sits above Nezame-no-toko. From the gorge it is ~15–20 min uphill to the station (¥240 to Suhara) — or walk “home” to Nezame Hotel and skip the fare.",
    caution: "If finishing at dusk, prefer the hotel walk-home over waiting for a late train.",
    moreUrl: "https://en.wikipedia.org/wiki/Agematsu",
  },
  nagiso: {
    text: "Nagiso Station is the JR hub after Magome–Tsumago. Walk ~3–4 km from Tsumago when daylight and energy allow, or take the local bus.",
    caution: "Be off forested trail by ~4:00 PM in late October.",
    moreUrl: "https://en.wikipedia.org/wiki/Nagiso",
  },
  "nagiso station": {
    text: "Nagiso Station is the JR hub after Magome–Tsumago. Walk ~3–4 km from Tsumago when daylight and energy allow, or take the local bus.",
    caution: "Be off forested trail by ~4:00 PM in late October.",
    moreUrl: "https://en.wikipedia.org/wiki/Nagiso",
  },
  yabuhara: {
    text: "Yabuhara is the usual start for Torii Pass toward Narai — uphill to the gate, then downhill into the Thousand Houses.",
    caution:
      "No shops on the pass trail; pack water and snacks. Skip to JR Narai in rain or fatigue.",
    moreUrl: "https://en.wikipedia.org/wiki/Nakasend%C5%8D",
  },
  "yabuhara station": {
    text: "Yabuhara is the usual start for Torii Pass toward Narai — uphill to the gate, then downhill into the Thousand Houses.",
    caution:
      "No shops on the pass trail; pack water and snacks. Skip to JR Narai in rain or fatigue.",
    moreUrl: "https://en.wikipedia.org/wiki/Nakasend%C5%8D",
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
  nakamachi: {
    text: "Nakamachi-dori is the preserved merchant street south of the castle — black-and-white latticed warehouses, cafés, and craft shops in the old town.",
    caution: "Narrow lanes; watch bikes and delivery carts when walking with a daypack.",
    moreUrl: "https://en.wikipedia.org/wiki/Matsumoto,_Nagano",
  },
  "nakamachi-dori": {
    text: "Nakamachi-dori is the preserved merchant street south of the castle — black-and-white latticed warehouses, cafés, and craft shops in the old town.",
    caution: "Narrow lanes; watch bikes and delivery carts when walking with a daypack.",
    moreUrl: "https://en.wikipedia.org/wiki/Matsumoto,_Nagano",
  },
  "nawate-dori": {
    text: "Nawate-dori (“frog street”) runs along the Metoba River with souvenir stalls and snack shops — a short stroll from the castle into the old town.",
    caution: "Can be busy on weekends; keep valuables zipped in crowds.",
    moreUrl: "https://en.wikipedia.org/wiki/Matsumoto,_Nagano",
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
    text: "Valley base beside Nezame-no-toko with breakfast and dinner on package nights — after the Suhara walk you can finish at the rocks and walk “home” here.",
    caution:
      "Rural evenings are quiet; confirm dinner time with the front desk. Leave large bags here on Day 4.",
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
/** Bump when BASELINE_DAYS / demo map content changes so ?demo=nakasendo reseeds without ?reset=1. */
export const DEMO_CONTENT_VERSION = 2
export const DEMO_VERSION_KEY = "tc_demo_nakasendo_version"
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
export type DemoActStatus = "booked" | "planned" | "option" | "confirm"

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
  /** Plan map pin / From→To corridor */
  mapQuery?: string
  mapQueryTo?: string
  /** Booked / Planned / Option / Confirm chip */
  status?: DemoActStatus
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
        status: "planned",
        mapQuery: "Singapore Changi Airport",
        mapQueryTo: "Narita Airport",
      },
      {
        id: nid(),
        text: "Arrive Narita Airport 08:40 · Narita → Shinjuku (own arrangement)",
        done: false,
        time: "08:40",
        kind: "transfer",
        status: "planned",
        mapQuery: "Narita Airport",
        mapQueryTo: "Shinjuku",
      },
      {
        id: nid(),
        text: "Daytime highway bus Shinjuku → Nagoya (by Japan Navi)",
        done: false,
        kind: "transfer",
        highwayBus: true,
        included: true,
        status: "planned",
        mapQuery: "Shinjuku",
        mapQueryTo: "Nagoya",
      },
      {
        id: nid(),
        text: "Daiwa Roynet Hotel Nagoya Taiko-dori Side · Moderate Double · room only",
        done: false,
        kind: "stay",
        lodging: true,
        included: true,
        status: "booked",
        mapQuery: "Daiwa Roynet Hotel Nagoya Taiko-dori Side",
      },
    ],
  },
  {
    id: nid(),
    day: 2,
    label: "Day 2 · Explore Nagoya → Nakatsugawa",
    date: "2026-10-26",
    guide: {
      title: "Gateway to the Mountains",
      bullets: [
        {
          label: "History",
          text: "Nagoya was the seat of the Owari Tokugawa — birthplace of Nobunaga, Hideyoshi, and Ieyasu — before you climb into the Kiso timber country.",
          url: "https://en.wikipedia.org/wiki/Nagoya",
        },
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
          label: "Luggage",
          text: "Move with all bags today. Ask Plaza Hotel Sakae about storage or forwarding before tomorrow’s Magome walk — nothing is booked yet.",
        },
        {
          label: "Cash",
          text: "Withdraw backup yen in Nagoya; Nakatsugawa-juku is quieter and some shops prefer cash.",
        },
        {
          label: "Stay",
          text: "Plaza Hotel Sakae is in Nakatsugawa City (not Nagoya’s Sakae) — ~2 min from the station. Notice hinoki in local interiors — Kiso cypress was once so prized that illegal cutting meant death.",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Easy city walking in Nagoya (morning)",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Nagoya",
      },
      {
        id: nid(),
        text: "JR Chuo Line Nagoya → Nakatsugawa (aim afternoon)",
        done: false,
        kind: "transfer",
        status: "planned",
        mapQuery: "Nagoya",
        mapQueryTo: "Nakatsugawa",
      },
      {
        id: nid(),
        text: "Optional stroll Nakatsugawa-juku (~2–4 km)",
        done: false,
        kind: "walk",
        status: "option",
        mapQuery: "Nakatsugawa-juku",
      },
      {
        id: nid(),
        text: "Plaza Hotel Sakae Nakatsugawa · Double · room only",
        done: false,
        kind: "stay",
        lodging: true,
        included: true,
        status: "booked",
        mapQuery: "Plaza Hotel Sakae Nakatsugawa",
      },
    ],
  },
  {
    id: nid(),
    day: 3,
    label: "Day 3 · Magome → Tsumago → Nagiso",
    date: "2026-10-27",
    guide: {
      title: "The Most Famous Path",
      bullets: [
        {
          label: "Hiking",
          text: "Magome → Tsumago ~8–8.5 km, 2.5–3 hours walking (breaks extra). Climb to Magome Pass, then descend — reverse has more uphill. Look for ishidatami (stone paving).",
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
        {
          label: "Luggage",
          text: "Do not walk with large bags. Magome–Tsumago same-day transfer (indicative ¥1,000/item, drop 8:30–11:30, collect 1:00–5:00) — confirm at tourist info; not arranged yet.",
        },
        {
          label: "Walking",
          text: "Allow 4–5 hours with breaks; finish forested trail by ~4:00 PM. Ring a bear bell at trailheads.",
        },
        {
          label: "Backup",
          text: "If tired, dark, or rainy after Tsumago, take the local bus to Nagiso Station instead of the 3–4 km walk. Start earlier from Nakatsugawa if chasing the 17:00 Nezame check-in.",
        },
        {
          label: "Timetable",
          text: "Kitaena bus Nakatsugawa → Magome; Nagiso town bus; JR Chuo toward Agematsu / Nezame Hotel — confirm on the day.",
          url: "https://railway.jr-central.co.jp/ticket/timetable/",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Kitaena bus Nakatsugawa Station → Magome",
        done: false,
        kind: "transfer",
        status: "planned",
        mapQuery: "Nakatsugawa",
        mapQueryTo: "Magome",
      },
      {
        id: nid(),
        text: "Walk Magome → Tsumago (~8 km, about 3 hours)",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Magome",
        mapQueryTo: "Tsumago",
      },
      {
        id: nid(),
        text: "Walk Tsumago → Nagiso Station (~3–4 km)",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Tsumago",
        mapQueryTo: "Nagiso Station",
      },
      {
        id: nid(),
        text: "Fallback: local bus Tsumago → Nagiso Station",
        done: false,
        kind: "transfer",
        status: "option",
        mapQuery: "Tsumago",
        mapQueryTo: "Nagiso Station",
      },
      {
        id: nid(),
        text: "JR Chuo Nagiso → Agematsu / Nezame Hotel area",
        done: false,
        kind: "transfer",
        status: "confirm",
        mapQuery: "Nagiso Station",
        mapQueryTo: "Nezame Hotel",
      },
      {
        id: nid(),
        text: "Nezame Hotel · Western Twin · breakfast & dinner (1 of 2 nights)",
        done: false,
        kind: "stay",
        lodging: true,
        meal: "BD",
        included: true,
        status: "booked",
        mapQuery: "Nezame Hotel",
      },
    ],
  },
  {
    id: nid(),
    day: 4,
    label: "Day 4 · Suhara → Agematsu (~12 km)",
    date: "2026-10-28",
    guide: {
      title: "Raw Kiso Valley",
      bullets: [
        {
          label: "Nature",
          text: "Default Option C: Suhara → Agematsu ~12 km. Cedars at Josho-ji, Terao-en hinoki / *komorebi*, Central Alps (Kiso-Komagatake) to the east, emerald Kiso River S-bends, finale at Nezame-no-toko.",
          url: "https://en.wikipedia.org/wiki/Nezame_no_Toko",
        },
        {
          label: "Mythology",
          text: "Legend says Urashima Taro sat on these granite beds after the Dragon Palace; opening his forbidden box turned him old here.",
          url: "https://en.wikipedia.org/wiki/Urashima_Tar%C5%8D",
        },
        {
          label: "Hiking",
          text: "Look for the Kiso Five Trees — evergreens once reserved for shogun castles and Ise Grand Shrine. Every scenic stop on this stretch is free.",
          url: "https://en.wikipedia.org/wiki/Kiso_Valley",
        },
        {
          label: "Water",
          text: "Fill bottles at Suhara-sui (mountain spring) in Suhara-juku before you start — free and famous tasting water.",
        },
        {
          label: "Lunch",
          text: "Buy bento or onigiri at a convenience store before leaving Suhara — zero shops for ~12 km until Agematsu.",
        },
        {
          label: "Luggage",
          text: "Leave large bags at Nezame Hotel; daypack only.",
        },
        {
          label: "Backup",
          text: "Finish at Nezame-no-toko and walk “home” to Nezame Hotel (skip ¥240 Suhara→Agematsu train). Or ~15–20 min uphill to Agematsu Station. Options A/B/D remain if you prefer a shorter day.",
        },
        {
          label: "Timetable",
          text: "JR Chuo to Suhara and optional return from Agematsu — confirm connections before starting.",
          url: "https://railway.jr-central.co.jp/ticket/timetable/",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "JR to Suhara Station (daypack from Nezame Hotel)",
        done: false,
        kind: "transfer",
        status: "confirm",
        mapQuery: "Nezame Hotel",
        mapQueryTo: "Suhara Station",
      },
      {
        id: nid(),
        text: "Fill water at Suhara-sui spring (free)",
        done: false,
        kind: "note",
        status: "planned",
        mapQuery: "Suhara-sui",
      },
      {
        id: nid(),
        text: "Pass Josho-ji Temple · cedar backdrop",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Josho-ji",
      },
      {
        id: nid(),
        text: "Walk Suhara → Nezame-no-toko via Terao-en (~12 km)",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Suhara",
        mapQueryTo: "Nezame-no-toko",
      },
      {
        id: nid(),
        text: "Terao-en Kiso-Hinoki grove (*komorebi*)",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Terao-en",
      },
      {
        id: nid(),
        text: "Nezame-no-toko · free granite beds · lunch stop",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Nezame-no-toko",
      },
      {
        id: nid(),
        text: "Walk home to Nezame Hotel (skip Agematsu train if possible)",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Nezame-no-toko",
        mapQueryTo: "Nezame Hotel",
      },
      {
        id: nid(),
        text: "Option A: Nagiso → Nojiri (~9–10 km) instead",
        done: false,
        kind: "note",
        status: "option",
      },
      {
        id: nid(),
        text: "Option B: Nojiri → Suhara (~9–10 km) instead",
        done: false,
        kind: "note",
        status: "option",
      },
      {
        id: nid(),
        text: "Option D: Short Agematsu & Nezame-no-toko loop instead",
        done: false,
        kind: "note",
        status: "option",
      },
      {
        id: nid(),
        text: "Nezame Hotel · Western Twin · breakfast & dinner (2 of 2 nights)",
        done: false,
        kind: "stay",
        lodging: true,
        meal: "BD",
        included: true,
        status: "booked",
        mapQuery: "Nezame Hotel",
      },
    ],
  },
  {
    id: nid(),
    day: 5,
    label: "Day 5 · Yabuhara → Torii Pass → Narai",
    date: "2026-10-29",
    guide: {
      title: "The High Pass",
      bullets: [
        {
          label: "Hiking",
          text: "Yabuhara → Torii Pass → Narai ~6–6.2 km, 3–3.5 hours. Higher effort: uphill to the Shinto gate, then downhill to Narai. Clear days can reveal Mt. Ontake.",
          url: "https://en.wikipedia.org/wiki/Mount_Ontake",
        },
        {
          label: "Culture",
          text: "Look for the “Stone of the Severed Head” (Kubitsuka) — site of a bloody 16th-century Takeda–Kiso clash.",
          url: "https://en.wikipedia.org/wiki/Nakasend%C5%8D",
        },
        {
          label: "History",
          text: "Narai at ~900 m was the highest and most prosperous post town — “Narai of a Thousand Houses.”",
          url: "https://en.wikipedia.org/wiki/Narai-juku",
        },
        {
          label: "Look for",
          text: "Kiso shikki (lacquerware) from local tree sap — shops that have stayed in the same families for generations.",
        },
        {
          label: "Cash",
          text: "No shops on the Torii Pass trail — bring water and snacks. Carry cash in Narai.",
        },
        {
          label: "Backup",
          text: "In rain, wind, fatigue, or poor trail conditions, skip the pass and take JR from Yabuhara straight to Narai.",
        },
        {
          label: "Luggage",
          text: "Confirm whether bags can go Nezame → YAMANIWA (deadline/arrival). If not, day bag + storage.",
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
        text: "Check out · JR to Yabuhara Station",
        done: false,
        kind: "transfer",
        status: "confirm",
        mapQuery: "Nezame Hotel",
        mapQueryTo: "Yabuhara Station",
      },
      {
        id: nid(),
        text: "Walk Yabuhara → Torii Pass → Narai (~6 km, 3–3.5 hours)",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Yabuhara",
        mapQueryTo: "Narai",
      },
      {
        id: nid(),
        text: "Backup: JR Yabuhara → Narai (skip Torii Pass)",
        done: false,
        kind: "transfer",
        status: "option",
        mapQuery: "Yabuhara Station",
        mapQueryTo: "Narai",
      },
      {
        id: nid(),
        text: "YAMANIWA INN · Wide Twin · breakfast included",
        done: false,
        kind: "stay",
        lodging: true,
        meal: "B",
        included: true,
        status: "booked",
        mapQuery: "YAMANIWA INN",
      },
    ],
  },
  {
    id: nid(),
    day: 6,
    label: "Day 6 · Narai → Matsumoto",
    date: "2026-10-30",
    guide: {
      title: "Thousand Houses to Castle Town",
      bullets: [
        {
          label: "Culture",
          text: "Morning stroll in Narai-juku before the train — lacquerware shops and the long wooden main street at ~900 m.",
          url: "https://en.wikipedia.org/wiki/Narai-juku",
        },
        {
          label: "Transition",
          text: "Toward Matsumoto the landscape opens into a wide basin ringed by the Japan Alps.",
          url: "https://en.wikipedia.org/wiki/Matsumoto,_Nagano",
        },
        {
          label: "Look for",
          text: "In Matsumoto: Castle, Nakamachi-dori, Nawate-dori — city walking after the pass day.",
          url: "https://en.wikipedia.org/wiki/Matsumoto_Castle",
        },
        {
          label: "Luggage",
          text: "Confirm whether bags can go YAMANIWA → Traveler’s Inn Takagi. Check-in 16:30–20:00; call if after 20:00.",
        },
        {
          label: "Cash",
          text: "Small Narai shops may prefer cash; Matsumoto accepts cards widely.",
        },
        {
          label: "Timetable",
          text: "JR Chuo Line Narai → Matsumoto — confirm on the day.",
          url: "https://www.jreast.co.jp/timetable/",
        },
      ],
    },
    activities: [
      {
        id: nid(),
        text: "Morning stroll Narai-juku",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Narai-juku",
      },
      {
        id: nid(),
        text: "JR Chuo Narai → Matsumoto",
        done: false,
        kind: "transfer",
        status: "planned",
        mapQuery: "Narai",
        mapQueryTo: "Matsumoto",
      },
      {
        id: nid(),
        text: "Traveler's Inn Takagi (旅の宿たかぎ) · private Japanese-style room above soba restaurant near Matsumoto Castle (1 of 2 nights) · room only · shared living room / shower / toilets · limited English",
        done: false,
        kind: "stay",
        lodging: true,
        included: true,
        status: "booked",
        mapQuery: "Traveler's Inn Takagi",
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
        text: "Explore Matsumoto Castle (~1–2 hours)",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Matsumoto Castle",
      },
      {
        id: nid(),
        text: "Old town stroll · Nakamachi-dori & Nawate-dori",
        done: false,
        kind: "walk",
        status: "planned",
        mapQuery: "Nakamachi",
        mapQueryTo: "Nawate-dori",
      },
      {
        id: nid(),
        text: "Option: day trip Narai → Kiso-Hirasawa or catch-up Torii Pass",
        done: false,
        kind: "note",
        status: "option",
      },
      {
        id: nid(),
        text: "Traveler's Inn Takagi (旅の宿たかぎ) · private Japanese-style room above soba restaurant near Matsumoto Castle (2 of 2 nights) · room only · shared living room / shower / toilets · limited English",
        done: false,
        kind: "stay",
        lodging: true,
        included: true,
        status: "booked",
        mapQuery: "Traveler's Inn Takagi",
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
        status: "planned",
        mapQuery: "Matsumoto",
        mapQueryTo: "Shinjuku",
      },
      {
        id: nid(),
        text: "Shinjuku Washington Hotel · Casual Double · room only",
        done: false,
        kind: "stay",
        lodging: true,
        included: true,
        status: "booked",
        mapQuery: "Shinjuku Washington Hotel",
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
        status: "planned",
        mapQuery: "Shinjuku",
      },
      {
        id: nid(),
        text: "Shinjuku → Haneda Airport (own arrangement) for late-night flight",
        done: false,
        kind: "transfer",
        status: "planned",
        mapQuery: "Shinjuku",
        mapQueryTo: "Haneda",
      },
      {
        id: nid(),
        text: "Note: walking distances are estimates; sections can be shortened. Best walks combine with trains/buses — not continuous Nakatsugawa→Narai.",
        done: false,
        kind: "note",
        status: "planned",
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
        status: "planned",
        mapQuery: "Haneda",
        mapQueryTo: "Singapore Changi Airport",
      },
      {
        id: nid(),
        text: "Arrive Singapore 06:55 · have a safe flight",
        done: false,
        time: "06:55",
        kind: "note",
        status: "planned",
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
        `Walking notes: distances are estimates (Magome–Tsumago ~8 km; Suhara–Agematsu ~12 km; Torii Pass ~6 km).`,
        `Walks combine with trains/buses — not continuous from Nakatsugawa to Narai.`,
        `Day 4 default: Suhara → Agematsu; fill Suhara-sui, buy lunch before Suhara, walk home to Nezame Hotel when possible.`,
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
        `· Luggage delivery / Magome–Tsumago bag transfer (arrange locally; budget separately)`,
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
        `Day 4 (Suhara → Agematsu ~12 km): Fill bottles at Suhara-sui spring before starting. Buy bento/onigiri in Suhara — no shops until Agematsu. Finish at Nezame-no-toko and walk to Nezame Hotel to skip the ¥240 station train when possible.`,
        ``,
        `Torii Pass backup: In rain, wind, or fatigue, take JR Yabuhara → Narai instead of the pass.`,
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
  // Drop "narai." etc. and any demo hits outside Singapore–Japan corridor
  purgeStaleDemoGeocode(Object.keys(DEMO_GEO))
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
  LS.set(DEMO_VERSION_KEY, DEMO_CONTENT_VERSION)

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

/** True when stored demo content version is missing or behind DEMO_CONTENT_VERSION. */
export function needsDemoContentReseed() {
  const stored = LS.get<number | string>(DEMO_VERSION_KEY, 0)
  const n = typeof stored === "number" ? stored : Number(stored)
  return !Number.isFinite(n) || n !== DEMO_CONTENT_VERSION
}
