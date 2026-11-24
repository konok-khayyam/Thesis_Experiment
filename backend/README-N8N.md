# n8n backend setup

This repository includes the browser-side API client, endpoint contract and setup notes. It does NOT include a deployed or activated n8n workflow. The backend must be configured in n8n before real participant data are collected.

## Endpoints (POST)
- `/study/consent` receives `{session_id, consent}`
- `/study/baseline` receives `{session_id, demographics, hvic}` (16 numeric items)
- `/chat/assign` receives `{session_id}` and returns `{condition, chat_token}`
- `/study/postchat` receives `{session_id, responses}` (12 numeric items)
- `/study/scenarios` receives `{session_id, answers}` (4 coded choices)
- `/study/complete` receives `{session_id}` and returns `{completion_code}`

Set `API_BASE_URL` in `assets/config.js` to the n8n webhook base URL and set `DEMO_MODE:false` only after end-to-end testing.

## Suggested n8n workflow per endpoint
Webhook (POST) -> validate payload in Code node -> verify session/stage -> write to approved storage -> Respond to Webhook.
Enable CORS for the exact GitHub Pages origin and handle OPTIONS preflight. Validate every field server-side; never trust condition values from the browser.

## Random assignment
`/chat/assign` must allocate one of HI, VI, HC, VC, NEUTRAL server-side. Persist assignment by session_id and return the same assignment for repeated calls. Prefer blocked randomisation to maintain balanced groups. Return an opaque or signed chat_token. The chat page should obtain the assigned prompt securely from the backend; a query-string condition must not be trusted.

## Sheets
Suggested tabs: Participants, Demographics, HVIC, PostChat, Scenarios, ChatLog (only if approved). Keep any Prolific identifier separately with restricted access. Do not place Google credentials in GitHub Pages code. n8n should hold credentials in its credential store.

## Privacy
Google Sheets is an external cloud service. Confirm it is approved for this study with the supervisor/ethics/data-protection process before real data collection. Confirm anonymous vs pseudonymous status, retention, legal basis, data controller, and withdrawal process. GitHub Pages is static hosting and cannot protect secrets.
