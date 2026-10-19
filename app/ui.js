(function (root, document) {
    'use strict';
    var core = root.TVDiagnostics;
    var ids = ['view', 'refresh', 'measure', 'stop', 'back'];
    var showRuntime = false;
    var stopMeasurement = null, cancelStorage = null, revision = 0, navigating = false;
    function node(id) { return document.getElementById(id); }
    function text(id, value) { node(id).textContent = value; }
    function stop(reason) {
        if (stopMeasurement) { stopMeasurement(reason); stopMeasurement = null; }
    }
    function refresh() {
        var data, key, current;
        if (navigating) { return; }
        stop('readings refreshed; measurement discarded');
        if (cancelStorage) { cancelStorage(); }
        revision += 1;
        current = revision;
        data = core.readBasic(root);
        for (key in data) { if (Object.prototype.hasOwnProperty.call(data, key)) { text(key, data[key]); } }
        data = core.readRuntime(root);
        for (key in data) { if (Object.prototype.hasOwnProperty.call(data, key)) { text(key, data[key]); } }
        text('storage', 'Checking...');
        text('status', 'Read-only snapshot. No settings changed.');
        cancelStorage = core.readStorage(root, function (value) { if (current === revision) { text('storage', value); } });
    }
    function start() {
        var finished = false;
        if (stopMeasurement || navigating) { return; }
        node('measure').disabled = true;
        node('stop').disabled = false;
        node('stop').focus();
        node('progress').style.width = '0%';
        text('timing', 'Measuring this page for 5 seconds...');
        var cancel = core.measure(root, function (fraction) {
            node('progress').style.width = Math.round(fraction * 100) + '%';
        }, function (outcome) {
            var result = outcome.result;
            finished = true;
            stopMeasurement = null;
            node('measure').disabled = false;
            if (document.activeElement === node('stop')) { node('measure').focus(); }
            node('stop').disabled = true;
            if (!outcome.ok || !result) {
                text('timing', 'Unavailable (' + (outcome.reason || 'insufficient samples') + ').');
                node('progress').style.width = '0%';
                return;
            }
            text('timing', 'Animation callbacks: ' + result.callbacksPerSecond.toFixed(1) + '/second' +
                '\nMedian interval: ' + result.medianMs.toFixed(1) + ' ms | 95th percentile: ' + result.p95Ms.toFixed(1) + ' ms' +
                '\nLongest interval: ' + result.longestMs.toFixed(1) + ' ms | Intervals over 50 ms: ' + result.over50Ms +
                '\n' + result.samples + ' intervals over ' + result.seconds.toFixed(2) + ' seconds. This page only.');
        });
        if (!finished) { stopMeasurement = cancel; }
    }
    function cleanup() {
        stop('page left; measurement discarded');
        revision += 1;
        if (cancelStorage) { cancelStorage(); cancelStorage = null; }
    }
    function back() {
        if (navigating) { return; }
        cleanup();
        if (root.history && root.history.length > 1) {
            navigating = true;
            text('status', 'Returning to the previous page...');
            try { root.history.back(); } catch (ignored) { navigating = false; }
            root.setTimeout(function () {
                navigating = false;
                text('status', 'If Back did not leave this page, use the TV Home button.');
            }, 1200);
        } else { text('status', 'No previous page is available. Use the TV Home button to leave.'); }
    }
    function move(direction) {
        var current = -1, i, next;
        for (i = 0; i < ids.length; i += 1) { if (document.activeElement === node(ids[i])) { current = i; } }
        if (current === -1) { current = direction > 0 ? -1 : 0; }
        for (i = 1; i <= ids.length; i += 1) {
            next = (current + direction * i + ids.length * 2) % ids.length;
            if (!node(ids[next]).disabled) { node(ids[next]).focus(); return; }
        }
    }
    node('view').addEventListener('click', function () {
        stop('view changed; measurement discarded');
        showRuntime = !showRuntime;
        node('summary-view').hidden = showRuntime;
        node('runtime-view').hidden = !showRuntime;
        node('measure').disabled = showRuntime;
        text('view', showRuntime ? 'TV summary' : 'Browser details');
        node('view').focus();
    });
    node('refresh').addEventListener('click', refresh);
    node('measure').addEventListener('click', start);
    node('stop').addEventListener('click', function () { stop(); });
    node('back').addEventListener('click', back);
    document.addEventListener('keydown', function (event) {
        var code = event.keyCode || event.which;
        if (code === 37 || code === 38 || code === 39 || code === 40) {
            event.preventDefault(); move(code === 37 || code === 38 ? -1 : 1);
        } else if (code === 13) {
            event.preventDefault();
            if (!event.repeat && document.activeElement && document.activeElement.tagName === 'BUTTON') { document.activeElement.click(); }
        } else if (code === 10009 || code === 27 || code === 8) {
            event.preventDefault(); if (!event.repeat) { back(); }
        }
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { stop('page hidden; measurement discarded'); } });
    root.addEventListener('pagehide', cleanup);
    root.addEventListener('pageshow', function (event) { if (event.persisted) { navigating = false; refresh(); } });
    refresh();
    node('refresh').focus();
}(window, document));
