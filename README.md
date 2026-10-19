# TV Diagnostics for TizenBrew

Experimental, read-only application module. It does not optimize the TV or grant remote access.

## What it does
- Attempts to display model, firmware, platform version, memory and internal storage using APIs already available to the host.
- Displays browser-reported user agent, viewport, screen/DPR, logical-processor hint, context, feature presence and this document's navigation timing in a separate Browser details view.
- Distinguishes missing namespaces/methods from observed permission errors; it cannot determine why a host omitted an API.
- Runs an optional five-second animation callback timing check of this page only.
- Displays unsupported or denied APIs as Unavailable. This is expected under some TizenBrew configurations.

## Privacy and limits
No service module, credentials, telemetry, network requests, persistent storage, settings changes, app management, or root access. Results stay on screen. TizenBrew itself downloads the code through its existing GitHub/jsDelivr mechanism; that delivery and the host's own behavior are outside this module.

This module does not measure Smart Hub or another app's frame rate, input-to-photon latency, video quality, or overall TV speed. It cannot identify a bottleneck from frame timing alone. No performance improvement or complete security guarantee is claimed.

## Installation
Use TizenBrew Module Manager → Add GitHub Module with the reviewed repository and pinned revision supplied alongside this project. Do not substitute an unreviewed repository. An ordinary browser preview lacks Samsung TV APIs. Version 0.1.0 launched on the television described below; version 0.2.0 still needs a hardware check.

## Controls and removal
Browser details toggles the runtime view; TV summary returns to the timing check. Refresh updates both snapshots. Arrows select buttons, Enter activates, Back attempts previous-page navigation. Use the TV Home button if needed. To undo, remove only this module in TizenBrew Module Manager; do not reset the television or uninstall TizenBrew.

## Testing
Run `npm test` for deterministic helper tests, and `npm run test:ui` for a local browser test using an already available Playwright installation. Browser tests are not proof of television behavior.

## References
- https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md
- https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html
- https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/systeminfo-api.html

## Validation status
- Version 0.1.0 was verified on a Samsung UN65TU7000FXZA (2020), firmware T-KSU2EAKUC-2301.1, on 2026-10-19 at 01:18 UTC. The UI and five-second check worked; neither `tizen.systeminfo` nor `webapis.productinfo` was exposed in the hosted module.
- That single page-only sample reported 60.0 callbacks/second, median 16.7 ms, p95 16.8 ms, longest 16.8 ms, and 301 intervals over 5.02 seconds. This is not a TV-wide performance or panel-refresh measurement.
- Version 0.2.0: helper tests, mock-DOM remote-navigation tests and JavaScript syntax checks pass. Real-browser rendering is blocked in this build environment: Chromium exits with `socket() failed: Operation not permitted`. Version 0.2.0 has not yet been tested on the television.

## Interpreting browser details
The reported user agent may be overridden by the host and does not verify actual engine, operating-system or firmware versions. Screen size and device-pixel ratio describe browser presentation, not necessarily native panel resolution. Hardware concurrency is a browser-reported logical-processor hint, not an inventory of physical CPU cores. Feature presence does not prove functionality or acceleration. Navigation timing describes this document only and may be pending until Refresh is selected after page load. No URLs, resource names, host addresses, device identifiers, account information or raw API errors are collected. The page checks only the scheme and secure-context flag, with no requests for access and no host bridges or injected vendor scripts.
