/* =====================================================================
   CryptoSwing · Simulador de Trading (Long & Short)
   - Datos de mercado REALES (Binance public API, solo lectura)
   - Velas + EMA50/EMA200 + RSI(14) + MACD + volumen
   - Cuenta demo (paper trading) LONG y SHORT con 500 USD ficticios
   - Coach explicativo, calculadora, asistente IA local, backtesting,
     curva de equity, journal y estadísticas
   AVISO: educativo. No es asesoramiento financiero.
   ===================================================================== */

"use strict";

/* ------------------------- Configuración ------------------------- */
const CONFIG = {
  emaFast: 50, emaSlow: 200,
  rsiPeriod: 14, rsiMin: 40, rsiMax: 55,
  pullbackPct: 0.03,
  stopLossPct: 0.05, takeProfitPct: 0.10,
  initialBalance: 500,
  refreshMs: 5000,
  candleLimit: 320,
  macdFast: 12, macdSlow: 26, macdSignal: 9,
  volMaPeriod: 20,
  useMacd: true, useVolume: true,
  useTrailing: true, trailPct: 0.06,
};

const API_BASES = [
  "https://api.binance.com",
  "https://api.binance.us",
  "https://data-api.binance.vision",
];

/* ------------------------- Estado ------------------------- */
const state = { symbol: "BTCUSDT", interval: "1d", candles: [], lastPrice: null, apiBase: API_BASES[0], timer: null };

/* ------------------------- Persistencia ------------------------- */
const STORE_KEY = "cryptoswing_v2";
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const s = JSON.parse(raw); s.calcs = s.calcs || []; return s; }
  } catch (e) { /* ignore */ }
  return { balance: CONFIG.initialBalance, position: null, trades: [], peakEquity: CONFIG.initialBalance, calcs: [] };
}
function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {} }
let store = loadStore();

/* ------------------------- Utilidades ------------------------- */
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 2) => Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMoney = (n) => "$" + fmt(n, 2);
function priceDecimals(p) { if (p >= 1) return 2; if (p >= 0.01) return 4; return 6; }
function normalize(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

/* ------------------------- Indicadores ------------------------- */
function ema(values, period) {
  const k = 2 / (period + 1); const out = []; let prev;
  for (let i = 0; i < values.length; i++) { prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k); out.push(prev); }
  return out;
}
function rsi(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) { const d = values[i] - values[i - 1]; if (d >= 0) gain += d; else loss -= d; }
  let avgGain = gain / period, avgLoss = loss / period;
  out[period] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss));
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]; const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period; avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss));
  }
  return out;
}
function sma(values, period) {
  const out = new Array(values.length).fill(null); let sum = 0;
  for (let i = 0; i < values.length; i++) { sum += values[i]; if (i >= period) sum -= values[i - period]; if (i >= period - 1) out[i] = sum / period; }
  return out;
}
function macd(values, fast, slow, signalP) {
  const ef = ema(values, fast), es = ema(values, slow);
  const macdLine = values.map((_, i) => ef[i] - es[i]);
  const signalLine = ema(macdLine, signalP);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

/* ------------------------- Gráficos ------------------------- */
let chart, candleSeries, ema50Series, ema200Series, rsiChart, rsiSeries, equityChart, equitySeries;
let stopLine = null, tpLine = null, entryLine = null;

function chartOpts() {
  return {
    layout: { background: { color: "transparent" }, textColor: "#8a97ad" },
    grid: { vertLines: { color: "#1c2435" }, horzLines: { color: "#1c2435" } },
    rightPriceScale: { borderColor: "#263247" },
    timeScale: { borderColor: "#263247", timeVisible: true },
    crosshair: { mode: 0 },
  };
}

function buildCharts() {
  chart = LightweightCharts.createChart($("chart"), chartOpts());
  candleSeries = chart.addCandlestickSeries({ upColor: "#16c784", downColor: "#ea3943", borderUpColor: "#16c784", borderDownColor: "#ea3943", wickUpColor: "#16c784", wickDownColor: "#ea3943" });
  ema50Series = chart.addLineSeries({ color: "#3b82f6", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  ema200Series = chart.addLineSeries({ color: "#f7931a", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });

  rsiChart = LightweightCharts.createChart($("rsiChart"), { ...chartOpts(), rightPriceScale: { borderColor: "#263247", scaleMargins: { top: 0.1, bottom: 0.1 } } });
  rsiSeries = rsiChart.addLineSeries({ color: "#f0b90b", lineWidth: 2 });
  rsiSeries.createPriceLine({ price: 70, color: "#ea3943", lineWidth: 1, lineStyle: 2, title: "70" });
  rsiSeries.createPriceLine({ price: 30, color: "#16c784", lineWidth: 1, lineStyle: 2, title: "30" });

  equityChart = LightweightCharts.createChart($("equityChart"), chartOpts());
  equitySeries = equityChart.addAreaSeries({ lineColor: "#16c784", topColor: "rgba(22,199,132,0.4)", bottomColor: "rgba(22,199,132,0.02)", lineWidth: 2 });

  chart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r) rsiChart.timeScale().setVisibleLogicalRange(r); });
  rsiChart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r) chart.timeScale().setVisibleLogicalRange(r); });

  new ResizeObserver(() => {
    [["chart", chart], ["rsiChart", rsiChart], ["equityChart", equityChart]].forEach(([id, ch]) => {
      if (ch && $(id)) ch.applyOptions({ width: $(id).clientWidth, height: $(id).clientHeight });
    });
  }).observe(document.body);
}

/* ------------------------- Datos de mercado ------------------------- */
async function fetchKlines(symbol, interval, limit, endTime) {
  let path = `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  if (endTime) path += `&endTime=${endTime}`;
  let lastErr;
  for (const base of API_BASES) {
    try {
      const res = await fetch(base + path);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const raw = await res.json();
      state.apiBase = base;
      return raw.map((k) => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
async function fetchCandles() { return fetchKlines(state.symbol, state.interval, CONFIG.candleLimit); }

async function fetchHistory(targetCount) {
  const maxPerReq = 1000; let all = []; let endTime; let guard = 0;
  while (all.length < targetCount && guard < 60) {
    guard++;
    const need = Math.min(maxPerReq, targetCount - all.length);
    const batch = await fetchKlines(state.symbol, state.interval, need, endTime);
    if (!batch.length) break;
    all = batch.concat(all);
    endTime = batch[0].time * 1000 - 1;
    if (batch.length < need) break;
  }
  const seen = new Set(); const unique = [];
  for (const c of all.sort((a, b) => a.time - b.time)) { if (!seen.has(c.time)) { seen.add(c.time); unique.push(c); } }
  return unique;
}

function setLive(on) {
  const b = $("liveBadge"); if (!b) return;
  b.classList.toggle("off", !on);
  b.lastChild.textContent = on ? " EN VIVO" : " SIN CONEXIÓN";
}

async function refresh() {
  try {
    const candles = await fetchCandles();
    state.candles = candles;
    state.lastPrice = candles[candles.length - 1].close;
    setLive(true);
    renderChart(); renderPriceStrip(); evaluateSignal(); checkPositionTriggers(); renderAccount();
  } catch (e) { console.error("Error de datos:", e); setLive(false); updateCoachOffline(); }
}

/* ------------------------- Render gráfico ------------------------- */
function renderChart() {
  const c = state.candles;
  candleSeries.setData(c);
  const closes = c.map((x) => x.close);
  const volumes = c.map((x) => x.volume || 0);
  const e50 = ema(closes, CONFIG.emaFast);
  const e200 = ema(closes, CONFIG.emaSlow);
  const rsiArr = rsi(closes, CONFIG.rsiPeriod);
  const macdData = macd(closes, CONFIG.macdFast, CONFIG.macdSlow, CONFIG.macdSignal);
  const volMA = sma(volumes, CONFIG.volMaPeriod);
  ema50Series.setData(c.map((x, i) => ({ time: x.time, value: e50[i] })).slice(CONFIG.emaFast));
  ema200Series.setData(c.map((x, i) => ({ time: x.time, value: e200[i] })).slice(CONFIG.emaSlow));
  rsiSeries.setData(c.map((x, i) => ({ time: x.time, value: rsiArr[i] })).filter((p) => p.value != null));
  state._ind = { e50, e200, rsiArr, macdData, volMA, volumes };
}

function renderPriceStrip() {
  const c = state.candles; const last = c[c.length - 1]; const dec = priceDecimals(last.close);
  $("lastPrice").textContent = "$" + fmt(last.close, dec);
  const change = ((last.close - last.open) / last.open) * 100;
  const el = $("priceChange");
  el.textContent = (change >= 0 ? "▲ +" : "▼ ") + fmt(change, 2) + "%";
  el.className = "price-change " + (change >= 0 ? "up" : "down");
  $("rsiValue").textContent = fmt(state._ind.rsiArr[c.length - 1], 1);
}

/* ------------------------- Señales (long & short) ------------------------- */
function evalDirection(dir) {
  const c = state.candles;
  if (!c.length || !state._ind) return null;
  const i = c.length - 1;
  const price = c[i].close;
  const e50 = state._ind.e50[i], e200 = state._ind.e200[i], r = state._ind.rsiArr[i];
  const macdLine = state._ind.macdData.macdLine[i];
  const volMA = state._ind.volMA[i], vol = state._ind.volumes[i];
  const pullback = e50 > 0 && Math.abs(price - e50) / e50 <= CONFIG.pullbackPct;
  const volOk = !CONFIG.useVolume || (volMA != null && vol > volMA);
  if (dir === "long") {
    const trend = e50 > e200;
    const rsiOk = r != null && r >= CONFIG.rsiMin && r <= CONFIG.rsiMax;
    const macdOk = !CONFIG.useMacd || macdLine > 0;
    return { dir, trend, pullback, rsiOk, macdOk, volOk, buy: trend && pullback && rsiOk && macdOk && volOk };
  } else {
    const trend = e50 < e200;
    const rsiOk = r != null && r >= (100 - CONFIG.rsiMax) && r <= (100 - CONFIG.rsiMin); // 45-60
    const macdOk = !CONFIG.useMacd || macdLine < 0;
    return { dir, trend, pullback, rsiOk, macdOk, volOk, buy: trend && pullback && rsiOk && macdOk && volOk };
  }
}

const CONDTEXT = {
  long: { trend: "Tendencia alcista (EMA50 > EMA200)", pullback: "Pullback (precio cerca de EMA50)", rsi: "RSI entre 40 y 55", macd: "Momentum alcista (MACD > 0)", volume: "Volumen sobre la media" },
  short: { trend: "Tendencia bajista (EMA50 < EMA200)", pullback: "Repunte hacia la EMA50", rsi: "RSI entre 45 y 60", macd: "Momentum bajista (MACD < 0)", volume: "Volumen sobre la media" },
};

function evaluateSignal() {
  const longS = evalDirection("long");
  const shortS = evalDirection("short");
  if (!longS) return;

  // dirección a mostrar: la que tenga señal; si ninguna, la que coincida con la tendencia
  let shown = longS.buy ? longS : shortS.buy ? shortS : (longS.trend ? longS : shortS);

  const setCond = (key, ok) => {
    const li = document.querySelector(`.conditions li[data-cond="${key}"]`);
    if (!li) return;
    li.classList.toggle("ok", ok);
    li.querySelector(".mark").textContent = ok ? "●" : "○";
    const t = li.querySelector(".ctext"); if (t) t.textContent = CONDTEXT[shown.dir][key];
  };
  setCond("trend", shown.trend); setCond("pullback", shown.pullback); setCond("rsi", shown.rsiOk);
  setCond("macd", shown.macdOk); setCond("volume", shown.volOk);

  const badge = $("signalBadge"); const dirLabel = $("dirLabel");
  const hasPos = !!store.position;
  if (hasPos) {
    badge.textContent = "EN POSICIÓN (" + (store.position.direction === "long" ? "LONG" : "SHORT") + ")";
    badge.className = "signal-badge wait";
    dirLabel.textContent = "Gestiona tu posición abierta abajo.";
    lastBuyState = false;
  } else if (longS.buy) {
    badge.textContent = "🟢 SEÑAL LONG"; badge.className = "signal-badge buy";
    dirLabel.textContent = "El mercado sube: oportunidad de compra.";
    if (!lastBuyState) beep(); lastBuyState = true;
  } else if (shortS.buy) {
    badge.textContent = "🔴 SEÑAL SHORT"; badge.className = "signal-badge sell";
    dirLabel.textContent = "El mercado baja: oportunidad de venta en corto.";
    if (!lastBuyState) beep(); lastBuyState = true;
  } else {
    badge.textContent = "⏳ ESPERAR"; badge.className = "signal-badge wait";
    dirLabel.textContent = "Aún no se cumplen todas las condiciones.";
    lastBuyState = false;
  }

  $("buyBtn").disabled = hasPos;
  $("sellBtn").disabled = hasPos;
  updateCoach(longS, shortS, shown);
}

/* ------------------------- Coach ------------------------- */
const COACH_MISS = {
  long: { trend: "la tendencia aún no es alcista (la EMA50 está por debajo de la EMA200)", pullback: "el precio está lejos de la EMA50 (espera un retroceso)", rsi: "el RSI no está en la zona sana de compra (40-55)", macd: "el momentum (MACD) todavía no es alcista", volume: "el volumen está flojo (poca participación)" },
  short: { trend: "la tendencia aún no es bajista (la EMA50 está por encima de la EMA200)", pullback: "el precio está lejos de la EMA50 (espera un repunte)", rsi: "el RSI no está en la zona de venta (45-60)", macd: "el momentum (MACD) todavía no es bajista", volume: "el volumen está flojo (poca participación)" },
};

function updateCoach(longS, shortS, shown) {
  const el = $("coachText"); if (!el) return;
  if (store.position) {
    const p = store.position;
    const pnl = pnlOf(p, state.lastPrice);
    const sign = pnl >= 0 ? "a favor" : "en contra";
    el.textContent = `Tienes una posición ${p.direction === "long" ? "LONG (apuestas a que sube)" : "SHORT (apuestas a que baja)"}. Vas ${sign}: ${fmtMoney(pnl)}. Se cerrará sola si toca el stop (${fmtMoney(p.stop)}) o el objetivo (${fmtMoney(p.tp)}). Recuerda: respeta el plan, no muevas el stop por miedo.`;
    return;
  }
  if (longS.buy) { el.textContent = "✅ Se cumplen las 5 condiciones para LONG. El mercado sube con fuerza y volumen. Podrías abrir una compra: la app calculará tu stop y objetivo automáticamente. Arriesga solo el % que elegiste."; return; }
  if (shortS.buy) { el.textContent = "✅ Se cumplen las 5 condiciones para SHORT. El mercado baja con momentum. Podrías abrir una venta en corto: ganarías si sigue cayendo. Recuerda gestionar el riesgo."; return; }
  const miss = ["trend", "pullback", "rsi", "macd", "volume"].filter((k) => !shown[k === "rsi" ? "rsiOk" : k === "macd" ? "macdOk" : k === "volume" ? "volOk" : k]);
  const faltan = miss.map((k) => COACH_MISS[shown.dir][k]).slice(0, 2).join("; y ");
  el.textContent = `Mejor esperar (mirando ${shown.dir === "long" ? "LONG" : "SHORT"}). Falta que ${faltan || "se confirmen las condiciones"}. Un buen trader no fuerza operaciones: la paciencia es parte de la estrategia.`;
}
function updateCoachOffline() { const el = $("coachText"); if (el) el.textContent = "Sin conexión al mercado. La app intenta reconectar con Binance automáticamente."; }

/* ------------------------- Paper trading (long & short) ------------------------- */
function pnlOf(p, price) { return p.direction === "long" ? (price - p.entry) * p.qty : (p.entry - price) * p.qty; }

function openPosition(direction) {
  if (store.position || state.lastPrice == null) return;
  const riskPct = parseFloat($("riskSelect").value);
  const riskUsd = store.balance * riskPct;
  const positionUsd = Math.min(riskUsd / CONFIG.stopLossPct, store.balance);
  const entry = state.lastPrice;
  const qty = positionUsd / entry;
  const sl = CONFIG.stopLossPct, tp = CONFIG.takeProfitPct;
  store.position = {
    symbol: state.symbol, direction, entry, qty, positionUsd, riskUsd,
    stop: direction === "long" ? entry * (1 - sl) : entry * (1 + sl),
    tp: direction === "long" ? entry * (1 + tp) : entry * (1 - tp),
    extreme: entry, trailingActive: false, openedAt: Date.now(),
  };
  saveStore(); drawPositionLines(); renderPosition(); renderAccount(); evaluateSignal();
}

function closePosition(reason) {
  if (!store.position) return;
  const p = store.position; const exit = state.lastPrice;
  const pnl = pnlOf(p, exit);
  const pnlPct = ((exit - p.entry) / p.entry) * 100 * (p.direction === "long" ? 1 : -1);
  store.balance += pnl;
  store.trades.unshift({ date: new Date().toISOString(), symbol: p.symbol, direction: p.direction, entry: p.entry, exit, stop: p.stop, tp: p.tp, pnl, pnlPct, reason });
  store.position = null;
  store.peakEquity = Math.max(store.peakEquity || CONFIG.initialBalance, store.balance);
  saveStore(); clearPositionLines(); renderPosition(); renderAccount(); renderJournal(); renderEquity(); evaluateSignal();
}

function checkPositionTriggers() {
  if (!store.position) return;
  const p = store.position; const price = state.lastPrice;
  if (p.direction === "long") {
    if (price <= p.stop) { closePosition(p.trailingActive ? "Trailing Stop" : "Stop Loss"); return; }
    if (CONFIG.useTrailing) {
      p.extreme = Math.max(p.extreme || p.entry, price);
      const ns = p.extreme * (1 - CONFIG.trailPct);
      if (ns > p.stop) { p.stop = ns; p.trailingActive = true; saveStore(); drawPositionLines(); }
    } else if (price >= p.tp) { closePosition("Take Profit"); }
  } else {
    if (price >= p.stop) { closePosition(p.trailingActive ? "Trailing Stop" : "Stop Loss"); return; }
    if (CONFIG.useTrailing) {
      p.extreme = Math.min(p.extreme || p.entry, price);
      const ns = p.extreme * (1 + CONFIG.trailPct);
      if (ns < p.stop) { p.stop = ns; p.trailingActive = true; saveStore(); drawPositionLines(); }
    } else if (price <= p.tp) { closePosition("Take Profit"); }
  }
}

function drawPositionLines() {
  clearPositionLines();
  const p = store.position; if (!p || !candleSeries) return;
  entryLine = candleSeries.createPriceLine({ price: p.entry, color: "#8a97ad", lineWidth: 1, lineStyle: 0, title: "Entrada" });
  stopLine = candleSeries.createPriceLine({ price: p.stop, color: "#ea3943", lineWidth: 1, lineStyle: 2, title: p.trailingActive ? "Trailing Stop" : "Stop" });
  if (!CONFIG.useTrailing) tpLine = candleSeries.createPriceLine({ price: p.tp, color: "#16c784", lineWidth: 1, lineStyle: 2, title: "TP" });
}
function clearPositionLines() { [entryLine, stopLine, tpLine].forEach((l) => l && candleSeries && candleSeries.removePriceLine(l)); entryLine = stopLine = tpLine = null; }

/* ------------------------- Render cuenta/posición/stats ------------------------- */
function renderPosition() {
  const p = store.position;
  if (!p) { $("noPosition").classList.remove("hidden"); $("positionInfo").classList.add("hidden"); $("closeBtn").disabled = true; return; }
  const dec = priceDecimals(p.entry);
  $("noPosition").classList.add("hidden"); $("positionInfo").classList.remove("hidden");
  const dEl = $("posDirection");
  dEl.textContent = p.direction === "long" ? "▲ LONG" : "▼ SHORT";
  dEl.className = p.direction === "long" ? "tag-long" : "tag-short";
  $("posEntry").textContent = "$" + fmt(p.entry, dec);
  $("posQty").textContent = fmt(p.qty, 6) + " " + p.symbol.replace("USDT", "");
  $("posStop").textContent = "$" + fmt(p.stop, dec);
  $("posTP").textContent = "$" + fmt(p.tp, dec);
  const pnl = pnlOf(p, state.lastPrice);
  const pnlPct = ((state.lastPrice - p.entry) / p.entry) * 100 * (p.direction === "long" ? 1 : -1);
  const el = $("posPnl");
  el.textContent = (pnl >= 0 ? "+" : "") + fmtMoney(pnl) + " (" + fmt(pnlPct, 2) + "%)";
  el.className = pnl >= 0 ? "green" : "red";
  $("closeBtn").disabled = false;
}

function renderAccount() {
  let equity = store.balance;
  if (store.position && state.lastPrice != null) equity += pnlOf(store.position, state.lastPrice);
  $("balance").textContent = fmtMoney(store.balance);
  $("equity").textContent = fmtMoney(equity);
  if (store.position) renderPosition();
  renderStats(equity);
}

function renderStats(equity) {
  const trades = store.trades;
  const wins = trades.filter((t) => t.pnl > 0).length;
  const winrate = trades.length ? (wins / trades.length) * 100 : 0;
  const netPnl = store.balance - CONFIG.initialBalance;
  store.peakEquity = Math.max(store.peakEquity || CONFIG.initialBalance, equity);
  const drawdown = store.peakEquity > 0 ? ((store.peakEquity - equity) / store.peakEquity) * 100 : 0;
  $("stTrades").textContent = trades.length;
  $("stWinrate").textContent = fmt(winrate, 0) + "%";
  const pnlEl = $("stPnl"); pnlEl.textContent = (netPnl >= 0 ? "+" : "") + fmtMoney(netPnl); pnlEl.className = netPnl >= 0 ? "green" : "red";
  $("stDrawdown").textContent = fmt(Math.max(0, drawdown), 1) + "%";
}

function renderJournal() {
  const body = $("journalBody");
  if (!store.trades.length) { body.innerHTML = '<tr class="empty"><td colspan="8">Aún no hay operaciones registradas.</td></tr>'; return; }
  body.innerHTML = store.trades.map((t) => {
    const dec = priceDecimals(t.entry); const cls = t.pnl >= 0 ? "win" : "loss";
    const d = new Date(t.date);
    const date = d.toLocaleDateString("es-ES") + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const dir = t.direction === "short" ? '<span class="tag-short">SHORT</span>' : '<span class="tag-long">LONG</span>';
    return `<tr><td>${date}</td><td>${t.symbol}</td><td>${dir}</td><td>$${fmt(t.entry, dec)}</td><td>$${fmt(t.exit, dec)}</td><td class="${cls}">${t.pnl >= 0 ? "+" : ""}${fmtMoney(t.pnl)}</td><td class="${cls}">${fmt(t.pnlPct, 2)}%</td><td>${t.reason}</td></tr>`;
  }).join("");
}

function renderEquity() {
  if (!equitySeries) return;
  const chrono = [...store.trades].reverse();
  let bal = CONFIG.initialBalance; let t = Math.floor(Date.now() / 1000) - chrono.length - 1;
  const data = [{ time: t, value: bal }];
  for (const tr of chrono) { bal += tr.pnl; t = Math.max(t + 1, Math.floor(new Date(tr.date).getTime() / 1000)); data.push({ time: t, value: bal }); }
  // garantizar tiempos estrictamente crecientes
  for (let i = 1; i < data.length; i++) if (data[i].time <= data[i - 1].time) data[i].time = data[i - 1].time + 1;
  equitySeries.setData(data);
}

/* ------------------------- Exportar CSV ------------------------- */
function exportCSV() {
  const header = ["Fecha", "Par", "Sentido", "Entrada", "Salida", "Stop", "TP", "Resultado_USD", "Resultado_%", "Motivo"];
  const rows = store.trades.map((t) => [new Date(t.date).toLocaleString("es-ES"), t.symbol, t.direction, t.entry, t.exit, t.stop, t.tp, t.pnl.toFixed(2), t.pnlPct.toFixed(2), t.reason]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "cryptoswing_journal.csv"; a.click();
}

/* ------------------------- Backtesting (estrategia long validada) ------------------------- */
function simulateStrategy(candles, riskPct, cfg = CONFIG) {
  const c = candles;
  const closes = c.map((x) => x.close);
  const volumes = c.map((x) => x.volume || 0);
  const e50 = ema(closes, cfg.emaFast), e200 = ema(closes, cfg.emaSlow);
  const rsiArr = rsi(closes, cfg.rsiPeriod);
  const macdData = macd(closes, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
  const volMA = sma(volumes, cfg.volMaPeriod);
  const macdMode = cfg.macdMode || "zero";
  let balance = cfg.initialBalance, peak = balance, maxDD = 0, pos = null;
  const trades = [];
  for (let i = cfg.emaSlow; i < c.length; i++) {
    const candle = c[i];
    if (pos) {
      let exit = null, reason = null;
      if (candle.low <= pos.stop) { exit = pos.stop; reason = pos.trailingActive ? "Trailing Stop" : "Stop Loss"; }
      else if (!cfg.useTrailing && candle.high >= pos.tp) { exit = pos.tp; reason = "Take Profit"; }
      if (exit) {
        const pnl = (exit - pos.entry) * pos.qty; balance += pnl; trades.push({ pnl, reason });
        peak = Math.max(peak, balance); maxDD = Math.max(maxDD, peak > 0 ? (peak - balance) / peak : 0); pos = null;
      } else if (cfg.useTrailing) {
        pos.highest = Math.max(pos.highest, candle.high);
        const ns = pos.highest * (1 - cfg.trailPct); if (ns > pos.stop) { pos.stop = ns; pos.trailingActive = true; }
      }
    }
    if (!pos && balance > 0) {
      const price = candle.close;
      const trend = e50[i] > e200[i];
      const pullback = e50[i] > 0 && Math.abs(price - e50[i]) / e50[i] <= cfg.pullbackPct;
      const r = rsiArr[i];
      const rsiOk = r != null && !isNaN(r) && r >= cfg.rsiMin && r <= cfg.rsiMax;
      const macdOk = !cfg.useMacd || (macdMode === "hist" ? macdData.histogram[i] > 0 : macdData.macdLine[i] > 0);
      const volOk = !cfg.useVolume || (volMA[i] != null && candle.volume > volMA[i]);
      if (trend && pullback && rsiOk && macdOk && volOk && price > 0) {
        const positionUsd = Math.min((balance * riskPct) / cfg.stopLossPct, balance);
        pos = { entry: price, qty: positionUsd / price, stop: price * (1 - cfg.stopLossPct), tp: price * (1 + cfg.takeProfitPct), highest: price, trailingActive: false };
      }
    }
  }
  const wins = trades.filter((t) => t.pnl > 0);
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0));
  return { trades: trades.length, wins: wins.length, winrate: trades.length ? (wins.length / trades.length) * 100 : 0, ret: ((balance - cfg.initialBalance) / cfg.initialBalance) * 100, maxDD: maxDD * 100, pf: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0), balance };
}

function candlesPerYear(interval) { const m = { "15m": 96 * 365, "1h": 24 * 365, "4h": 6 * 365, "1d": 365 }; return m[interval] || 365; }

async function runBacktest() {
  const btn = $("backtestBtn"); const years = parseInt($("yearsSelect").value, 10); const riskPct = parseFloat($("riskSelect").value);
  btn.disabled = true; const oldText = btn.textContent; btn.textContent = "Descargando histórico…";
  try {
    const target = Math.min(years * candlesPerYear(state.interval), 6000);
    const candles = await fetchHistory(target);
    if (!candles || candles.length < CONFIG.emaSlow + 5) { btn.textContent = "Histórico insuficiente"; setTimeout(() => { btn.textContent = oldText; btn.disabled = false; }, 1800); return; }
    const r = simulateStrategy(candles, riskPct);
    $("btTrades").textContent = r.trades; $("btWinrate").textContent = fmt(r.winrate, 0) + "%";
    const retEl = $("btReturn"); retEl.textContent = (r.ret >= 0 ? "+" : "") + fmt(r.ret, 1) + "%"; retEl.className = r.ret >= 0 ? "green" : "red";
    $("btDrawdown").textContent = fmt(r.maxDD, 1) + "%"; $("btPF").textContent = r.pf === Infinity ? "∞" : fmt(r.pf, 2);
    const finalEl = $("btFinal"); finalEl.textContent = fmtMoney(r.balance); finalEl.className = r.balance >= CONFIG.initialBalance ? "green" : "red";
    const first = new Date(candles[0].time * 1000).toLocaleDateString("es-ES");
    const last = new Date(candles[candles.length - 1].time * 1000).toLocaleDateString("es-ES");
    $("btPeriod").textContent = `${candles.length} velas · ${first} → ${last} · ${state.symbol} · ${state.interval} · riesgo ${(riskPct * 100).toFixed(0)}%`;
    $("backtestResults").classList.remove("hidden");
  } catch (e) { console.error("Error backtest:", e); btn.textContent = "Error de conexión"; setTimeout(() => { btn.textContent = oldText; }, 1800); }
  finally { btn.textContent = oldText; btn.disabled = false; }
}

/* ------------------------- Calculadora ------------------------- */
let lastCalc = null;
function runCalc() {
  const capital = parseFloat($("calcCapital").value) || 0;
  const riskPct = (parseFloat($("calcRisk").value) || 0) / 100;
  const dir = $("calcDir").value;
  const entry = parseFloat($("calcEntry").value) || 0;
  const stop = parseFloat($("calcStop").value) || 0;
  const target = parseFloat($("calcTarget").value) || 0;
  const res = $("calcResults"); const verdict = $("calcVerdict");

  if (capital <= 0 || entry <= 0 || stop <= 0) { res.classList.remove("hidden"); verdict.textContent = "⚠️ Rellena capital, entrada y stop con valores mayores que 0."; $("calcSaveBtn").disabled = true; return; }

  const riskUsd = capital * riskPct;
  const stopDistPct = Math.abs(entry - stop) / entry;
  const posUsd = stopDistPct > 0 ? riskUsd / stopDistPct : 0;
  const units = entry > 0 ? posUsd / entry : 0;
  const lossUsd = riskUsd;
  const profitUsd = target > 0 ? Math.abs(target - entry) * units : 0;
  const rr = lossUsd > 0 && profitUsd > 0 ? profitUsd / lossUsd : 0;
  const toStop = stopDistPct * 100;
  const toTarget = target > 0 ? (Math.abs(target - entry) / entry) * 100 : 0;

  $("calcRiskUsd").textContent = fmtMoney(riskUsd);
  $("calcPosUsd").textContent = fmtMoney(posUsd) + (posUsd > capital ? " (¡necesita apalancamiento!)" : "");
  $("calcUnits").textContent = fmt(units, 6);
  $("calcRR").textContent = rr > 0 ? "1 : " + fmt(rr, 2) : "—";
  $("calcProfit").textContent = profitUsd > 0 ? "+" + fmtMoney(profitUsd) : "—";
  $("calcLoss").textContent = "-" + fmtMoney(lossUsd);
  $("calcToStop").textContent = fmt(toStop, 2) + "%";
  $("calcToTarget").textContent = target > 0 ? fmt(toTarget, 2) + "%" : "—";

  // validación de coherencia direccional
  let warn = "";
  if (dir === "long" && !(stop < entry && (target === 0 || target > entry))) warn = "⚠️ En LONG: el stop debe ir por DEBAJO de la entrada y el objetivo por ENCIMA.";
  if (dir === "short" && !(stop > entry && (target === 0 || target < entry))) warn = "⚠️ En SHORT: el stop debe ir por ENCIMA de la entrada y el objetivo por DEBAJO.";
  let v = warn;
  if (!warn) {
    if (rr >= 2) v = "✅ Buen ratio (1:" + fmt(rr, 1) + "). Arriesgas " + fmtMoney(riskUsd) + " para ganar " + fmtMoney(profitUsd) + ". Operación con sentido.";
    else if (rr > 0) v = "⚠️ Ratio bajo (1:" + fmt(rr, 1) + "). Lo ideal es al menos 1:2. Busca un objetivo más amplio o un stop más ajustado.";
    else v = "ℹ️ Añade un precio objetivo para calcular el ratio riesgo/beneficio.";
  }
  verdict.textContent = v;
  res.classList.remove("hidden");
  lastCalc = { date: new Date().toISOString(), capital, riskPct, dir, entry, stop, target, riskUsd, posUsd, units, rr, profitUsd, lossUsd };
  $("calcSaveBtn").disabled = false;
}

function saveCalc() {
  if (!lastCalc) return;
  store.calcs.unshift(lastCalc); saveStore(); renderCalcs();
}
function renderCalcs() {
  const el = $("calcList");
  if (!store.calcs.length) { el.innerHTML = '<p class="muted">Aún no has guardado cálculos.</p>'; return; }
  el.innerHTML = store.calcs.map((c, i) => {
    const dec = priceDecimals(c.entry); const d = new Date(c.date);
    const dirTag = c.dir === "short" ? '<span class="tag-short">SHORT</span>' : '<span class="tag-long">LONG</span>';
    return `<div class="calc-item"><div class="ci-head"><span>${dirTag} · ${d.toLocaleDateString("es-ES")} ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span><button class="ci-del" data-i="${i}" title="Borrar">🗑️</button></div>
      Entrada $${fmt(c.entry, dec)} · Stop $${fmt(c.stop, dec)}${c.target > 0 ? " · Objetivo $" + fmt(c.target, dec) : ""}<br>
      Invertir <b>${fmtMoney(c.posUsd)}</b> (${fmt(c.units, 6)} u.) · Riesgo <b>${fmtMoney(c.riskUsd)}</b> · R/B <b>${c.rr > 0 ? "1:" + fmt(c.rr, 2) : "—"}</b></div>`;
  }).join("");
  el.querySelectorAll(".ci-del").forEach((b) => b.addEventListener("click", (e) => { store.calcs.splice(+e.target.dataset.i, 1); saveStore(); renderCalcs(); }));
}
function clearCalcs() { if (!store.calcs.length || !confirm("¿Borrar todos los cálculos guardados?")) return; store.calcs = []; saveStore(); renderCalcs(); }

/* ------------------------- Asistente IA ------------------------- */
const KB = [
  { k: ["long", "largo", "comprar", "alcista"], a: "Ir en LONG (largo) significa COMPRAR esperando que el precio SUBA. Compras barato para vender más caro. Ganas si sube, pierdes si baja. Es la operación más intuitiva y la base del trading alcista." },
  { k: ["short", "corto", "vender", "bajista", "ponerse corto"], a: "Ir en SHORT (corto) significa VENDER esperando que el precio BAJE. Vendes caro para recomprar más barato. Ganas si baja. Permite ganar también en mercados bajistas, pero el riesgo teórico es mayor (el precio puede subir mucho), así que usa siempre stop loss." },
  { k: ["stop", "stop loss", "stoploss"], a: "El STOP LOSS es el precio donde cierras la operación para LIMITAR tu pérdida si el mercado va en tu contra. Es tu cinturón de seguridad. Regla de oro: defínelo ANTES de entrar y nunca lo muevas a peor por miedo." },
  { k: ["take profit", "objetivo", "tp", "beneficio"], a: "El TAKE PROFIT es el precio objetivo donde recoges ganancias. En esta app está en +10% (ratio 1:2 con el stop del 5%). Tener un objetivo claro evita la avaricia." },
  { k: ["riesgo", "gestion", "gestionar", "cuanto arriesgar", "money management"], a: "La GESTIÓN DE RIESGO es lo más importante. Regla del 1%: nunca arriesgues más del 1-2% de tu cuenta en una sola operación. Así una racha de pérdidas no te arruina. Calcula el tamaño de posición = (riesgo en USD) / (distancia al stop en %)." },
  { k: ["tamano", "posicion", "cuanto invertir", "lote", "size"], a: "El tamaño de posición se calcula así: decides cuánto arriesgar (ej. 1% de 500$ = 5$). Si tu stop está al 5% de distancia, inviertes 5$ / 0.05 = 100$. Así si salta el stop pierdes solo 5$. Usa la pestaña Calculadora para hacerlo automático." },
  { k: ["rsi"], a: "El RSI (Índice de Fuerza Relativa) mide si un activo está sobrecomprado (>70) o sobrevendido (<30). En esta estrategia buscamos RSI entre 40 y 55 para comprar en un retroceso sano dentro de una tendencia alcista." },
  { k: ["ema", "media movil", "medias"], a: "La EMA es una media móvil que suaviza el precio. Usamos la EMA50 (rápida) y EMA200 (lenta). Si la EMA50 está por encima de la EMA200, la tendencia es alcista (buscamos comprar); si está por debajo, bajista (buscamos vender en corto)." },
  { k: ["macd"], a: "El MACD mide el momentum (la fuerza del movimiento). Si el MACD está por encima de 0, el impulso es alcista; por debajo de 0, bajista. Lo usamos como filtro para no entrar a contracorriente." },
  { k: ["volumen"], a: "El VOLUMEN es cuánto se negocia. Un movimiento con volumen alto tiene más fuerza y fiabilidad. Filtramos las entradas exigiendo volumen por encima de su media de 20 periodos." },
  { k: ["drawdown"], a: "El DRAWDOWN es la mayor caída de tu cuenta desde un máximo. Mide el dolor máximo que has sufrido. Cuanto menor, mejor: un drawdown controlado significa buena gestión de riesgo." },
  { k: ["win rate", "winrate", "aciertos"], a: "El WIN RATE es el % de operaciones ganadoras. Ojo: con un buen ratio riesgo/beneficio (1:2), no necesitas acertar mucho. Con 40% de aciertos ya puedes ser rentable." },
  { k: ["ratio", "riesgo beneficio", "r/b", "rr"], a: "El RATIO RIESGO/BENEFICIO compara lo que arriesgas con lo que puedes ganar. 1:2 significa arriesgar 1 para ganar 2. Es la clave de la rentabilidad a largo plazo: pocas operaciones buenas compensan varias pequeñas pérdidas." },
  { k: ["backtest", "backtesting", "probar estrategia", "historico"], a: "El BACKTESTING prueba la estrategia con datos del PASADO para ver cómo habría funcionado. En la pestaña Operar puedes lanzar un backtest de hasta 5 años. Recuerda: rendimientos pasados no garantizan futuros." },
  { k: ["corto plazo", "intradia", "scalping", "day trading"], a: "El CORTO PLAZO (intradía) usa temporalidades pequeñas (15m, 1h) y operaciones que duran minutos u horas. Requiere más tiempo y disciplina. Más señales pero más ruido." },
  { k: ["largo plazo", "swing", "inversion"], a: "El LARGO PLAZO / SWING usa temporalidades grandes (4h, 1 día) y operaciones que duran días o semanas. Más relajado, menos ruido, ideal para empezar." },
  { k: ["empezar", "principiante", "como empiezo", "novato"], a: "Para empezar: 1) Practica en este simulador (dinero ficticio). 2) Opera solo BTC/ETH al principio. 3) Arriesga máximo 1% por operación. 4) Lleva un journal. 5) Practica 1-2 meses antes de pensar en dinero real. La paciencia y la gestión de riesgo valen más que cualquier indicador." },
  { k: ["apalancamiento", "leverage", "apalancar"], a: "El APALANCAMIENTO multiplica tu posición con dinero prestado (x2, x10...). Multiplica ganancias PERO también pérdidas, y puede liquidarte. Para principiantes: evítalo o usa x1-x2 como mucho. Es la causa nº1 de cuentas reventadas." },
  { k: ["fomo", "miedo", "psicologia", "emociones", "ansiedad"], a: "La PSICOLOGÍA es el 80% del trading. FOMO (miedo a perderte el movimiento) y revenge trading (operar para recuperar) destruyen cuentas. Solución: ten un plan, respeta el stop, y acepta que perder algunas es parte del juego." },
  { k: ["exchange", "binance", "comprar cripto", "donde"], a: "Un EXCHANGE es la plataforma donde compras/vendes cripto (Binance, Coinbase, Kraken...). Esta app usa los datos públicos de Binance solo para mostrar precios reales; no opera con tu dinero." },
  { k: ["comision", "fees", "comisiones"], a: "Las COMISIONES son lo que cobra el exchange por operar (normalmente 0.1% por operación). Parecen poco, pero si operas mucho se acumulan. Tenlas en cuenta en el corto plazo." },
  { k: ["dca", "promediar", "dollar cost"], a: "El DCA (Dollar Cost Averaging) es comprar cantidades fijas cada cierto tiempo, sin importar el precio. Reduce el impacto de la volatilidad y es una estrategia de largo plazo muy popular y de bajo estrés." },
  { k: ["vender app", "apk", "negocio", "monetizar"], a: "Puedes vender la app como SIMULADOR EDUCATIVO (totalmente legítimo). Lo que está REGULADO es vender señales o asesoramiento de inversión (CNMV/SEC). Mantén siempre el aviso de 'no es asesoramiento financiero'." },
];
const KB_FALLBACK = "Buena pregunta. Puedo ayudarte con: long y short, stop loss, take profit, gestión de riesgo, tamaño de posición, RSI, EMA, MACD, volumen, drawdown, win rate, ratio riesgo/beneficio, backtesting, corto vs largo plazo, apalancamiento, psicología y cómo empezar. Reformula tu duda con alguna de esas palabras y te explico. 😊";

function assistantAnswer(q) {
  const n = normalize(q);
  if (/\b(hola|buenas|hey|saludos)\b/.test(n)) return "¡Hola! 👋 Soy tu asistente de trading. Pregúntame lo que quieras: long, short, stop loss, gestión de riesgo, RSI, cómo empezar... Estoy para resolver tus dudas.";
  if (/(gracias|genial|perfecto)/.test(n)) return "¡A mandar! 💪 Recuerda: practica en demo, gestiona el riesgo y sé paciente. ¿Otra duda?";
  let best = null, bestScore = 0;
  for (const item of KB) {
    let score = 0;
    for (const kw of item.k) if (n.includes(normalize(kw))) score += kw.split(" ").length;
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return best ? best.a : KB_FALLBACK;
}

function addMsg(text, who) {
  const log = $("chatLog");
  const div = document.createElement("div");
  div.className = "msg " + who; div.textContent = text;
  log.appendChild(div); log.scrollTop = log.scrollHeight;
}

async function askAI(question) {
  const key = ($("apiKeyInput").value || "").trim();
  if (!key) return assistantAnswer(question);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [
        { role: "system", content: "Eres un experto en trading de criptomonedas que explica de forma sencilla a principiantes, en español. Sé claro, prudente y recuerda que no es asesoramiento financiero." },
        { role: "user", content: question },
      ], temperature: 0.5 }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || assistantAnswer(question);
  } catch (e) { return assistantAnswer(question) + "\n\n(No pude conectar con tu IA externa, te respondí con el asistente local.)"; }
}

async function sendChat(text) {
  const q = (text != null ? text : $("chatInput").value).trim();
  if (!q) return;
  addMsg(q, "user"); $("chatInput").value = "";
  addMsg("…", "bot");
  const answer = await askAI(q);
  const log = $("chatLog"); if (log.lastChild) log.lastChild.textContent = answer; else addMsg(answer, "bot");
}

/* ------------------------- Glosario ------------------------- */
const GLOSSARY = [
  ["Trading", "Comprar y vender activos (aquí criptomonedas) buscando obtener beneficio de los movimientos de precio."],
  ["Long (largo)", "Apostar a que el precio SUBE: compras para vender más caro."],
  ["Short (corto)", "Apostar a que el precio BAJA: vendes para recomprar más barato."],
  ["Stop Loss", "Precio de salida que limita tu pérdida. Tu red de seguridad."],
  ["Take Profit", "Precio objetivo donde recoges ganancias."],
  ["Pullback", "Pequeño retroceso del precio dentro de una tendencia. Buena zona de entrada."],
  ["Volatilidad", "Cuánto se mueve el precio. La cripto es muy volátil (sube y baja mucho)."],
  ["Tendencia", "Dirección general del precio: alcista (sube), bajista (baja) o lateral."],
  ["Equity", "Valor total de tu cuenta incluyendo las operaciones abiertas."],
  ["Drawdown", "La mayor caída de tu cuenta desde un máximo. Mide el riesgo soportado."],
  ["Apalancamiento", "Operar con dinero prestado para multiplicar la posición. Multiplica ganancias y pérdidas."],
  ["Liquidez", "Facilidad para comprar/vender sin mover el precio. BTC y ETH tienen mucha."],
];
function renderGlossary() {
  const el = $("glossary"); if (!el) return;
  el.innerHTML = GLOSSARY.map(([t, d]) => `<div class="gloss-item"><b>${t}</b><p>${d}</p></div>`).join("");
}

/* ------------------------- Alertas sonoras ------------------------- */
let soundOn = true; let lastBuyState = false;
function beep() {
  if (!soundOn) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = freq; osc.type = "sine"; osc.connect(gain); gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.001, t); gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.start(t); osc.stop(t + 0.18);
    });
  } catch (e) {}
}
function toggleSound() { soundOn = !soundOn; const b = $("soundToggle"); b.textContent = soundOn ? "🔔" : "🔕"; b.classList.toggle("off", !soundOn); }

/* ------------------------- Reset ------------------------- */
function resetAccount() {
  if (!confirm("¿Reiniciar la cuenta demo? Se borrará el historial y el saldo volverá a 500 USD.")) return;
  store = { balance: CONFIG.initialBalance, position: null, trades: [], peakEquity: CONFIG.initialBalance, calcs: store.calcs || [] };
  saveStore(); clearPositionLines(); renderPosition(); renderAccount(); renderJournal(); renderEquity(); evaluateSignal();
}

/* ------------------------- Tabs y plazo ------------------------- */
function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tabpanel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const panel = $("tab-" + btn.dataset.tab);
      if (panel) panel.classList.add("active");
      // recalcular tamaño de gráficos al mostrar la pestaña Operar
      if (btn.dataset.tab === "operar") setTimeout(() => { [chart, rsiChart, equityChart].forEach((ch, i) => { const id = ["chart", "rsiChart", "equityChart"][i]; if (ch && $(id)) ch.applyOptions({ width: $(id).clientWidth, height: $(id).clientHeight }); }); }, 50);
    });
  });
}
function updatePlazoHint() {
  const v = $("intervalSelect").value;
  const short = v === "15m" || v === "1h";
  $("plazoHint").textContent = short ? "Corto plazo: operaciones de minutos a horas. Más señales, más ruido." : "Largo plazo: operaciones de días a semanas. Más estable, ideal para empezar.";
}

/* ------------------------- Init ------------------------- */
function changeMarket() { state.symbol = $("symbolSelect").value; state.interval = $("intervalSelect").value; updatePlazoHint(); refresh(); }

function init() {
  buildCharts();
  setupTabs();
  renderPosition(); renderAccount(); renderJournal(); renderEquity(); renderCalcs(); renderGlossary(); updatePlazoHint();

  // saludo del asistente
  addMsg("¡Hola! 👋 Soy tu asistente. Pregúntame cualquier duda de trading o pulsa una sugerencia de arriba.", "bot");
  // cargar API key guardada
  const savedKey = localStorage.getItem("cryptoswing_apikey"); if (savedKey) $("apiKeyInput").value = savedKey;

  $("symbolSelect").addEventListener("change", changeMarket);
  $("intervalSelect").addEventListener("change", changeMarket);
  $("buyBtn").addEventListener("click", () => openPosition("long"));
  $("sellBtn").addEventListener("click", () => openPosition("short"));
  $("closeBtn").addEventListener("click", () => closePosition("Cierre manual"));
  $("resetBtn").addEventListener("click", resetAccount);
  $("exportBtn").addEventListener("click", exportCSV);
  $("riskSelect").addEventListener("change", renderAccount);
  $("backtestBtn").addEventListener("click", runBacktest);
  $("soundToggle").addEventListener("click", toggleSound);
  $("trailingToggle").addEventListener("change", (e) => { CONFIG.useTrailing = e.target.checked; if (store.position) drawPositionLines(); });

  // calculadora
  $("calcBtn").addEventListener("click", runCalc);
  $("calcSaveBtn").addEventListener("click", saveCalc);
  $("clearCalcsBtn").addEventListener("click", clearCalcs);

  // chat
  $("chatSend").addEventListener("click", () => sendChat());
  $("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
  document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => sendChat(c.dataset.q)));
  $("apiKeyInput").addEventListener("change", (e) => { localStorage.setItem("cryptoswing_apikey", e.target.value.trim()); });

  if (store.position) { state.symbol = store.position.symbol; $("symbolSelect").value = state.symbol; }
  refresh().then(() => { if (store.position) drawPositionLines(); });
  state.timer = setInterval(refresh, CONFIG.refreshMs);
}

document.addEventListener("DOMContentLoaded", init);
