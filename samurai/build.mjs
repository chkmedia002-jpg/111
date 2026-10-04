// Builds the rigged samurai:
//   samurai.glb   - binary glTF: skinned mesh + skeleton + Idle/Walk/Attack/Pose_Reference clips
//   index.html    - standalone interactive viewer (GLB embedded, three.js from CDN)
//   artifact.html - the same viewer without a document skeleton (for publishing)
// Usage: npm install three@0.170.0 && node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildSamurai } from './src/samurai.js';

const here = dirname(fileURLToPath(import.meta.url));
const THREE_CDN = process.env.THREE_BASE ?? 'https://cdn.jsdelivr.net/npm/three@0.147.0';

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

const { model, clips, report } = buildSamurai(THREE, { mergeGeometries, mergeVertices });
const mesh = model.getObjectByName('SamuraiMesh');
console.log(`bones: ${mesh.skeleton.bones.length}, triangles: ${mesh.geometry.index.count / 3}`);
for (const [name, err] of Object.entries(report)) {
  console.log(`clip ${name}: max IK reach error ${(err * 1000).toFixed(1)} mm`);
}

const glb = Buffer.from(await new GLTFExporter().parseAsync(model, { binary: true, animations: clips }));
writeFileSync(join(here, 'samurai.glb'), glb);
console.log(`samurai.glb: ${(glb.byteLength / 1024).toFixed(0)} KB`);

const html = readFileSync(join(here, 'viewer.template.html'), 'utf8')
  .replaceAll('__THREE__', THREE_CDN)
  .replace('__GLB_BASE64__', () => glb.toString('base64'));
writeFileSync(join(here, 'artifact.html'), html);
writeFileSync(join(here, process.env.OUT ?? 'index.html'),
  `<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}</style>\n</head>\n<body>\n${html}\n</body>\n</html>\n`);
console.log(`viewer written (three from ${THREE_CDN})`);
