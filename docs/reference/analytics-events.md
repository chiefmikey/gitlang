# Analytics events

GitLang follows the Wolfe telemetry standard v1. The shared loader tag in `public/index.html` (`data-site="gitlang"`) sends pageviews, page leave and scroll depth, clicks, web vitals and errors automatically, without cookies. The custom events below go through `window.wolfeTelemetry.capture` via `client/src/lib/analytics.ts`. Props are enumerated values only: never usernames, repo names, queries or other user content. Telemetry stays on in e2e tests (the loader tags those events `actor=e2e`).

`mode` is one of `user`, `repo`, `multi_repo`, `org`, `aggregate`, `compare`, `contributor`, derived from the input format by `searchMode()` without sending the input itself.

| Event                        | Trigger                                                 | Props                                         |
| ---------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| `search_submitted`           | A lookup starts (typed, URL path on load, or random)    | `mode`, `source` = `input` / `url` / `random` |
| `search_completed`           | The lookup finished                                     | `mode`, `result` = `ok` / `empty` / `error`   |
| `random_clicked`             | The random button is pressed                            | none                                          |
| `language_breakdown_toggled` | A language bar's per-repo breakdown is opened or closed | `state` = `open` / `closed`                   |
| `github_profile_opened`      | The owner/repo link in the result card is clicked       | none                                          |
| `scroll_top_clicked`         | The `[ top ]` button is used                            | none                                          |
| `author_link_clicked`        | The footer "made by" link is clicked                    | none                                          |

There is no privacy or cookie page on the site, and the third-party Google Tag Manager / GA4 tags were removed.
