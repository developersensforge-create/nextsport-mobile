# NextSport Mobile — Changelog

## Build 75 (Android) / Build 4 (iOS) — 2026-11-16

### Coach Feedback v2: Per-Submission Review + UX Redesign

#### 🔧 Changed
- **Per-submission review**: Each attempt is now independently reviewable. Reviewing Attempt 1 only clears that submission — Attempt 2 and 3 remain in the queue.
- **Assignment reviewed status**: Only auto-flips to "reviewed" when ALL submissions have been reviewed.
- **AthleteDetailScreen PM redesign**: Restructured from 4 disjoint sections into 3 focused sections:
  - **To Review** — pending submissions (priority #1)
  - **Assignments** — progress bars + View Feedback inline (priority #2)
  - **Activity** — analysis history (reference)
- **List preview**: Assignments & Activity sections show latest 5 items with "View All →" link to dedicated full-page lists.
- **Modal backdrop fix**: Clicking blank areas in Assign Drill modal no longer causes screen flicker.

#### ➕ Added
- `AthleteAssignmentsScreen` — dedicated full-page assignment list with individual progress bars and View Feedback links
- `AthleteActivityScreen` — dedicated full-page analysis history
- `GET /api/coach/feedback/given` — returns feedback authored BY the coach (fixes View Feedback showing empty for coaches)

#### 🐛 Fixed
- **View Feedback empty**: `getMyFeedback()` queried `player_id` (feedback received), not `coach_id` (feedback given). Fixed with new endpoint + `coachView` mode in FeedbackList.
- **Auto-refresh after review**: Replaced `useFocusEffect` with `navigation.addListener('focus')` for reliable reload.
- **Modal flickering**: Sheet touch fallthrough to backdrop caused close/re-render loop. Fixed with `onStartShouldSetResponder`.

#### 🗑️ Removed
- `StatusBadge` component (noise — all analyses showed "completed")
- `feedbackMap` state from AthleteDetailScreen (replaced by submission-level `reviewed` flag)
- `getMyFeedback()` call from AthleteDetailScreen (no longer needed)
- "Reviewed Feedback" standalone section (merged into Assignment cards)
- Confusing chat bubble icon in Analysis History (replaced by clean Activity list)

---

## Build 70 — 2026-11-09

### Coach Phase 3 — Batch 4: Sanitization + State Guards

#### 🔧 Changed
- **500 sanitization**: All coach API 500 responses now return `"Internal server error"` (not raw DB errors)
- **Overall note limit**: 2000 character max with HTTP 400 validation
- **Assignment state regression guard**: `submitted`/`reviewed` status cannot roll back to `pending` (HTTP 409)
- **Audio cache filename**: Uses URL path hash instead of `Date.now()` for idempotent cache keys

---

## Build 63-69 — 2026-11-06 ~ 2026-11-07

### Coach Phase 3 — Batch 1-3: Feedback + Assignment System

- Coach feedback management (annotations, audio, overall notes)
- Assignment submission workflow (3 attempts per assignment)
- VideoWithMarkers timeline + annotation display
- FeedbackDetailScreen with audio playback
- FeedbackListScreen with assignment filtering
- Token display differentiation for assignment mode
- Recording duration calculation fix (hardcoded 15s → Date.now() timing)