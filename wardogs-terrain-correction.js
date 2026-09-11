/* Terrain height correction for SPH-2 (data from wardogs.t0ki.cn). Opt-in. */
window.TerrainCorrection = (function () {
  'use strict';

  var DATA_BASE = 'https://wardogs.t0ki.cn/';
  var CONFIG_URL = DATA_BASE + 'data/ballistics/terrain-context.json';
  var WEAPON_ID = 'spg';

  var state = {
    initialized: false,
    available: false,
    enabled: false,
    ready: false,
    loading: false,
    config: null,
    payloads: { lowMain: null, lowExtension: null, highV2: null },
    terrains: new Map(),
    lastError: null
  };

  function finite(v) { return typeof v === 'number' && isFinite(v); }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function log() { if (window.console) console.info('[terrain-correction]', Array.prototype.slice.call(arguments)); }

  // ---------------- 工具:JSON 加载 ----------------
  // 允许浏览器与 CDN 缓存(减轻源站负担);数据更新需走 CDN 刷新/版本号
  async function fetchJson(url) {
    if (!/^https?:/i.test(url)) url = new URL(url, DATA_BASE).href;
    var r = await fetch(url, { cache: 'default', mode: 'cors' });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
    return r.json();
  }

  // ---------------- 地形采样(移植 terrain-ballistics.js) ----------------
  function landscapeQuadsPerGameUnit(manifest, axis) {
    var specific = Number(manifest['gameUnitsToLandscapeQuads' + axis]);
    if (finite(specific) && specific !== 0) return specific;
    return Number(manifest.gameUnitsToLandscapeQuads);
  }
  function withinCoverage(gx, gy, manifest) {
    var c = manifest.coverage;
    if (!c) return true;
    var e = 1e-7;
    return gx >= c.gameXMin - e && gx <= c.gameXMax + e && gy >= c.gameYMin - e && gy <= c.gameYMax + e;
  }
  function locateTerrainPoint(terrain, point) {
    var m = terrain.manifest;
    var gx = Number(point.x), gy = Number(point.y);
    if (!withinCoverage(gx, gy, m)) return null;
    var quadX = Number(m.globalQuadOffsetX) + gx * landscapeQuadsPerGameUnit(m, 'X');
    var quadY = Number(m.globalQuadOffsetY) + gy * landscapeQuadsPerGameUnit(m, 'Y');
    var cq = Number(m.chunkQuads);
    var chunkX = clamp(Math.floor(quadX / cq), Number(m.chunkXMin), Number(m.chunkXMax));
    var chunkY = clamp(Math.floor(quadY / cq), Number(m.chunkYMin), Number(m.chunkYMax));
    return {
      chunkX: chunkX, chunkY: chunkY,
      localX: clamp(quadX - chunkX * cq, 0, cq),
      localY: clamp(quadY - chunkY * cq, 0, cq),
      key: chunkX + ',' + chunkY
    };
  }
  function chunkEntry(terrain, key) { return terrain.manifest.chunks ? terrain.manifest.chunks[key] : null; }
  async function loadChunk(terrain, key) {
    if (terrain.chunkCache.has(key)) return terrain.chunkCache.get(key);
    if (terrain.chunkPending.has(key)) return terrain.chunkPending.get(key);
    var entry = chunkEntry(terrain, key);
    if (!entry) throw new Error('chunk missing ' + terrain.mapId + ':' + key);
    var promise = (async function () {
      var resp = await fetch(new URL(entry.file, terrain.manifestUrl).href, { cache: 'default' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var buf = await resp.arrayBuffer();
      var chunk = { entry: entry, view: new DataView(buf) };
      terrain.chunkCache.set(key, chunk);
      return chunk;
    })();
    terrain.chunkPending.set(key, promise);
    try { return await promise; } finally { terrain.chunkPending.delete(key); }
  }
  function rawHeightAt(terrain, chunk, x, y) {
    var side = Number(terrain.manifest.verticesPerSide);
    return chunk.view.getUint16((y * side + x) * 2, true);
  }
  function decodeRawHeight(terrain, raw, entry) {
    var lo = Number(entry.minLocalZ), hi = Number(entry.maxLocalZ);
    if (!finite(lo) || !finite(hi)) return null;
    var localZ = lo + (raw / 65535) * (hi - lo);
    return Number(terrain.manifest.worldZOffsetMeters) + localZ * Number(terrain.manifest.worldZScaleMetersPerLocalUnit);
  }
  function terrainHeightAtPointSync(terrain, point) {
    var loc = locateTerrainPoint(terrain, point);
    if (!loc) return null;
    var chunk = terrain.chunkCache.get(loc.key);
    if (!chunk) return null;
    var mv = Number(terrain.manifest.verticesPerSide) - 1;
    var x0 = clamp(Math.floor(loc.localX), 0, mv), y0 = clamp(Math.floor(loc.localY), 0, mv);
    var x1 = clamp(x0 + 1, 0, mv), y1 = clamp(y0 + 1, 0, mv);
    var fx = loc.localX - x0, fy = loc.localY - y0;
    var z00 = decodeRawHeight(terrain, rawHeightAt(terrain, chunk, x0, y0), chunk.entry);
    var z10 = decodeRawHeight(terrain, rawHeightAt(terrain, chunk, x1, y0), chunk.entry);
    var z01 = decodeRawHeight(terrain, rawHeightAt(terrain, chunk, x0, y1), chunk.entry);
    var z11 = decodeRawHeight(terrain, rawHeightAt(terrain, chunk, x1, y1), chunk.entry);
    if (![z00, z10, z01, z11].every(finite)) return null;
    var top = z00 + (z10 - z00) * fx, bottom = z01 + (z11 - z01) * fx;
    return top + (bottom - top) * fy;
  }

  // ---------------- 通用插值 ----------------
  function sparseInterval(nodes, value) {
    if (!Array.isArray(nodes) || nodes.length < 2) return -1;
    if (value < Number(nodes[0]) || value > Number(nodes[nodes.length - 1])) return -1;
    if (value === Number(nodes[nodes.length - 1])) return nodes.length - 2;
    var lo = 0, hi = nodes.length - 1;
    while (lo + 1 < hi) { var mid = (lo + hi) >> 1; if (Number(nodes[mid]) <= value) lo = mid; else hi = mid; }
    return lo;
  }
  function interpolateSeries(nodes, values, x) {
    var i = sparseInterval(nodes, x);
    if (i < 0 || !Array.isArray(values) || values.length !== nodes.length) return null;
    var x0 = Number(nodes[i]), x1 = Number(nodes[i + 1]);
    var f = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
    return Number(values[i]) + (Number(values[i + 1]) - Number(values[i])) * f;
  }
  function interpolateSparseSegment(segment, distance) {
    var nodes = segment ? segment.distanceNodes : null;
    var mins = segment ? segment.minDeltaZMeters : null;
    var maxs = segment ? segment.maxDeltaZMeters : null;
    var i = sparseInterval(nodes, distance);
    if (i < 0) return null;
    var d0 = Number(nodes[i]), d1 = Number(nodes[i + 1]);
    var f = d1 === d0 ? 0 : (distance - d0) / (d1 - d0);
    return {
      minDeltaZM: Number(mins[i]) + (Number(mins[i + 1]) - Number(mins[i])) * f,
      maxDeltaZM: Number(maxs[i]) + (Number(maxs[i + 1]) - Number(maxs[i])) * f
    };
  }

  // ---------------- 低弧主表 ----------------
  function lowMainInterval(nodes, distance) { return sparseInterval(nodes, distance); }
  function lowMainEnvelope(payload, boundaryIndex, distance) {
    var rep = payload.representation;
    var nodes = rep.distanceNodes;
    var mins = rep.minDeltaZMetersByBoundary[boundaryIndex];
    var maxs = rep.maxDeltaZMetersByBoundary[boundaryIndex];
    var interval = lowMainInterval(nodes, distance);
    if (interval < 0) return null;
    var d0 = Number(nodes[interval]), d1 = Number(nodes[interval + 1]);
    var f = d1 === d0 ? 0 : (distance - d0) / (d1 - d0);
    return {
      minDeltaZM: Number(mins[interval]) + (Number(mins[interval + 1]) - Number(mins[interval])) * f,
      maxDeltaZM: Number(maxs[interval]) + (Number(maxs[interval + 1]) - Number(maxs[interval])) * f
    };
  }
  function resolveLowMain(payload, distanceM, flatMrad, deltaZM) {
    var distance = Number(distanceM), flat = Number(flatMrad), dz = Number(deltaZM);
    if (![distance, flat, dz].every(finite)) return { status: 'fallback', reason: 'non-finite-input' };
    var domain = payload && payload.domain;
    var selectable = payload && payload.selectableCommandMrad;
    var rep = payload && payload.representation;
    if (!domain || !rep || !Array.isArray(selectable) || selectable.length !== 2) return { status: 'fallback', reason: 'invalid-payload' };
    if (distance < domain.distanceMinMeters || distance > domain.distanceMaxMeters ||
        flat < domain.flatMilMin || flat > domain.flatMilMax ||
        dz < domain.deltaZMinMeters || dz > domain.deltaZMaxMeters) return { status: 'fallback', reason: 'outside-supported-domain' };
    var boundaries = rep.boundariesMrad;
    var guard = Number(rep.guardMeters);
    var first = lowMainEnvelope(payload, 0, distance);
    if (!first || !finite(guard)) return { status: 'fallback', reason: 'invalid-payload' };
    if (dz <= first.maxDeltaZM + guard) return { status: 'fallback', reason: 'below-minimum-selectable-command' };
    var lastCrossed = null;
    for (var i = 0; i < boundaries.length; i++) {
      var env = lowMainEnvelope(payload, i, distance);
      if (!env) return { status: 'fallback', reason: 'missing-boundary-envelope' };
      var gmin = env.minDeltaZM - guard, gmax = env.maxDeltaZM + guard;
      if (dz >= gmin && dz <= gmax) return { status: 'fallback', reason: 'family-boundary-envelope', boundaryMrad: boundaries[i] };
      if (dz > gmax) { lastCrossed = boundaries[i]; continue; }
      if (dz < gmin) break;
    }
    if (lastCrossed === null) return { status: 'fallback', reason: 'no-supported-command-bin' };
    var commandMrad = Number(lastCrossed) + 5;
    if (commandMrad < selectable[0] || commandMrad > selectable[1]) return { status: 'fallback', reason: 'outside-selectable-command-range' };
    return { status: 'ok', commandMrad: commandMrad };
  }

  // ---------------- 低弧尾段/顶点 ----------------
  function lowExtensionEnvelope(region, boundary, distance, flatMrad) {
    for (var s = 0; s < (boundary.segments || []).length; s++) {
      var v = interpolateSparseSegment(boundary.segments[s], distance);
      if (v) return v;
    }
    var clip = Number(region.clipMeters);
    if (!finite(clip) || !(clip > 0)) return null;
    if (boundary.boundaryMrad < flatMrad) return { minDeltaZM: -clip, maxDeltaZM: -clip };
    if (boundary.boundaryMrad > flatMrad) return { minDeltaZM: clip, maxDeltaZM: clip };
    return null;
  }
  function chooseLowExtensionRegion(payload, distance) {
    var tail = payload.regions.tail, apex = payload.regions.apex;
    if (tail && distance >= Number(tail.distanceMinMeters) && distance <= Number(tail.distanceMaxMeters)) return tail;
    if (apex && distance >= Number(apex.distanceMinMeters) && distance <= Number(apex.distanceMaxMeters)) return apex;
    return null;
  }
  function resolveLowExtension(payload, distanceM, flatMrad, deltaZM) {
    var distance = Number(distanceM), flat = Number(flatMrad), dz = Number(deltaZM);
    if (![distance, flat, dz].every(finite)) return { status: 'fallback', reason: 'non-finite-input' };
    var domain = payload && payload.domain;
    var selectable = payload && payload.selectableCommandMrad;
    if (!domain || !Array.isArray(selectable) || selectable.length !== 2) return { status: 'fallback', reason: 'invalid-payload' };
    if (distance < domain.distanceMinMeters || distance > domain.distanceMaxMeters ||
        dz < domain.deltaZMinMeters || dz > domain.deltaZMaxMeters) return { status: 'fallback', reason: 'outside-supported-domain' };
    var reachability = interpolateSeries(payload.reachability.distanceNodes, payload.reachability.maxPositiveDeltaZMeters, distance);
    var reachGuard = Number(payload.reachability.guardMeters);
    if (!finite(reachability) || !finite(reachGuard)) return { status: 'fallback', reason: 'missing-reachability' };
    if (dz > reachability + reachGuard) return { status: 'unreachable', reason: 'terrain-adjusted-low-unreachable', reachabilityDeltaZM: reachability };
    if (dz >= reachability - reachGuard) return { status: 'fallback', reason: 'reachability-boundary', reachabilityDeltaZM: reachability };
    var region = chooseLowExtensionRegion(payload, distance);
    if (!region) return { status: 'fallback', reason: 'outside-supported-domain' };
    var guard = Number(region.guardMeters);
    var lastCrossed = null;
    for (var i = 0; i < region.boundaries.length; i++) {
      var b = region.boundaries[i];
      var env = lowExtensionEnvelope(region, b, distance, flat);
      if (!env) return { status: 'fallback', reason: 'missing-boundary-envelope' };
      var gmin = env.minDeltaZM - guard, gmax = env.maxDeltaZM + guard;
      if (dz >= gmin && dz <= gmax) return { status: 'fallback', reason: 'family-boundary-envelope', boundaryMrad: b.boundaryMrad };
      if (dz > gmax) { lastCrossed = Number(b.boundaryMrad); continue; }
      if (dz < gmin) break;
    }
    if (lastCrossed === null) return { status: 'fallback', reason: 'below-minimum-selectable-command' };
    var commandMrad = lastCrossed + 5;
    if (commandMrad < selectable[0] || commandMrad > selectable[1]) return { status: 'fallback', reason: 'outside-selectable-command-range' };
    return { status: 'ok', commandMrad: commandMrad, region: distance <= Number(payload.regions.tail.distanceMaxMeters) ? 'tail' : 'apex' };
  }

  // ---------------- 高弧 ----------------
  function highEnvelope(payload, boundary, distance, flatMrad) {
    for (var s = 0; s < (boundary.segments || []).length; s++) {
      var v = interpolateSparseSegment(boundary.segments[s], distance);
      if (v) return v;
    }
    var clip = Number(payload.representation.clipMeters);
    if (!finite(clip) || !(clip > 0)) return null;
    if (boundary.boundaryMrad < flatMrad) return { minDeltaZM: clip, maxDeltaZM: clip };
    if (boundary.boundaryMrad > flatMrad) return { minDeltaZM: -clip, maxDeltaZM: -clip };
    return null;
  }
  function resolveHigh(payload, distanceM, flatMrad, deltaZM) {
    var distance = Number(distanceM), flat = Number(flatMrad), dz = Number(deltaZM);
    if (![distance, flat, dz].every(finite)) return { status: 'fallback', reason: 'non-finite-input' };
    var domain = payload && payload.domain;
    var rep = payload && payload.representation;
    var selectable = payload && payload.selectableCommandMrad;
    if (!domain || !rep || !Array.isArray(selectable) || selectable.length !== 2) return { status: 'fallback', reason: 'invalid-payload' };
    if (distance < domain.distanceMinMeters || distance > domain.distanceMaxMeters ||
        dz < domain.deltaZMinMeters || dz > domain.deltaZMaxMeters) return { status: 'fallback', reason: 'outside-supported-domain' };
    var guard = Number(rep.guardMeters);
    for (var i = 0; i < rep.boundaries.length; i++) {
      var b = rep.boundaries[i];
      var env = highEnvelope(payload, b, distance, flat);
      if (!env) return { status: 'fallback', reason: 'missing-boundary-envelope' };
      var gmin = env.minDeltaZM - guard, gmax = env.maxDeltaZM + guard;
      if (dz >= gmin && dz <= gmax) return { status: 'fallback', reason: 'family-boundary-envelope', boundaryMrad: b.boundaryMrad };
      if (dz > gmax) {
        var commandMrad = Number(b.boundaryMrad) - 5;
        if (commandMrad < selectable[0] || commandMrad > selectable[1]) return { status: 'fallback', reason: 'outside-selectable-command-range' };
        return { status: 'ok', commandMrad: commandMrad };
      }
    }
    return { status: 'fallback', reason: 'above-maximum-selectable-command' };
  }

  // ---------------- 编排 ----------------
  function flatCommand(solution) {
    if (!solution) return null;
    var v = Number(solution.mils != null ? solution.mils : solution.mil);
    return finite(v) ? v : null;
  }
  function normalizeCandidate(result, tableSolution) {
    var tableMrad = flatCommand(tableSolution);
    if (!tableSolution) return null;
    if (!finite(tableMrad)) return { status: 'OUTSIDE_CERTIFIED_DOMAIN', reason: 'ambiguous-flat-table-command', tableMrad: null, commandMrad: null, deltaMrad: null, applied: false };
    if (result && result.status === 'ok' && finite(result.commandMrad)) {
      var cmd = Number(result.commandMrad);
      return { status: 'SAFE_CONSENSUS', reason: result.reason || null, tableMrad: tableMrad, commandMrad: cmd, deltaMrad: cmd - tableMrad, boundaryMrad: result.boundaryMrad || null, region: result.region || null, applied: false };
    }
    if (result && result.status === 'unreachable') {
      return { status: 'TERRAIN_ADJUSTED_UNREACHABLE', reason: result.reason || 'terrain-adjusted-unreachable', tableMrad: tableMrad, commandMrad: null, deltaMrad: null, reachabilityDeltaZM: result.reachabilityDeltaZM || null, applied: false };
    }
    return { status: result && result.reason === 'family-boundary-envelope' ? 'FAMILY_DISAGREEMENT' : 'OUTSIDE_CERTIFIED_DOMAIN', reason: (result && result.reason) || 'no-safe-candidate', tableMrad: tableMrad, commandMrad: null, deltaMrad: null, boundaryMrad: result && result.boundaryMrad || null, reachabilityDeltaZM: result && result.reachabilityDeltaZM || null, applied: false };
  }
  function resolveArcCandidates(distance, deltaZ, solutions) {
    var d = Number(distance), dz = Number(deltaZ);
    if (!finite(d) || !finite(dz) || !solutions) return null;
    var low = null, high = null;
    if (solutions.low) {
      var flat = flatCommand(solutions.low);
      if (!finite(flat)) low = normalizeCandidate(null, solutions.low);
      else if (d <= 2439) low = normalizeCandidate(resolveLowMain(state.payloads.lowMain, d, flat, dz), solutions.low);
      else low = normalizeCandidate(resolveLowExtension(state.payloads.lowExtension, d, flat, dz), solutions.low);
    }
    if (solutions.high) {
      var flatH = flatCommand(solutions.high);
      high = finite(flatH) ? normalizeCandidate(resolveHigh(state.payloads.highV2, d, flatH, dz), solutions.high) : normalizeCandidate(null, solutions.high);
    }
    if (!low && !high) return null;
    return { low: low, high: high };
  }
  function cloneSolutions(solutions) {
    return {
      inRange: Boolean(solutions && solutions.inRange),
      single: solutions && solutions.single ? Object.assign({}, solutions.single) : null,
      low: solutions && solutions.low ? Object.assign({}, solutions.low) : null,
      high: solutions && solutions.high ? Object.assign({}, solutions.high) : null
    };
  }
  function applySafeCandidates(solutions, arcs) {
    if (!state.enabled || !solutions || !arcs) return { solutions: solutions, applied: false, method: null };
    var safe = ['low', 'high'].filter(function (arc) {
      return solutions[arc] && arcs[arc] && arcs[arc].status === 'SAFE_CONSENSUS' && finite(arcs[arc].commandMrad);
    });
    if (!safe.length) return { solutions: solutions, applied: false, method: null };
    var next = cloneSolutions(solutions);
    for (var i = 0; i < safe.length; i++) {
      var arc = safe[i];
      var cmd = Number(arcs[arc].commandMrad);
      next[arc] = Object.assign({}, next[arc], { mils: cmd, mil: cmd });
      arcs[arc].applied = true;
    }
    return { solutions: next, applied: true, method: 'safe-consensus' };
  }

  // ---------------- 初始化 / payloads ----------------
  async function loadTerrainDefinitions(config) {
    var maps = config.terrainMaps || {};
    for (var mapId in maps) {
      var def = maps[mapId];
      var manifestPath = typeof def === 'string' ? def : (def && def.terrainManifest);
      if (!mapId || !manifestPath) continue;
      try {
        var manifest = await fetchJson(manifestPath);
        state.terrains.set(mapId, {
          mapId: mapId, manifest: manifest,
          manifestUrl: new URL(manifestPath, DATA_BASE).href,
          chunkCache: new Map(), chunkPending: new Map()
        });
        log('terrain loaded', mapId);
      } catch (e) { /* 单图失败不影响其它图 */ }
    }
  }
  var payloadPromise = null;
  async function ensurePayloads() {
    if (state.ready) return true;
    if (payloadPromise) return payloadPromise;
    var p = state.config && state.config.payloads;
    if (!p) return false;
    state.loading = true;
    payloadPromise = (async function () {
      try {
        var lm = await fetchJson(p.lowMain.url);
        var le = await fetchJson(p.lowExtension.url);
        var hv = await fetchJson(p.highV2.url);
        state.payloads = { lowMain: lm, lowExtension: le, highV2: hv };
        state.ready = true;
        state.lastError = null;
        return true;
      } catch (e) {
        state.ready = false;
        state.lastError = e;
        return false;
      } finally {
        state.loading = false;
        payloadPromise = null;
      }
    })();
    return payloadPromise;
  }
  async function init() {
    if (state.initialized) return state.available;
    state.initialized = true;
    try {
      var config = await fetchJson(CONFIG_URL);
      var exp = config && config.experimentalCorrection;
      state.available = Boolean(exp && exp.available);
      state.config = exp || null;
      if (!state.available) return false;
      state.enabled = false; // 默认关闭
      await loadTerrainDefinitions(config);
      return true;
    } catch (e) {
      state.available = false;
      state.enabled = false;
      state.lastError = e;
      return false;
    }
  }
  function setEnabled(b) {
    state.enabled = Boolean(b);
    if (state.enabled && !state.ready) ensurePayloads();
  }
  function isEnabled() { return Boolean(state.enabled); }

  // ---------------- 主入口:修正一次射击解 ----------------
  // origin/target 为米(0-16384);地形 manifest 使用游戏单位(0-163.2,1 单位=100m)
  var METERS_PER_GAME_UNIT = 100;
  function toGameUnits(p) {
    return { x: Number(p.x) / METERS_PER_GAME_UNIT, y: Number(p.y) / METERS_PER_GAME_UNIT };
  }

  async function correct(mapId, weaponId, origin, target, distanceM, solutions) {
    var fb = function (reason) { return { solutions: solutions, applied: false, deltaZ: null, arcs: null, reason: reason }; };
    if (weaponId !== WEAPON_ID || !state.enabled) return fb('disabled');
    if (!state.available) return fb('feature-unavailable');
    await ensurePayloads();
    if (!state.ready) return fb('payloads-not-ready');
    var terrain = state.terrains.get(mapId);
    if (!terrain) return fb('terrain-unavailable');
    var o = toGameUnits(origin), t = toGameUnits(target);
    var ol = locateTerrainPoint(terrain, o);
    var tl = locateTerrainPoint(terrain, t);
    if (!ol || !tl) return fb('out-of-coverage');
    try {
      await Promise.all([loadChunk(terrain, ol.key), loadChunk(terrain, tl.key)]);
    } catch (e) {
      return fb('terrain-load-failed');
    }
    var oz = terrainHeightAtPointSync(terrain, o);
    var tz = terrainHeightAtPointSync(terrain, t);
    if (!finite(oz) || !finite(tz)) return fb('height-sample-failed');
    var deltaZ = tz - oz;
    var arcs = resolveArcCandidates(distanceM, deltaZ, solutions);
    var out = applySafeCandidates(solutions, arcs);
    return {
      solutions: out.solutions,
      applied: out.applied,
      deltaZ: deltaZ,
      arcs: arcs,
      method: out.method || null,
      siteMils: null,
      reason: out.applied ? (out.method || 'applied') : 'no-safe-consensus'
    };
  }

  return {
    init: init,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    correct: correct,
    getState: function () {
      return {
        initialized: state.initialized, available: state.available,
        enabled: state.enabled, ready: state.ready, loading: state.loading,
        lastError: state.lastError ? state.lastError.message : null
      };
    }
  };
})();
