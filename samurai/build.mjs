// Builds the rigged samurai:
//   samurai.glb   - binary glTF: skinned mesh + skeleton + Idle/Walk/Attack/Pose_Reference clips
//   index.html    - interactive viewer (loads samurai.glb next to it, three.js from CDN)
//   artifact.html - the same viewer without a document skeleton (for publishing)
// Usage: npm install three@0.170.0 @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4
//        node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, quantize } from '@gltf-transform/functions';
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
const meshes = model.children.filter((o) => o.isSkinnedMesh);
const tris = meshes.reduce((n, m) => n + m.geometry.index.count / 3, 0);
console.log(`bones: ${meshes[0].skeleton.bones.length}, meshes: ${meshes.length}, triangles: ${tris}`);
for (const [name, err] of Object.entries(report)) {
  console.log(`clip ${name}: max IK reach error ${(err * 1000).toFixed(1)} mm`);
}

const raw = new Uint8Array(await new GLTFExporter().parseAsync(model, { binary: true, animations: clips }));
// Quantize vertex data (KHR_mesh_quantization): 14-bit positions, 10-bit normals,
// 8-bit weights. Cuts the file to about a third with no visible loss.
const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
const doc = await io.readBinary(raw);
// One quantization volume for the whole scene keeps the skins identical, so dedup
// can fold the per-chunk skins into a single skin (one armature in Blender).
await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeWeight: 8, quantizationVolume: 'scene' }), dedup(), prune());
const glb = Buffer.from(await io.writeBinary(doc));
writeFileSync(join(here, 'samurai.glb'), glb);
console.log(`samurai.glb: ${(glb.byteLength / 1024).toFixed(0)} KB`);

const html = readFileSync(join(here, 'viewer.template.html'), 'utf8')
  .replaceAll('__THREE__', THREE_CDN);
writeFileSync(join(here, 'artifact.html'), html);
writeFileSync(join(here, process.env.OUT ?? 'index.html'),
  `<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}</style>\n</head>\n<body>\n${html}\n</body>\n</html>\n`);
console.log(`viewer written (three from ${THREE_CDN})`);
