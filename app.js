/* =====================================================================
   CryptoSwing · Simulador de Swing Trading
   - Datos de mercado REALES (Binance public API, solo lectura)
   - Gráfico de velas + EMA50/EMA200 + RSI(14)
   - Cuenta demo (paper trading) con 500 USD ficticios
   - Detección de señales, gestión de riesgo, journal y estadísticas
   AVISO: educativo. No es asesoramiento financiero.
   ===================================================================== */

"use strict";

/* ------------------------- Configuración ------------------------- */
const CONFIG = {
  emaFast: 50,
  emaSlow: 200,
  rsiPeriod: 14,
  rsiMin: 40,
  rsiMax: 55,
  pullbackPct: 0.03,     // precio dentro del +-3% de la EMA50
  stopLossPct: 0.04,     // 4%
  takeProfitPct: 0.08,   // 8%
  initialBalance: 500,
  refreshMs: 5000,       // refresco "tiempo real"
  candleLimit: 320,
  // Filtros de confirmación (mejora de la estrategia)
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  volMaPeriod: 20,
  useMacd: true,         // exigir momentum alcista (MACD)
  useVolume: true,       // exigir volumen por encima de la media
};

const API_BASES = [
  "https://api.binance.com",
  "https://api.binance.us",
  "https://data-api.binance.vision",
];

/* ------------------------- Estado ------------------------- */
const state = {
  symbol: "BTCUSDT",
  interval: "1d",
  candles: [],
  lastPrice: null,
  apiBase: API_BASES[0],
  timer: null,
};

/* ------------------------- Persistencia ------------------------- */
const STORE_KEY = "cryptoswing_v1";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { balance: CONFIG.initialBalance, position: null, trades: [], peakEquity: CONFIG.initialBalance };
}
function saveStore() { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
let store = loadStore();

/* ------------------------- Utilidades ------------------------- */
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 2) => Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMoney = (n) => "$" + fmt(n, 2);

function priceDecimals(p) {
  if (p >= 1000) return 2;
  if (p >= 1) return 2;
  if (p >= 0.01) return 4;
  return 6;
}

/* ------------------------- Indicadores ------------------------- */
function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) { prev = values[0]; }
    else { prev = values[i] * k + prev * (1 - k); }
    out.push(prev);
  }
  return out;
}

function rsi(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  let avgGain = gain / period, avgLoss = loss / period;
  out[period] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss));
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss));
  }
  return out;
}

// Media móvil simple (para el volumen)
function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// MACD: línea, señal e histograma
function macd(values, fast, slow, signalP) {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const macdLine = values.map((_, i) => ef[i] - es[i]);
  const signalLine = ema(macdLine, signalP);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

/* ------------------------- Gráficos ------------------------- */
let chart, candleSeries, ema50Series, ema200Series, rsiChart, rsiSeries;
let stopLine = null, tpLine = null, entryLine = null;

function buildCharts() {
  const opts = {
    layout: { background: { color: "transparent" }, textColor: "#8a97ad" },
    grid: { vertLines: { color: "#1c2435" }, horzLines: { color: "#1c2435" } },
    rightPriceScale: { borderColor: "#263247" },
    timeScale: { borderColor: "#263247", timeVisible: true },
    crosshair: { mode: 0 },
  };

  chart = LightweightCharts.createChart($("chart"), opts);
  candleSeries = chart.addCandlestickSeries({
    upColor: "#16c784", downColor: "#ea3943",
    borderUpColor: "#16c784", borderDownColor: "#ea3943",
    wickUpColor: "#16c784", wickDownColor: "#ea3943",
  });
  ema50Series = chart.addLineSeries({ color: "#3b82f6", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  ema200Series = chart.addLineSeries({ color: "#f7931a", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });

  rsiChart = LightweightCharts.createChart($("rsiChart"), {
    ...opts,
    rightPriceScale: { borderColor: "#263247", scaleMargins: { top: 0.1, bottom: 0.1 } },
  });
  rsiSeries = rsiChart.addLineSeries({ color: "#f0b90b", lineWidth: 2 });
  rsiSeries.createPriceLine({ price: 70, color: "#ea3943", lineWidth: 1, lineStyle: 2, title: "70" });
  rsiSeries.createPriceLine({ price: 30, color: "#16c784", lineWidth: 1, lineStyle: 2, title: "30" });

  // Sincronizar el desplazamiento temporal de ambos gráficos
  chart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r) rsiChart.timeScale().setVisibleLogicalRange(r); });
  rsiChart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r) chart.timeScale().setVisibleLogicalRange(r); });

  new ResizeObserver(() => {
    chart.applyOptions({ width: $("chart").clientWidth, height: $("chart").clientHeight });
    rsiChart.applyOptions({ width: $("rsiChart").clientWidth, height: $("rsiChart").clientHeight });
  }).observe(document.body);
}

/* ------------------------- Datos de mercado ------------------------- */
// Descarga genérica de velas (con base de API y parámetros opcionales)
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
      return raw.map((k) => ({
        time: Math.floor(k[0] / 1000),
        open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
      }));
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function fetchCandles() {
  return fetchKlines(state.symbol, state.interval, CONFIG.candleLimit);
}

// Descarga paginada hacia atrás para conseguir N velas (años de histórico)
async function fetchHistory(targetCount) {
  const maxPerReq = 1000; // límite de Binance por petición
  let all = [];
  let endTime = undefined;
  let guard = 0;
  while (all.length < targetCount && guard < 60) {
    guard++;
    const need = Math.min(maxPerReq, targetCount - all.length);
    const batch = await fetchKlines(state.symbol, state.interval, need, endTime);
    if (!batch.length) break;
    all = batch.concat(all);
    // siguiente página: justo antes de la vela más antigua obtenida
    endTime = batch[0].time * 1000 - 1;
    if (batch.length < need) break; // no hay más histórico disponible
  }
  // eliminar posibles duplicados por solapamiento y ordenar
  const seen = new Set();
  const unique = [];
  for (const c of all.sort((a, b) => a.time - b.time)) {
    if (!seen.has(c.time)) { seen.add(c.time); unique.push(c); }
  }
  return unique;
}

function setLive(on) {
  const b = $("liveBadge");
  b.classList.toggle("off", !on);
  b.firstChild.nextSibling; // keep dot
  b.lastChild.textContent = on ? " EN VIVO" : " SIN CONEXIÓN";
}

async function refresh() {
  try {
    const candles = await fetchCandles();
    state.candles = candles;
    state.lastPrice = candles[candles.length - 1].close;
    setLive(true);
    renderChart();
    renderPriceStrip();
    evaluateSignal();
    checkPositionTriggers();
    renderAccount();
  } catch (e) {
    console.error("Error de datos:", e);
    setLive(false);
  }
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
  const c = state.candles;
  const last = c[c.length - 1];
  const dec = priceDecimals(last.close);
  $("lastPrice").textContent = "$" + fmt(last.close, dec);

  const change = ((last.close - last.open) / last.open) * 100;
  const el = $("priceChange");
  el.textContent = (change >= 0 ? "▲ +" : "▼ ") + fmt(change, 2) + "%";
  el.className = "price-change " + (change >= 0 ? "up" : "down");

  const dispDec = priceDecimals(state._ind.rsiArr[c.length - 1] || 50);
  $("rsiValue").textContent = fmt(state._ind.rsiArr[c.length - 1], 1);
}

/* ------------------------- Señal ------------------------- */
function currentSignal() {
  const c = state.candles;
  if (!c.length || !state._ind) return null;
  const i = c.length - 1;
  const price = c[i].close;
  const e50 = state._ind.e50[i];
  const e200 = state._ind.e200[i];
  const r = state._ind.rsiArr[i];
  const macdLine = state._ind.macdData.macdLine[i];
  const volMA = state._ind.volMA[i];
  const vol = state._ind.volumes[i];

  const trend = e50 > e200;
  const pullback = e50 > 0 && Math.abs(price - e50) / e50 <= CONFIG.pullbackPct;
  const rsiOk = r != null && r >= CONFIG.rsiMin && r <= CONFIG.rsiMax;
  const macdOk = !CONFIG.useMacd || macdLine > 0;
  const volOk = !CONFIG.useVolume || (volMA != null && vol > volMA);

  return {
    trend, pullback, rsiOk, macdOk, volOk,
    buy: trend && pullback && rsiOk && macdOk && volOk,
    price, e50, e200, rsi: r,
  };
}

function evaluateSignal() {
  const s = currentSignal();
  if (!s) return;

  const setCond = (key, ok) => {
    const li = document.querySelector(`.conditions li[data-cond="${key}"]`);
    if (!li) return;
    li.classList.toggle("ok", ok);
    li.querySelector(".mark").textContent = ok ? "●" : "○";
  };
  setCond("trend", s.trend);
  setCond("pullback", s.pullback);
  setCond("rsi", s.rsiOk);
  setCond("macd", s.macdOk);
  setCond("volume", s.volOk);

  const badge = $("signalBadge");
  if (s.buy && !store.position) {
    badge.textContent = "🟢 COMPRA";
    badge.className = "signal-badge buy";
    if (!lastBuyState) beep(); // suena solo al APARECER la señal
    lastBuyState = true;
  } else if (store.position) {
    badge.textContent = "EN POSICIÓN";
    badge.className = "signal-badge wait";
    lastBuyState = false;
  } else {
    badge.textContent = "ESPERAR";
    badge.className = "signal-badge wait";
    lastBuyState = false;
  }

  $("buyBtn").disabled = !!store.position || !s.buy;
}

/* ------------------------- Paper trading ------------------------- */
function openPosition() {
  const s = currentSignal();
  if (!s || !s.buy || store.position) return;

  const riskPct = parseFloat($("riskSelect").value);
  const riskUsd = store.balance * riskPct;
  const positionUsd = Math.min(riskUsd / CONFIG.stopLossPct, store.balance); // no más que el saldo
  const entry = state.lastPrice;
  const qty = positionUsd / entry;

  store.position = {
    symbol: state.symbol,
    entry,
    qty,
    positionUsd,
    riskUsd,
    stop: entry * (1 - CONFIG.stopLossPct),
    tp: entry * (1 + CONFIG.takeProfitPct),
    openedAt: Date.now(),
  };
  saveStore();
  drawPositionLines();
  renderPosition();
  renderAccount();
  evaluateSignal();
}

function closePosition(reason) {
  if (!store.position) return;
  const p = store.position;
  const exit = state.lastPrice;
  const pnl = (exit - p.entry) * p.qty;
  const pnlPct = ((exit - p.entry) / p.entry) * 100;

  store.balance += pnl;
  store.trades.unshift({
    date: new Date().toISOString(),
    symbol: p.symbol,
    entry: p.entry,
    exit,
    stop: p.stop,
    tp: p.tp,
    pnl,
    pnlPct,
    reason,
  });
  store.position = null;
  store.peakEquity = Math.max(store.peakEquity || CONFIG.initialBalance, store.balance);
  saveStore();
  clearPositionLines();
  renderPosition();
  renderAccount();
  renderJournal();
  evaluateSignal();
}

function checkPositionTriggers() {
  if (!store.position) return;
  const p = store.position;
  const price = state.lastPrice;
  if (price <= p.stop) closePosition("Stop Loss");
  else if (price >= p.tp) closePosition("Take Profit");
}

function drawPositionLines() {
  clearPositionLines();
  const p = store.position;
  if (!p) return;
  entryLine = candleSeries.createPriceLine({ price: p.entry, color: "#8a97ad", lineWidth: 1, lineStyle: 0, title: "Entrada" });
  stopLine = candleSeries.createPriceLine({ price: p.stop, color: "#ea3943", lineWidth: 1, lineStyle: 2, title: "Stop" });
  tpLine = candleSeries.createPriceLine({ price: p.tp, color: "#16c784", lineWidth: 1, lineStyle: 2, title: "TP" });
}
function clearPositionLines() {
  [entryLine, stopLine, tpLine].forEach((l) => l && candleSeries.removePriceLine(l));
  entryLine = stopLine = tpLine = null;
}

/* ------------------------- Render cuenta / posición / stats ------------------------- */
function renderPosition() {
  const p = store.position;
  if (!p) {
    $("noPosition").classList.remove("hidden");
    $("positionInfo").classList.add("hidden");
    $("closeBtn").disabled = true;
    return;
  }
  const dec = priceDecimals(p.entry);
  $("noPosition").classList.add("hidden");
  $("positionInfo").classList.remove("hidden");
  $("posEntry").textContent = "$" + fmt(p.entry, dec);
  $("posQty").textContent = fmt(p.qty, 6) + " " + p.symbol.replace("USDT", "");
  $("posStop").textContent = "$" + fmt(p.stop, dec);
  $("posTP").textContent = "$" + fmt(p.tp, dec);

  const pnl = (state.lastPrice - p.entry) * p.qty;
  const pnlPct = ((state.lastPrice - p.entry) / p.entry) * 100;
  const el = $("posPnl");
  el.textContent = (pnl >= 0 ? "+" : "") + fmtMoney(pnl) + " (" + fmt(pnlPct, 2) + "%)";
  el.className = pnl >= 0 ? "green" : "red";
  $("closeBtn").disabled = false;
}

function renderAccount() {
  let equity = store.balance;
  if (store.position) equity += (state.lastPrice - store.position.entry) * store.position.qty;
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
  const pnlEl = $("stPnl");
  pnlEl.textContent = (netPnl >= 0 ? "+" : "") + fmtMoney(netPnl);
  pnlEl.className = netPnl >= 0 ? "green" : "red";
  $("stDrawdown").textContent = fmt(Math.max(0, drawdown), 1) + "%";
}

function renderJournal() {
  const body = $("journalBody");
  if (!store.trades.length) {
    body.innerHTML = '<tr class="empty"><td colspan="9">Aún no hay operaciones registradas.</td></tr>';
    return;
  }
  body.innerHTML = store.trades.map((t) => {
    const dec = priceDecimals(t.entry);
    const cls = t.pnl >= 0 ? "win" : "loss";
    const d = new Date(t.date);
    const date = d.toLocaleDateString("es-ES") + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return `<tr>
      <td>${date}</td>
      <td>${t.symbol}</td>
      <td>$${fmt(t.entry, dec)}</td>
      <td>$${fmt(t.exit, dec)}</td>
      <td>$${fmt(t.stop, dec)}</td>
      <td>$${fmt(t.tp, dec)}</td>
      <td class="${cls}">${t.pnl >= 0 ? "+" : ""}${fmtMoney(t.pnl)}</td>
      <td class="${cls}">${fmt(t.pnlPct, 2)}%</td>
      <td>${t.reason}</td>
    </tr>`;
  }).join("");
}

/* ------------------------- Exportar CSV ------------------------- */
function exportCSV() {
  const header = ["Fecha", "Par", "Entrada", "Salida", "Stop", "TP", "Resultado_USD", "Resultado_%", "Motivo"];
  const rows = store.trades.map((t) => [
    new Date(t.date).toLocaleString("es-ES"), t.symbol,
    t.entry.toFixed(priceDecimals(t.entry)), t.exit.toFixed(priceDecimals(t.entry)),
    t.stop.toFixed(priceDecimals(t.entry)), t.tp.toFixed(priceDecimals(t.entry)),
    t.pnl.toFixed(2), t.pnlPct.toFixed(2), t.reason,
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "cryptoswing_journal.csv";
  a.click();
}

/* ------------------------- Backtesting ------------------------- */
// Motor puro: simula la estrategia sobre un array de velas. Sin efectos secundarios.
function simulateStrategy(candles, riskPct, cfg = CONFIG) {
  const c = candles;
  const closes = c.map((x) => x.close);
  const volumes = c.map((x) => x.volume || 0);
  const e50 = ema(closes, cfg.emaFast);
  const e200 = ema(closes, cfg.emaSlow);
  const rsiArr = rsi(closes, cfg.rsiPeriod);
  const macdData = macd(closes, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
  const volMA = sma(volumes, cfg.volMaPeriod);
  const macdMode = cfg.macdMode || "zero"; // "zero": MACD>0 | "hist": histograma>0

  let balance = cfg.initialBalance;
  let peak = balance, maxDD = 0;
  let pos = null;
  const trades = [];

  for (let i = cfg.emaSlow; i < c.length; i++) {
    const candle = c[i];
    if (pos) {
      let exit = null, reason = null;
      // si una misma vela toca stop y tp, asumimos lo peor (stop) por prudencia
      if (candle.low <= pos.stop) { exit = pos.stop; reason = "Stop Loss"; }
      else if (candle.high >= pos.tp) { exit = pos.tp; reason = "Take Profit"; }
      if (exit) {
        const pnl = (exit - pos.entry) * pos.qty;
        balance += pnl;
        trades.push({ pnl, reason });
        peak = Math.max(peak, balance);
        maxDD = Math.max(maxDD, peak > 0 ? (peak - balance) / peak : 0);
        pos = null;
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
        pos = {
          entry: price,
          qty: positionUsd / price,
          stop: price * (1 - cfg.stopLossPct),
          tp: price * (1 + cfg.takeProfitPct),
        };
      }
    }
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0));
  return {
    trades: trades.length,
    wins: wins.length,
    winrate: trades.length ? (wins.length / trades.length) * 100 : 0,
    ret: ((balance - cfg.initialBalance) / cfg.initialBalance) * 100,
    maxDD: maxDD * 100,
    pf: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0),
    balance,
  };
}

// Cuántas velas hay por año según la temporalidad
function candlesPerYear(interval) {
  const map = { "15m": 96 * 365, "1h": 24 * 365, "4h": 6 * 365, "1d": 365 };
  return map[interval] || 365;
}

async function runBacktest() {
  const btn = $("backtestBtn");
  const years = parseInt($("yearsSelect").value, 10);
  const riskPct = parseFloat($("riskSelect").value);

  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = "Descargando histórico…";

  try {
    // objetivo de velas (limitado para mantener buen rendimiento)
    const target = Math.min(years * candlesPerYear(state.interval), 6000);
    const candles = await fetchHistory(target);

    if (!candles || candles.length < CONFIG.emaSlow + 5) {
      btn.textContent = "Histórico insuficiente";
      setTimeout(() => { btn.textContent = oldText; btn.disabled = false; }, 1800);
      return;
    }

    const r = simulateStrategy(candles, riskPct);

    $("btTrades").textContent = r.trades;
    $("btWinrate").textContent = fmt(r.winrate, 0) + "%";
    const retEl = $("btReturn");
    retEl.textContent = (r.ret >= 0 ? "+" : "") + fmt(r.ret, 1) + "%";
    retEl.className = r.ret >= 0 ? "green" : "red";
    $("btDrawdown").textContent = fmt(r.maxDD, 1) + "%";
    $("btPF").textContent = r.pf === Infinity ? "∞" : fmt(r.pf, 2);
    const finalEl = $("btFinal");
    finalEl.textContent = fmtMoney(r.balance);
    finalEl.className = r.balance >= CONFIG.initialBalance ? "green" : "red";

    const first = new Date(candles[0].time * 1000).toLocaleDateString("es-ES");
    const last = new Date(candles[candles.length - 1].time * 1000).toLocaleDateString("es-ES");
    $("btPeriod").textContent = `${candles.length} velas · ${first} → ${last} · ${state.symbol} · ${state.interval} · riesgo ${(riskPct * 100).toFixed(0)}%`;
    $("backtestResults").classList.remove("hidden");
  } catch (e) {
    console.error("Error en backtest:", e);
    btn.textContent = "Error de conexión";
    setTimeout(() => { btn.textContent = oldText; }, 1800);
  } finally {
    btn.textContent = oldText;
    btn.disabled = false;
  }
}


/* ------------------------- Alertas sonoras ------------------------- */
let soundOn = true;
let lastBuyState = false;

function beep() {
  if (!soundOn) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [880, 1175]; // dos tonos ascendentes
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      osc.connect(gain); gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.start(t); osc.stop(t + 0.18);
    });
  } catch (e) { /* navegador sin audio */ }
}

function toggleSound() {
  soundOn = !soundOn;
  const btn = $("soundToggle");
  btn.textContent = soundOn ? "🔔" : "🔕";
  btn.classList.toggle("off", !soundOn);
}

/* ------------------------- Reset ------------------------- */
function resetAccount() {
  if (!confirm("¿Reiniciar la cuenta demo? Se borrará el historial y el saldo volverá a 500 USD.")) return;
  store = { balance: CONFIG.initialBalance, position: null, trades: [], peakEquity: CONFIG.initialBalance };
  saveStore();
  clearPositionLines();
  renderPosition();
  renderAccount();
  renderJournal();
  evaluateSignal();
}

/* ------------------------- Init ------------------------- */
function changeMarket() {
  state.symbol = $("symbolSelect").value;
  state.interval = $("intervalSelect").value;
  // Si hay posición abierta de otro par, la cerramos al precio actual para evitar inconsistencias
  if (store.position && store.position.symbol !== state.symbol) {
    // mantenemos la posición pero seguimos mostrando su par; mejor avisamos
  }
  refresh();
}

function init() {
  buildCharts();
  renderPosition();
  renderAccount();
  renderJournal();

  $("symbolSelect").addEventListener("change", changeMarket);
  $("intervalSelect").addEventListener("change", changeMarket);
  $("buyBtn").addEventListener("click", openPosition);
  $("closeBtn").addEventListener("click", () => closePosition("Cierre manual"));
  $("resetBtn").addEventListener("click", resetAccount);
  $("exportBtn").addEventListener("click", exportCSV);
  $("riskSelect").addEventListener("change", renderAccount);
  $("backtestBtn").addEventListener("click", runBacktest);
  $("soundToggle").addEventListener("click", toggleSound);

  // Si había posición abierta, redibujamos sus líneas
  if (store.position) { state.symbol = store.position.symbol; $("symbolSelect").value = state.symbol; }

  refresh().then(() => { if (store.position) drawPositionLines(); });
  state.timer = setInterval(refresh, CONFIG.refreshMs);
}

document.addEventListener("DOMContentLoaded", init);
