# Experimental TV service snapshot, development only

**Experimental hardware test. This version was approved for a one-time test by the device owner. Hardware compatibility has not yet been verified.**

This standalone prototype leaves the existing v0.2.0 diagnostic module unchanged. It adds a NEW HTTP endpoint, explicitly bound to TV loopback 127.0.0.1:18763. It does not use a preexisting TizenBrew module message channel. It is not an optimizer and gives no assistant remote access.

## Data and scope

One fixed GET /read-only-snapshot reads only Node os.totalmem(), os.freemem(), os.uptime(), and os.loadavg(). These return OS-reported total/free bytes, uptime seconds, and 1/5/15-minute system load averages. Load averages are NOT CPU percentages, per-app measurements, or a normalized performance score. No Tizen APIs are called in this first prototype; native callback and cancellation behavior remains unverified. No arbitrary command, query parameter, URL, path, code or API name is accepted. No identifiers, inventory, files, environment, credentials, raw errors, persistent results, or logs are read or saved.

## Lifecycle

Loading service.js starts the endpoint, but collects no snapshot until the single UI button is activated. A single 55-second timer closes the listener and destroys its tracked sockets. The first accepted GET consumes the service; response finish immediately stops accepting connections and allows a maximum 250 ms graceful drain before destroying remaining sockets. The original 55-second deadline stays active and can cut that drain short. Response abort/error stops immediately. A delayed listening event after expiry or during drain closes the listener again. Connections idle for two seconds are destroyed, and at most eight accepted connections are retained. Port conflicts fail closed without retries. Errors do not restart the timer. No polling or autostart setting is added. The host itself fetches module assets over the network as it already does; this code makes no external requests.

The page makes at most one request, only on Read once, with a 10-second deadline. Stop waiting, navigation/pagehide, successful completion and errors clear its timer and abort its XHR. Stop waiting does not stop the backend early; it expires on its original deadline.

**The 55-second bound relies on a responsive host event loop.** Node's OS methods are synchronous native calls; JavaScript cannot preempt a hung native call or event loop. A hard independent wall-clock kill would require a separate supervisor/process and is deliberately not attempted. Do not promise unconditional 55-second shutdown on broken runtimes. The host may retain an inert VM and service status after all this module's sockets/timers are gone. Removing the module does not forcibly unload that VM. Reopening the module may therefore NOT restart an expired endpoint. The inspected host only restarts absent or crashed service entries. There is no verified Android-only, module-specific restart procedure. Do not assume reopening the page restarts an expired service.

## Transport security

Requires Host exactly 127.0.0.1:18763 and Origin exactly http://127.0.0.1:8081 or http://localhost:8081. Those are TizenBrew's expected module-host origins. It rejects missing/null/other origins, unexpected methods and paths, request bodies and queries. CORS allows only the validated requesting origin; it does not use credentials or wildcard origins. It serves no HTML or executable content. Binding loopback prevents ordinary LAN connections.

Origin/Host checks are browser request restrictions, NOT authentication. Another local process can forge headers, and another module on the same permitted host origin can read or consume the one snapshot while available. Such callers can also cause denial of service. No new secret/token or persistent permission is created. Older engine CORS behavior, a different host origin, unavailable OS APIs, or a port conflict can prevent success. Rejecting OPTIONS means any unexpected preflight fails closed.

Response finish means bytes handed to the operating system, not proof that the page received them. The endpoint stops accepting immediately at that point and allows a bounded 250 ms socket drain, subject to the original deadline. The UI reports success only after parsing a valid response. Partial transfer or browser restrictions can yield no result even when the endpoint has consumed its one attempt. No automatic retry is made.

## Validation

Run npm test. Tests execute service.js only inside a VM with a mocked HTTP server and mocked OS functions; no listening socket is opened. They cover allowlists, invalid requests, a second request, fixed expiry, port conflict, idle sockets, connection limit, response cleanup and sanitized missing/error/invalid data. UI mocks cover no auto-request/repeated click, timeout, cancellation, navigation, valid and invalid response cleanup. Node syntax checks also pass on the available Node 24 runtime.

No Node 4.4.3 runtime, real browser, actual HTTP transfer, Samsung firmware, or hardware compatibility test has been run. Source uses ES5 syntax and avoids newer runtime features. A native method hanging forever cannot be safely simulated on a single synchronous test event loop; that case is explicitly outside the timer guarantee. No Tizen callback timeout test applies because this revision invokes no Tizen APIs.

## Test scope and sources

This release is for a single owner-approved test on a Samsung UN65TU7000FXZA. It is not a remote-access service or optimizer. Do not install it on other devices without reviewing its scope and limitations. Older diagnostic versions remain available at their pinned revisions.

- https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md
- https://github.com/reisxd/TizenBrew/blob/main/tizenbrew-app/TizenBrew/service-nextgen/service/utils/serviceLauncher.js
- https://github.com/reisxd/TizenBrew/blob/main/tizenbrew-app/TizenBrew/service-nextgen/service/index.js
