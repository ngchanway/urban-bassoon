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

/** External-link glyph for popup “open article” (no React). */
const EXT_LINK_SVG =
  '<svg class="popup-read-more-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>'

const NOTE_COMPACT_LEN = 90

export function formatStopPopup(opts: {
  title: string
  localLabel?: string
  dayLabel?: string
  activityTime?: string
  activitySnippet?: string
  kind?: string
  note?: PlaceNote | null
  dayId?: string | number
  activityId?: string | number
  stopId?: string | number
  expanded?: boolean
  /** When true (default), truncate note and hide caution until expanded. */
  compact?: boolean
}): string {
  const compact = opts.compact !== false && !opts.expanded
  const metaParts = [
    opts.dayLabel,
    opts.activityTime?.trim(),
    opts.activitySnippet || (opts.kind === "hub" ? "Departure" : ""),
  ].filter(Boolean)
  const metaFull = metaParts.join(" · ")
  const meta = compact && metaFull.length > 72 ? `${metaFull.slice(0, 69)}…` : metaFull

  let noteHtml = ""
  const note = opts.note
  if (note?.text) {
    let moreCtrl = ""
    if (!compact && note.moreUrl) {
      moreCtrl = ` <a class="popup-read-more" href="${escapeHtml(note.moreUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open article" title="Open article">${EXT_LINK_SVG}</a>`
    }
    const body =
      compact && note.text.length > NOTE_COMPACT_LEN
        ? `${note.text.slice(0, NOTE_COMPACT_LEN - 1)}…`
        : note.text
    noteHtml = `<div class="popup-notes">${escapeHtml(body)}${moreCtrl}</div>`
  }

  const cautionHtml =
    !compact && note?.caution
      ? `<div class="popup-notes popup-caution"><strong>Watch out:</strong> ${escapeHtml(note.caution)}</div>`
      : ""

  const canExpand = Boolean(
    note?.text &&
      (note.text.length > NOTE_COMPACT_LEN || note.caution || note.moreUrl || metaFull.length > 72),
  )
  let toggleHtml = ""
  if (canExpand || opts.expanded) {
    const label = compact ? "More" : "Less"
    const next = compact ? "1" : "0"
    toggleHtml = `<button type="button" class="popup-expand-toggle" data-expand="${next}" aria-expanded="${compact ? "false" : "true"}">${label}</button>`
  }

  let itinHtml = ""
  if (opts.dayId || opts.activityId) {
    const dayAttr = opts.dayId ? ` data-day-id="${escapeHtml(opts.dayId)}"` : ""
    const actAttr = opts.activityId ? ` data-activity-id="${escapeHtml(opts.activityId)}"` : ""
    itinHtml = `<button type="button" class="popup-itin-link"${dayAttr}${actAttr} aria-label="Show in itinerary" title="Show in itinerary">${ITIN_ICON_SVG}</button>`
  }

  const local = opts.localLabel?.trim()
  const localHtml = local ? `<div class="popup-local">${escapeHtml(local)}</div>` : ""
  const stopAttr = opts.stopId != null ? ` data-stop-id="${escapeHtml(opts.stopId)}"` : ""

  return `<div class="popup-body"${stopAttr} data-compact="${compact ? "1" : "0"}"><div class="popup-title-row"><div class="popup-title-stack"><div class="popup-title">${escapeHtml(opts.title)}</div>${localHtml}</div>${itinHtml}</div>${
    meta ? `<div class="popup-meta">${escapeHtml(meta)}</div>` : ""
  }${noteHtml}${cautionHtml}${toggleHtml}</div>`
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
