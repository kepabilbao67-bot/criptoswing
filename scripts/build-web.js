/* Copia los archivos web de la raíz a la carpeta www/ que usa Capacitor.
   Multiplataforma (Windows, macOS, Linux). */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const www = path.join(root, "www");

const ASSETS = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "sw.js",
  "icon.svg",
];

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

for (const file of ASSETS) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    console.error("Falta el archivo:", file);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(www, file));
  console.log("copiado ->", file);
}

console.log("\n✅ Carpeta www/ lista para Capacitor.");
