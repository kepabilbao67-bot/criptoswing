/* =====================================================================
   CryptoSwing · Simulador de Trading (Long & Short) — bilingüe ES/EN
   Datos reales (Binance, solo lectura). AVISO: educativo, no asesoramiento.
   ===================================================================== */
"use strict";

/* ------------------------- Configuración ------------------------- */
const CONFIG = {
  emaFast: 50, emaSlow: 200, rsiPeriod: 14, rsiMin: 40, rsiMax: 55,
  pullbackPct: 0.03, stopLossPct: 0.05, takeProfitPct: 0.10,
  initialBalance: 500, refreshMs: 5000, candleLimit: 320,
  macdFast: 12, macdSlow: 26, macdSignal: 9, volMaPeriod: 20,
  useMacd: true, useVolume: true, useTrailing: true, trailPct: 0.06,
};
const API_BASES = ["https://api.binance.com", "https://api.binance.us", "https://data-api.binance.vision"];
const state = { symbol: "BTCUSDT", interval: "1d", candles: [], lastPrice: null, apiBase: API_BASES[0], timer: null };

/* ------------------------- i18n ------------------------- */
let LANG = "es";
const I18N = {
  es: {
    tagline: "Simulador · dinero de práctica", live: "EN VIVO", offline: "SIN CONEXIÓN",
    "tab.operar": "📊 Operar", "tab.calc": "🧮 Calculadora", "tab.ai": "🤖 Asistente IA", "tab.learn": "🎓 Aprender",
    pair: "Par", timeframe: "Plazo / Temporalidad", "group.short": "Corto plazo (intradía)", "group.long": "Largo plazo (swing)",
    "coach.title": "🧭 Coach (te explica qué pasa)", "coach.connecting": "Conectando con el mercado…",
    "signal.title": "Señal de la estrategia",
    "account.title": "Cuenta de práctica", "account.balance": "Saldo", "account.equity": "Equity", "account.risk": "Riesgo por operación",
    "pos.title": "Posición abierta", "pos.none": "Sin posición. Abre LONG (sube) o SHORT (baja).",
    "pos.direction": "Sentido", "pos.entry": "Entrada", "pos.qty": "Cantidad", "pos.stop": "Stop Loss", "pos.tp": "Take Profit", "pos.pnl": "P&L flotante",
    "btn.long": "▲ LONG", "btn.short": "▼ SHORT", "btn.close": "CERRAR POSICIÓN", "btn.reset": "Reiniciar cuenta demo",
    "stats.title": "Estadísticas", "stats.trades": "Operaciones", "stats.winrate": "Win rate", "stats.pnl": "P&L neto", "stats.dd": "Drawdown máx",
    "bt.title": "🔬 Backtesting", "bt.intro": "Prueba la estrategia con años de histórico real.", "bt.years": "Histórico a analizar",
    "bt.y1": "1 año", "bt.y2": "2 años", "bt.y3": "3 años", "bt.y5": "5 años",
    "bt.trailing": "Usar trailing stop (experimental)", "bt.run": "Ejecutar backtest", "bt.compare": "⚖️ Comparar estrategias",
    "bt.return": "Rentabilidad", "bt.pf": "Profit factor", "bt.final": "Saldo final",
    "equity.title": "📈 Evolución de tu cuenta (equity)", "achv.title": "🏆 Logros",
    "journal.title": "📒 Historial de operaciones", "journal.export": "Exportar CSV", "journal.empty": "Aún no hay operaciones registradas.",
    "th.date": "Fecha", "th.exit": "Salida", "th.result": "Resultado", "th.reason": "Motivo",
    "calc.title": "🧮 Calculadora de operaciones", "calc.intro": "Calcula cuánto invertir y arriesgar. Los resultados se pueden guardar.",
    "calc.capital": "Capital total (USD)", "calc.risk": "Riesgo por operación (%)", "calc.dir": "Sentido", "calc.long": "Long (compra)", "calc.short": "Short (venta)",
    "calc.entry": "Precio de entrada", "calc.stop": "Precio de stop loss", "calc.target": "Precio objetivo (take profit)",
    "calc.calc": "Calcular", "calc.save": "Guardar cálculo", "calc.riskUsd": "Riesgo en USD", "calc.posUsd": "Invertir (posición)",
    "calc.units": "Unidades", "calc.rr": "Ratio riesgo/beneficio", "calc.profit": "Ganancia potencial", "calc.loss": "Pérdida potencial",
    "calc.toStop": "Distancia al stop", "calc.toTarget": "Distancia al objetivo", "calc.saved": "💾 Cálculos guardados", "calc.clear": "Borrar todos",
    "calc.noSaved": "Aún no has guardado cálculos.",
    "ai.title": "🤖 Asistente de trading", "ai.intro": "Pregúntame lo que quieras sobre trading. Funciona sin conexión externa. Opcionalmente conecta tu propia IA.",
    "ai.chip.long": "¿Qué es long?", "ai.chip.short": "¿Qué es short?", "ai.chip.stop": "¿Stop loss?", "ai.chip.size": "Tamaño de posición", "ai.chip.risk": "Gestión de riesgo", "ai.chip.start": "¿Cómo empiezo?",
    "ai.placeholder": "Escribe tu pregunta…", "ai.send": "Enviar", "ai.connect": "⚙️ Conectar tu propia IA (opcional)",
    "ai.connectHelp": "Si pegas una clave de OpenAI, responderá GPT. Vacío = asistente local gratuito. La clave se guarda solo en tu navegador.",
    "ai.greeting": "¡Hola! 👋 Soy tu asistente. Pregúntame cualquier duda de trading o pulsa una sugerencia.",
    "learn.startTitle": "🎓 Empieza aquí (para principiantes)", "learn.glossaryTitle": "📖 Glosario", "learn.lsTitle": "⚖️ Long vs Short",
    "learn.longH": "▲ LONG (comprar)", "learn.longP": "Ganas si el precio sube. Compras barato para vender caro.", "learn.longEx": "Ej.: compras BTC a 60.000 y cierras a 66.000 → ganancia.",
    "learn.shortH": "▼ SHORT (vender)", "learn.shortP": "Ganas si el precio baja. Vendes caro para recomprar barato.", "learn.shortEx": "Ej.: abres short a 60.000 y cierras a 54.000 → ganancia.",
    disclaimer: "⚠️ Herramienta educativa con dinero ficticio. No es asesoramiento financiero. Datos reales (Binance); operaciones simuladas. El trading de criptomonedas es de alto riesgo.",
    "plazo.short": "Corto plazo: operaciones de minutos a horas. Más señales, más ruido.",
    "plazo.long": "Largo plazo: operaciones de días a semanas. Más estable, ideal para empezar.",
    "badge.inpos": "EN POSICIÓN", "badge.long": "🟢 SEÑAL LONG", "badge.short": "🔴 SEÑAL SHORT", "badge.wait": "⏳ ESPERAR",
    "dir.inpos": "Gestiona tu posición abierta abajo.", "dir.long": "El mercado sube: oportunidad de compra.", "dir.short": "El mercado baja: oportunidad de venta en corto.", "dir.wait": "Aún no se cumplen todas las condiciones.",
    "cmp.head.strategy": "Estrategia", "cmp.head.ret": "Rentab.", "cmp.head.dd": "Drawdown", "cmp.head.trades": "Ops", "cmp.head.win": "Win",
    "cmp.base": "Actual (1:2)", "cmp.trail": "Trailing 6%", "cmp.risk2": "Riesgo 2%", "cmp.nofilter": "Sin filtros", "cmp.downloading": "Descargando…", "cmp.insufficient": "Histórico insuficiente",
    "achvProgress": "Desbloqueados: ",
  },
  en: {
    tagline: "Simulator · paper money", live: "LIVE", offline: "OFFLINE",
    "tab.operar": "📊 Trade", "tab.calc": "🧮 Calculator", "tab.ai": "🤖 AI Assistant", "tab.learn": "🎓 Learn",
    pair: "Pair", timeframe: "Timeframe", "group.short": "Short term (intraday)", "group.long": "Long term (swing)",
    "coach.title": "🧭 Coach (explains what's happening)", "coach.connecting": "Connecting to the market…",
    "signal.title": "Strategy signal",
    "account.title": "Practice account", "account.balance": "Balance", "account.equity": "Equity", "account.risk": "Risk per trade",
    "pos.title": "Open position", "pos.none": "No position. Open LONG (up) or SHORT (down).",
    "pos.direction": "Direction", "pos.entry": "Entry", "pos.qty": "Quantity", "pos.stop": "Stop Loss", "pos.tp": "Take Profit", "pos.pnl": "Floating P&L",
    "btn.long": "▲ LONG", "btn.short": "▼ SHORT", "btn.close": "CLOSE POSITION", "btn.reset": "Reset demo account",
    "stats.title": "Statistics", "stats.trades": "Trades", "stats.winrate": "Win rate", "stats.pnl": "Net P&L", "stats.dd": "Max drawdown",
    "bt.title": "🔬 Backtesting", "bt.intro": "Test the strategy with years of real history.", "bt.years": "History to analyze",
    "bt.y1": "1 year", "bt.y2": "2 years", "bt.y3": "3 years", "bt.y5": "5 years",
    "bt.trailing": "Use trailing stop (experimental)", "bt.run": "Run backtest", "bt.compare": "⚖️ Compare strategies",
    "bt.return": "Return", "bt.pf": "Profit factor", "bt.final": "Final balance",
    "equity.title": "📈 Account growth (equity)", "achv.title": "🏆 Achievements",
    "journal.title": "📒 Trade history", "journal.export": "Export CSV", "journal.empty": "No trades recorded yet.",
    "th.date": "Date", "th.exit": "Exit", "th.result": "Result", "th.reason": "Reason",
    "calc.title": "🧮 Trade calculator", "calc.intro": "Calculate how much to invest and risk. Results can be saved.",
    "calc.capital": "Total capital (USD)", "calc.risk": "Risk per trade (%)", "calc.dir": "Direction", "calc.long": "Long (buy)", "calc.short": "Short (sell)",
    "calc.entry": "Entry price", "calc.stop": "Stop loss price", "calc.target": "Target price (take profit)",
    "calc.calc": "Calculate", "calc.save": "Save calculation", "calc.riskUsd": "Risk in USD", "calc.posUsd": "Invest (position)",
    "calc.units": "Units", "calc.rr": "Risk/reward ratio", "calc.profit": "Potential profit", "calc.loss": "Potential loss",
    "calc.toStop": "Distance to stop", "calc.toTarget": "Distance to target", "calc.saved": "💾 Saved calculations", "calc.clear": "Clear all",
    "calc.noSaved": "You haven't saved any calculations yet.",
    "ai.title": "🤖 Trading assistant", "ai.intro": "Ask me anything about trading. Works offline. Optionally connect your own AI.",
    "ai.chip.long": "What is long?", "ai.chip.short": "What is short?", "ai.chip.stop": "Stop loss?", "ai.chip.size": "Position size", "ai.chip.risk": "Risk management", "ai.chip.start": "How do I start?",
    "ai.placeholder": "Type your question…", "ai.send": "Send", "ai.connect": "⚙️ Connect your own AI (optional)",
    "ai.connectHelp": "Paste an OpenAI key and GPT will answer. Empty = free local assistant. The key is stored only in your browser.",
    "ai.greeting": "Hi! 👋 I'm your assistant. Ask me any trading question or tap a suggestion.",
    "learn.startTitle": "🎓 Start here (for beginners)", "learn.glossaryTitle": "📖 Glossary", "learn.lsTitle": "⚖️ Long vs Short",
    "learn.longH": "▲ LONG (buy)", "learn.longP": "You win if price goes up. Buy low to sell high.", "learn.longEx": "E.g.: buy BTC at 60,000 and close at 66,000 → profit.",
    "learn.shortH": "▼ SHORT (sell)", "learn.shortP": "You win if price goes down. Sell high to buy back lower.", "learn.shortEx": "E.g.: open short at 60,000 and close at 54,000 → profit.",
    disclaimer: "⚠️ Educational tool with fake money. Not financial advice. Real data (Binance); simulated trades. Crypto trading is high risk.",
    "plazo.short": "Short term: trades lasting minutes to hours. More signals, more noise.",
    "plazo.long": "Long term: trades lasting days to weeks. More stable, ideal to start.",
    "badge.inpos": "IN POSITION", "badge.long": "🟢 LONG SIGNAL", "badge.short": "🔴 SHORT SIGNAL", "badge.wait": "⏳ WAIT",
    "dir.inpos": "Manage your open position below.", "dir.long": "Market is rising: buy opportunity.", "dir.short": "Market is falling: short opportunity.", "dir.wait": "Not all conditions are met yet.",
    "cmp.head.strategy": "Strategy", "cmp.head.ret": "Return", "cmp.head.dd": "Drawdown", "cmp.head.trades": "Trades", "cmp.head.win": "Win",
    "cmp.base": "Current (1:2)", "cmp.trail": "Trailing 6%", "cmp.risk2": "Risk 2%", "cmp.nofilter": "No filters", "cmp.downloading": "Downloading…", "cmp.insufficient": "Insufficient history",
    "achvProgress": "Unlocked: ",
  },
};
function t(key) { return (I18N[LANG] && I18N[LANG][key]) || I18N.es[key] || key; }

const CONDTEXT = {
  es: { long: { trend: "Tendencia alcista (EMA50 > EMA200)", pullback: "Pullback (precio cerca de EMA50)", rsi: "RSI entre 40 y 55", macd: "Momentum alcista (MACD > 0)", volume: "Volumen sobre la media" },
        short: { trend: "Tendencia bajista (EMA50 < EMA200)", pullback: "Repunte hacia la EMA50", rsi: "RSI entre 45 y 60", macd: "Momentum bajista (MACD < 0)", volume: "Volumen sobre la media" } },
  en: { long: { trend: "Uptrend (EMA50 > EMA200)", pullback: "Pullback (price near EMA50)", rsi: "RSI between 40 and 55", macd: "Bullish momentum (MACD > 0)", volume: "Volume above average" },
        short: { trend: "Downtrend (EMA50 < EMA200)", pullback: "Bounce toward EMA50", rsi: "RSI between 45 and 60", macd: "Bearish momentum (MACD < 0)", volume: "Volume above average" } },
};
const COACH_MISS = {
  es: { long: { trend: "la tendencia aún no es alcista", pullback: "el precio está lejos de la EMA50 (espera un retroceso)", rsi: "el RSI no está en zona de compra (40-55)", macd: "el momentum (MACD) no es alcista", volume: "el volumen está flojo" },
        short: { trend: "la tendencia aún no es bajista", pullback: "el precio está lejos de la EMA50 (espera un repunte)", rsi: "el RSI no está en zona de venta (45-60)", macd: "el momentum (MACD) no es bajista", volume: "el volumen está flojo" } },
  en: { long: { trend: "the trend isn't bullish yet", pullback: "price is far from EMA50 (wait for a pullback)", rsi: "RSI isn't in the buy zone (40-55)", macd: "momentum (MACD) isn't bullish", volume: "volume is weak" },
        short: { trend: "the trend isn't bearish yet", pullback: "price is far from EMA50 (wait for a bounce)", rsi: "RSI isn't in the sell zone (45-60)", macd: "momentum (MACD) isn't bearish", volume: "volume is weak" } },
};

/* ------------------------- Persistencia ------------------------- */
const STORE_KEY = "cryptoswing_v2";
function loadStore() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const s = JSON.parse(raw); s.calcs = s.calcs || []; s.flags = s.flags || {}; return s; } } catch (e) {}
  return { balance: CONFIG.initialBalance, position: null, trades: [], peakEquity: CONFIG.initialBalance, calcs: [], flags: {} };
}
function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {} }
let store = loadStore();

/* ------------------------- Utilidades ------------------------- */
const $ = (id) => document.getElementById(id);
function locale() { return LANG === "en" ? "en-US" : "es-ES"; }
const fmt = (n, d = 2) => Number(n).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMoney = (n) => "$" + fmt(n, 2);
function priceDecimals(p) { if (p >= 1) return 2; if (p >= 0.01) return 4; return 6; }
function normalize(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

/* ------------------------- Indicadores ------------------------- */
function ema(values, period) { const k = 2 / (period + 1); const out = []; let prev; for (let i = 0; i < values.length; i++) { prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k); out.push(prev); } return out; }
function rsi(values, period) {
  const out = new Array(values.length).fill(null); if (values.length <= period) return out;
  let gain = 0, loss = 0; for (let i = 1; i <= period; i++) { const d = values[i] - values[i - 1]; if (d >= 0) gain += d; else loss -= d; }
  let avgGain = gain / period, avgLoss = loss / period; out[period] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss));
  for (let i = period + 1; i < values.length; i++) { const d = values[i] - values[i - 1]; const g = d > 0 ? d : 0, l = d < 0 ? -d : 0; avgGain = (avgGain * (period - 1) + g) / period; avgLoss = (avgLoss * (period - 1) + l) / period; out[i] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss)); }
  return out;
}
function sma(values, period) { const out = new Array(values.length).fill(null); let sum = 0; for (let i = 0; i < values.length; i++) { sum += values[i]; if (i >= period) sum -= values[i - period]; if (i >= period - 1) out[i] = sum / period; } return out; }
function macd(values, fast, slow, signalP) { const ef = ema(values, fast), es = ema(values, slow); const macdLine = values.map((_, i) => ef[i] - es[i]); const signalLine = ema(macdLine, signalP); const histogram = macdLine.map((v, i) => v - signalLine[i]); return { macdLine, signalLine, histogram }; }

/* ------------------------- Gráficos ------------------------- */
let chart, candleSeries, ema50Series, ema200Series, rsiChart, rsiSeries, equityChart, equitySeries;
let stopLine = null, tpLine = null, entryLine = null;
function chartOpts() { return { layout: { background: { color: "transparent" }, textColor: "#8a97ad" }, grid: { vertLines: { color: "#1c2435" }, horzLines: { color: "#1c2435" } }, rightPriceScale: { borderColor: "#263247" }, timeScale: { borderColor: "#263247", timeVisible: true }, crosshair: { mode: 0 } }; }
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
  new ResizeObserver(() => { [["chart", chart], ["rsiChart", rsiChart], ["equityChart", equityChart]].forEach(([id, ch]) => { if (ch && $(id)) ch.applyOptions({ width: $(id).clientWidth, height: $(id).clientHeight }); }); }).observe(document.body);
}

/* ------------------------- Datos de mercado ------------------------- */
async function fetchKlines(symbol, interval, limit, endTime) {
  let path = `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`; if (endTime) path += `&endTime=${endTime}`;
  let lastErr;
  for (const base of API_BASES) { try { const res = await fetch(base + path); if (!res.ok) throw new Error("HTTP " + res.status); const raw = await res.json(); state.apiBase = base; return raw.map((k) => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] })); } catch (e) { lastErr = e; } }
  throw lastErr;
}
async function fetchCandles() { return fetchKlines(state.symbol, state.interval, CONFIG.candleLimit); }
async function fetchHistory(targetCount) {
  const maxPerReq = 1000; let all = []; let endTime; let guard = 0;
  while (all.length < targetCount && guard < 60) { guard++; const need = Math.min(maxPerReq, targetCount - all.length); const batch = await fetchKlines(state.symbol, state.interval, need, endTime); if (!batch.length) break; all = batch.concat(all); endTime = batch[0].time * 1000 - 1; if (batch.length < need) break; }
  const seen = new Set(); const unique = []; for (const c of all.sort((a, b) => a.time - b.time)) { if (!seen.has(c.time)) { seen.add(c.time); unique.push(c); } } return unique;
}
function setLive(on) { const b = $("liveBadge"); if (!b) return; b.classList.toggle("off", !on); const span = b.querySelector("span:last-child"); if (span) span.textContent = on ? t("live") : t("offline"); }

async function refresh() {
  try { const candles = await fetchCandles(); state.candles = candles; state.lastPrice = candles[candles.length - 1].close; setLive(true); renderChart(); renderPriceStrip(); evaluateSignal(); checkPositionTriggers(); renderAccount(); }
  catch (e) { console.error("Error de datos:", e); setLive(false); const el = $("coachText"); if (el) el.textContent = LANG === "en" ? "No market connection. Retrying with Binance automatically." : "Sin conexión al mercado. Reintentando con Binance automáticamente."; }
}

/* ------------------------- Render gráfico ------------------------- */
function renderChart() {
  const c = state.candles; candleSeries.setData(c);
  const closes = c.map((x) => x.close); const volumes = c.map((x) => x.volume || 0);
  const e50 = ema(closes, CONFIG.emaFast), e200 = ema(closes, CONFIG.emaSlow);
  const rsiArr = rsi(closes, CONFIG.rsiPeriod); const macdData = macd(closes, CONFIG.macdFast, CONFIG.macdSlow, CONFIG.macdSignal); const volMA = sma(volumes, CONFIG.volMaPeriod);
  ema50Series.setData(c.map((x, i) => ({ time: x.time, value: e50[i] })).slice(CONFIG.emaFast));
  ema200Series.setData(c.map((x, i) => ({ time: x.time, value: e200[i] })).slice(CONFIG.emaSlow));
  rsiSeries.setData(c.map((x, i) => ({ time: x.time, value: rsiArr[i] })).filter((p) => p.value != null));
  state._ind = { e50, e200, rsiArr, macdData, volMA, volumes };
}
function renderPriceStrip() {
  const c = state.candles; const last = c[c.length - 1]; const dec = priceDecimals(last.close);
  $("lastPrice").textContent = "$" + fmt(last.close, dec);
  const change = ((last.close - last.open) / last.open) * 100; const el = $("priceChange");
  el.textContent = (change >= 0 ? "▲ +" : "▼ ") + fmt(change, 2) + "%"; el.className = "price-change " + (change >= 0 ? "up" : "down");
  $("rsiValue").textContent = fmt(state._ind.rsiArr[c.length - 1], 1);
}

/* ------------------------- Señales (long & short) ------------------------- */
function evalDirection(dir) {
  const c = state.candles; if (!c.length || !state._ind) return null;
  const i = c.length - 1; const price = c[i].close;
  const e50 = state._ind.e50[i], e200 = state._ind.e200[i], r = state._ind.rsiArr[i];
  const macdLine = state._ind.macdData.macdLine[i]; const volMA = state._ind.volMA[i], vol = state._ind.volumes[i];
  const pullback = e50 > 0 && Math.abs(price - e50) / e50 <= CONFIG.pullbackPct;
  const volOk = !CONFIG.useVolume || (volMA != null && vol > volMA);
  if (dir === "long") { const trend = e50 > e200; const rsiOk = r != null && r >= CONFIG.rsiMin && r <= CONFIG.rsiMax; const macdOk = !CONFIG.useMacd || macdLine > 0; return { dir, trend, pullback, rsiOk, macdOk, volOk, buy: trend && pullback && rsiOk && macdOk && volOk }; }
  const trend = e50 < e200; const rsiOk = r != null && r >= (100 - CONFIG.rsiMax) && r <= (100 - CONFIG.rsiMin); const macdOk = !CONFIG.useMacd || macdLine < 0; return { dir, trend, pullback, rsiOk, macdOk, volOk, buy: trend && pullback && rsiOk && macdOk && volOk };
}
function evaluateSignal() {
  const longS = evalDirection("long"), shortS = evalDirection("short"); if (!longS) return;
  let shown = longS.buy ? longS : shortS.buy ? shortS : (longS.trend ? longS : shortS);
  const ct = CONDTEXT[LANG][shown.dir];
  const setCond = (key, ok) => { const li = document.querySelector(`.conditions li[data-cond="${key}"]`); if (!li) return; li.classList.toggle("ok", ok); li.querySelector(".mark").textContent = ok ? "●" : "○"; const tx = li.querySelector(".ctext"); if (tx) tx.textContent = ct[key]; };
  setCond("trend", shown.trend); setCond("pullback", shown.pullback); setCond("rsi", shown.rsiOk); setCond("macd", shown.macdOk); setCond("volume", shown.volOk);
  const badge = $("signalBadge"), dirLabel = $("dirLabel"); const hasPos = !!store.position;
  if (hasPos) { badge.textContent = t("badge.inpos") + " (" + (store.position.direction === "long" ? "LONG" : "SHORT") + ")"; badge.className = "signal-badge wait"; dirLabel.textContent = t("dir.inpos"); lastBuyState = false; }
  else if (longS.buy) { badge.textContent = t("badge.long"); badge.className = "signal-badge buy"; dirLabel.textContent = t("dir.long"); if (!lastBuyState) { beep(); notifySignal("long"); } lastBuyState = true; }
  else if (shortS.buy) { badge.textContent = t("badge.short"); badge.className = "signal-badge sell"; dirLabel.textContent = t("dir.short"); if (!lastBuyState) { beep(); notifySignal("short"); } lastBuyState = true; }
  else { badge.textContent = t("badge.wait"); badge.className = "signal-badge wait"; dirLabel.textContent = t("dir.wait"); lastBuyState = false; }
  $("buyBtn").disabled = hasPos; $("sellBtn").disabled = hasPos;
  updateCoach(longS, shortS, shown);
}
function updateCoach(longS, shortS, shown) {
  const el = $("coachText"); if (!el) return;
  if (store.position) {
    const p = store.position; const pnl = pnlOf(p, state.lastPrice);
    if (LANG === "en") { el.textContent = `You have a ${p.direction === "long" ? "LONG (betting it goes up)" : "SHORT (betting it goes down)"} position. P&L: ${fmtMoney(pnl)}. It closes automatically at the stop (${fmtMoney(p.stop)}) or target (${fmtMoney(p.tp)}). Stick to the plan; don't move the stop out of fear.`; }
    else { el.textContent = `Tienes una posición ${p.direction === "long" ? "LONG (apuestas a que sube)" : "SHORT (apuestas a que baja)"}. P&L: ${fmtMoney(pnl)}. Se cierra sola en el stop (${fmtMoney(p.stop)}) o el objetivo (${fmtMoney(p.tp)}). Respeta el plan; no muevas el stop por miedo.`; }
    return;
  }
  if (longS.buy) { el.textContent = LANG === "en" ? "✅ All 5 LONG conditions met. The market is rising with volume. You could open a buy; the app sets your stop and target automatically." : "✅ Se cumplen las 5 condiciones LONG. El mercado sube con volumen. Podrías abrir una compra; la app pone tu stop y objetivo automáticamente."; return; }
  if (shortS.buy) { el.textContent = LANG === "en" ? "✅ All 5 SHORT conditions met. The market is falling with momentum. You could open a short; you'd profit if it keeps dropping." : "✅ Se cumplen las 5 condiciones SHORT. El mercado baja con momentum. Podrías abrir un corto; ganarías si sigue cayendo."; return; }
  const keys = ["trend", "pullback", "rsi", "macd", "volume"]; const miss = keys.filter((k) => !shown[k === "rsi" ? "rsiOk" : k === "macd" ? "macdOk" : k === "volume" ? "volOk" : k]);
  const faltan = miss.map((k) => COACH_MISS[LANG][shown.dir][k]).slice(0, 2).join(LANG === "en" ? "; and " : "; y ");
  const dirName = shown.dir === "long" ? "LONG" : "SHORT";
  el.textContent = LANG === "en" ? `Better to wait (looking ${dirName}). Missing: ${faltan || "conditions to confirm"}. A good trader doesn't force trades — patience is part of the strategy.` : `Mejor esperar (mirando ${dirName}). Falta que ${faltan || "se confirmen las condiciones"}. Un buen trader no fuerza operaciones: la paciencia es parte de la estrategia.`;
}

/* ------------------------- Paper trading ------------------------- */
function pnlOf(p, price) { return p.direction === "long" ? (price - p.entry) * p.qty : (p.entry - price) * p.qty; }
function openPosition(direction) {
  if (store.position || state.lastPrice == null) return;
  const riskPct = parseFloat($("riskSelect").value); const riskUsd = store.balance * riskPct;
  const positionUsd = Math.min(riskUsd / CONFIG.stopLossPct, store.balance); const entry = state.lastPrice; const qty = positionUsd / entry; const sl = CONFIG.stopLossPct, tp = CONFIG.takeProfitPct;
  store.position = { symbol: state.symbol, direction, entry, qty, positionUsd, riskUsd, stop: direction === "long" ? entry * (1 - sl) : entry * (1 + sl), tp: direction === "long" ? entry * (1 + tp) : entry * (1 - tp), extreme: entry, trailingActive: false, openedAt: Date.now() };
  saveStore(); drawPositionLines(); renderPosition(); renderAccount(); evaluateSignal();
}
function closePosition(reason) {
  if (!store.position) return; const p = store.position; const exit = state.lastPrice;
  const pnl = pnlOf(p, exit); const pnlPct = ((exit - p.entry) / p.entry) * 100 * (p.direction === "long" ? 1 : -1);
  store.balance += pnl; store.trades.unshift({ date: new Date().toISOString(), symbol: p.symbol, direction: p.direction, entry: p.entry, exit, stop: p.stop, tp: p.tp, pnl, pnlPct, reason });
  store.position = null; store.peakEquity = Math.max(store.peakEquity || CONFIG.initialBalance, store.balance);
  saveStore(); clearPositionLines(); renderPosition(); renderAccount(); renderJournal(); renderEquity(); renderAchievements(); evaluateSignal();
}
function checkPositionTriggers() {
  if (!store.position) return; const p = store.position; const price = state.lastPrice;
  if (p.direction === "long") {
    if (price <= p.stop) { closePosition(p.trailingActive ? "Trailing Stop" : "Stop Loss"); return; }
    if (CONFIG.useTrailing) { p.extreme = Math.max(p.extreme || p.entry, price); const ns = p.extreme * (1 - CONFIG.trailPct); if (ns > p.stop) { p.stop = ns; p.trailingActive = true; saveStore(); drawPositionLines(); } }
    else if (price >= p.tp) closePosition("Take Profit");
  } else {
    if (price >= p.stop) { closePosition(p.trailingActive ? "Trailing Stop" : "Stop Loss"); return; }
    if (CONFIG.useTrailing) { p.extreme = Math.min(p.extreme || p.entry, price); const ns = p.extreme * (1 + CONFIG.trailPct); if (ns < p.stop) { p.stop = ns; p.trailingActive = true; saveStore(); drawPositionLines(); } }
    else if (price <= p.tp) closePosition("Take Profit");
  }
}
function drawPositionLines() {
  clearPositionLines(); const p = store.position; if (!p || !candleSeries) return;
  entryLine = candleSeries.createPriceLine({ price: p.entry, color: "#8a97ad", lineWidth: 1, lineStyle: 0, title: t("pos.entry") });
  stopLine = candleSeries.createPriceLine({ price: p.stop, color: "#ea3943", lineWidth: 1, lineStyle: 2, title: p.trailingActive ? "Trailing" : "Stop" });
  if (!CONFIG.useTrailing) tpLine = candleSeries.createPriceLine({ price: p.tp, color: "#16c784", lineWidth: 1, lineStyle: 2, title: "TP" });
}
function clearPositionLines() { [entryLine, stopLine, tpLine].forEach((l) => l && candleSeries && candleSeries.removePriceLine(l)); entryLine = stopLine = tpLine = null; }

/* ------------------------- Render cuenta/posición/stats ------------------------- */
function renderPosition() {
  const p = store.position;
  if (!p) { $("noPosition").classList.remove("hidden"); $("positionInfo").classList.add("hidden"); $("closeBtn").disabled = true; return; }
  const dec = priceDecimals(p.entry); $("noPosition").classList.add("hidden"); $("positionInfo").classList.remove("hidden");
  const dEl = $("posDirection"); dEl.textContent = p.direction === "long" ? "▲ LONG" : "▼ SHORT"; dEl.className = p.direction === "long" ? "tag-long" : "tag-short";
  $("posEntry").textContent = "$" + fmt(p.entry, dec); $("posQty").textContent = fmt(p.qty, 6) + " " + p.symbol.replace("USDT", "");
  $("posStop").textContent = "$" + fmt(p.stop, dec); $("posTP").textContent = "$" + fmt(p.tp, dec);
  const pnl = pnlOf(p, state.lastPrice); const pnlPct = ((state.lastPrice - p.entry) / p.entry) * 100 * (p.direction === "long" ? 1 : -1);
  const el = $("posPnl"); el.textContent = (pnl >= 0 ? "+" : "") + fmtMoney(pnl) + " (" + fmt(pnlPct, 2) + "%)"; el.className = pnl >= 0 ? "green" : "red";
  $("closeBtn").disabled = false;
}
function renderAccount() {
  let equity = store.balance; if (store.position && state.lastPrice != null) equity += pnlOf(store.position, state.lastPrice);
  $("balance").textContent = fmtMoney(store.balance); $("equity").textContent = fmtMoney(equity);
  if (store.position) renderPosition(); renderStats(equity);
}
function renderStats(equity) {
  const trades = store.trades; const wins = trades.filter((t) => t.pnl > 0).length; const winrate = trades.length ? (wins / trades.length) * 100 : 0;
  const netPnl = store.balance - CONFIG.initialBalance; store.peakEquity = Math.max(store.peakEquity || CONFIG.initialBalance, equity);
  const drawdown = store.peakEquity > 0 ? ((store.peakEquity - equity) / store.peakEquity) * 100 : 0;
  $("stTrades").textContent = trades.length; $("stWinrate").textContent = fmt(winrate, 0) + "%";
  const pnlEl = $("stPnl"); pnlEl.textContent = (netPnl >= 0 ? "+" : "") + fmtMoney(netPnl); pnlEl.className = netPnl >= 0 ? "green" : "red";
  $("stDrawdown").textContent = fmt(Math.max(0, drawdown), 1) + "%";
}
function renderJournal() {
  const body = $("journalBody"); if (!store.trades.length) { body.innerHTML = `<tr class="empty"><td colspan="8">${t("journal.empty")}</td></tr>`; return; }
  body.innerHTML = store.trades.map((tr) => { const dec = priceDecimals(tr.entry); const cls = tr.pnl >= 0 ? "win" : "loss"; const d = new Date(tr.date); const date = d.toLocaleDateString(locale()) + " " + d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }); const dir = tr.direction === "short" ? '<span class="tag-short">SHORT</span>' : '<span class="tag-long">LONG</span>'; return `<tr><td>${date}</td><td>${tr.symbol}</td><td>${dir}</td><td>$${fmt(tr.entry, dec)}</td><td>$${fmt(tr.exit, dec)}</td><td class="${cls}">${tr.pnl >= 0 ? "+" : ""}${fmtMoney(tr.pnl)}</td><td class="${cls}">${fmt(tr.pnlPct, 2)}%</td><td>${tr.reason}</td></tr>`; }).join("");
}
function renderEquity() {
  if (!equitySeries) return; const chrono = [...store.trades].reverse(); let bal = CONFIG.initialBalance; let tt = Math.floor(Date.now() / 1000) - chrono.length - 1;
  const data = [{ time: tt, value: bal }]; for (const tr of chrono) { bal += tr.pnl; tt = Math.max(tt + 1, Math.floor(new Date(tr.date).getTime() / 1000)); data.push({ time: tt, value: bal }); }
  for (let i = 1; i < data.length; i++) if (data[i].time <= data[i - 1].time) data[i].time = data[i - 1].time + 1;
  equitySeries.setData(data);
}

/* ------------------------- Logros ------------------------- */
function maxWinStreak() { let max = 0, cur = 0; for (const tr of [...store.trades].reverse()) { if (tr.pnl > 0) { cur++; max = Math.max(max, cur); } else cur = 0; } return max; }
const ACHIEVEMENTS = [
  { id: "first", ico: "🎬", es: ["Primer paso", "Abre tu primera operación"], en: ["First step", "Open your first trade"], chk: (s) => s.trades.length >= 1 },
  { id: "firstwin", ico: "✅", es: ["Primera victoria", "Cierra una operación ganadora"], en: ["First win", "Close a winning trade"], chk: (s) => s.trades.some((t) => t.pnl > 0) },
  { id: "long", ico: "▲", es: ["Alcista", "Haz una operación en largo"], en: ["Bull", "Make a long trade"], chk: (s) => s.trades.some((t) => t.direction === "long") },
  { id: "short", ico: "▼", es: ["Bajista", "Haz una operación en corto"], en: ["Bear", "Make a short trade"], chk: (s) => s.trades.some((t) => t.direction === "short") },
  { id: "five", ico: "5️⃣", es: ["Practicante", "Llega a 5 operaciones"], en: ["Practitioner", "Reach 5 trades"], chk: (s) => s.trades.length >= 5 },
  { id: "ten", ico: "🔟", es: ["Veterano", "Llega a 10 operaciones"], en: ["Veteran", "Reach 10 trades"], chk: (s) => s.trades.length >= 10 },
  { id: "stop", ico: "🛡️", es: ["Disciplina", "Respeta un stop loss"], en: ["Discipline", "Respect a stop loss"], chk: (s) => s.trades.some((t) => /Stop/.test(t.reason)) },
  { id: "streak", ico: "🔥", es: ["En racha", "3 ganadoras seguidas"], en: ["On fire", "3 wins in a row"], chk: () => maxWinStreak() >= 3 },
  { id: "profit", ico: "💰", es: ["En verde", "Termina con saldo > 500$"], en: ["In the green", "End with balance > $500"], chk: (s) => s.balance > CONFIG.initialBalance },
  { id: "plus10", ico: "🚀", es: ["+10%", "Haz crecer la cuenta un 10%"], en: ["+10%", "Grow the account by 10%"], chk: (s) => s.balance >= CONFIG.initialBalance * 1.1 },
  { id: "backtest", ico: "🔬", es: ["Investigador", "Ejecuta un backtest"], en: ["Researcher", "Run a backtest"], chk: (s) => s.flags && s.flags.backtested },
  { id: "calc", ico: "🧮", es: ["Calculador", "Usa la calculadora"], en: ["Calculator", "Use the calculator"], chk: (s) => s.flags && s.flags.calculated },
];
function renderAchievements() {
  const grid = $("achvGrid"); if (!grid) return;
  let unlocked = 0;
  grid.innerHTML = ACHIEVEMENTS.map((a) => { const ok = !!a.chk(store); if (ok) unlocked++; const [nm, ds] = a[LANG] || a.es; return `<div class="achv ${ok ? "unlocked" : ""}"><span class="ico">${a.ico}</span><span class="nm">${nm}</span><span class="ds">${ds}</span></div>`; }).join("");
  $("achvProgress").innerHTML = t("achvProgress") + `<b>${unlocked}</b> / ${ACHIEVEMENTS.length}`;
}

/* ------------------------- Exportar CSV ------------------------- */
function exportCSV() {
  const header = ["Fecha", "Par", "Sentido", "Entrada", "Salida", "Stop", "TP", "Resultado_USD", "Resultado_%", "Motivo"];
  const rows = store.trades.map((tr) => [new Date(tr.date).toLocaleString(locale()), tr.symbol, tr.direction, tr.entry, tr.exit, tr.stop, tr.tp, tr.pnl.toFixed(2), tr.pnlPct.toFixed(2), tr.reason]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "cryptoswing_journal.csv"; a.click();
}

/* ------------------------- Backtesting ------------------------- */
function simulateStrategy(candles, riskPct, cfg = CONFIG) {
  const c = candles; const closes = c.map((x) => x.close); const volumes = c.map((x) => x.volume || 0);
  const e50 = ema(closes, cfg.emaFast), e200 = ema(closes, cfg.emaSlow); const rsiArr = rsi(closes, cfg.rsiPeriod);
  const macdData = macd(closes, cfg.macdFast, cfg.macdSlow, cfg.macdSignal); const volMA = sma(volumes, cfg.volMaPeriod); const macdMode = cfg.macdMode || "zero";
  let balance = cfg.initialBalance, peak = balance, maxDD = 0, pos = null; const trades = [];
  for (let i = cfg.emaSlow; i < c.length; i++) {
    const candle = c[i];
    if (pos) {
      let exit = null, reason = null;
      if (candle.low <= pos.stop) { exit = pos.stop; reason = pos.trailingActive ? "Trailing Stop" : "Stop Loss"; }
      else if (!cfg.useTrailing && candle.high >= pos.tp) { exit = pos.tp; reason = "Take Profit"; }
      if (exit) { const pnl = (exit - pos.entry) * pos.qty; balance += pnl; trades.push({ pnl, reason }); peak = Math.max(peak, balance); maxDD = Math.max(maxDD, peak > 0 ? (peak - balance) / peak : 0); pos = null; }
      else if (cfg.useTrailing) { pos.highest = Math.max(pos.highest, candle.high); const ns = pos.highest * (1 - cfg.trailPct); if (ns > pos.stop) { pos.stop = ns; pos.trailingActive = true; } }
    }
    if (!pos && balance > 0) {
      const price = candle.close; const trend = e50[i] > e200[i]; const pullback = e50[i] > 0 && Math.abs(price - e50[i]) / e50[i] <= cfg.pullbackPct;
      const r = rsiArr[i]; const rsiOk = r != null && !isNaN(r) && r >= cfg.rsiMin && r <= cfg.rsiMax;
      const macdOk = !cfg.useMacd || (macdMode === "hist" ? macdData.histogram[i] > 0 : macdData.macdLine[i] > 0); const volOk = !cfg.useVolume || (volMA[i] != null && candle.volume > volMA[i]);
      if (trend && pullback && rsiOk && macdOk && volOk && price > 0) { const positionUsd = Math.min((balance * riskPct) / cfg.stopLossPct, balance); pos = { entry: price, qty: positionUsd / price, stop: price * (1 - cfg.stopLossPct), tp: price * (1 + cfg.takeProfitPct), highest: price, trailingActive: false }; }
    }
  }
  const wins = trades.filter((t) => t.pnl > 0); const grossWin = wins.reduce((a, t) => a + t.pnl, 0); const grossLoss = Math.abs(trades.filter((t) => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0));
  return { trades: trades.length, wins: wins.length, winrate: trades.length ? (wins.length / trades.length) * 100 : 0, ret: ((balance - cfg.initialBalance) / cfg.initialBalance) * 100, maxDD: maxDD * 100, pf: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0), balance };
}
function candlesPerYear(interval) { const m = { "15m": 96 * 365, "1h": 24 * 365, "4h": 6 * 365, "1d": 365 }; return m[interval] || 365; }

async function runBacktest() {
  const btn = $("backtestBtn"); const years = parseInt($("yearsSelect").value, 10); const riskPct = parseFloat($("riskSelect").value);
  btn.disabled = true; const oldText = btn.textContent; btn.textContent = t("cmp.downloading");
  try {
    const target = Math.min(years * candlesPerYear(state.interval), 6000); const candles = await fetchHistory(target);
    if (!candles || candles.length < CONFIG.emaSlow + 5) { btn.textContent = t("cmp.insufficient"); setTimeout(() => { btn.textContent = oldText; btn.disabled = false; }, 1800); return; }
    const r = simulateStrategy(candles, riskPct);
    $("btTrades").textContent = r.trades; $("btWinrate").textContent = fmt(r.winrate, 0) + "%";
    const retEl = $("btReturn"); retEl.textContent = (r.ret >= 0 ? "+" : "") + fmt(r.ret, 1) + "%"; retEl.className = r.ret >= 0 ? "green" : "red";
    $("btDrawdown").textContent = fmt(r.maxDD, 1) + "%"; $("btPF").textContent = r.pf === Infinity ? "∞" : fmt(r.pf, 2);
    const finalEl = $("btFinal"); finalEl.textContent = fmtMoney(r.balance); finalEl.className = r.balance >= CONFIG.initialBalance ? "green" : "red";
    const first = new Date(candles[0].time * 1000).toLocaleDateString(locale()); const last = new Date(candles[candles.length - 1].time * 1000).toLocaleDateString(locale());
    $("btPeriod").textContent = `${candles.length} velas · ${first} → ${last} · ${state.symbol} · ${state.interval} · ${(riskPct * 100).toFixed(0)}%`;
    $("backtestResults").classList.remove("hidden");
    store.flags.backtested = true; saveStore(); renderAchievements();
  } catch (e) { console.error("Error backtest:", e); btn.textContent = LANG === "en" ? "Connection error" : "Error de conexión"; setTimeout(() => { btn.textContent = oldText; }, 1800); }
  finally { btn.textContent = oldText; btn.disabled = false; }
}

async function compareStrategies() {
  const btn = $("compareBtn"); const years = parseInt($("yearsSelect").value, 10);
  btn.disabled = true; const oldText = btn.textContent; btn.textContent = t("cmp.downloading");
  try {
    const target = Math.min(years * candlesPerYear(state.interval), 6000); const candles = await fetchHistory(target);
    if (!candles || candles.length < CONFIG.emaSlow + 5) { btn.textContent = t("cmp.insufficient"); setTimeout(() => { btn.textContent = oldText; btn.disabled = false; }, 1800); return; }
    const variants = [
      { name: t("cmp.base"), cfg: { ...CONFIG, useTrailing: false }, risk: 0.01 },
      { name: t("cmp.trail"), cfg: { ...CONFIG, useTrailing: true, trailPct: 0.06 }, risk: 0.01 },
      { name: t("cmp.risk2"), cfg: { ...CONFIG, useTrailing: false }, risk: 0.02 },
      { name: t("cmp.nofilter"), cfg: { ...CONFIG, useTrailing: false, useMacd: false, useVolume: false }, risk: 0.01 },
    ];
    const rows = variants.map((v) => ({ name: v.name, r: simulateStrategy(candles, v.risk, v.cfg) }));
    const bestRet = Math.max(...rows.map((x) => x.r.ret));
    const html = `<table class="cmp-table"><thead><tr><th>${t("cmp.head.strategy")}</th><th>${t("cmp.head.ret")}</th><th>${t("cmp.head.dd")}</th><th>${t("cmp.head.trades")}</th><th>${t("cmp.head.win")}</th></tr></thead><tbody>` +
      rows.map((x) => `<tr><td>${x.name}</td><td class="${x.r.ret === bestRet ? "cmp-best" : (x.r.ret >= 0 ? "green" : "red")}">${x.r.ret >= 0 ? "+" : ""}${fmt(x.r.ret, 1)}%</td><td>${fmt(x.r.maxDD, 1)}%</td><td>${x.r.trades}</td><td>${fmt(x.r.winrate, 0)}%</td></tr>`).join("") +
      `</tbody></table>`;
    const el = $("compareResults"); el.innerHTML = html; el.classList.remove("hidden");
    store.flags.backtested = true; saveStore(); renderAchievements();
  } catch (e) { console.error("Error comparar:", e); btn.textContent = LANG === "en" ? "Connection error" : "Error de conexión"; setTimeout(() => { btn.textContent = oldText; }, 1800); }
  finally { btn.textContent = oldText; btn.disabled = false; }
}

/* ------------------------- Calculadora ------------------------- */
let lastCalc = null;
function prefillCalc() {
  if (state.lastPrice == null) return; const dec = priceDecimals(state.lastPrice);
  if (!parseFloat($("calcEntry").value)) $("calcEntry").value = state.lastPrice.toFixed(dec);
  const entry = parseFloat($("calcEntry").value) || state.lastPrice; const dir = $("calcDir").value;
  if (!parseFloat($("calcStop").value)) $("calcStop").value = (dir === "long" ? entry * (1 - CONFIG.stopLossPct) : entry * (1 + CONFIG.stopLossPct)).toFixed(dec);
  if (!parseFloat($("calcTarget").value)) $("calcTarget").value = (dir === "long" ? entry * (1 + CONFIG.takeProfitPct) : entry * (1 - CONFIG.takeProfitPct)).toFixed(dec);
  $("calcCapital").value = store.balance.toFixed(2);
}
function runCalc() {
  const capital = parseFloat($("calcCapital").value) || 0; const riskPct = (parseFloat($("calcRisk").value) || 0) / 100; const dir = $("calcDir").value;
  const entry = parseFloat($("calcEntry").value) || 0; const stop = parseFloat($("calcStop").value) || 0; const target = parseFloat($("calcTarget").value) || 0;
  const res = $("calcResults"); const verdict = $("calcVerdict");
  if (capital <= 0 || entry <= 0 || stop <= 0) { res.classList.remove("hidden"); verdict.textContent = LANG === "en" ? "⚠️ Fill capital, entry and stop with values greater than 0." : "⚠️ Rellena capital, entrada y stop con valores mayores que 0."; $("calcSaveBtn").disabled = true; return; }
  const riskUsd = capital * riskPct; const stopDistPct = Math.abs(entry - stop) / entry; const posUsd = stopDistPct > 0 ? riskUsd / stopDistPct : 0; const units = entry > 0 ? posUsd / entry : 0;
  const lossUsd = riskUsd; const profitUsd = target > 0 ? Math.abs(target - entry) * units : 0; const rr = lossUsd > 0 && profitUsd > 0 ? profitUsd / lossUsd : 0;
  const toStop = stopDistPct * 100; const toTarget = target > 0 ? (Math.abs(target - entry) / entry) * 100 : 0;
  $("calcRiskUsd").textContent = fmtMoney(riskUsd); $("calcPosUsd").textContent = fmtMoney(posUsd) + (posUsd > capital ? (LANG === "en" ? " (needs leverage!)" : " (¡necesita apalancamiento!)") : "");
  $("calcUnits").textContent = fmt(units, 6); $("calcRR").textContent = rr > 0 ? "1 : " + fmt(rr, 2) : "—";
  $("calcProfit").textContent = profitUsd > 0 ? "+" + fmtMoney(profitUsd) : "—"; $("calcLoss").textContent = "-" + fmtMoney(lossUsd);
  $("calcToStop").textContent = fmt(toStop, 2) + "%"; $("calcToTarget").textContent = target > 0 ? fmt(toTarget, 2) + "%" : "—";
  let warn = "";
  if (dir === "long" && !(stop < entry && (target === 0 || target > entry))) warn = LANG === "en" ? "⚠️ LONG: stop must be BELOW entry and target ABOVE." : "⚠️ En LONG: el stop debe ir por DEBAJO de la entrada y el objetivo por ENCIMA.";
  if (dir === "short" && !(stop > entry && (target === 0 || target < entry))) warn = LANG === "en" ? "⚠️ SHORT: stop must be ABOVE entry and target BELOW." : "⚠️ En SHORT: el stop debe ir por ENCIMA de la entrada y el objetivo por DEBAJO.";
  let v = warn;
  if (!warn) {
    if (rr >= 2) v = (LANG === "en" ? "✅ Good ratio (1:" : "✅ Buen ratio (1:") + fmt(rr, 1) + (LANG === "en" ? `). You risk ${fmtMoney(riskUsd)} to gain ${fmtMoney(profitUsd)}.` : `). Arriesgas ${fmtMoney(riskUsd)} para ganar ${fmtMoney(profitUsd)}.`);
    else if (rr > 0) v = (LANG === "en" ? "⚠️ Low ratio (1:" : "⚠️ Ratio bajo (1:") + fmt(rr, 1) + (LANG === "en" ? "). Aim for at least 1:2." : "). Lo ideal es al menos 1:2.");
    else v = LANG === "en" ? "ℹ️ Add a target price to compute the risk/reward ratio." : "ℹ️ Añade un precio objetivo para calcular el ratio riesgo/beneficio.";
  }
  verdict.textContent = v; res.classList.remove("hidden");
  lastCalc = { date: new Date().toISOString(), capital, riskPct, dir, entry, stop, target, riskUsd, posUsd, units, rr, profitUsd, lossUsd };
  $("calcSaveBtn").disabled = false;
  store.flags.calculated = true; saveStore(); renderAchievements();
}
function saveCalc() { if (!lastCalc) return; store.calcs.unshift(lastCalc); saveStore(); renderCalcs(); }
function renderCalcs() {
  const el = $("calcList"); if (!store.calcs.length) { el.innerHTML = `<p class="muted">${t("calc.noSaved")}</p>`; return; }
  el.innerHTML = store.calcs.map((c, i) => { const dec = priceDecimals(c.entry); const d = new Date(c.date); const dirTag = c.dir === "short" ? '<span class="tag-short">SHORT</span>' : '<span class="tag-long">LONG</span>'; return `<div class="calc-item"><div class="ci-head"><span>${dirTag} · ${d.toLocaleDateString(locale())} ${d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}</span><button class="ci-del" data-i="${i}">🗑️</button></div>${t("calc.entry")} $${fmt(c.entry, dec)} · Stop $${fmt(c.stop, dec)}${c.target > 0 ? " · TP $" + fmt(c.target, dec) : ""}<br>${t("calc.posUsd")} <b>${fmtMoney(c.posUsd)}</b> (${fmt(c.units, 6)}) · ${t("calc.riskUsd")} <b>${fmtMoney(c.riskUsd)}</b> · R/B <b>${c.rr > 0 ? "1:" + fmt(c.rr, 2) : "—"}</b></div>`; }).join("");
  el.querySelectorAll(".ci-del").forEach((b) => b.addEventListener("click", (e) => { store.calcs.splice(+e.target.dataset.i, 1); saveStore(); renderCalcs(); }));
}
function clearCalcs() { if (!store.calcs.length || !confirm(LANG === "en" ? "Delete all saved calculations?" : "¿Borrar todos los cálculos guardados?")) return; store.calcs = []; saveStore(); renderCalcs(); }

/* ------------------------- Asistente IA (bilingüe) ------------------------- */
const KB = [
  { k: ["long", "largo", "comprar", "alcista", "buy"], es: "Ir en LONG (largo) significa COMPRAR esperando que el precio SUBA. Compras barato para vender más caro. Ganas si sube. Es la base del trading alcista.", en: "Going LONG means BUYING expecting the price to RISE. Buy low to sell higher. You win if it goes up. It's the basis of bullish trading." },
  { k: ["short", "corto", "vender", "bajista", "sell"], es: "Ir en SHORT (corto) significa VENDER esperando que el precio BAJE. Vendes caro para recomprar barato. Permite ganar en mercados bajistas, pero el riesgo es mayor: usa siempre stop loss.", en: "Going SHORT means SELLING expecting the price to FALL. Sell high to buy back lower. Lets you profit in bear markets, but risk is higher: always use a stop loss." },
  { k: ["stop", "stop loss", "stoploss"], es: "El STOP LOSS es el precio donde cierras la operación para LIMITAR tu pérdida. Es tu cinturón de seguridad. Defínelo ANTES de entrar y no lo muevas a peor por miedo.", en: "The STOP LOSS is the price where you close a trade to LIMIT your loss. It's your seatbelt. Set it BEFORE entering and don't move it out of fear." },
  { k: ["take profit", "objetivo", "tp", "beneficio", "target"], es: "El TAKE PROFIT es el precio objetivo donde recoges ganancias. En esta app está en +10% (ratio 1:2 con el stop del 5%).", en: "The TAKE PROFIT is the target price where you bank gains. In this app it's +10% (1:2 ratio with the 5% stop)." },
  { k: ["riesgo", "gestion", "gestionar", "risk", "management"], es: "La GESTIÓN DE RIESGO es lo más importante. Regla del 1%: nunca arriesgues más del 1-2% de tu cuenta por operación. Así una mala racha no te arruina.", en: "RISK MANAGEMENT is the most important thing. The 1% rule: never risk more than 1-2% of your account per trade. That way a losing streak won't ruin you." },
  { k: ["tamano", "posicion", "cuanto invertir", "size", "position"], es: "Tamaño de posición = (riesgo en USD) / (distancia al stop en %). Ej.: arriesgas 5$ y el stop está al 5% → inviertes 100$. Usa la pestaña Calculadora.", en: "Position size = (risk in USD) / (distance to stop in %). E.g.: risk $5 and stop at 5% → invest $100. Use the Calculator tab." },
  { k: ["rsi"], es: "El RSI mide si un activo está sobrecomprado (>70) o sobrevendido (<30). Buscamos RSI entre 40 y 55 para comprar en un retroceso sano.", en: "The RSI shows if an asset is overbought (>70) or oversold (<30). We look for RSI between 40 and 55 to buy on a healthy pullback." },
  { k: ["ema", "media movil", "medias", "moving average"], es: "La EMA es una media móvil. Usamos EMA50 y EMA200. Si la EMA50 está por encima, la tendencia es alcista; por debajo, bajista.", en: "The EMA is a moving average. We use EMA50 and EMA200. If EMA50 is above, the trend is bullish; below, bearish." },
  { k: ["macd"], es: "El MACD mide el momentum. Por encima de 0, impulso alcista; por debajo, bajista. Lo usamos como filtro para no entrar a contracorriente.", en: "The MACD measures momentum. Above 0, bullish push; below, bearish. We use it as a filter to avoid trading against the flow." },
  { k: ["volumen", "volume"], es: "El VOLUMEN es cuánto se negocia. Un movimiento con volumen alto es más fiable. Filtramos exigiendo volumen sobre su media de 20.", en: "VOLUME is how much is traded. A move with high volume is more reliable. We filter by requiring volume above its 20-period average." },
  { k: ["drawdown"], es: "El DRAWDOWN es la mayor caída de tu cuenta desde un máximo. Mide el dolor máximo soportado. Cuanto menor, mejor.", en: "DRAWDOWN is the biggest drop of your account from a peak. It measures the max pain endured. The lower, the better." },
  { k: ["win rate", "winrate", "aciertos"], es: "El WIN RATE es el % de operaciones ganadoras. Con buen ratio 1:2 no necesitas acertar mucho: con 40% ya puedes ser rentable.", en: "WIN RATE is the % of winning trades. With a good 1:2 ratio you don't need to be right often: 40% can already be profitable." },
  { k: ["ratio", "riesgo beneficio", "r/b", "rr", "risk reward"], es: "El RATIO RIESGO/BENEFICIO compara lo que arriesgas con lo que puedes ganar. 1:2 = arriesgar 1 para ganar 2. Clave de la rentabilidad.", en: "The RISK/REWARD ratio compares what you risk vs what you can gain. 1:2 = risk 1 to make 2. Key to long-term profitability." },
  { k: ["backtest", "backtesting", "historico", "history"], es: "El BACKTESTING prueba la estrategia con datos del PASADO. Puedes lanzar uno de hasta 5 años. Rendimientos pasados no garantizan futuros.", en: "BACKTESTING tests the strategy with PAST data. You can run one up to 5 years. Past returns don't guarantee future ones." },
  { k: ["corto plazo", "intradia", "scalping", "day trading"], es: "El CORTO PLAZO usa temporalidades pequeñas (15m, 1h) y operaciones de minutos u horas. Más señales pero más ruido.", en: "SHORT TERM uses small timeframes (15m, 1h) and trades of minutes or hours. More signals but more noise." },
  { k: ["largo plazo", "swing", "inversion", "long term"], es: "El LARGO PLAZO / SWING usa temporalidades grandes (4h, 1 día) y operaciones de días o semanas. Más relajado, ideal para empezar.", en: "LONG TERM / SWING uses big timeframes (4h, 1d) and trades of days or weeks. More relaxed, ideal to start." },
  { k: ["empezar", "principiante", "novato", "start", "beginner"], es: "Para empezar: 1) Practica aquí con dinero ficticio. 2) Opera solo BTC/ETH. 3) Arriesga máximo 1%. 4) Lleva un journal. 5) Practica 1-2 meses antes del dinero real.", en: "To start: 1) Practice here with fake money. 2) Trade only BTC/ETH. 3) Risk max 1%. 4) Keep a journal. 5) Practice 1-2 months before real money." },
  { k: ["apalancamiento", "leverage", "apalancar"], es: "El APALANCAMIENTO multiplica tu posición con dinero prestado (x2, x10). Multiplica ganancias y pérdidas, y puede liquidarte. Para principiantes: evítalo.", en: "LEVERAGE multiplies your position with borrowed money (x2, x10). It multiplies gains and losses, and can liquidate you. Beginners: avoid it." },
  { k: ["fomo", "miedo", "psicologia", "emociones", "psychology"], es: "La PSICOLOGÍA es el 80% del trading. El FOMO y el revenge trading destruyen cuentas. Ten un plan, respeta el stop y acepta perder algunas.", en: "PSYCHOLOGY is 80% of trading. FOMO and revenge trading destroy accounts. Have a plan, respect the stop, and accept losing some." },
  { k: ["exchange", "binance", "donde"], es: "Un EXCHANGE es la plataforma donde compras/vendes cripto (Binance, Coinbase...). Esta app usa datos públicos de Binance; no opera con tu dinero.", en: "An EXCHANGE is the platform where you buy/sell crypto (Binance, Coinbase...). This app uses Binance public data; it doesn't trade your money." },
  { k: ["comision", "fees", "comisiones"], es: "Las COMISIONES son lo que cobra el exchange (≈0.1% por operación). Parecen poco pero se acumulan si operas mucho.", en: "FEES are what the exchange charges (≈0.1% per trade). They seem small but add up if you trade a lot." },
  { k: ["dca", "promediar"], es: "El DCA es comprar cantidades fijas cada cierto tiempo sin importar el precio. Reduce el impacto de la volatilidad. Estrategia de largo plazo.", en: "DCA is buying fixed amounts periodically regardless of price. It reduces volatility impact. A low-stress long-term strategy." },
  { k: ["vender app", "apk", "negocio", "monetizar", "sell app"], es: "Puedes vender la app como SIMULADOR EDUCATIVO (legítimo). Vender señales/asesoramiento está REGULADO. Mantén el aviso de 'no es asesoramiento financiero'.", en: "You can sell the app as an EDUCATIONAL SIMULATOR (legitimate). Selling signals/advice is REGULATED. Keep the 'not financial advice' notice." },
];
const KB_FALLBACK = { es: "Buena pregunta. Puedo ayudarte con: long, short, stop loss, take profit, gestión de riesgo, tamaño de posición, RSI, EMA, MACD, volumen, drawdown, win rate, ratio R/B, backtesting, corto vs largo plazo, apalancamiento, psicología y cómo empezar. Reformula con alguna de esas palabras. 😊", en: "Good question. I can help with: long, short, stop loss, take profit, risk management, position size, RSI, EMA, MACD, volume, drawdown, win rate, R/R ratio, backtesting, short vs long term, leverage, psychology and how to start. Rephrase using one of those words. 😊" };
function assistantAnswer(q, lang) {
  const L = lang || LANG; const n = normalize(q);
  if (/\b(hola|buenas|hey|saludos|hi|hello)\b/.test(n)) return L === "en" ? "Hi! 👋 I'm your trading assistant. Ask me about long, short, stop loss, risk management, RSI, how to start..." : "¡Hola! 👋 Soy tu asistente de trading. Pregúntame sobre long, short, stop loss, gestión de riesgo, RSI, cómo empezar...";
  if (/(gracias|thanks|thank you)/.test(n)) return L === "en" ? "You're welcome! 💪 Practice in demo, manage risk and be patient." : "¡A mandar! 💪 Practica en demo, gestiona el riesgo y sé paciente.";
  let best = null, bestScore = 0;
  for (const item of KB) { let score = 0; for (const kw of item.k) if (n.includes(normalize(kw))) score += kw.split(" ").length; if (score > bestScore) { bestScore = score; best = item; } }
  return best ? (best[L] || best.es) : (KB_FALLBACK[L] || KB_FALLBACK.es);
}
function addMsg(text, who) { const log = $("chatLog"); const div = document.createElement("div"); div.className = "msg " + who; div.textContent = text; log.appendChild(div); log.scrollTop = log.scrollHeight; }
async function askAI(question) {
  const key = ($("apiKeyInput").value || "").trim(); if (!key) return assistantAnswer(question);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key }, body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: (LANG === "en" ? "You are a crypto trading expert explaining simply to beginners, in English. Be clear, prudent; not financial advice." : "Eres un experto en trading de cripto que explica de forma sencilla a principiantes, en español. Sé claro, prudente; no es asesoramiento financiero.") }, { role: "user", content: question }], temperature: 0.5 }) });
    if (!res.ok) throw new Error("HTTP " + res.status); const data = await res.json(); return data.choices?.[0]?.message?.content?.trim() || assistantAnswer(question);
  } catch (e) { return assistantAnswer(question) + (LANG === "en" ? "\n\n(Couldn't reach your external AI, answered with the local assistant.)" : "\n\n(No pude conectar con tu IA externa, respondí con el asistente local.)"); }
}
async function sendChat(text) {
  const q = (text != null ? text : $("chatInput").value).trim(); if (!q) return;
  addMsg(q, "user"); $("chatInput").value = ""; addMsg("…", "bot");
  const answer = await askAI(q); const log = $("chatLog"); if (log.lastChild) log.lastChild.textContent = answer; else addMsg(answer, "bot");
}

/* ------------------------- Glosario y pasos ------------------------- */
const GLOSSARY = {
  es: [["Trading", "Comprar y vender activos buscando beneficio de los movimientos de precio."], ["Long (largo)", "Apostar a que el precio SUBE."], ["Short (corto)", "Apostar a que el precio BAJA."], ["Stop Loss", "Precio de salida que limita tu pérdida."], ["Take Profit", "Precio objetivo donde recoges ganancias."], ["Pullback", "Pequeño retroceso dentro de una tendencia."], ["Volatilidad", "Cuánto se mueve el precio."], ["Tendencia", "Dirección general del precio."], ["Equity", "Valor total de tu cuenta con las operaciones abiertas."], ["Drawdown", "La mayor caída de tu cuenta desde un máximo."], ["Apalancamiento", "Operar con dinero prestado para multiplicar la posición."], ["Liquidez", "Facilidad para comprar/vender sin mover el precio."]],
  en: [["Trading", "Buying and selling assets to profit from price moves."], ["Long", "Betting the price goes UP."], ["Short", "Betting the price goes DOWN."], ["Stop Loss", "Exit price that limits your loss."], ["Take Profit", "Target price where you bank gains."], ["Pullback", "A small retracement within a trend."], ["Volatility", "How much the price moves."], ["Trend", "General direction of the price."], ["Equity", "Total value of your account including open trades."], ["Drawdown", "The biggest drop of your account from a peak."], ["Leverage", "Trading with borrowed money to multiply the position."], ["Liquidity", "Ease of buying/selling without moving the price."]],
};
function renderGlossary() { const el = $("glossary"); if (!el) return; el.innerHTML = (GLOSSARY[LANG] || GLOSSARY.es).map(([t2, d]) => `<div class="gloss-item"><b>${t2}</b><p>${d}</p></div>`).join(""); }
const STEPS = {
  es: ["<b>¿Qué es esto?</b> Un simulador para practicar trading de cripto con dinero ficticio y datos reales. Cero riesgo.", "<b>Elige par y plazo.</b> BTC/ETH para empezar. 1 día = largo plazo; 15m/1h = corto plazo.", "<b>Mira el Coach.</b> Te dice si conviene comprar (long), vender (short) o esperar.", "<b>Abre una operación.</b> LONG si crees que sube, SHORT si crees que baja. La app calcula tu stop y objetivo.", "<b>Revisa estadísticas y journal.</b> Aprende de cada operación. Practica 1 mes antes del dinero real."],
  en: ["<b>What is this?</b> A simulator to practice crypto trading with fake money and real data. Zero risk.", "<b>Pick a pair and timeframe.</b> BTC/ETH to start. 1 day = long term; 15m/1h = short term.", "<b>Watch the Coach.</b> It tells you whether to buy (long), sell (short) or wait.", "<b>Open a trade.</b> LONG if you think it rises, SHORT if it falls. The app sets your stop and target.", "<b>Review stats and journal.</b> Learn from each trade. Practice 1 month before real money."],
};
function renderLearnSteps() { const el = $("learnSteps"); if (!el) return; el.innerHTML = (STEPS[LANG] || STEPS.es).map((s) => `<li>${s}</li>`).join(""); }

/* ------------------------- Alertas / notificaciones ------------------------- */
let soundOn = true; let lastBuyState = false;
function beep() { if (!soundOn) return; try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); [880, 1175].forEach((freq, i) => { const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.frequency.value = freq; osc.type = "sine"; osc.connect(gain); gain.connect(ctx.destination); const tt = ctx.currentTime + i * 0.18; gain.gain.setValueAtTime(0.001, tt); gain.gain.exponentialRampToValueAtTime(0.3, tt + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, tt + 0.16); osc.start(tt); osc.stop(tt + 0.18); }); } catch (e) {} }
function toggleSound() { soundOn = !soundOn; const b = $("soundToggle"); b.textContent = soundOn ? "🔔" : "🔕"; b.classList.toggle("off", !soundOn); }
let notifOn = false;
function notifAvailable() { return typeof window !== "undefined" && "Notification" in window; }
function toggleNotif() {
  const b = $("notifToggle"); if (!notifAvailable()) return;
  if (!notifOn) { Notification.requestPermission().then((perm) => { notifOn = perm === "granted"; b.textContent = notifOn ? "🔔📲" : "🔕📲"; b.classList.toggle("off", !notifOn); try { localStorage.setItem("cryptoswing_notif", notifOn ? "1" : "0"); } catch (e) {} if (notifOn) notify("CryptoSwing", LANG === "en" ? "Alerts on. We'll notify you on a signal." : "Avisos activados. Te avisaremos en cada señal."); }); }
  else { notifOn = false; b.textContent = "🔕📲"; b.classList.add("off"); try { localStorage.setItem("cryptoswing_notif", "0"); } catch (e) {} }
}
function notify(title, body) { if (!notifOn || !notifAvailable() || Notification.permission !== "granted") return; try { new Notification(title, { body, icon: "icon.svg", tag: "cryptoswing-signal", renotify: true }); } catch (e) {} }
function notifySignal(dir) { const price = state.lastPrice != null ? "$" + fmt(state.lastPrice, priceDecimals(state.lastPrice)) : ""; const sym = state.symbol.replace("USDT", ""); if (dir === "long") notify("🟢 " + (LANG === "en" ? "LONG signal" : "Señal LONG") + " · " + sym, (LANG === "en" ? "Market rising (" : "El mercado sube (") + price + ")."); else notify("🔴 " + (LANG === "en" ? "SHORT signal" : "Señal SHORT") + " · " + sym, (LANG === "en" ? "Market falling (" : "El mercado baja (") + price + ")."); }

/* ------------------------- Tema e idioma ------------------------- */
function applyTheme(theme) { document.body.classList.toggle("light", theme === "light"); $("themeToggle").textContent = theme === "light" ? "☀️" : "🌙"; try { localStorage.setItem("cryptoswing_theme", theme); } catch (e) {} }
function toggleTheme() { applyTheme(document.body.classList.contains("light") ? "dark" : "light"); }

function applyLang(lang) {
  LANG = lang === "en" ? "en" : "es";
  try { localStorage.setItem("cryptoswing_lang", LANG); } catch (e) {}
  document.documentElement.lang = LANG; $("langToggle").textContent = LANG === "es" ? "ES" : "EN";
  document.querySelectorAll("[data-i18n]").forEach((el) => { const k = el.getAttribute("data-i18n"); el.textContent = t(k); });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.getAttribute("data-i18n-ph")); });
  document.querySelectorAll("[data-i18n-label]").forEach((el) => { el.label = t(el.getAttribute("data-i18n-label")); });
  // re-render dinámicos
  updatePlazoHint(); renderGlossary(); renderLearnSteps(); renderJournal(); renderCalcs(); renderAchievements();
  if (state._ind) evaluateSignal(); else { const b = $("signalBadge"); if (b) b.textContent = t("badge.wait"); }
}
function toggleLang() { applyLang(LANG === "es" ? "en" : "es"); }

/* ------------------------- Reset ------------------------- */
function resetAccount() {
  if (!confirm(LANG === "en" ? "Reset the demo account? History will be erased and balance back to $500." : "¿Reiniciar la cuenta demo? Se borrará el historial y el saldo volverá a 500 USD.")) return;
  store = { balance: CONFIG.initialBalance, position: null, trades: [], peakEquity: CONFIG.initialBalance, calcs: store.calcs || [], flags: store.flags || {} };
  saveStore(); clearPositionLines(); renderPosition(); renderAccount(); renderJournal(); renderEquity(); renderAchievements(); evaluateSignal();
}

/* ------------------------- Tabs y plazo ------------------------- */
function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tabpanel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active"); const panel = $("tab-" + btn.dataset.tab); if (panel) panel.classList.add("active");
      if (btn.dataset.tab === "calc") prefillCalc();
      if (btn.dataset.tab === "operar") setTimeout(() => { [["chart", chart], ["rsiChart", rsiChart], ["equityChart", equityChart]].forEach(([id, ch]) => { if (ch && $(id)) ch.applyOptions({ width: $(id).clientWidth, height: $(id).clientHeight }); }); }, 50);
    });
  });
}
function updatePlazoHint() { const v = $("intervalSelect").value; const short = v === "15m" || v === "1h"; $("plazoHint").textContent = short ? t("plazo.short") : t("plazo.long"); }

/* ------------------------- Init ------------------------- */
function changeMarket() { state.symbol = $("symbolSelect").value; state.interval = $("intervalSelect").value; updatePlazoHint(); refresh(); }
function init() {
  buildCharts(); setupTabs();
  applyTheme(localStorage.getItem("cryptoswing_theme") || "dark");
  applyLang(localStorage.getItem("cryptoswing_lang") || "es");
  renderPosition(); renderAccount(); renderJournal(); renderEquity(); renderCalcs(); renderGlossary(); renderLearnSteps(); renderAchievements();
  addMsg(t("ai.greeting"), "bot");
  const savedKey = localStorage.getItem("cryptoswing_apikey"); if (savedKey) $("apiKeyInput").value = savedKey;
  if (notifAvailable() && localStorage.getItem("cryptoswing_notif") === "1" && Notification.permission === "granted") { notifOn = true; const b = $("notifToggle"); b.textContent = "🔔📲"; b.classList.remove("off"); }

  $("symbolSelect").addEventListener("change", changeMarket);
  $("intervalSelect").addEventListener("change", changeMarket);
  $("buyBtn").addEventListener("click", () => openPosition("long"));
  $("sellBtn").addEventListener("click", () => openPosition("short"));
  $("closeBtn").addEventListener("click", () => closePosition(LANG === "en" ? "Manual close" : "Cierre manual"));
  $("resetBtn").addEventListener("click", resetAccount);
  $("exportBtn").addEventListener("click", exportCSV);
  $("riskSelect").addEventListener("change", renderAccount);
  $("backtestBtn").addEventListener("click", runBacktest);
  $("compareBtn").addEventListener("click", compareStrategies);
  $("soundToggle").addEventListener("click", toggleSound);
  $("notifToggle").addEventListener("click", toggleNotif);
  $("themeToggle").addEventListener("click", toggleTheme);
  $("langToggle").addEventListener("click", toggleLang);
  $("trailingToggle").addEventListener("change", (e) => { CONFIG.useTrailing = e.target.checked; if (store.position) drawPositionLines(); });
  $("calcBtn").addEventListener("click", runCalc);
  $("calcSaveBtn").addEventListener("click", saveCalc);
  $("clearCalcsBtn").addEventListener("click", clearCalcs);
  $("calcDir").addEventListener("change", prefillCalc);
  $("chatSend").addEventListener("click", () => sendChat());
  $("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
  document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => sendChat(c.dataset.q)));
  $("apiKeyInput").addEventListener("change", (e) => { localStorage.setItem("cryptoswing_apikey", e.target.value.trim()); });

  if (store.position) { state.symbol = store.position.symbol; $("symbolSelect").value = state.symbol; }
  refresh().then(() => { if (store.position) drawPositionLines(); });
  state.timer = setInterval(refresh, CONFIG.refreshMs);
}
document.addEventListener("DOMContentLoaded", init);
