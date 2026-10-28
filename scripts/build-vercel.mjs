import{copyFileSync,mkdirSync}from'node:fs';import path from'node:path';
const files=["app.js","icon.svg","index.html","manifest.json","styles.css","sw.js"];
for(const file of files){const target=path.join('vercel-public',file);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(file,target);}
console.log('Preparados '+files.length+' archivos web de la versión publicada.');
