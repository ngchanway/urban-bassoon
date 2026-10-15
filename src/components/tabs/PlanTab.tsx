import { useEffect, useState } from "react"
import { addDays, downloadICS, generateDayICS, generateICS } from "../../lib/calendar"
import { TAB } from "../../lib/tabs"
import { IconExternalLink } from "../shared/Icons"
import { SwipeableActivity } from "../shared/SwipeableActivity"
import { PlanRouteMap } from "./PlanRouteMap"

export function PlanTab({
  trip,
  saveTrip,
  itinerary,
  addDay,
  addActivity,
  toggleActivity,
  removeDay,
  removeActivity,
  expenses,
  baseCurrency,
  memories,
  navigateTo,
  onQuickExpense,
  onQuickMemory,
  activeTripId,
}) {
  const tripComplete = Boolean(trip.destination && trip.startDate && trip.endDate)
  const [showCal, setShowCal] = useState(false)
  const [focusActivityId, setFocusActivityId] = useState(null)
  const [locatableIds, setLocatableIds] = useState(() => new Set())
  const [locateHint, setLocateHint] = useState("")
  const [flashId, setFlashId] = useState(null)
  const [expandedDayId, setExpandedDayId] = useState(() => itinerary[0]?.id ?? null)
  const [addSheet, setAddSheet] = useState(null) // { day }
  const [addMode, setAddMode] = useState("single") // single | fromto
  const [addForm, setAddForm] = useState({ place: "", from: "", to: "", detail: "", time: "" })

  const tripDays =
    trip.startDate && trip.endDate
      ? Math.max(
          0,
          Math.round(
            (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000,
          ) + 1,
        )
      : null

  useEffect(() => {
    if (!itinerary.length) {
      setExpandedDayId(null)
      return
    }
    setExpandedDayId((cur) =>
      cur != null && itinerary.some((d) => d.id === cur) ? cur : itinerary[0].id,
    )
  }, [itinerary])

  const openAddSheet = (day) => {
    setAddSheet({ day })
    setAddMode("single")
    setAddForm({ place: "", from: "", to: "", detail: "", time: "" })
  }

  const submitAddActivity = () => {
    if (!addSheet?.day) return
    const detail = addForm.detail.trim()
    const time = addForm.time.trim()
    if (addMode === "fromto") {
      const from = addForm.from.trim()
      const to = addForm.to.trim()
      if (!from || !to) return
      const text = detail ? `${from} → ${to} · ${detail}` : `${from} → ${to}`
      addActivity(addSheet.day.id, {
        text,
        kind: "walk",
        mapQuery: from,
        mapQueryTo: to,
        ...(time ? { time } : {}),
      })
    } else {
      const place = addForm.place.trim()
      if (!place) return
      const text = detail ? `${place} · ${detail}` : place
      addActivity(addSheet.day.id, {
        text,
        mapQuery: place,
        ...(time ? { time } : {}),
      })
    }
    setAddSheet(null)
  }

  const daySpend = (day) =>
    expenses
      .filter((e) => e.dayId === day.id)
      .reduce((s, e) => s + (e.amtBase ?? Number(e.amount ?? 0)), 0)
  const dayMemories = (day) => memories.filter((m) => m.dayId === day.id).length

  const flashEl = (elId) => {
    setFlashId(elId)
    window.setTimeout(() => setFlashId((cur) => (cur === elId ? null : cur)), 2000)
  }

  const toggleDay = (dayId) => {
    setExpandedDayId((cur) => (cur === dayId ? null : dayId))
  }

  const handleLocate = (actId, dayId) => {
    if (dayId != null) setExpandedDayId(dayId)
    document
      .getElementById("plan-route-map")
      ?.closest(".app-map-sticky")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => setFocusActivityId(actId), 160)
  }

  const handleRevealItinerary = ({ dayId, activityId }) => {
    const actKey = activityId != null ? String(activityId) : ""
    let dayKey = dayId != null ? String(dayId) : ""
    if (!dayKey && actKey) {
      const day = itinerary.find((d) => (d.activities || []).some((a) => String(a.id) === actKey))
      if (day) dayKey = String(day.id)
    }
    if (dayKey) {
      const match = itinerary.find((d) => String(d.id) === dayKey)
      setExpandedDayId(match?.id ?? dayKey)
    }

    window.setTimeout(() => {
      const actEl = actKey ? document.getElementById(`itin-act-${actKey}`) : null
      const dayEl = dayKey ? document.getElementById(`itin-day-${dayKey}`) : null
      const target = actEl || dayEl
      if (!target) return
      target.scrollIntoView({ behavior: "smooth", block: "center" })
      flashEl(actEl ? `itin-act-${actKey}` : `itin-day-${dayKey}`)
    }, 150)
  }

  const showTripForm = !tripComplete

  const allActs = itinerary.flatMap((d) => d.activities).length
  const daysWithActs = itinerary.filter((d) => d.activities.length > 0).length
  const tripSlug = (trip.name || "trip").replace(/\s+/g, "-")
  const icsStr = () => generateICS({ trip, itinerary })

  const canSaveAdd =
    addMode === "fromto"
      ? Boolean(addForm.from.trim() && addForm.to.trim())
      : Boolean(addForm.place.trim())

  const tripBlock = showTripForm ? (
    <div className="plan-trip-details">
      <div className="card-title" style={{ marginBottom: 8 }}>
        🗺️ Trip Details
      </div>
      <div className="flex flex-col gap-8">
        <input
          className="input"
          placeholder="Destination (e.g. Tokyo, Japan)"
          value={trip.destination}
          onChange={(e) => saveTrip({ ...trip, destination: e.target.value })}
        />
        <div className="grid-2">
          <div>
            <div className="card-title-small">Depart</div>
            <input
              type="date"
              className="input"
              value={trip.startDate}
              onChange={(e) => saveTrip({ ...trip, startDate: e.target.value })}
            />
          </div>
          <div>
            <div className="card-title-small">Return</div>
            <input
              type="date"
              className="input"
              value={trip.endDate}
              onChange={(e) => saveTrip({ ...trip, endDate: e.target.value })}
            />
          </div>
        </div>
        {tripDays != null && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-faint)",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>
              🗓️ {tripDays} {tripDays === 1 ? "day" : "days"}
            </span>
            {trip.destination && <span>📍 {trip.destination}</span>}
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <div>
      <PlanRouteMap
        trip={trip}
        itinerary={itinerary}
        memories={memories}
        tripKey={activeTripId || trip.destination || "trip"}
        focusActivityId={focusActivityId}
        onFocusConsumed={() => setFocusActivityId(null)}
        onLocateMiss={() => {
          setLocateHint("Pin not located yet")
          window.setTimeout(() => setLocateHint(""), 2200)
        }}
        onRevealItinerary={handleRevealItinerary}
        onLocatableIds={(ids) => setLocatableIds(new Set(ids.map(String)))}
      />

      {locateHint && <div className="plan-locate-hint">{locateHint}</div>}

      <div className="card">
        {tripBlock}

        <div className="card-title" style={{ marginBottom: 10 }}>
          📅 Itinerary
        </div>

        <button
          type="button"
          className="plan-export-toggle"
          aria-expanded={showCal}
          onClick={() => setShowCal((s) => !s)}
        >
          <span className="plan-export-toggle-label">
            <span className="plan-export-chevron" aria-hidden="true">
              {showCal ? "▾" : "▸"}
            </span>
            Export to calendar
          </span>
          {allActs > 0 && <span className="plan-export-toggle-meta">{allActs} events</span>}
        </button>

        {showCal && (
          <div className="plan-itin-sync">
            {!trip.startDate && (
              <div className="cal-no-dates">Set trip dates above to enable calendar export.</div>
            )}
            {trip.startDate && (
              <>
                <button
                  type="button"
                  className="btn plan-export-ics-btn"
                  onClick={() => downloadICS(icsStr(), `${tripSlug}.ics`)}
                >
                  Download .ics
                </button>
                <div className="plan-export-ics-sub">
                  Works with Apple Calendar, Google, Outlook
                </div>

                {daysWithActs > 0 && (
                  <div className="cal-event-preview">
                    <div className="cal-event-preview-title">Add one day</div>
                    {itinerary.map((day, idx) => {
                      if (!day.activities.length) return null
                      const d = addDays(trip.startDate, idx)
                      const dateLabel = d.toLocaleDateString("en", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                      return (
                        <div key={day.id} className="cal-preview-row">
                          <div className="cal-preview-date">{dateLabel}</div>
                          <div className="cal-preview-acts">
                            {day.label} · {day.activities.length} act
                            {day.activities.length !== 1 ? "s" : ""}
                          </div>
                          <div className="cal-preview-chips">
                            <button
                              type="button"
                              className="cal-chip cal-chip-ics"
                              onClick={() =>
                                downloadICS(
                                  generateDayICS({ trip, day, dayIndex: idx }),
                                  `${tripSlug}-day-${idx + 1}.ics`,
                                )
                              }
                            >
                              .ics
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {itinerary.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🗓️</div>
            <div className="empty-msg">Add days to build your itinerary</div>
          </div>
        ) : (
          itinerary.map((day, dayIdx) => {
            const ds = daySpend(day)
            const dm = dayMemories(day)
            const expanded = String(expandedDayId) === String(day.id)
            const firstAct = (day.activities[0]?.text || "").trim()
            const oneLiner =
              day.activities.length === 0
                ? "No activities yet"
                : firstAct
                  ? `${firstAct.length > 48 ? `${firstAct.slice(0, 48).trimEnd()}…` : firstAct}${day.activities.length > 1 ? ` · +${day.activities.length - 1}` : ""}`
                  : `${day.activities.length} activit${day.activities.length === 1 ? "y" : "ies"}`
            return (
              <div key={day.id} className="plan-day-wrap">
                <div
                  id={`itin-day-${day.id}`}
                  className={`day-card${expanded ? "" : " collapsed"}${flashId === `itin-day-${day.id}` ? " itin-flash" : ""}`}
                >
                  <div className="day-hdr">
                    <button
                      type="button"
                      className="day-title"
                      aria-expanded={expanded}
                      onClick={() => toggleDay(day.id)}
                    >
                      <span className="day-chevron" aria-hidden="true">
                        ▸
                      </span>
                      <span className="day-title-stack">
                        <span className="day-title-text">{day.label}</span>
                        {trip.startDate && (
                          <span className="day-date">
                            {addDays(trip.startDate, dayIdx).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                        {!expanded && <span className="day-oneliner">{oneLiner}</span>}
                      </span>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {ds > 0 && (
                        <span className="linked-badge" onClick={() => navigateTo(TAB.budget)}>
                          💰 {baseCurrency} {ds.toFixed(0)}
                        </span>
                      )}
                      {dm > 0 && (
                        <span
                          className="linked-badge"
                          style={{
                            background: "var(--amber-glow)",
                            borderColor: "var(--amber-dim)",
                            color: "var(--amber)",
                          }}
                          onClick={() => navigateTo(TAB.memories)}
                        >
                          📸 {dm}
                        </span>
                      )}
                      <button type="button" className="btn-del" onClick={() => removeDay(day.id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="day-body">
                    {Array.isArray(day.guide?.bullets) && day.guide.bullets.length > 0 && (
                      <div className="day-field-guide">
                        {day.guide.title && (
                          <div className="day-field-guide-title">{day.guide.title}</div>
                        )}
                        <ul className="day-field-guide-list">
                          {day.guide.bullets.map((b) => (
                            <li key={`${b.label}-${b.text.slice(0, 24)}`}>
                              <span className="day-field-guide-label">{b.label}</span>
                              <span className="day-field-guide-text">
                                {b.text}
                                {b.url ? (
                                  <>
                                    {" "}
                                    <a
                                      className="day-field-guide-link"
                                      href={b.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label="Open article"
                                      title="Open article"
                                    >
                                      <IconExternalLink size={14} />
                                    </a>
                                  </>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {day.activities.map((act, i) => (
                      <SwipeableActivity
                        key={act.id}
                        act={act}
                        dayId={day.id}
                        onToggle={() => toggleActivity(day.id, act.id)}
                        onDelete={() => removeActivity(day.id, act.id)}
                        onExpense={() => onQuickExpense(act, day)}
                        onMemory={() => onQuickMemory(act, day)}
                        onLocate={
                          locatableIds.has(String(act.id))
                            ? () => handleLocate(act.id, day.id)
                            : undefined
                        }
                        isFirst={i === 0}
                        flash={flashId === `itin-act-${act.id}`}
                      />
                    ))}
                    {expanded && day.activities.length > 0 && (
                      <div className="swipe-hint">← swipe to delete · swipe to complete →</div>
                    )}
                    <button
                      type="button"
                      className="btn-ghost plan-add-activity-btn"
                      onClick={() => openAddSheet(day)}
                    >
                      Add activity
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}

        <div className="plan-day-wrap plan-add-day-wrap">
          <button
            type="button"
            className="plan-insert-day plan-add-day"
            onClick={addDay}
            aria-label="Add day"
            title="Add day"
          >
            <span className="plan-day-plus" aria-hidden="true">
              +
            </span>
          </button>
        </div>
      </div>

      {addSheet && (
        <div
          className="pin-form-overlay"
          onClick={(e) => e.target === e.currentTarget && setAddSheet(null)}
        >
          <div className="pin-form">
            <div className="pin-form-title">Add activity</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
              {addSheet.day.label}
            </div>
            <div className="plan-add-mode" role="tablist" aria-label="Place mode">
              <button
                type="button"
                role="tab"
                aria-selected={addMode === "single"}
                className={`plan-add-mode-btn${addMode === "single" ? " active" : ""}`}
                onClick={() => setAddMode("single")}
              >
                One place
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={addMode === "fromto"}
                className={`plan-add-mode-btn${addMode === "fromto" ? " active" : ""}`}
                onClick={() => setAddMode("fromto")}
              >
                From → To
              </button>
            </div>
            <div className="flex flex-col gap-8" style={{ marginTop: 10 }}>
              {addMode === "single" ? (
                <input
                  className="input"
                  placeholder="Place (for map)"
                  value={addForm.place}
                  onChange={(e) => setAddForm((f) => ({ ...f, place: e.target.value }))}
                />
              ) : (
                <>
                  <input
                    className="input"
                    placeholder="From"
                    value={addForm.from}
                    onChange={(e) => setAddForm((f) => ({ ...f, from: e.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="To"
                    value={addForm.to}
                    onChange={(e) => setAddForm((f) => ({ ...f, to: e.target.value }))}
                  />
                </>
              )}
              <input
                className="input"
                placeholder="Detail (optional)"
                value={addForm.detail}
                onChange={(e) => setAddForm((f) => ({ ...f, detail: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && canSaveAdd && submitAddActivity()}
              />
              <div>
                <div className="card-title-small" style={{ marginBottom: 4 }}>
                  Time (optional)
                </div>
                <input
                  className="input"
                  type="time"
                  value={addForm.time}
                  onChange={(e) => setAddForm((f) => ({ ...f, time: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-8 mt-12">
              <button type="button" className="btn-ghost flex-1" onClick={() => setAddSheet(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn flex-1"
                onClick={submitAddActivity}
                disabled={!canSaveAdd}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
