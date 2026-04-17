# Calendar Widget + Calendar Page Design (Axis Desktop)

Date: 2026-04-15
Status: Approved in chat, ready for implementation planning
Approach: A (FullCalendar as rendering engine + domain adapters)

## 1) Goal

Deliver a local-first Calendar experience for Axis Desktop with:

- A compact `CalendarWidget` for quick monthly visibility on the dashboard.
- A full `CalendarPage` powered by FullCalendar for month/week/day planning.
- Manual events persisted in local SQLite (Rust commands + tauri-specta).
- Existing tasks projected into the calendar (no duplication), including completed tasks.

The experience should remain minimal, dense, and clear, aligned with Linear/Raycast style.

## 2) Confirmed Product Decisions

1. Scope for this delivery is **Calendar only** (no Notes work in this scope).
2. Completed tasks must appear in the calendar with reduced opacity + strikethrough.
3. Task completion toggle in calendar happens via task event popover checkbox.
4. Weekday labels must be localized for EN and PT using project i18n.
5. Date display format in UI is `DD-MM-YYYY`.
6. Persistence format remains calendar-safe:
   - `all_day = 1`: `start_at` and `end_at` stored as `YYYY-MM-DD`.
   - `all_day = 0`: `start_at` and `end_at` stored as UTC datetime (`YYYY-MM-DDTHH:mm:ssZ`).
7. For all-day events, `end_at` is exclusive (iCalendar/FullCalendar behavior).

## 3) Scope and Deliverables

1. `src/components/grid/widgets/CalendarWidget.tsx`
2. `src/pages/CalendarPage.tsx`
3. `src/lib/calendar-domain.ts`
4. `src/store/calendar-store.ts`
5. `src/styles/fullcalendar-overrides.css`
6. `src-tauri/src/commands/calendar.rs`
7. SQL migration for `calendar_events`
8. `src-tauri/src/lib.rs` and `src-tauri/src/bindings.rs` updates
9. `src-tauri/src/commands/mod.rs`, `src/lib/tauri-bindings.ts`, and generated `src/lib/bindings.ts` updates
10. Routing integration (`ui-store`, `MainWindowContent`, `BentoGrid` connected navigation)

## 4) Architecture

### 4.1 Data ownership

- Manual calendar events: owned by new `calendar_events` table and calendar Rust commands.
- Tasks: owned by existing task domain/store and only projected in calendar UI.
- No task duplication in SQLite calendar table.

### 4.2 Frontend layering

- `calendar-store` owns only manual event state + calendar page UI state (`view`, `date`, selection).
- `calendar-domain` provides pure conversion and formatting functions.
- UI components (`CalendarWidget` and `CalendarPage`) compose manual events + task-derived events before passing to FullCalendar/widget view.

### 4.3 Mutation rule

FullCalendar never writes directly to any store internals. All updates flow through explicit store actions.

## 5) SQLite Model and Migration

Table:

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_at ON calendar_events(end_at);
```

Notes:

- `all_day` is stored as integer (`0`/`1`), mapped to boolean in Rust structs.
- Storage format depends on `all_day` as defined in Section 2.

## 6) Rust Command Design (`calendar.rs`)

Structs:

- `CalendarEvent`
- `CreateEventInput`
- `UpdateEventInput`

Commands:

1. `get_events_range(start: String, end: String) -> Result<Vec<CalendarEvent>, String>`
   - Returns events intersecting the requested interval.
   - SQL predicate: `start_at < ?end AND end_at > ?start`.
   - Sorted by `start_at ASC`.
2. `create_event(input: CreateEventInput) -> Result<CalendarEvent, String>`
3. `update_event(input: UpdateEventInput) -> Result<CalendarEvent, String>`
4. `delete_event(id: String) -> Result<(), String>`

Validation rules:

- `title.trim()` must not be empty.
- For `all_day = true`, parse and compare `YYYY-MM-DD` dates; `end_at` must be strictly after `start_at`.
- For `all_day = false`, parse UTC datetimes; `end_at` must be strictly after `start_at`.

Integration:

- Register module in `commands/mod.rs`.
- Register commands in `bindings.rs` (`collect_commands!`).
- Extend startup table bootstrap in `lib.rs` to ensure `calendar_events` exists.

## 7) Domain Functions (`calendar-domain.ts`)

Pure functions:

1. `tasksToCalendarEvents(tasks)`
   - Includes tasks with `due_date`, including completed ones.
   - Maps to all-day FullCalendar events with `extendedProps.type = 'task'`.
   - Adds class names for priority and completion styling.
2. `formatEventRange(start, end, allDay)`
   - UI format uses `DD-MM-YYYY`.
   - Includes time labels for timed events.
3. `getEventColor(event)`
   - Resolves style token/class based on event type and priority.
4. `isSameDay(date1, date2)`
5. `getMonthRange(date)`
   - Returns month interval used by range loading.

## 8) Calendar Store (`calendar-store.ts`)

State:

- `events: CalendarEvent[]`
- `currentView: 'month' | 'week' | 'day'`
- `currentDate: Date`
- `isLoading: boolean`
- `selectedEventId: string | null`

Actions:

- `loadEventsRange(start: Date, end: Date)`
- `createEvent(input)`
- `updateEvent(id, updates)`
- `deleteEvent(id)`
- `setView(view)`
- `setCurrentDate(date)`
- `selectEvent(id)`

Behavior:

- `createEvent` generates `id` via `crypto.randomUUID()` and timestamps via `new Date().toISOString()`.
- `updateEvent` performs optimistic update and reverts/reloads on failure.
- Time serialization follows Section 2:
  - all-day uses `YYYY-MM-DD` values.
  - timed uses UTC datetime strings.

## 9) Calendar Widget Design (`CalendarWidget.tsx`)

UI:

- Compact month grid (Monday-first).
- Header with month navigation (`‹`, `›`) and `↗` open-page action.
- Today highlight with design-system accent.
- Per-day dots for manual events and task items.
- Read-only list for selected day (or today by default), max 4 rows + `+N more`.

Interaction:

- Single click day -> select day and refresh list.
- Double click day -> navigate to full calendar page with selected date.
- No editing in widget.

Localization:

- Weekday initials and month label come from i18n/locale-aware formatting.

## 10) Calendar Page Design (`CalendarPage.tsx`)

Header:

- Custom controls: prev/next, period title, Today button, view toggles (Month/Week/Day), `+ New Event`.

FullCalendar config:

- Plugins: dayGrid, timeGrid, interaction.
- `headerToolbar={false}`.
- `firstDay={1}`.
- `nowIndicator={true}`.
- `editable={true}`, `selectable={true}`.
- `slotMinTime="06:00:00"`, `slotMaxTime="23:00:00"`.
- Default view: week (`timeGridWeek`).
- Locale bound to app language (`en` / `pt-br`).

Data composition:

- `manualEvents` from `calendar-store`.
- `taskEvents` from `tasksToCalendarEvents(useTasksStore(state => state.tasks))`.
- Final array passed to FullCalendar merges both, with type markers in `extendedProps`.

Interactions:

1. Select empty slot/range -> open create modal with prefilled date/time.
2. Click manual event -> detail popover (edit/delete).
3. Click task event -> task popover with:
   - priority,
   - checkbox for done/undone,
   - link to Tasks page.
4. Drag/drop or resize manual events -> optimistic store update.
5. Drag/drop task events -> disallowed; operation reverted.

Modal behavior:

- Required title.
- Date + optional time range.
- All-day toggle.
- Optional description.
- Color picker (6 predefined tokens from design system).
- `Enter` submits, `Escape` cancels.

## 11) Styling (`fullcalendar-overrides.css`)

Create `src/styles/fullcalendar-overrides.css` and import it from `CalendarPage`.

Overrides include:

- Font family, sizes, spacing, borders, backgrounds via CSS variables.
- Today cell styling and now-indicator styling.
- Event pill styles aligned with app tokens.
- Remove/normalize default FullCalendar hover/focus visual noise.
- Task styles:
  - `priority-high|medium|low`
  - `is-done` (reduced opacity + line-through).

No hardcoded semantic colors for UI state; use project CSS variables/tokens.

## 12) App Integration

1. Add `calendar` to `AppPage` in `ui-store.ts`.
2. Add calendar route rendering in `MainWindowContent.tsx`.
3. Connect widget navigation in `BentoGrid.tsx` to `navigateTo('calendar', { selectedDate })`.
4. Keep existing bento widget registry entry `id: 'calendar'` and replace widget internals.

## 13) Testing Strategy

Unit tests:

- `calendar-domain`:
  - task mapping (including completed tasks)
  - all-day vs timed range formatting
  - same-day logic
  - month range boundaries

Store tests:

- load/create/update/delete flows
- optimistic update + rollback behavior
- serialization format per all-day/timed rule

Manual verification checklist:

1. Week starts Monday in widget and page.
2. EN/PT language switch updates weekday labels.
3. All-day event persists and reopens correctly with exclusive end date.
4. Timed event drag/drop updates persisted values.
5. Task done state toggled from calendar popover reflects in tasks store/UI.
6. Completed tasks appear with reduced opacity + line-through.

## 14) Non-Goals (MVP Exclusions)

- External calendar sync (Google/Outlook/iCal)
- Recurring events
- Invitees/attendees
- Reminder notifications
- Dragging tasks to change due date
- Agenda list view
- Holiday feeds
- Custom per-calendar category colors

## 15) Risks and Mitigations

1. Date format confusion between storage and display
   - Mitigation: strict domain conversion boundary; storage not coupled to display format.
2. FullCalendar style drift vs design system
   - Mitigation: dedicated overrides stylesheet and token-only colors.
3. Mixed event types behavior complexity (manual vs task)
   - Mitigation: explicit `extendedProps.type` guards for click/drag/update logic.

## 16) Acceptance Criteria

- Calendar widget provides compact month + daily list with navigation and page deep-link.
- Calendar page supports month/week/day, event CRUD, and drag updates for manual events.
- Tasks with due date appear on calendar, including completed tasks with done styling.
- Task completion is toggleable from calendar popover.
- EN/PT localization works for weekdays and calendar locale output.
- UI displays dates as `DD-MM-YYYY`.
- Data persistence remains local SQLite via Rust commands and type-safe tauri-specta bindings.
