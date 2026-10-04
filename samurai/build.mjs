// Builds the samurai model:
//   samurai.glb  - binary glTF for Blender / game engines / any 3D viewer
//   index.html   - standalone interactive viewer (three.js from CDN)
// Usage: npm install three@0.170.0 && node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildSamurai } from './src/samurai.js';

const here = dirname(fileURLToPath(import.meta.url));
const THREE_CDN = process.env.THREE_BASE ?? 'https://cdn.jsdelivr.net/npm/three@0.170.0';

// GLTFExporter reads Blobs through FileReader, which Node lacks.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

// Bake the scene graph into one mesh per material, grouped by body part.
function bake(model) {
  model.updateMatrixWorld(true);
  const parts = new Map(); // part name -> Map(material -> geometries)
  const partOf = (obj) => {
    for (let o = obj; o; o = o.parent) if (o.parent === model) return o.name || 'Body';
    return 'Body';
  };
  model.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld);
    const part = partOf(o);
    if (!parts.has(part)) parts.set(part, new Map());
    const byMat = parts.get(part);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const out = new THREE.Group();
  out.name = 'Samurai';
  let tris = 0;
  for (const [part, byMat] of parts) {
    const pg = new THREE.Group();
    pg.name = part;
    for (const [mat, geos] of byMat) {
      const merged = mergeVertices(mergeGeometries(geos), 1e-5);
      tris += merged.index.count / 3;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${part}_${mat.name}`;
      pg.add(mesh);
    }
    out.add(pg);
  }
  return { out, tris };
}

const { out, tris } = bake(buildSamurai(THREE));
const glb = await new GLTFExporter().parseAsync(out, { binary: true });
writeFileSync(join(here, 'samurai.glb'), Buffer.from(glb));
console.log(`samurai.glb: ${(glb.byteLength / 1024).toFixed(0)} KB, ${tris} triangles`);

const builder = readFileSync(join(here, 'src/samurai.js'), 'utf8').replace(/^export /m, '');
const html = readFileSync(join(here, 'viewer.template.html'), 'utf8')
  .replaceAll('__THREE__', THREE_CDN)
  .replace('/*BUILDER*/', () => builder);
// artifact.html has no document skeleton (the publisher adds one); index.html is a standalone page.
writeFileSync(join(here, 'artifact.html'), html);
writeFileSync(join(here, process.env.OUT ?? 'index.html'),
  `<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}</style>\n</head>\n<body>\n${html}\n</body>\n</html>\n`);
console.log(`viewer written (three from ${THREE_CDN})`);
