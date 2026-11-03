/* Temporary capability probe: calls privileged Luna methods from inside an
 * installed web app and posts the raw results to a loopback receiver on the TV
 * (/tmp/reportd.py). Nothing is changed except a no-op write-back of a value
 * that was just read. */
(function () {
  'use strict';

  var REPORT_URL = 'http://127.0.0.1:8765/report';
  var logEl = document.getElementById('log');
  var rows = [];

  function line(text, cls) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    logEl.appendChild(d);
  }

  function send(payload) {
    var body;
    try {
      body = JSON.stringify(payload);
    } catch (e) {
      body = JSON.stringify({ name: payload.name, ok: false, error: 'unserializable: ' + e });
    }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', REPORT_URL, true);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
      xhr.send(body);
    } catch (e) {
      /* fall through to the beacon */
    }
    try {
      var img = new Image();
      img.src = REPORT_URL + '?d=' + encodeURIComponent(JSON.stringify({
        name: payload.name,
        ok: payload.ok,
        error: payload.error || null,
        keys: payload.keys || null
      })).slice(0, 1800);
    } catch (e) { /* ignore */ }
  }

  function record(name, payload) {
    var row = { name: name, ok: payload.ok, error: payload.error || null, keys: payload.keys || null };
    rows.push(row);
    send(row);
    line((row.ok ? 'OK   ' : 'FAIL ') + name +
      (row.error ? '  ' + row.error : '') +
      (row.keys ? '  [' + row.keys.join(', ') + ']' : ''), row.ok ? 'ok' : 'bad');
  }

  function call(name, service, method, params, callback) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      var payload = { ok: false, error: 'timeout' };
      record(name, payload);
      callback(payload);
    }, 6000);

    function finish(payload) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      record(name, payload);
      callback(payload);
    }

    try {
      webOS.service.request('luna://' + service, {
        method: method,
        parameters: params || {},
        onSuccess: function (res) {
          var keys = res && typeof res === 'object' ? Object.keys(res).slice(0, 24) : [];
          finish({ ok: !(res && res.returnValue === false), error: res && res.errorText, keys: keys, value: res });
        },
        onFailure: function (err) {
          finish({ ok: false, error: (err && (err.errorText || err.errorCode)) || 'failure' });
        }
      });
    } catch (e) {
      finish({ ok: false, error: String(e) });
    }
  }

  function summarizeSettings(res) {
    if (!res || typeof res !== 'object') return null;
    var settings = res.settings || res.data || res;
    if (!settings || typeof settings !== 'object') return null;
    var out = {};
    var n = 0;
    Object.keys(settings).forEach(function (k) {
      if (n++ > 40) return;
      out[k] = settings[k];
    });
    return out;
  }

  var steps = [];

  steps.push(function (next) {
    call('control:systemproperty.getSystemInfo', 'com.webos.service.tv.systemproperty',
      'getSystemInfo', { keys: ['modelName', 'sdkVersion'] }, next);
  });

  steps.push(function (next) {
    call('settings.getSystemSettings(option)', 'com.webos.settingsservice',
      'getSystemSettings', { category: 'option' }, function (r) {
        if (r.ok && r.value) {
          try { send({ name: 'settings.option.values', ok: true, value: summarizeSettings(r.value) }); } catch (e) {}
        }
        next(r);
      });
  });

  steps.push(function (next) {
    call('settings.getSystemSettings(general)', 'com.webos.settingsservice',
      'getSystemSettings', { category: 'general' }, function (r) {
        if (r.ok && r.value) {
          try { send({ name: 'settings.general.values', ok: true, value: summarizeSettings(r.value) }); } catch (e) {}
        }
        next(r);
      });
  });

  steps.push(function (next) {
    call('applicationManager.listApps', 'com.webos.applicationManager',
      'listApps', {}, next);
  });

  steps.push(function (next) {
    call('applicationManager.getForegroundAppInfo', 'com.webos.applicationManager',
      'getForegroundAppInfo', {}, next);
  });

  steps.push(function (next) {
    call('surfacemanager.captureCompositorOutput', 'com.webos.surfacemanager',
      'captureCompositorOutput',
      { output: '/media/developer/temp/probe-surface.jpg', format: 'JPEG', maxWidth: 1280, maxHeight: 720 },
      next);
  });

  steps.push(function (next) {
    call('capture.executeOneShot', 'com.webos.service.capture',
      'executeOneShot',
      { output: '/media/developer/temp/probe-capture', format: { type: 'JPEG', quality: 80 }, width: 1280, height: 720 },
      next);
  });

  // No-op write test, only if a read worked: write back the same value.
  steps.push(function (next) {
    var option = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].name === 'settings.getSystemSettings(option)' && rows[i].ok) option = true;
    }
    if (!option) return next({ ok: false, error: 'skipped: read did not work' });
    call('settings.setSystemSettings(noop)', 'com.webos.settingsservice', 'setSystemSettings',
      { category: 'option', settings: { limitAdTracking: true } }, next);
  });

  var index = 0;
  function runNext() {
    if (index >= steps.length) {
      line('done', 'ok');
      send({ name: 'probe.complete', ok: true, keys: null });
      return;
    }
    var step = steps[index++];
    step(function () { setTimeout(runNext, 250); });
  }

  if (!window.webOS || !webOS.service || typeof webOS.service.request !== 'function') {
    line('webOS service API unavailable', 'bad');
    send({ name: 'probe.boot', ok: false, error: 'webOS service API unavailable' });
    return;
  }

  line('probing…');
  send({ name: 'probe.boot', ok: true });
  runNext();
})();
