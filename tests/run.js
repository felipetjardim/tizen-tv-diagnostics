'use strict';
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
var EventEmitter = require('events');
var source = fs.readFileSync(__dirname + '/../service.js', 'utf8');
var checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function harness(overrides) {
    var tasks = []; var reads = []; var callback; var server = new EventEmitter();
    server.closed = 0;
    server.close = function () { server.closed++; };
    server.setTimeout = function (ms, fn) { server.timeout = ms; server.timeoutFn = fn; };
    server.listen = function (port, host) { server.binding = [port, host]; };
    var os = { totalmem: function () { return 100; }, freemem: function () { return 40; }, uptime: function () { return 50; }, loadavg: function () { return [1, 2, 3]; } };
    Object.keys(overrides || {}).forEach(function (key) { os[key] = overrides[key]; });
    Object.keys(os).forEach(function (key) { var fn = os[key]; if (typeof fn === 'function') { os[key] = function () { reads.push(key); return fn(); }; } });
    vm.runInNewContext(source, {
        require: function (name) { if (name === 'http') { return { createServer: function (fn) { callback = fn; return server; } }; } if (name === 'os') { return os; } throw new Error('Forbidden require ' + name); },
        setTimeout: function (fn, ms) { var task = { fn: fn, ms: ms, active: true }; tasks.push(task); return task; },
        clearTimeout: function (task) { if (task) { task.active = false; } }
    });
    function req(changes, autoFinish) {
        var input = { headers: { host: '127.0.0.1:18763', origin: 'http://127.0.0.1:8081' }, method: 'GET', url: '/read-only-snapshot' };
        Object.keys(changes || {}).forEach(function (key) { input[key] = changes[key]; });
        var res = new EventEmitter(); res.headers = {};
        res.setHeader = function (name, value) { res.headers[name] = value; };
        res.writeHead = function (code) { res.status = code; };
        res.end = function (body) { res.body = JSON.parse(body); if (autoFinish !== false) { res.emit('finish'); } };
        callback(input, res); return res;
    }
    function socket() {
        var s = new EventEmitter(); s.destroyed = false;
        s.destroy = function () { s.destroyed = true; s.emit('close'); };
        s.setTimeout = function (ms, fn) { s.timeout = ms; s.timeoutFn = fn; };
        server.emit('connection', s); return s;
    }
    return { server: server, tasks: tasks, reads: reads, req: req, socket: socket };
}
test('binds loopback and has one fixed lifetime, no reads at start', function () { var h = harness(); assert.deepStrictEqual(h.server.binding, [18763, '127.0.0.1']); assert.strictEqual(h.tasks.length, 1); assert.strictEqual(h.tasks[0].ms, 55000); assert.strictEqual(h.reads.length, 0); });
test('one valid snapshot closes listener then allows bounded response drain', function () { var h = harness(); var s = h.socket(); var r = h.req(); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.freeMemoryBytes.value, 40); assert.strictEqual(r.headers['Access-Control-Allow-Origin'], 'http://127.0.0.1:8081'); assert.strictEqual(h.server.closed, 1); assert.strictEqual(h.tasks[0].active, true); assert(!s.destroyed); assert.strictEqual(h.tasks[1].ms, 250); h.tasks[1].fn(); assert(s.destroyed); assert(!h.tasks[0].active); assert(!h.tasks[1].active); assert.deepStrictEqual(h.reads, ['totalmem', 'freemem', 'uptime', 'loadavg']); });
test('localhost origin is explicitly allowed', function () { var h = harness(); assert.strictEqual(h.req({ headers: { host: '127.0.0.1:18763', origin: 'http://localhost:8081' } }).status, 200); });
['http://evil.test', 'null', undefined, 'http://localhost:8081.evil.test', 'https://localhost:8081', 'http://127.0.0.1:8082'].forEach(function (origin) { test('rejects origin ' + origin, function () { var h = harness(); var r = h.req({ headers: { host: '127.0.0.1:18763', origin: origin } }); assert.strictEqual(r.status, 403); assert.strictEqual(r.headers['Access-Control-Allow-Origin'], undefined); assert.strictEqual(h.reads.length, 0); }); });
['localhost:18763', 'evil.test:18763', '127.0.0.1', undefined].forEach(function (host) { test('rejects host ' + host, function () { var h = harness(); assert.strictEqual(h.req({ headers: { host: host, origin: 'http://localhost:8081' } }).status, 403); }); });
[{method:'POST'}, {method:'OPTIONS'}, {url:'/read-only-snapshot?x=1'}, {url:'/'}, {url:'/../read-only-snapshot'}, {headers:{host:'127.0.0.1:18763',origin:'http://localhost:8081','content-length':'1'}}, {headers:{host:'127.0.0.1:18763',origin:'http://localhost:8081','transfer-encoding':'chunked'}}].forEach(function (change, i) { test('rejects malformed request ' + i, function () { var h = harness(); assert.strictEqual(h.req(change).status, 400); assert.strictEqual(h.reads.length, 0); assert(h.tasks[0].active); }); });
test('in-flight second valid request cannot take another snapshot', function () { var h = harness(); var r = h.req({}, false); assert.strictEqual(h.req().status, 410); assert.strictEqual(h.reads.length, 4); r.emit('finish'); assert.strictEqual(h.server.closed, 1); });
test('expiry destroys pending connections, no timer remains', function () { var h = harness(); var s = h.socket(); h.tasks[0].fn(); assert(s.destroyed); assert.strictEqual(h.server.closed, 1); assert(!h.tasks[0].active); assert.strictEqual(h.req().status, 410); assert.strictEqual(h.reads.length, 0); });
test('port collision fails closed with no retry', function () { var h = harness(); h.server.emit('error', { code:'EADDRINUSE' }); assert.strictEqual(h.server.closed, 1); assert(!h.tasks[0].active); assert.strictEqual(h.tasks.length, 1); assert.strictEqual(h.reads.length, 0); });
test('slow idle socket has finite timeout', function () { var h = harness(); var s = h.socket(); assert.strictEqual(s.timeout, 2000); s.timeoutFn(); assert(s.destroyed); h.tasks[0].fn(); });
test('connection count capped at eight', function () { var h = harness(); for (var i = 0; i < 8; i++) { assert(!h.socket().destroyed); } assert(h.socket().destroyed); h.tasks[0].fn(); });
test('OS failures and unavailable methods are sanitized', function () { var h = harness({totalmem:undefined,freemem:function(){throw new Error('secret');},uptime:function(){return NaN;},loadavg:function(){return [1,Infinity,3];}}); var r=h.req(); assert.strictEqual(r.body.totalMemoryBytes.status,'missing'); assert.strictEqual(r.body.freeMemoryBytes.status,'error'); assert.strictEqual(r.body.uptimeSeconds.status,'invalid'); assert.strictEqual(r.body.loadAverage1_5_15Minutes.status,'invalid'); assert(JSON.stringify(r.body).indexOf('secret')<0); });
test('inconsistent memory rejected', function () { var h=harness({freemem:function(){return 101;}}); assert.strictEqual(h.req().body.freeMemoryBytes.status,'invalid'); });
test('response abort closes endpoint', function () { var h=harness(); var r=h.req({},false); r.emit('close'); assert.strictEqual(h.server.closed,1); assert(!h.tasks[0].active); });
test('hard deadline interrupts response drain and clears both timers', function () { var h=harness(); var s=h.socket(); h.req(); assert(!s.destroyed); h.tasks[0].fn(); assert(s.destroyed); assert(!h.tasks[0].active); assert(!h.tasks[1].active); });
test('finish then close does not destroy response socket before drain', function () { var h=harness(); var s=h.socket(); var r=h.req(); r.emit('close'); assert(!s.destroyed); assert(h.tasks[1].active); h.tasks[1].fn(); assert(s.destroyed); });
test('duplicate finish cannot extend response drain', function () { var h=harness(); var r=h.req(); r.emit('finish'); assert.strictEqual(h.tasks.length,2); assert(h.socket().destroyed); h.tasks[1].fn(); });
test('late successful bind after expiry is closed again', function () { var h=harness(); h.tasks[0].fn(); var count=h.server.closed; h.server.emit('listening'); assert.strictEqual(h.server.closed,count+1); assert(h.socket().destroyed); assert.strictEqual(h.reads.length,0); });
test('late successful bind during drain is closed again', function () { var h=harness(); h.req(); var count=h.server.closed; h.server.emit('listening'); assert.strictEqual(h.server.closed,count+1); h.tasks[1].fn(); });
test('response error during drain forces immediate timer and socket cleanup', function () { var h=harness(); var s=h.socket(); var r=h.req(); r.emit('error',new Error('test')); assert(s.destroyed); assert(!h.tasks[0].active); assert(!h.tasks[1].active); });
test('no native async API calls, forbidden modules or evaluation',function(){ assert(!/require\(['"](fs|child_process|vm|net|https|tizen)['"]\)/.test(source)); assert(!/\beval\s*\(|\bsetInterval\s*\(|\bprocess\./.test(source)); });
console.log(checks + ' deterministic service checks passed. No real sockets or TV APIs were used.');
