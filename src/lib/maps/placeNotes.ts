import { callAi } from "../ai"
import { LS } from "../storage"

export type PlaceNote = { text: string; at: string; caution?: string; moreUrl?: string }

const NOTES_KEY = "tc_place_notes"

function normKey(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ")
}

export function loadPlaceNotes(): Record<string, PlaceNote> {
  return LS.get<Record<string, PlaceNote>>(NOTES_KEY, {})
}

export function mergePlaceNotes(
  entries: Record<string, Omit<PlaceNote, "at"> & { at?: string; moreUrl?: string }>,
) {
  const next = loadPlaceNotes()
  const now = new Date().toISOString()
  for (const [k, v] of Object.entries(entries)) {
    const key = normKey(k)
    if (!key || !v.text?.trim()) continue
    next[key] = {
      text: v.text.trim(),
      caution: v.caution?.trim(),
      moreUrl: v.moreUrl?.trim() || undefined,
      at: v.at || now,
    }
  }
  LS.set(NOTES_KEY, next)
}

export function getPlaceNote(noteKey: string): PlaceNote | null {
  return loadPlaceNotes()[normKey(noteKey)] || null
}

function escapeHtml(s: string | number | null | undefined) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Minimal list glyph for popup HTML (no React). */
const ITIN_ICON_SVG =
  '<svg class="popup-itin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>'

export function formatStopPopup(opts: {
  title: string
  localLabel?: string
  dayLabel?: string
  activitySnippet?: string
  kind?: string
  note?: PlaceNote | null
  dayId?: string | number
  activityId?: string | number
  stopId?: string | number
  expanded?: boolean
  /** @deprecated Full note always shown; kept for call-site compat. */
  compact?: boolean
}): string {
  const meta = [opts.dayLabel, opts.activitySnippet || (opts.kind === "hub" ? "Departure" : "")]
    .filter(Boolean)
    .join(" · ")

  let noteHtml = ""
  const note = opts.note
  if (note?.text) {
    let moreCtrl = ""
    if (note.moreUrl) {
      moreCtrl = ` <a class="popup-read-more" href="${escapeHtml(note.moreUrl)}" target="_blank" rel="noopener noreferrer">Read more</a>`
    }
    noteHtml = `<div class="popup-notes">${escapeHtml(note.text)}${moreCtrl}</div>`
  }

  const cautionHtml = note?.caution
    ? `<div class="popup-notes popup-caution"><strong>Watch out:</strong> ${escapeHtml(note.caution)}</div>`
    : ""

  let itinHtml = ""
  if (opts.dayId || opts.activityId) {
    const dayAttr = opts.dayId ? ` data-day-id="${escapeHtml(opts.dayId)}"` : ""
    const actAttr = opts.activityId ? ` data-activity-id="${escapeHtml(opts.activityId)}"` : ""
    itinHtml = `<button type="button" class="popup-itin-link"${dayAttr}${actAttr} aria-label="Show in itinerary" title="Show in itinerary">${ITIN_ICON_SVG}</button>`
  }

  const local = opts.localLabel?.trim()
  const localHtml = local ? `<div class="popup-local">${escapeHtml(local)}</div>` : ""

  return `<div class="popup-title-row"><div class="popup-title-stack"><div class="popup-title">${escapeHtml(opts.title)}</div>${localHtml}</div>${itinHtml}</div>${
    meta ? `<div class="popup-meta">${escapeHtml(meta)}</div>` : ""
  }${noteHtml}${cautionHtml}`
}

/** Lazy AI note for custom places; caches in tc_place_notes. */
export async function ensurePlaceNote(
  noteKey: string,
  placeLabel: string,
  context?: string,
): Promise<PlaceNote | null> {
  const existing = getPlaceNote(noteKey)
  if (existing) return existing
  if (typeof navigator !== "undefined" && !navigator.onLine) return null
  try {
    const text = await callAi({
      task: "tip",
      maxTokens: 220,
      system:
        "You write short traveler place notes. Reply with exactly two short paragraphs separated by a blank line: (1) fun fact / history / culture or nature (2-3 sentences). (2) starting with CAUTION: practical things to watch out for (safety, etiquette, weather, trail, transport). No markdown headings.",
      messages: [
        {
          role: "user",
          content: `Place: ${placeLabel}${context ? `\nContext: ${context}` : ""}`,
        },
      ],
    })
    const parts = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
    let body = parts[0] || text.trim()
    let caution = ""
    const cautionPart = parts.find((p) => /^caution:/i.test(p)) || parts[1]
    if (cautionPart) {
      caution = cautionPart.replace(/^caution:\s*/i, "").trim()
      if (parts[0] && !/^caution:/i.test(parts[0])) body = parts[0]
    }
    const note: PlaceNote = {
      text: body.slice(0, 420),
      caution: caution ? caution.slice(0, 280) : undefined,
      at: new Date().toISOString(),
    }
    mergePlaceNotes({ [noteKey]: note })
    return note
  } catch {
    return null
  }
}
