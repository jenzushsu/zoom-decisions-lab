# Decisions Lab

A standalone, desktop-first Zoom Decisions comparison app. No dependencies or build step; Node.js 22+ is required. This project is separate from Hawker Wars.

## Run

```sh
npm start
```

Open http://localhost:3000. Click **Run all three modes** for a fixed, explicitly labeled sample walkthrough. Sample mode does not analyze edited text or uploaded images. The illustration is drawn locally; no external assets or fonts are needed.

For live runs:

```sh
cp .env.example .env
```

Set `ZOOM_API_KEY` in `.env` to a Decisions-enabled key from your Zoom AI Services project, restart `npm start`, refresh the browser, and select **Live Zoom API**. Credentials stay server-side. There is no credential input in the browser. Live errors never fall back to fixtures.

## Official API verification — November 2, 2026

- [API reference](https://developers.zoom.us/docs/api/ai-services/): `POST https://api.zoom.us/v2/aiservices/decisions/decide`, using a Decisions-enabled `x-api-key`. Account entitlement is required.
- [Fast mode guide](https://developers.zoom.us/docs/ai-services/decisions/fast-mode/): text strings or user messages with `input_text` / `input_image` content. Images use inline data URLs and `enable_image_input: true`. The app sends `detail: "auto"` and a supported model, `zoom-decisions` or `zoom-decisions-pro`.
- Documentation differs on authentication: the guide shows `Authorization: Bearer`, while the reference specifies `x-api-key`. The app follows the reference by default. `ZOOM_ACCESS_TOKEN` supports the guide’s alternative when no API key is set. There is no automatic authentication retry.
- [Overview](https://developers.zoom.us/docs/ai-services/decisions/): synchronous typed questions, not streaming or tool execution.

Every mode submits identical questions: a route choice and two independent evidence predicates. Image-only excludes customer text. Combined includes both sources. `reference_id` is generated locally and returned in the app envelope, not claimed as a Zoom response field.

## Reading results

| Display | Provenance |
|---|---|
| Decision | API `choice`, mapped to an app label |
| Probability bars | API `probabilities` |
| Evidence signals | Two separately requested API predicate probabilities |
| Evidence supplied | App record of input modalities |
| Rationale | Fixed app explanation of the selected route; no model reasoning claimed |
| Confidence | Shown only if present; otherwise explicitly unavailable |
| Uncertainty | App calculation: `1 − selected-choice probability`; not calibrated accuracy |
| Latency | Server wall time around Zoom HTTP request + body read; network included |
| Raw JSON | Unmodified parsed response; sample mode shows fixture JSON instead |

Refusals are preserved per question. No quotations, image regions, inferred citations, inference-only timing or undocumented rationale fields are fabricated. No accuracy advantage is asserted for combined input. Sample probabilities are invented teaching fixtures, not observed Zoom performance; their API latency is unavailable.

## Demo flow

1. Run the sample comparison. Text routes to routine support, image to priority review, and combined to inspection; these are deliberately contrasting fixtures.
2. Connect credentials and select Live mode.
3. Upload a real parcel photo and edit the note. Run each mode or all three in parallel.
4. Expand raw responses and compare distributions. Export results as JSON.

Editing inputs, model or result source clears old results. Inputs are locked during runs. Exports contain text, metadata and raw results, but omit image bytes. No server-side persistence is used.

## Verification

```sh
npm test
```

Seven tests cover modality isolation, image opt-in, shared questions, input validation, probability normalization, refusals and malformed responses. Browser checks cover the sample comparison and missing-credentials path. Live calls require your account credentials and have not been verified against Zoom.

## Implementation

- `server.mjs`: static app and same-origin JSON proxy, fixed Zoom URL, 45-second upstream timeout, six-request concurrency cap, structured metadata logging.
- `decisions.mjs`: documented request construction, fixed questions, answer validation and comparison normalization.
- `public/`: responsive vanilla HTML/CSS/JS interface and locally rendered parcel illustration.

App limits are 12,000 text characters and a 4 MB PNG/JPEG/WebP image; these are conservative demo limits, not claims about Zoom limits. Basic image signatures are checked server-side and image decoding in the browser. Error logs omit submitted evidence and credentials.

The server binds to loopback for local demos. This prototype is not an authenticated public service. Hosting requires access control, HTTPS, deliberate rate limits and server-managed secrets; do not expose the live proxy as an unrestricted public endpoint. No webhook or tunnel is needed for this synchronous API.
