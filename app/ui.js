(function () {
    'use strict';
    var request = null;
    var timer = null;
    var tried = false;
    var readButton = document.getElementById('read');
    var status = document.getElementById('status');
    function finish(message) {
        if (timer !== null) { clearTimeout(timer); timer = null; }
        if (request) {
            var old = request;
            request = null;
            old.onload = old.onerror = old.ontimeout = old.onabort = null;
            old.abort();
        }
        if (message) { status.textContent = message; }
    }
    function field(entry, unit, divisor) {
        if (!entry || entry.status !== 'available') { return 'Unavailable (' + (entry && /^(missing|invalid|error)$/.test(entry.status) ? entry.status : 'invalid') + ')'; }
        if (typeof entry.value !== 'number' || !isFinite(entry.value) || entry.value < 0) { return 'Unavailable (invalid)'; }
        return (entry.value / divisor).toFixed(2) + unit;
    }
    readButton.onclick = function () {
        if (tried) { return; }
        tried = true;
        readButton.disabled = true;
        status.textContent = 'Reading one snapshot...';
        request = new XMLHttpRequest();
        var xhr = request;
        timer = setTimeout(function () { finish('No result within 10 seconds. The endpoint may have expired or be unavailable.'); }, 10000);
        xhr.onload = function () {
            try {
                if (xhr.status !== 200 || xhr.responseText.length > 4096) { throw new Error('unavailable'); }
                var data = JSON.parse(xhr.responseText);
                if (data.schema !== 'tv-readonly-snapshot-v1') { throw new Error('schema'); }
                var load = data.loadAverage1_5_15Minutes;
                var loadText = 'Unavailable';
                if (load && load.status === 'available' && Array.isArray(load.value) && load.value.length === 3 && load.value.every(function (v) { return typeof v === 'number' && isFinite(v) && v >= 0; })) {
                    loadText = load.value.map(function (v) { return v.toFixed(2); }).join(' / ');
                }
                document.getElementById('result').textContent = 'OS total memory: ' + field(data.totalMemoryBytes, ' MiB', 1048576) + '\nOS free memory: ' + field(data.freeMemoryBytes, ' MiB', 1048576) + '\nOS uptime: ' + field(data.uptimeSeconds, ' hours', 3600) + '\nLoad averages (1 / 5 / 15 min): ' + loadText;
                finish('Snapshot received. The endpoint is closing; no polling continues.');
            } catch (ignore) { finish('No valid snapshot received. Compatibility is unverified; do not change TV permissions.'); }
        };
        xhr.onerror = xhr.ontimeout = function () { finish('Endpoint unavailable or expired. Compatibility is unverified.'); };
        try { xhr.open('GET', 'http://127.0.0.1:18763/read-only-snapshot', true); xhr.timeout = 10000; xhr.send(); }
        catch (ignore) { finish('Request unavailable in this page context.'); }
    };
    document.getElementById('stop').onclick = function () { finish('Stopped waiting. The service is designed to expire after 55 seconds if the host stays responsive.'); };
    document.getElementById('back').onclick = function () { finish(); window.history.back(); };
    window.addEventListener('pagehide', function () { finish(); });
    window.addEventListener('beforeunload', function () { finish(); });
    document.addEventListener('keydown', function (event) {
        var buttons = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) { return !b.disabled; });
        var index = buttons.indexOf(document.activeElement);
        if (event.keyCode >= 37 && event.keyCode <= 40) {
            event.preventDefault();
            buttons[(index + (event.keyCode === 37 || event.keyCode === 38 ? buttons.length - 1 : 1)) % buttons.length].focus();
        } else if (event.keyCode === 10009 || event.keyCode === 27) { finish(); window.history.back(); }
    });
    readButton.focus();
}());
