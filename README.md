# 📈 CryptoSwing — Simulador de Swing Trading

App web para **practicar trading de criptomonedas con dinero ficticio**, usando datos de mercado **reales** y gráficos profesionales en tiempo real.

> ⚠️ **Educativo.** No es asesoramiento financiero. Las operaciones son simuladas (paper trading); los precios son reales (API pública de Binance, solo lectura). El trading real de cripto es de alto riesgo.

---

## ✨ Características

- 🗂️ **4 pestañas**: Operar · Calculadora · Asistente IA · Aprender.
- 📊 **Gráfico de velas en tiempo real** con EMA 50/200, RSI(14), MACD y volumen.
- ↕️ **Operativa LONG y SHORT** (gana tanto si el mercado sube como si baja).
- ⏱️ **Corto y largo plazo**: temporalidades de 15m/1h (intradía) a 4h/1d (swing).
- 🧭 **Coach inteligente**: te explica en lenguaje sencillo si conviene comprar, vender o esperar, y qué condición falta.
- 🟢 **Detector de señales** con 5 condiciones de confirmación para cada sentido.
- 💵 **Cuenta de práctica con 500 USD** ficticios.
- 🛡️ **Gestión de riesgo automática** (stop 5% / TP 10%, ratio 1:2 optimizado).
- 🧮 **Calculadora de operaciones** con historial guardado (tamaño de posición, riesgo, R:R, ganancia/pérdida).
- 🤖 **Asistente IA integrado** para resolver dudas (funciona sin conexión; opción de conectar tu propia clave de OpenAI).
- 🎓 **Modo principiante**: tutorial paso a paso, glosario y explicación de long vs short.
- 🔬 **Backtesting** con años de histórico real + **comparador de estrategias** (lado a lado).
- 🏆 **Logros/retos** para principiantes (gamificación que engancha y enseña).
- 🌗 **Tema claro/oscuro** y 🌍 **bilingüe (Español/English)** con un clic.
- 📈 **Curva de equity** + journal + estadísticas + export CSV.
- 🔔 **Alertas sonoras**, 📲 **notificaciones del navegador** y **PWA instalable** (camino a la APK).

> 🧪 La estrategia (filtros MACD + volumen, ratio 1:2) está **validada con backtests** sobre 5-10 años. Toda la lógica pasa **221 tests automáticos, 0 fallos**, y la app arranca sin errores.

---

## 🚀 Cómo ejecutarla (en tu PC)

No necesita instalación ni claves de API. Solo un servidor web local (porque el navegador bloquea `fetch` desde `file://`).

### Opción A — Python (ya lo tienes instalado)
```bash
cd criptoswing
python3 -m http.server 8080
```
Abre en el navegador: **http://localhost:8080**

### Opción B — Node.js
```bash
cd criptoswing
npx serve .
```

### Opción C — Extensión "Live Server" de VS Code
Clic derecho en `index.html` → *Open with Live Server*.

> Si ves "SIN CONEXIÓN" en la esquina, tu red/región puede bloquear Binance. La app intenta automáticamente `binance.com`, `binance.us` y `data-api.binance.vision`.

---

## 🎮 Cómo usarla

1. Elige el **par** (BTC, ETH...) y la **temporalidad** (15m, 1h, 4h, 1D).
2. Observa el panel **"Señal de la estrategia"**:
   - Cuando las **3 condiciones** se pongan en verde, aparece **🟢 COMPRA**.
3. Pulsa **COMPRAR (Long)** → se abre una posición simulada con tu gestión de riesgo.
   - Verás las líneas de **Entrada**, **Stop** (rojo) y **TP** (verde) en el gráfico.
4. La posición se cierra **automáticamente** al tocar el Stop o el Take Profit, o manualmente con **CERRAR**.
5. Revisa tu **Journal** y tus **Estadísticas** para mejorar.
6. **Reiniciar cuenta demo** vuelve a poner 500 USD y borra el historial.

---

## 🌐 Publicación web automática (GitHub Pages)

El repositorio ya incluye un workflow que **despliega la web automáticamente** cada vez que haces push a `main`.

1. Solo necesitas (una vez) ir a **Settings → Pages** y, si no se activó solo, elegir como *Source* → **GitHub Actions**.
2. Cada push a `main` publica la app. La URL será:
   `https://kepabilbao67-bot.github.io/criptoswing/`
3. Workflow: `.github/workflows/deploy-pages.yml`

Con esa URL (HTTPS) ya puedes **instalar la PWA** en el móvil: abre la web → menú del navegador → *Añadir a pantalla de inicio*.

---

## 📱 Generar la APK de Android — AUTOMÁTICO (sin instalar nada)

El repositorio incluye un workflow que **compila la APK en la nube** con GitHub Actions:

1. Ve a la pestaña **Actions** del repositorio.
2. Elige el workflow **"Compilar APK Android"** → botón **"Run workflow"**.
3. Cuando termine (unos minutos), entra en la ejecución y descarga el artefacto **`cryptoswing-apk`** (contiene `app-debug.apk`).
4. Copia ese `.apk` a tu móvil Android e instálalo (activa "instalar apps de orígenes desconocidos").

Workflow: `.github/workflows/build-apk.yml`

### Generar la APK en tu PC (alternativa manual)

Requisitos: **Node.js**, **Java JDK 17** y **Android Studio**.

```bash
npm install            # instala Capacitor
npm run android:add    # prepara www/ y añade la plataforma Android
npm run android:copy   # sincroniza los archivos web
npm run android:open   # abre Android Studio
```

En **Android Studio** → *Build > Build Bundle(s)/APK(s) > Build APK(s)*.

> La APK *debug* sirve para probar e instalar manualmente. Para **publicar en Google Play** necesitas una cuenta de desarrollador y firmar la app con un *keystore* (build *release*).

---

## 💼 Sobre "vender la estrategia y la app"

Algunas ideas legítimas y responsables:

- **Vender la app (SaaS o APK):** ofrécela como simulador educativo. Sé transparente: deja claro que es **paper trading** y **no** asesoramiento financiero.
- **Modelo freemium:** versión gratis con 1-2 pares; versión premium con más pares, alertas, backtesting e informes.
- **Cursos / contenido:** la app es una gran herramienta de apoyo para enseñar gestión de riesgo.
- ⚖️ **Importante:** vender *señales* o *asesoramiento de inversión* está **regulado** en casi todos los países (CNMV en España, SEC en EE. UU., etc.). Antes de cobrar por recomendaciones de inversión, **infórmate de la normativa** o consulta a un profesional. Vender una *herramienta educativa* es muy distinto a vender *consejos financieros*.

---

## 🗂️ Estructura

```
criptoswing/
├── index.html        # Estructura y UI
├── styles.css        # Diseño (tema oscuro profesional)
├── app.js            # Lógica: datos, indicadores, gráficos, paper trading, backtesting
├── manifest.json     # PWA: metadatos de la app
├── sw.js             # PWA: service worker (instalable / offline shell)
├── icon.svg          # Icono de la app
├── capacitor.config.json  # Configuración para empaquetar la APK
├── package.json      # Scripts y dependencias de Capacitor
├── scripts/
│   └── build-web.js  # Prepara la carpeta www/ para Capacitor
└── .github/workflows/
    ├── deploy-pages.yml  # Publica la web en GitHub Pages
    └── build-apk.yml     # Compila la APK de Android en la nube
```

## 🔧 Personalización rápida (en `app.js`, objeto `CONFIG`)

| Parámetro | Por defecto | Qué hace |
|-----------|-------------|----------|
| `emaFast` / `emaSlow` | 50 / 200 | Periodos de las medias móviles |
| `rsiMin` / `rsiMax` | 40 / 55 | Zona de RSI para la señal |
| `stopLossPct` | 0.05 | Stop loss (5%) — optimizado por backtest |
| `takeProfitPct` | 0.10 | Take profit (10%, ratio 1:2) |
| `useTrailing` | false | Stop dinámico (opcional, activable en la UI) |
| `trailPct` | 0.06 | Distancia del trailing stop al máximo (si se activa) |
| `useMacd` | true | Exigir momentum alcista (MACD &gt; 0) |
| `useVolume` | true | Exigir volumen sobre la media |
| `volMaPeriod` | 20 | Periodo de la media de volumen |
| `initialBalance` | 500 | Saldo inicial de la cuenta demo |
| `refreshMs` | 5000 | Frecuencia de actualización (ms) |
