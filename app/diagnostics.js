/* ES5-compatible, read-only helpers. No network or persistent storage. */
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.TVDiagnostics = factory(); }
}(this, function () {
    'use strict';
    function unavailable(reason) { return 'Unavailable (' + reason + ')'; }
    function errorReason(error) {
        var name;
        try { name = error && error.name; } catch (ignored) { name = ''; }
        if (name === 'SecurityError' || name === 'NotAllowedError') { return 'permission denied'; }
        if (name === 'NotSupportedError') { return 'not supported'; }
        return 'API error';
    }
    function namespace(root, path) {
        var value = root, i;
        try {
            for (i = 0; i < path.length; i += 1) {
                if (!value) { return { value: null, reason: 'API not exposed' }; }
                value = value[path[i]];
            }
            return value ? { value: value } : { value: null, reason: 'API not exposed' };
        } catch (error) { return { value: null, reason: errorReason(error) }; }
    }
    function invoke(api, method, args) {
        if (!api.value) { return { ok: false, reason: api.reason }; }
        try {
            if (typeof api.value[method] !== 'function') { return { ok: false, reason: 'method not exposed' }; }
            return { ok: true, value: api.value[method].apply(api.value, args || []) };
        } catch (error) { return { ok: false, reason: errorReason(error) }; }
    }
    function displayText(result) {
        if (!result.ok) { return unavailable(result.reason); }
        if (typeof result.value !== 'string' || !result.value.replace(/\s/g, '')) { return unavailable('no valid value'); }
        return result.value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 120);
    }
    function validBytes(value) { return typeof value === 'number' && isFinite(value) && value >= 0 && value <= 9007199254740991; }
    function bytes(value) {
        if (!validBytes(value)) { return unavailable('no valid value'); }
        return (value / 1073741824).toFixed(2) + ' GiB';
    }
    function displayBytes(result) { return result.ok ? bytes(result.value) : unavailable(result.reason); }
    function readBasic(root) {
        var system = namespace(root, ['tizen', 'systeminfo']);
        var product = namespace(root, ['webapis', 'productinfo']);
        var total = invoke(system, 'getTotalMemory');
        var free = invoke(system, 'getAvailableMemory');
        var memory = displayBytes(free) + ' free / ' + displayBytes(total) + ' total';
        if (!total.ok && !free.ok && total.reason === free.reason) { memory = unavailable(total.reason); }
        if (total.ok && free.ok && validBytes(total.value) && validBytes(free.value) && free.value > total.value) {
            memory = unavailable('inconsistent API values');
        }
        return {
            apis: 'SystemInfo: ' + (system.value ? 'exposed' : system.reason) + '; ProductInfo: ' + (product.value ? 'exposed' : product.reason),
            model: displayText(invoke(product, 'getModel')),
            firmware: displayText(invoke(product, 'getFirmware')),
            platform: displayText(invoke(system, 'getCapability', ['http://tizen.org/feature/platform.version'])),
            memory: memory
        };
    }
    function storageText(value) {
        var units, i, unit;
        try {
            units = value && value.units;
            if (!units || typeof units.length !== 'number') { return unavailable('no valid value'); }
            for (i = 0; i < units.length && i < 64; i += 1) {
                unit = units[i];
                if (unit && unit.type === 'INTERNAL') {
                    if (!validBytes(unit.capacity) || !validBytes(unit.availableCapacity) || unit.availableCapacity > unit.capacity) {
                        return unavailable('no valid value');
                    }
                    return bytes(unit.availableCapacity) + ' free / ' + bytes(unit.capacity) + ' user space';
                }
            }
            return unavailable('no internal volume reported');
        } catch (error) { return unavailable(errorReason(error)); }
    }
    function readStorage(root, callback) {
        var system = namespace(root, ['tizen', 'systeminfo']);
        var done = false, timer;
        function finish(value) {
            if (done) { return; }
            done = true;
            root.clearTimeout(timer);
            callback(value);
        }
        timer = root.setTimeout(function () { finish(unavailable('API timed out')); }, 3000);
        try {
            if (!system.value) { finish(unavailable(system.reason)); }
            else if (typeof system.value.getPropertyValue !== 'function') { finish(unavailable('method not exposed')); }
            else {
                system.value.getPropertyValue('STORAGE', function (value) { finish(storageText(value)); },
                    function (error) { finish(unavailable(errorReason(error))); });
            }
        } catch (error) { finish(unavailable(errorReason(error))); }
        return function () { done = true; root.clearTimeout(timer); };
    }
    function summarize(intervals) {
        var sorted = intervals.slice(0).sort(function (a, b) { return a - b; });
        var sum = 0, slow = 0, i, count = sorted.length;
        if (!count) { return null; }
        for (i = 0; i < count; i += 1) { sum += sorted[i]; if (sorted[i] > 50) { slow += 1; } }
        if (sum <= 0) { return null; }
        return {
            samples: count,
            seconds: sum / 1000,
            callbacksPerSecond: count * 1000 / sum,
            medianMs: count % 2 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2,
            p95Ms: sorted[Math.ceil(count * 0.95) - 1],
            longestMs: sorted[count - 1],
            over50Ms: slow
        };
    }
    function measure(root, onProgress, onDone) {
        var running = true, frame = null, watchdog = null, start = null, previous = null, lastProgress = -1000;
        var intervals = [];
        function finish(reason) {
            if (!running) { return; }
            running = false;
            if (frame !== null) { root.cancelAnimationFrame(frame); }
            if (watchdog !== null) { root.clearTimeout(watchdog); }
            onDone(reason ? { ok: false, reason: reason } : { ok: true, result: summarize(intervals) });
        }
        function step(stamp) {
            var elapsed, delta;
            if (!running) { return; }
            if (root.document && root.document.hidden) { finish('page hidden; measurement discarded'); return; }
            if (typeof stamp !== 'number' || !isFinite(stamp)) { finish('invalid animation timestamp'); return; }
            if (start === null) { start = stamp; previous = stamp; }
            else {
                delta = stamp - previous;
                if (delta <= 0) { finish('invalid animation interval'); return; }
                intervals.push(delta);
                previous = stamp;
            }
            elapsed = stamp - start;
            if (elapsed - lastProgress >= 250) { onProgress(Math.min(1, elapsed / 5000)); lastProgress = elapsed; }
            if (elapsed >= 5000) { onProgress(1); finish(null); return; }
            if (intervals.length >= 1200) { finish('sample limit reached'); return; }
            frame = root.requestAnimationFrame(step);
        }
        try {
            if (typeof root.requestAnimationFrame !== 'function' || typeof root.cancelAnimationFrame !== 'function') {
                finish('animation API not exposed');
            } else if (root.document && root.document.hidden) { finish('page hidden; measurement discarded'); }
            else {
                watchdog = root.setTimeout(function () { finish('timed out; measurement discarded'); }, 8000);
                frame = root.requestAnimationFrame(step);
            }
        } catch (error) { finish(errorReason(error)); }
        return function (reason) { finish(reason || 'stopped; measurement discarded'); };
    }
    return { readBasic: readBasic, readStorage: readStorage, measure: measure, summarize: summarize, storageText: storageText, bytes: bytes };
}));
