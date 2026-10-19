# TV Diagnostics for TizenBrew

Experimental, read-only application module. It does not optimize the TV or grant remote access.

## What it does
- Attempts to display model, firmware, platform version, memory and internal storage using APIs already available to the host.
- Runs an optional five-second animation callback timing check of this page only.
- Displays unsupported or denied APIs as Unavailable. This is expected under some TizenBrew configurations.

## Privacy and limits
No service module, credentials, telemetry, network requests, persistent storage, settings changes, app management, or root access. Results stay on screen. TizenBrew itself downloads the code through its existing GitHub/jsDelivr mechanism; that delivery and the host's own behavior are outside this module.

This module does not measure Smart Hub or another app's frame rate, input-to-photon latency, video quality, or overall TV speed. It cannot identify a bottleneck from frame timing alone. No performance improvement or complete security guarantee is claimed.

## Installation
Use TizenBrew Module Manager → Add GitHub Module with the reviewed repository and pinned revision supplied alongside this project. Do not substitute an unreviewed repository. An ordinary browser preview lacks Samsung TV APIs. Actual television compatibility remains unverified until tested on hardware.

## Controls and removal
Arrows select buttons, Enter activates, Back attempts previous-page navigation. Use the TV Home button if needed. To undo, remove only this module in TizenBrew Module Manager; do not reset the television or uninstall TizenBrew.

## Testing
Run `npm test` for deterministic helper tests, and `npm run test:ui` for a local browser test using an already available Playwright installation. Browser tests are not proof of television behavior.

## References
- https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md
- https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html
- https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/systeminfo-api.html

## Validation status
Helper tests and mock-DOM remote-navigation tests passed. JavaScript syntax checks passed. Real-browser rendering could not be completed in the build environment, and the module has not yet been tested on a television. Treat initial launch as a compatibility check, not a verified deployment.
