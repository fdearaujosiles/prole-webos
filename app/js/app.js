(function () {
  'use strict';

  var MAX_DOCK = 10;
  var DOCK_STORE = 'prolewebos.dock';
  var cfg = window.PROLE_CONFIG || window.AURORA_CONFIG || { apps: [], rotateSeconds: 30 };
  var defaultFavorites = cfg.apps || [];
  var favorites = loadDockConfig() || defaultFavorites.map(cloneFavorite);
  var walls = window.AURORA_WALLPAPERS || [];

  var LOGOS = {
    netflix: '<span class="nflx">N</span>',
    youtube:
      '<svg class="glyph" viewBox="0 0 64 44" aria-hidden="true">' +
      '<rect x="2" y="2" width="60" height="40" rx="10" fill="#ff0000"/>' +
      '<path d="M26 13 L46 22 L26 31 Z" fill="#ffffff"/></svg>',
    prime:
      '<span class="prime"><span class="p1">prime</span><span class="p2">video</span></span>' +
      '<svg class="smile" viewBox="0 0 44 12" aria-hidden="true">' +
      '<path d="M3 3 Q22 14 41 3" fill="none" stroke="#00a8e1" stroke-width="3" stroke-linecap="round"/></svg>',
    disney: '<span class="disney">Disney<span class="plus">+</span></span>',
    stremio:
      '<svg class="glyph" viewBox="0 0 64 64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="29" fill="#6d4aff"/>' +
      '<circle cx="32" cy="32" r="21" fill="#8b6bff"/>' +
      '<path d="M26 20 L47 32 L26 44 Z" fill="#ffffff"/>' +
      '<circle cx="49" cy="15" r="4" fill="#2ef2c0"/></svg>',
    appletv:
      '<svg class="apple" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M16.7 12.9c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.8-.4 6.9 1.1 9.2.7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-1.1 2.7-2.2.9-1.3 1.2-2.5 1.2-2.6-.1 0-2.2-.9-2.2-3.7zM14.5 6.1c.6-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/></svg>' +
      '<span class="tv">tv</span>',
    hbomax: '<span class="hbo">HBO</span><span class="hmax">max</span>'
  };

  var UTILITY_LOGOS = {
    allapps:
      '<svg class="uicon" viewBox="0 0 64 64" aria-hidden="true">' +
      '<rect x="8" y="8" width="13" height="13" rx="3.4" fill="currentColor"/>' +
      '<rect x="25.5" y="8" width="13" height="13" rx="3.4" fill="currentColor"/>' +
      '<rect x="43" y="8" width="13" height="13" rx="3.4" fill="currentColor"/>' +
      '<rect x="8" y="25.5" width="13" height="13" rx="3.4" fill="currentColor"/>' +
      '<rect x="25.5" y="25.5" width="13" height="13" rx="3.4" fill="currentColor"/>' +
      '<rect x="43" y="25.5" width="13" height="13" rx="3.4" fill="currentColor"/>' +
      '<rect x="8" y="43" width="13" height="13" rx="3.4" fill="currentColor"/>' +
      '<rect x="25.5" y="43" width="13" height="13" rx="3.4" fill="currentColor"/>' +
      '<rect x="43" y="43" width="13" height="13" rx="3.4" fill="currentColor"/></svg>',
    inputs:
      '<svg class="uicon" viewBox="0 0 64 64" aria-hidden="true">' +
      '<rect x="7" y="12" width="50" height="33" rx="5" fill="none" stroke="currentColor" stroke-width="3.4"/>' +
      '<path d="M25 54h14M32 45v9" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M23 23l9 5.5-9 5.5z" fill="currentColor"/></svg>',
    settings:
      '<svg class="uicon" viewBox="0 0 64 64" aria-hidden="true">' +
      '<path d="M11 20h42M11 32h42M11 44h42" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>' +
      '<circle cx="25" cy="20" r="5" fill="#0e121a" stroke="currentColor" stroke-width="3.2"/>' +
      '<circle cx="42" cy="32" r="5" fill="#0e121a" stroke="currentColor" stroke-width="3.2"/>' +
      '<circle cx="29" cy="44" r="5" fill="#0e121a" stroke="currentColor" stroke-width="3.2"/></svg>',
    manage:
      '<svg class="uicon" viewBox="0 0 64 64" aria-hidden="true">' +
      '<rect x="7" y="7" width="21" height="21" rx="4.5" fill="none" stroke="currentColor" stroke-width="3.2"/>' +
      '<rect x="36" y="7" width="21" height="21" rx="4.5" fill="none" stroke="currentColor" stroke-width="3.2"/>' +
      '<rect x="7" y="36" width="21" height="21" rx="4.5" fill="none" stroke="currentColor" stroke-width="3.2"/>' +
      '<path d="M36 47l7 7 14-17" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var INPUT_GLYPH =
    '<svg class="input-glyph" viewBox="0 0 64 64" aria-hidden="true">' +
    '<rect x="8" y="13" width="48" height="31" rx="5" fill="none" stroke="currentColor" stroke-width="3"/>' +
    '<path d="M25 52h14M32 44v8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M24 23l9 5.5-9 5.5z" fill="currentColor"/></svg>';

  var UTILITIES = [
    { key: 'allapps', name: 'All apps', kind: 'apps' },
    { key: 'inputs', name: 'Inputs', kind: 'inputs' },
    {
      key: 'settings',
      name: 'Settings',
      kind: 'settings',
      ids: ['com.palm.app.settings', 'com.webos.app.settings']
    }
  ];

  var SELF_ID = 'com.fdear.prolewebos';
  var SERVICE_URI = 'luna://com.fdear.prolewebos.service';
  var KEY_STORE = 'prolewebos.ssapKey';

  /* The TV refuses listLaunchPoints to an unprivileged app page, so a bundled JS service asks the
   * remote-control API (see app/services). If that is refused or unavailable, these known webOS app
   * ids are checked one by one with getAppLoadStatus. */
  var KNOWN_APPS = [
    ['com.webos.app.discovery', 'LG Content Store'],
    ['netflix', 'Netflix'],
    ['youtube.leanback.v4', 'YouTube'],
    ['amazon', 'Prime Video'],
    ['com.disney.disneyplus-prod', 'Disney+'],
    ['io.strem.tv', 'Stremio'],
    ['com.apple.appletv', 'Apple TV'],
    ['com.wbd.stream', 'HBO Max'],
    ['spotify-beehive', 'Spotify'],
    ['globoplaywebos', 'Globoplay'],
    ['com.disney.alch.prod.lrd.app', 'Star+'],
    ['com.mercadolibre.mercadoplay', 'Mercado Play'],
    ['com.webos.app.lgchannels', 'LG Channels'],
    ['com.twin.app.gamingportal', 'LG Gaming Portal'],
    ['com.geforcenow.play', 'GeForce NOW'],
    ['com.webos.app.browser', 'Web Browser'],
    ['com.webos.app.mediadiscovery', 'Media Player'],
    ['com.webos.app.homeconnect', 'Home Hub'],
    ['com.webos.app.lifeonscreen', 'LG Gallery+'],
    ['com.webos.app.camera', 'Camera'],
    ['amazon.alexa.view', 'Amazon Alexa'],
    ['com.webos.app.sportsteamsettings', 'Sports'],
    ['epoxyaisports', 'LG Sports Playbook'],
    ['com.magine.filmicca', 'FILMICCA'],
    ['shortcutcopilot', 'Copilot'],
    ['com.miniclip.eightballpool', '8 Ball Pool'],
    ['com.retroarch.webos', 'RetroArch'],
    ['com.palmdts.devmode', 'Developer Mode'],
    ['com.palm.app.settings', 'Settings']
  ];

  var INPUT_IDS = [
    'com.webos.app.hdmi1',
    'com.webos.app.hdmi2',
    'com.webos.app.hdmi3',
    'com.webos.app.hdmi4',
    'com.webos.app.livetv',
    'com.webos.app.externalinput.av1',
    'com.webos.app.externalinput.component'
  ];

  function isInputId(id) {
    return INPUT_IDS.indexOf(id) !== -1;
  }

  var dockEl = document.getElementById('dock');
  var clockEl = document.getElementById('clock');
  var dateEl = document.getElementById('date');
  var toastEl = document.getElementById('toast');
  var hintEl = document.getElementById('hint');
  var overlayEl = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlaySub = document.getElementById('overlay-sub');
  var overlayGrid = document.getElementById('overlay-grid');

  var dockItems = [];
  var dockTiles = [];
  var installed = Object.create(null);
  var inputFound = Object.create(null);
  var externalInputs = null;
  var inputsLoading = false;
  var inputsFailed = false;
  var launchPoints = [];
  var fallbackApps = [];
  var catalog = [];
  var hasAppList = false;
  var catalogLoading = false;
  var dockFocus = 0;

  var overlayMode = null;
  var overlayItems = [];
  var overlayTiles = [];
  var overlayFocus = 0;

  var manageView = 'dock';
  var manageTiles = [];
  var manageFocus = 0;
  var manageResetArm = false;
  var manageResetTimer = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function initial(title) {
    var s = String(title || '').trim();
    for (var i = 0; i < s.length; i++) {
      if (/[\p{L}\p{N}]/u.test(s.charAt(i))) return s.charAt(i).toUpperCase();
    }
    return '?';
  }

  function colorFor(title) {
    var h = 0;
    var s = String(title || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return 'linear-gradient(145deg, hsl(' + h + ' 42% 32%), hsl(' + ((h + 42) % 360) + ' 48% 17%))';
  }

  /* ---------- dock config ---------- */

  /* Launch points often carry params as an empty object; treat that as "no params" so a
   * catalog entry and its pinned favorite compare as the same app. */
  function normParams(p) {
    if (!p || typeof p !== 'object') return null;
    return Object.keys(p).length ? p : null;
  }

  function cloneFavorite(f) {
    return {
      key: f.key || '',
      name: f.name || f.title || '',
      ids: (f.ids || (f.id ? [f.id] : [])).slice(),
      icon: f.icon || '',
      params: normParams(f.params)
    };
  }

  function loadDockConfig() {
    try {
      var raw = localStorage.getItem(DOCK_STORE);
      if (!raw) return null;
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return null;
      return list
        .slice(0, MAX_DOCK)
        .map(cloneFavorite)
        .filter(function (f) { return !!f.name && f.ids.length > 0; });
    } catch (e) {
      return null;
    }
  }

  function saveDockConfig() {
    try { localStorage.setItem(DOCK_STORE, JSON.stringify(favorites)); } catch (e) {}
  }

  function clearDockConfig() {
    try { localStorage.removeItem(DOCK_STORE); } catch (e) {}
  }

  function favoriteIds(item) {
    return (item.ids || (item.id ? [item.id] : [])).slice();
  }

  function favoriteKey(item) {
    var ids = favoriteIds(item);
    for (var i = 0; i < defaultFavorites.length; i++) {
      var d = defaultFavorites[i];
      if ((d.ids || []).some(function (id) { return ids.indexOf(id) !== -1; })) return d.key;
    }
    return 'app:' + (ids[0] || 'unknown');
  }

  function pinnedIndex(item) {
    var ids = favoriteIds(item);
    var params = JSON.stringify(normParams(item.params));
    for (var i = 0; i < favorites.length; i++) {
      var f = favorites[i];
      if (JSON.stringify(normParams(f.params)) !== params) continue;
      if ((f.ids || []).some(function (id) { return ids.indexOf(id) !== -1; })) return i;
    }
    return -1;
  }

  /* ---------- dock ---------- */

  function rebuildDock() {
    var prevKey = dockTiles[dockFocus] ? dockTiles[dockFocus].dataset.app : '';
    dockItems = favorites.concat(UTILITIES);
    dockTiles = [];
    dockEl.innerHTML = '';

    dockItems.forEach(function (item, i) {
      if (i === favorites.length) {
        var sep = document.createElement('span');
        sep.className = 'dock-sep';
        sep.setAttribute('aria-hidden', 'true');
        dockEl.appendChild(sep);
      }

      var b = document.createElement('button');
      b.className = 'tile' + (item.kind ? ' utility' : '');
      b.dataset.app = item.key;
      b.setAttribute('aria-label', item.name);

      var icon;
      if (item.kind) {
        icon = document.createElement('span');
        icon.className = 'icon';
        icon.innerHTML = UTILITY_LOGOS[item.key] || '';
      } else if (LOGOS[item.key]) {
        icon = document.createElement('span');
        icon.className = 'icon';
        icon.innerHTML = LOGOS[item.key];
      } else {
        icon = makeIcon({ title: item.name, icon: item.icon }, 'dock');
      }

      var label = document.createElement('span');
      label.className = 'label';
      label.textContent = item.name;

      b.appendChild(icon);
      b.appendChild(label);

      b.addEventListener('click', function () {
        setDockFocus(i);
        activateDock(i);
      });
      b.addEventListener('mouseenter', function () {
        setDockFocus(i);
      });

      dockEl.appendChild(b);
      dockTiles.push(b);
    });

    var nextFocus = 0;
    if (prevKey) {
      for (var i = 0; i < dockTiles.length; i++) {
        if (dockTiles[i].dataset.app === prevKey) {
          nextFocus = i;
          break;
        }
      }
    }
    if (nextFocus >= dockTiles.length) nextFocus = dockTiles.length - 1;
    setDockFocus(nextFocus);
  }

  function setDockFocus(i) {
    if (!dockTiles.length) return;
    if (dockTiles[dockFocus]) dockTiles[dockFocus].classList.remove('focused');
    dockFocus = ((i % dockTiles.length) + dockTiles.length) % dockTiles.length;
    dockTiles[dockFocus].classList.add('focused');
  }

  function activateDock(i) {
    var item = dockItems[i];
    if (!item) return;
    if (item.kind === 'apps' || item.kind === 'inputs') {
      openOverlay(item.kind);
      return;
    }
    launchIds(item.ids || [], item.name, item.params);
  }

  /* ---------- clock ---------- */

  var timeFmt;
  var dateFmt;
  try {
    timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch (e) {
    timeFmt = null;
    dateFmt = null;
  }

  function tick() {
    var d = new Date();
    if (timeFmt) {
      clockEl.textContent = timeFmt.format(d);
      dateEl.textContent = dateFmt.format(d);
    } else {
      var h = d.getHours();
      var m = d.getMinutes();
      clockEl.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
      dateEl.textContent = d.toDateString();
    }
    var next = 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 60;
    setTimeout(tick, next);
  }

  /* ---------- wallpaper ---------- */

  var layers = [document.getElementById('wallA'), document.getElementById('wallB')];
  var active = 0;
  var wallIndex = 0;
  var lastWallChange = 0;

  walls.forEach(function (w) {
    var img = new Image();
    img.src = w.file;
  });

  function showWall(i, instant) {
    if (!walls.length) return;
    var now = Date.now();
    if (!instant && now - lastWallChange < 1500) return;
    lastWallChange = now;

    wallIndex = ((i % walls.length) + walls.length) % walls.length;
    var next = 1 - active;
    var outgoing = layers[active];
    var incoming = layers[next];

    incoming.style.backgroundImage = 'url("' + walls[wallIndex].file + '")';

    if (instant) {
      incoming.style.transition = 'none';
      outgoing.style.transition = 'none';
      incoming.style.opacity = '1';
      outgoing.style.opacity = '0';
      void incoming.offsetWidth;
      incoming.style.transition = '';
      outgoing.style.transition = '';
    } else {
      requestAnimationFrame(function () {
        incoming.style.opacity = '1';
        outgoing.style.opacity = '0';
      });
    }
    active = next;
  }

  showWall(0, true);
  var rotateMs = Math.max(8, Number(cfg.rotateSeconds) || 30) * 1000;
  setInterval(function () {
    showWall(wallIndex + 1);
  }, rotateMs);

  /* ---------- luna ---------- */

  function luna(method, params, onOk, onFail) {
    if (!window.webOS || !webOS.service || typeof webOS.service.request !== 'function') {
      if (onFail) onFail({ errorText: 'webOS API unavailable' });
      return;
    }
    try {
      webOS.service.request('luna://com.webos.applicationManager', {
        method: method,
        parameters: params,
        onSuccess: onOk || function () {},
        onFailure: onFail || function () {}
      });
    } catch (e) {
      if (onFail) onFail({ errorText: String(e) });
    }
  }

  function launchIds(ids, name, params) {
    ids = (ids || []).slice();
    if (!ids.length) {
      toast('No app id configured for ' + name + '.');
      return;
    }
    if (hasAppList) {
      ids.sort(function (a, b) {
        return (installed[a] ? 0 : 1) - (installed[b] ? 0 : 1);
      });
    }

    closeOverlay();

    (function attempt(n) {
      if (n >= ids.length) {
        toast('Could not open ' + name + '. Check that it is installed.');
        return;
      }
      var settled = false;
      var guard = setTimeout(function () {
        settled = true;
      }, 2500);

      var req = { id: ids[n] };
      if (params && Object.keys(params).length) req.params = params;

      luna(
        'launch',
        req,
        function (res) {
          clearTimeout(guard);
          if (settled) return;
          settled = true;
          if (res && res.returnValue === false) attempt(n + 1);
        },
        function () {
          clearTimeout(guard);
          if (settled) return;
          settled = true;
          attempt(n + 1);
        }
      );
    })(0);
  }

  function titleMatch(name) {
    var wanted = name.toLowerCase();
    for (var id in installed) {
      var t = String(installed[id] || '').toLowerCase();
      if (t === wanted) return id;
    }
    for (var id2 in installed) {
      var t2 = String(installed[id2] || '').toLowerCase();
      if (t2.indexOf(wanted) !== -1) return id2;
    }
    return null;
  }

  /* Launch-point icon URLs point at a content hash that rotates, so the URL saved with a pinned
   * favorite dies on the next launch (and the tile falls back to a letter). Re-read the icon from
   * the current launch points every time the catalog arrives. */
  function refreshFavoriteIcon(app) {
    var ids = app.ids || [];
    var params = JSON.stringify(normParams(app.params));
    var match = null;
    for (var i = 0; i < launchPoints.length; i++) {
      var lp = launchPoints[i];
      if (!lp || ids.indexOf(lp.id) === -1) continue;
      if (JSON.stringify(normParams(lp.params)) === params) { match = lp; break; }
      if (!match) match = lp;
    }
    var icon = match ? (match.icon || match.largeIcon || '') : '';
    if (!icon || icon === app.icon) return false;
    app.icon = icon;
    return true;
  }

  function markMissing() {
    favorites.forEach(function (app, i) {
      var found = (app.ids || []).some(function (id) {
        return !!installed[id];
      });
      if (dockTiles[i]) dockTiles[i].classList.toggle('missing', !found);
    });

    for (var i = 0; i < UTILITIES.length; i++) {
      if (UTILITIES[i].kind !== 'settings') continue;
      var tile = dockTiles[favorites.length + i];
      if (!tile || !hasAppList) continue;
      var ok = (UTILITIES[i].ids || []).some(function (id) {
        return !!installed[id];
      });
      tile.classList.toggle('missing', !ok);
    }
  }

  function repairFavorites() {
    var changed = false;

    favorites.forEach(function (app) {
      var byId = (app.ids || []).some(function (id) {
        return !!installed[id];
      });
      if (!byId) {
        var guess = titleMatch(app.name);
        if (guess && (app.ids || []).indexOf(guess) === -1) {
          app.ids = app.ids || [];
          app.ids.unshift(guess);
        }
      }
      if (refreshFavoriteIcon(app)) changed = true;
    });

    if (changed) rebuildDock();
    markMissing();
    saveDockConfig();
  }

  /* ---------- app catalog ---------- */

  function byTitle(a, b) {
    return String(a.title).localeCompare(String(b.title), undefined, {
      sensitivity: 'base',
      numeric: true
    });
  }

  function rebuildCatalog() {
    var seen = Object.create(null);
    catalog = [];

    launchPoints.forEach(function (lp) {
      if (!lp || !lp.id || lp.hidden === true) return;
      if (lp.id === SELF_ID || isInputId(lp.id)) return;
      // Bookmarks (Xbox Cloud Gaming, for one) reuse the browser's app id but have their own
      // launch point id, so dedupe on that and keep the params needed to open them.
      var key = lp.launchPointId || lp.id;
      if (seen[key]) return;
      seen[key] = 1;
      catalog.push({
        id: lp.id,
        title: lp.title || lp.id,
        icon: lp.icon || lp.largeIcon || '',
        params: normParams(lp.params)
      });
    });

    if (!launchPoints.length) {
      fallbackApps.forEach(function (a) {
        if (!a || !a.id || a.id === SELF_ID || isInputId(a.id) || seen[a.id]) return;
        seen[a.id] = 1;
        catalog.push({ id: a.id, title: a.title, icon: '' });
      });
    }

    if (!catalog.some(function (a) { return a.id === 'com.palm.app.settings'; })) {
      catalog.push({ id: 'com.palm.app.settings', title: 'Settings', icon: '', glyph: 'settings' });
    }

    catalog.sort(byTitle);

    if (overlayMode === 'apps') renderOverlay();
    else if (overlayMode === 'manage') renderManage();
  }

  function svc(method, params, onOk, onFail) {
    if (!window.webOS || !webOS.service || typeof webOS.service.request !== 'function') {
      if (onFail) onFail({ errorText: 'webOS API unavailable' });
      return;
    }
    try {
      webOS.service.request(SERVICE_URI, {
        method: method,
        parameters: params,
        onSuccess: onOk || function () {},
        onFailure: onFail || function () {}
      });
    } catch (e) {
      if (onFail) onFail({ errorText: String(e) });
    }
  }

  function serviceCatalog() {
    var key = '';
    try { key = localStorage.getItem(KEY_STORE) || ''; } catch (e) {}
    svc(
      'ssap',
      { uri: 'com.webos.applicationManager/listLaunchPoints', clientKey: key },
      function (res) {
        if (!res || res.returnValue === false) return;
        if (res.clientKey) {
          try { localStorage.setItem(KEY_STORE, res.clientKey); } catch (e) {}
        }
        var list = res.payload && res.payload.launchPoints;
        if (!list || !list.length) return;
        launchPoints = list.filter(function (lp) {
          return lp && lp.id && lp.hidden !== true;
        });
        installed = Object.create(null);
        launchPoints.forEach(function (lp) {
          installed[lp.id] = lp.title || lp.id;
        });
        installed['com.palm.app.settings'] = 'Settings';
        hasAppList = true;
        repairFavorites();
        rebuildCatalog();
      },
      function () {
        /* The prompt was refused or the service is not running: the probe below covers it. */
      }
    );
  }

  function probeKnown() {
    var titles = Object.create(null);
    KNOWN_APPS.forEach(function (a) { titles[a[0]] = a[1]; });
    var ids = KNOWN_APPS.map(function (a) { return a[0]; }).concat(INPUT_IDS);
    var found = [];
    var left = ids.length;

    function done() {
      if (--left > 0) return;
      catalogLoading = false;
      if (overlayMode === 'inputs') renderOverlay();   // the probe knows which sources exist
      if (launchPoints.length) return;   // the service answered with the real list
      fallbackApps = found.sort(byTitle);
      hasAppList = true;
      installed = Object.create(null);
      found.forEach(function (a) { installed[a.id] = a.title; });
      repairFavorites();
      rebuildCatalog();
    }

    ids.forEach(function (id) {
      luna(
        'getAppLoadStatus',
        { appId: id },
        function (res) {
          if (res && res.exist === true) {
            found.push({ id: id, title: titles[id] || id });
            if (isInputId(id)) inputFound[id] = true;
          }
          done();
        },
        function () { done(); }
      );
    });
  }

  function loadCatalog() {
    catalogLoading = true;
    probeKnown();
    serviceCatalog();
  }

  /* ---------- overlay ---------- */

  function inputItems() {
    var defs = [
      { id: 'com.webos.app.hdmi1', title: 'HDMI 1' },
      { id: 'com.webos.app.hdmi2', title: 'HDMI 2' },
      { id: 'com.webos.app.hdmi3', title: 'HDMI 3' },
      { id: 'com.webos.app.hdmi4', title: 'HDMI 4' },
      { id: 'com.webos.app.livetv', title: 'Live TV' },
      { id: 'com.webos.app.externalinput.av1', title: 'AV' },
      { id: 'com.webos.app.externalinput.component', title: 'Component' }
    ];
    return defs.filter(function (d) {
      return !hasAppList || !!inputFound[d.id] || !!installed[d.id];
    });
  }

  function storedSsapKey() {
    try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }

  function rememberSsapKey(res) {
    if (!res || !res.clientKey) return;
    try { localStorage.setItem(KEY_STORE, res.clientKey); } catch (e) {}
  }

  /* Detected sources come from the TV itself, so the Inputs screen reflects what is actually
   * plugged in and how it is powered, not a fixed list of every port. */
  function loadInputs() {
    if (inputsLoading) return;
    inputsLoading = true;
    svc(
      'ssap',
      { uri: 'tv/getExternalInputList', clientKey: storedSsapKey() },
      function (res) {
        inputsLoading = false;
        if (!res || res.returnValue === false) {
          inputsFailed = true;
        } else {
          rememberSsapKey(res);
          var list = res.payload && res.payload.devices;
          externalInputs = Array.isArray(list) ? list.filter(function (d) {
            return d && d.appId;
          }) : [];
          inputsFailed = false;
        }
        if (overlayMode === 'inputs') renderOverlay();
      },
      function () {
        inputsLoading = false;
        inputsFailed = true;
        if (overlayMode === 'inputs') renderOverlay();
      }
    );
  }

  /* The TV reports a friendly name in subList when it recognises the device (a Switch, a console,
   * a set-top box). Prefer it over the generic "HDMI 3" label. */
  function inputName(d) {
    var sub = (d.subList && d.subList[0]) || null;
    var brand = sub && (sub.brandName || sub.labelName);
    if (brand) return brand;
    var label = String(d.label || '').trim();
    if (label && !/^hdmi[\s_-]*\d+$/i.test(label)) return label;
    return 'HDMI ' + (d.port || '');
  }

  function inputGroups() {
    var active = [];
    var linked = [];
    var off = [];

    (externalInputs || []).forEach(function (d) {
      var title = inputName(d);
      var portLabel = d.port ? 'HDMI ' + d.port : '';
      var item = {
        id: d.appId,
        title: title,
        sub: title === portLabel ? '' : portLabel,
        port: d.port || 0
      };
      var on = d.connected === true || d.hdmiSignalExist === true;
      var plugged = d.hdmiPlugIn === true || on;
      if (on) active.push(item);
      else if (plugged) linked.push(item);
      else off.push(item);
    });

    function byPort(a, b) { return a.port - b.port; }
    linked.sort(byPort);
    off.sort(byPort);
    active.push({ id: 'com.webos.app.livetv', title: 'Live TV', sub: 'Antenna / Cable' });

    return [
      { title: 'Active', items: active },
      { title: 'Connected', items: linked },
      { title: 'Not connected', items: off }
    ].filter(function (g) { return g.items.length > 0; });
  }

  function iconCandidates(url) {
    var out = [];
    if (!url) return out;
    out.push(url);
    try {
      var alt = new URL(url);
      alt.hostname = '127.0.0.1';
      out.push(alt.toString());
      var plain = new URL(url);
      plain.protocol = 'http:';
      out.push(plain.toString());
    } catch (e) {}
    return out;
  }

  function letterIcon(box, title) {
    box.classList.add('letter');
    box.style.background = colorFor(title);
    // Insert the letter rather than replace the box's contents: the pin badge is a child of
    // the same box and an icon URL failing after the badge was added must not wipe it.
    var letter = document.createTextNode(initial(title));
    if (box.firstChild) box.insertBefore(letter, box.firstChild);
    else box.appendChild(letter);
  }

  function makeIcon(item, mode) {
    var box = document.createElement('span');
    box.className = 'icon';

    if (mode === 'inputs') {
      box.innerHTML = INPUT_GLYPH;
      return box;
    }

    if (item.manage) {
      box.innerHTML = UTILITY_LOGOS.manage;
      return box;
    }

    if (item.glyph && UTILITY_LOGOS[item.glyph]) {
      box.innerHTML = UTILITY_LOGOS[item.glyph];
      return box;
    }

    var candidates = iconCandidates(item.icon);
    if (!candidates.length) {
      letterIcon(box, item.title || item.name);
      return box;
    }

    var img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    var n = 0;
    img.addEventListener('error', function () {
      n += 1;
      if (n < candidates.length) {
        img.src = candidates[n];
      } else {
        img.remove();
        letterIcon(box, item.title || item.name);
      }
    });
    img.src = candidates[0];
    box.appendChild(img);
    return box;
  }

  function addOverlayTile(item) {
    var i = overlayTiles.length;
    var b = document.createElement('button');
    b.className = 'app-tile';
    b.setAttribute('aria-label', item.title);

    var label = document.createElement('span');
    label.className = 'app-label';
    label.textContent = item.title;

    b.appendChild(makeIcon(item, overlayMode));
    b.appendChild(label);

    if (item.sub) {
      var sub = document.createElement('span');
      sub.className = 'app-sub';
      sub.textContent = item.sub;
      b.appendChild(sub);
    }

    b.addEventListener('click', function () {
      setOverlayFocus(i);
      launchOverlayItem(i);
    });
    b.addEventListener('mouseenter', function () {
      setOverlayFocus(i);
    });

    overlayGrid.appendChild(b);
    overlayTiles.push(b);
    overlayItems.push(item);
  }

  function addGroupHeader(text) {
    var h = document.createElement('div');
    h.className = 'input-group';
    h.setAttribute('aria-hidden', 'true');
    h.textContent = text;
    overlayGrid.appendChild(h);
  }

  function renderOverlay() {
    if (!overlayMode) return;

    overlayGrid.innerHTML = '';
    overlayTiles = [];
    overlayItems = [];

    if (overlayMode === 'apps') {
      overlayTitle.textContent = 'All apps';
      overlaySub.textContent = catalog.length
        ? catalog.length + ' installed'
        : catalogLoading
          ? 'Loading installed apps…'
          : 'No apps found';
      overlayGrid.className = 'apps';
      overlayItems = catalog.slice();
      overlayItems.push({ manage: true, title: 'Manage dock' });
    } else {
      overlayTitle.textContent = 'Inputs';
      overlayGrid.className = 'inputs';
      if (externalInputs && externalInputs.length) {
        overlaySub.textContent = 'Detected sources';
        inputGroups().forEach(function (group) {
          addGroupHeader(group.title);
          group.items.forEach(addOverlayTile);
        });
      } else {
        overlaySub.textContent = inputsLoading
          ? 'Detecting sources…'
          : inputsFailed
            ? 'Showing known inputs'
            : 'TV sources';
        inputItems().forEach(addOverlayTile);
      }
    }

    if (!overlayItems.length) {
      var empty = document.createElement('div');
      empty.className = 'overlay-empty';
      empty.textContent = overlayMode === 'apps' ? 'No apps found yet.' : 'No inputs found.';
      overlayGrid.appendChild(empty);
      return;
    }

    if (overlayMode === 'apps') {
      overlayItems.forEach(function (item, i) {
        var b = document.createElement('button');
        b.className = 'app-tile';
        b.setAttribute('aria-label', item.title);

        var label = document.createElement('span');
        label.className = 'app-label';
        label.textContent = item.title;

        b.appendChild(makeIcon(item, overlayMode));
        b.appendChild(label);

        b.addEventListener('click', function () {
          setOverlayFocus(i);
          launchOverlayItem(i);
        });
        b.addEventListener('mouseenter', function () {
          setOverlayFocus(i);
        });

        overlayGrid.appendChild(b);
        overlayTiles.push(b);
      });
    }

    if (overlayFocus >= overlayTiles.length) overlayFocus = overlayTiles.length - 1;
    applyOverlayFocus();
  }

  function openOverlay(mode) {
    overlayMode = mode;
    overlayFocus = 0;
    overlayEl.classList.add('open');
    overlayEl.setAttribute('aria-hidden', 'false');
    setHint('overlay');
    if (mode === 'inputs') loadInputs();
    renderOverlay();
  }

  function closeOverlay() {
    if (!overlayMode) return;
    overlayMode = null;
    overlayEl.classList.remove('open');
    overlayEl.setAttribute('aria-hidden', 'true');
    setHint('dock');
  }

  function gridColumns() {
    if (overlayMode === 'inputs') return 4;
    var tpl = getComputedStyle(overlayGrid).gridTemplateColumns;
    if (!tpl) return 1;
    return Math.max(1, tpl.split(' ').filter(Boolean).length);
  }

  function applyOverlayFocus() {
    overlayTiles.forEach(function (t, i) {
      t.classList.toggle('focused', i === overlayFocus);
    });
    var t = overlayTiles[overlayFocus];
    if (t && typeof t.scrollIntoView === 'function') {
      t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function setOverlayFocus(i) {
    if (!overlayTiles.length) return;
    overlayFocus = Math.max(0, Math.min(i, overlayTiles.length - 1));
    applyOverlayFocus();
  }

  function moveOverlay(dx, dy) {
    if (!overlayTiles.length) return;
    if (dx) {
      var next = overlayFocus + dx;
      if (next < 0) next = overlayTiles.length - 1;
      if (next >= overlayTiles.length) next = 0;
      setOverlayFocus(next);
    } else if (dy) {
      setOverlayFocus(overlayFocus + dy * gridColumns());
    }
  }

  function launchOverlayItem(i) {
    var item = overlayItems[i];
    if (!item) return;
    if (item.manage) {
      openManage('dock');
      return;
    }
    launchIds([item.id], item.title, item.params);
  }

  /* ---------- dock management ---------- */

  var MANAGE_ICONS = {
    add:
      '<svg class="uicon" viewBox="0 0 64 64" aria-hidden="true">' +
      '<path d="M32 13v38M13 32h38" fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round"/></svg>',
    reset:
      '<svg class="uicon" viewBox="0 0 64 64" aria-hidden="true">' +
      '<path d="M51 32a19 19 0 1 1-5.6-13.4" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round"/>' +
      '<path d="M47 11v10H37" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    done:
      '<svg class="uicon" viewBox="0 0 64 64" aria-hidden="true">' +
      '<path d="M14 33l12 12 24-27" fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var MANAGE_ACTIONS = [
    { key: 'add', label: 'Add apps', icon: 'add' },
    { key: 'reset', label: 'Reset dock', icon: 'reset' },
    { key: 'done', label: 'Done', icon: 'done' }
  ];

  function openManage(view) {
    overlayMode = 'manage';
    manageView = view || 'dock';
    manageFocus = 0;
    manageResetArm = false;
    clearTimeout(manageResetTimer);
    overlayEl.classList.add('open');
    overlayEl.setAttribute('aria-hidden', 'false');
    renderManage();
  }

  function applyManageFocus() {
    manageTiles.forEach(function (t, i) {
      t.classList.toggle('focused', i === manageFocus);
    });
    var t = manageTiles[manageFocus];
    if (t && typeof t.scrollIntoView === 'function') {
      t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function setManageFocus(i) {
    if (!manageTiles.length) return;
    manageFocus = Math.max(0, Math.min(i, manageTiles.length - 1));
    applyManageFocus();
  }

  function moveManageGrid(dx, dy) {
    if (!manageTiles.length) return;
    if (dx) {
      var next = manageFocus + dx;
      if (next < 0) next = manageTiles.length - 1;
      if (next >= manageTiles.length) next = 0;
      setManageFocus(next);
    } else if (dy) {
      setManageFocus(manageFocus + dy * gridColumns());
    }
  }

  function unpinAt(i) {
    var fav = favorites[i];
    if (!fav) return;
    favorites.splice(i, 1);
    saveDockConfig();
    rebuildDock();
    if (manageView === 'dock' && manageFocus >= favorites.length) {
      manageFocus = Math.max(0, favorites.length - 1);
    }
    renderManage();
    toast('Removed ' + fav.name + ' from the dock.');
  }

  function togglePin(item) {
    var idx = pinnedIndex(item);
    if (idx !== -1) {
      unpinAt(idx);
      return;
    }
    if (favorites.length >= MAX_DOCK) {
      toast('Dock is full — unpin an app first (' + MAX_DOCK + ' max).');
      return;
    }
    favorites.push({
      key: favoriteKey(item),
      name: item.title || item.name || 'App',
      ids: favoriteIds(item),
      icon: item.icon || '',
      params: normParams(item.params)
    });
    saveDockConfig();
    rebuildDock();
    renderManage();
    toast('Pinned ' + (item.title || item.name) + '.');
  }

  function activateManageAction(i) {
    var act = MANAGE_ACTIONS[i];
    if (!act) return;

    if (act.key === 'add') {
      manageResetArm = false;
      clearTimeout(manageResetTimer);
      openManage('picker');
      return;
    }

    if (act.key === 'done') {
      openOverlay('apps');
      return;
    }

    if (!manageResetArm) {
      manageResetArm = true;
      clearTimeout(manageResetTimer);
      manageResetTimer = setTimeout(function () {
        manageResetArm = false;
        if (overlayMode === 'manage' && manageView === 'dock') renderManage();
      }, 3200);
      toast('Press OK again to reset the dock.');
      renderManage();
      return;
    }

    manageResetArm = false;
    clearTimeout(manageResetTimer);
    favorites = defaultFavorites.map(cloneFavorite);
    clearDockConfig();
    saveDockConfig();
    manageFocus = 0;
    rebuildDock();
    renderManage();
    toast('Dock reset to defaults.');
  }

  function renderManage() {
    overlayGrid.innerHTML = '';
    manageTiles = [];
    overlaySub.textContent = favorites.length + ' of ' + MAX_DOCK + ' pinned';

    if (manageView === 'picker') {
      overlayTitle.textContent = 'Add apps';
      overlayGrid.className = 'apps';
      setHint('picker');

      if (!catalog.length) {
        var empty = document.createElement('div');
        empty.className = 'overlay-empty';
        empty.textContent = catalogLoading ? 'Loading installed apps…' : 'No apps found yet.';
        overlayGrid.appendChild(empty);
        return;
      }

      catalog.forEach(function (item, i) {
        var b = document.createElement('button');
        b.className = 'app-tile';
        b.setAttribute('aria-label', item.title);

        var icon = makeIcon(item, 'apps');
        if (pinnedIndex(item) !== -1) {
          var badge = document.createElement('span');
          badge.className = 'pin-badge';
          badge.textContent = '\u2713';
          icon.appendChild(badge);
        }

        var label = document.createElement('span');
        label.className = 'app-label';
        label.textContent = item.title;

        b.appendChild(icon);
        b.appendChild(label);

        b.addEventListener('click', function () {
          setManageFocus(i);
          togglePin(item);
        });
        b.addEventListener('mouseenter', function () {
          setManageFocus(i);
        });

        overlayGrid.appendChild(b);
        manageTiles.push(b);
      });

      if (manageFocus >= manageTiles.length) manageFocus = manageTiles.length - 1;
      applyManageFocus();
      return;
    }

    overlayTitle.textContent = 'Manage dock';
    overlayGrid.className = 'manage';
    setHint('manage');

    var dockSection = document.createElement('div');
    dockSection.className = 'manage-section';

    var dockLabel = document.createElement('div');
    dockLabel.className = 'manage-label';
    dockLabel.textContent = 'On the dock · ' + favorites.length + ' of ' + MAX_DOCK;

    var dockRow = document.createElement('div');
    dockRow.className = 'manage-row';

    dockSection.appendChild(dockLabel);
    dockSection.appendChild(dockRow);

    if (!favorites.length) {
      var none = document.createElement('div');
      none.className = 'manage-empty';
      none.textContent = 'The dock is empty — choose “Add apps” below.';
      dockRow.appendChild(none);
    }

    favorites.forEach(function (fav, i) {
      var b = document.createElement('button');
      b.className = 'app-tile';
      b.dataset.app = fav.key;
      b.setAttribute('aria-label', fav.name);

      var icon;
      if (LOGOS[fav.key]) {
        icon = document.createElement('span');
        icon.className = 'icon';
        icon.innerHTML = LOGOS[fav.key];
      } else {
        icon = makeIcon({ title: fav.name, icon: fav.icon }, 'dock');
      }

      var order = document.createElement('span');
      order.className = 'manage-order';
      order.textContent = String(i + 1);

      var label = document.createElement('span');
      label.className = 'app-label';
      label.textContent = fav.name;

      b.appendChild(icon);
      b.appendChild(order);
      b.appendChild(label);

      b.addEventListener('click', function () {
        setManageFocus(i);
        unpinAt(i);
      });
      b.addEventListener('mouseenter', function () {
        setManageFocus(i);
      });

      dockRow.appendChild(b);
      manageTiles.push(b);
    });

    overlayGrid.appendChild(dockSection);

    var actionSection = document.createElement('div');
    actionSection.className = 'manage-section';

    var actionLabel = document.createElement('div');
    actionLabel.className = 'manage-label';
    actionLabel.textContent = 'Actions';

    var actionRow = document.createElement('div');
    actionRow.className = 'manage-row actions';

    actionSection.appendChild(actionLabel);
    actionSection.appendChild(actionRow);

    MANAGE_ACTIONS.forEach(function (act, i) {
      var armed = act.key === 'reset' && manageResetArm;
      var b = document.createElement('button');
      b.className = 'app-tile' + (armed ? ' armed' : '');
      b.setAttribute('aria-label', armed ? 'Press OK again to reset' : act.label);

      var icon = document.createElement('span');
      icon.className = 'icon';
      icon.innerHTML = MANAGE_ICONS[act.icon];

      var label = document.createElement('span');
      label.className = 'app-label';
      label.textContent = armed ? 'Press OK again' : act.label;

      b.appendChild(icon);
      b.appendChild(label);

      b.addEventListener('click', function () {
        setManageFocus(favorites.length + i);
        activateManageAction(i);
      });
      b.addEventListener('mouseenter', function () {
        setManageFocus(favorites.length + i);
      });

      actionRow.appendChild(b);
      manageTiles.push(b);
    });

    overlayGrid.appendChild(actionSection);

    if (manageFocus >= manageTiles.length) manageFocus = manageTiles.length - 1;
    applyManageFocus();
  }

  function manageKey(k) {
    if (k === 461 || k === 27) {
      if (manageView === 'picker') openManage('dock');
      else openOverlay('apps');
      return true;
    }

    if (manageView === 'picker') {
      if (k === 37) { moveManageGrid(-1, 0); return true; }
      if (k === 39) { moveManageGrid(1, 0); return true; }
      if (k === 38) { moveManageGrid(0, -1); return true; }
      if (k === 40) { moveManageGrid(0, 1); return true; }
      if (k === 13 || k === 415) {
        var item = catalog[manageFocus];
        if (item) togglePin(item);
        return true;
      }
      return false;
    }

    var dockCount = favorites.length;
    var inDock = manageFocus < dockCount;

    if (k === 37) {
      if (inDock && manageFocus > 0) {
        var prev = favorites[manageFocus - 1];
        favorites[manageFocus - 1] = favorites[manageFocus];
        favorites[manageFocus] = prev;
        manageFocus -= 1;
        saveDockConfig();
        rebuildDock();
        renderManage();
      } else if (!inDock) {
        setManageFocus(manageFocus - 1);
      }
      return true;
    }

    if (k === 39) {
      if (inDock && manageFocus < dockCount - 1) {
        var next = favorites[manageFocus + 1];
        favorites[manageFocus + 1] = favorites[manageFocus];
        favorites[manageFocus] = next;
        manageFocus += 1;
        saveDockConfig();
        rebuildDock();
        renderManage();
      } else if (inDock) {
        setManageFocus(dockCount);
      } else {
        setManageFocus(manageFocus + 1);
      }
      return true;
    }

    if (k === 38) {
      if (inDock) setManageFocus(dockCount);
      else setManageFocus(Math.max(0, dockCount - 1));
      return true;
    }

    if (k === 40) {
      if (inDock) setManageFocus(dockCount);
      return true;
    }

    if (k === 13 || k === 415) {
      if (inDock) unpinAt(manageFocus);
      else activateManageAction(manageFocus - dockCount);
      return true;
    }

    return false;
  }

  /* ---------- toast / hint ---------- */

  var toastTimer = null;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, ms || 3400);
  }

  var hintTimer = null;
  function setHint(mode) {
    if (mode === 'manage') {
      hintEl.innerHTML =
        '&#8592; &#8594; REORDER <span class="sep">&middot;</span> OK UNPIN ' +
        '<span class="sep">&middot;</span> &#8593; &#8595; ACTIONS ' +
        '<span class="sep">&middot;</span> BACK DONE';
    } else if (mode === 'picker') {
      hintEl.innerHTML =
        'ARROWS MOVE <span class="sep">&middot;</span> OK PIN/UNPIN ' +
        '<span class="sep">&middot;</span> BACK DONE';
    } else if (mode === 'overlay') {
      hintEl.innerHTML =
        'ARROWS MOVE <span class="sep">&middot;</span> OK OPEN <span class="sep">&middot;</span> BACK CLOSE';
    } else {
      hintEl.innerHTML =
        '&#8592; &#8594; SELECT <span class="sep">&middot;</span> OK OPEN ' +
        '<span class="sep">&middot;</span> &#8593; &#8595; WALLPAPER ' +
        '<span class="sep">&middot;</span> BACK EXIT';
    }
    hintEl.style.opacity = '1';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      hintEl.style.opacity = '0.16';
    }, 12000);
  }

  /* ---------- remote ---------- */

  function exitApp() {
    try {
      window.close();
    } catch (e) {}
    setTimeout(function () {
      try {
        if (window.PalmSystem && typeof PalmSystem.close === 'function') PalmSystem.close();
      } catch (e) {}
    }, 120);
  }

  window.addEventListener(
    'keydown',
    function (e) {
      var k = e.keyCode || e.which;
      var handled = true;

      if (overlayMode === 'manage') {
        handled = manageKey(k);
      } else if (overlayMode) {
        if (k === 37) {
          moveOverlay(-1, 0);
        } else if (k === 39) {
          moveOverlay(1, 0);
        } else if (k === 38) {
          moveOverlay(0, -1);
        } else if (k === 40) {
          moveOverlay(0, 1);
        } else if (k === 13 || k === 415) {
          launchOverlayItem(overlayFocus);
        } else if (k === 461 || k === 27) {
          closeOverlay();
        } else {
          handled = false;
        }
      } else {
        if (k === 37) {
          setDockFocus(dockFocus - 1);
        } else if (k === 39) {
          setDockFocus(dockFocus + 1);
        } else if (k === 38) {
          showWall(wallIndex + 1);
        } else if (k === 40) {
          showWall(wallIndex - 1);
        } else if (k === 13 || k === 415) {
          activateDock(dockFocus);
        } else if (k === 461 || k === 27) {
          exitApp();
        } else {
          handled = false;
        }
      }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  overlayEl.addEventListener('click', function (e) {
    if (e.target === overlayEl) closeOverlay();
  });

  /* ---------- boot ---------- */

  rebuildDock();
  setDockFocus(0);
  tick();
  setHint('dock');
  loadCatalog();

  // Allow deep-link style launches for testing:
  //   ssap.js launch com.fdear.prolewebos '{"params":{"view":"apps"}}'
  try {
    var raw = window.PalmSystem && window.PalmSystem.launchParams;
    var params = raw ? JSON.parse(raw) : null;
    if (params && (params.view === 'apps' || params.view === 'inputs' || params.view === 'manage')) {
      setTimeout(function () {
        if (params.view === 'manage') openManage('dock');
        else openOverlay(params.view);
      }, 500);
    }
  } catch (e) {}
})();
