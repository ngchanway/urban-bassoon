import { callAi } from "../ai"
import { LS } from "../storage"

export type PlaceNote = { text: string; at: string; caution?: string }

const NOTES_KEY = "tc_place_notes"

function normKey(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ")
}

export function loadPlaceNotes(): Record<string, PlaceNote> {
  return LS.get<Record<string, PlaceNote>>(NOTES_KEY, {})
}

export function mergePlaceNotes(entries: Record<string, Omit<PlaceNote, "at"> & { at?: string }>) {
  const next = loadPlaceNotes()
  const now = new Date().toISOString()
  for (const [k, v] of Object.entries(entries)) {
    const key = normKey(k)
    if (!key || !v.text?.trim()) continue
    next[key] = { text: v.text.trim(), caution: v.caution?.trim(), at: v.at || now }
  }
  LS.set(NOTES_KEY, next)
}

export function getPlaceNote(noteKey: string): PlaceNote | null {
  return loadPlaceNotes()[normKey(noteKey)] || null
}

export function formatStopPopup(opts: {
  title: string
  dayLabel?: string
  activitySnippet?: string
  kind?: string
  note?: PlaceNote | null
}): string {
  const meta = [opts.dayLabel, opts.activitySnippet || (opts.kind === "hub" ? "Departure" : "")]
    .filter(Boolean)
    .join(" · ")
  const noteHtml = opts.note?.text
    ? `<div class="popup-notes">${escapeHtml(opts.note.text)}</div>`
    : ""
  const cautionHtml = opts.note?.caution
    ? `<div class="popup-notes" style="margin-top:6px;color:#e8c9a8"><strong>Watch out:</strong> ${escapeHtml(opts.note.caution)}</div>`
    : ""
  return `<div class="popup-title">${escapeHtml(opts.title)}</div>${
    meta ? `<div class="popup-meta">${escapeHtml(meta)}</div>` : ""
  }${noteHtml}${cautionHtml}`
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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
