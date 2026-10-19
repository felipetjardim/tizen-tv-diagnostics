/* ES5; development-only. Loading this file starts a short-lived loopback listener. */
(function (http, os, later, cancel) {
    'use strict';
    var PORT = 18763;
    var sockets = [];
    var ended = false;
    var consumed = false;
    var server;
    var deadline;
    var graceTimer = null;
    var draining = false;
    function closeListener() {
        if (server) { try { server.close(); } catch (ignore) {} }
    }
    function stop() {
        if (ended) { return; }
        ended = true;
        cancel(deadline);
        if (graceTimer !== null) { cancel(graceTimer); graceTimer = null; }
        closeListener();
        sockets.slice().forEach(function (socket) { socket.destroy(); });
        sockets = [];
    }
    function drain() {
        if (ended || draining) { return; }
        draining = true;
        /* Keep the original deadline active; drain never extends the lifetime. */
        graceTimer = later(stop, 250);
        closeListener();
    }
    function number(value) {
        return typeof value === 'number' && isFinite(value) && value >= 0;
    }
    function read(name, check) {
        try {
            if (typeof os[name] !== 'function') { return { status: 'missing' }; }
            var value = os[name]();
            if (!check(value)) { return { status: 'invalid' }; }
            return { status: 'available', value: value };
        } catch (ignore) { return { status: 'error' }; }
    }
    function snapshot() {
        var total = read('totalmem', function (v) { return number(v) && v > 0; });
        var free = read('freemem', number);
        if (total.status === 'available' && free.status === 'available' && free.value > total.value) {
            free = { status: 'invalid' };
        }
        return {
            schema: 'tv-readonly-snapshot-v1',
            totalMemoryBytes: total,
            freeMemoryBytes: free,
            uptimeSeconds: read('uptime', number),
            loadAverage1_5_15Minutes: read('loadavg', function (v) {
                return Array.isArray(v) && v.length === 3 && v.every(number);
            })
        };
    }
    function reply(res, status, body, origin) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Connection', 'close');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
        res.writeHead(status);
        res.end(JSON.stringify(body));
    }
    deadline = later(stop, 55000);
    try {
        server = http.createServer(function (req, res) {
            res.on('error', stop);
            if (ended || consumed) { reply(res, 410, { status: 'expired' }); return; }
            var origin = req.headers.origin;
            if (req.headers.host !== '127.0.0.1:' + PORT ||
                (origin !== 'http://127.0.0.1:8081' && origin !== 'http://localhost:8081')) {
                reply(res, 403, { status: 'rejected' }); return;
            }
            if (req.method !== 'GET' || req.url !== '/read-only-snapshot' ||
                req.headers['transfer-encoding'] !== undefined ||
                (req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0')) {
                reply(res, 400, { status: 'rejected' }); return;
            }
            consumed = true;
            /* No asynchronous or native Tizen requests; one fixed OS snapshot only. */
            var result = snapshot();
            res.on('finish', drain);
            res.on('close', function () { if (!draining) { stop(); } });
            reply(res, 200, result, origin);
        });
        server.on('error', stop);
        server.on('listening', function () {
            /* A delayed successful bind must not reopen an expired service. */
            if (ended || draining) { closeListener(); }
        });
        server.on('clientError', function (error, socket) { socket.destroy(); });
        server.on('connection', function (socket) {
            if (ended || consumed || sockets.length >= 8) { socket.destroy(); return; }
            sockets.push(socket);
            socket.setTimeout(2000, function () { socket.destroy(); });
            socket.on('error', function () { socket.destroy(); });
            socket.on('close', function () {
                var index = sockets.indexOf(socket);
                if (index >= 0) { sockets.splice(index, 1); }
            });
        });
        server.setTimeout(2000, function (socket) { socket.destroy(); });
        server.listen(PORT, '127.0.0.1');
    } catch (ignore) { stop(); }
}(require('http'), require('os'), setTimeout, clearTimeout));
