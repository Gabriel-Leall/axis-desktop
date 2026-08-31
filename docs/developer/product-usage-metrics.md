# Local Product Usage Metrics

Axis measures activation and retention locally so product decisions can use real behavior without introducing remote analytics or accounts.

## Privacy contract

The product-usage domain accepts only a closed event enum, an RFC 3339 timestamp, and a local calendar date. It must never receive or persist:

- task or note content;
- URLs or file paths;
- integration account identifiers;
- device fingerprints or installation identifiers.

The data remains in `tasks.db`. Nothing is uploaded automatically. A user can explicitly export a versioned JSON snapshot from **Preferences → User → Developer Settings**.

## Current hypotheses

These definitions are product hypotheses and may change after qualitative validation:

| Metric               | Definition                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Activation           | The first focus session has started and the first Quick Pane/onboarding capture has been saved. |
| Time to value        | Seconds from the first measured main-window open to activation.                                 |
| D1 return            | The main window was opened on the calendar day after activation.                                |
| First-week retention | The main window was opened on at least three days from activation day through day six.          |

Measurement starts when a version containing this system first records `app_opened`. Historical behavior is not inferred.

## Stored events

| Event                  | Recorded after                                                |
| ---------------------- | ------------------------------------------------------------- |
| `app_opened`           | The main React application starts.                            |
| `focus_started`        | A contextual focus session starts successfully.               |
| `capture_saved`        | A Quick Pane or onboarding capture is persisted successfully. |
| `daily_focus_set`      | A manual daily focus is persisted successfully.               |
| `wrap_up_completed`    | The daily plan is persisted as wrapped up.                    |
| `onboarding_completed` | The user explicitly finishes onboarding.                      |

Failures are logged locally and never block the product action that produced the event.

## Persistence

Migration 7 creates two tables:

- `product_usage_milestones`: the first occurrence of activation-related milestones;
- `product_usage_daily`: counters grouped by local date.

The Rust domain lives in `src-tauri/src/commands/product_usage.rs`. Frontend calls use the generated tauri-specta commands through `src/lib/product-usage.ts`.

## Changing the model

When adding or changing an event:

1. Explain which product decision the event supports.
2. Reject any design that requires user content or a stable personal identifier.
3. Add a failing Rust aggregation/privacy test first.
4. Instrument the successful domain boundary, not the button click.
5. Regenerate bindings with `bun run rust:bindings`.
6. Update this document and the exported snapshot schema version when its contract changes.
