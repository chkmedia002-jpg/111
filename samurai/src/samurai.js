// Procedural, rigged 3D model of an armoured samurai (o-yoroi style).
// Units are metres, +Y is up and the figure faces +Z.
//
// buildSamurai(THREE, { mergeGeometries, mergeVertices }) returns
//   { model, clips, report, walkSpeed }
// model  - Group holding the bone hierarchy (root bone "Hips") and SkinnedMesh chunks
// clips  - AnimationClips: Idle, Walk, Attack, Pose_Reference
// report - max IK reach error per clip (metres)
//
// Parts are modelled in their bone's local space (src/head.js, armor.js, limbs.js,
// weapons.js). Most armour is rigid, so most vertices follow one bone; parts that
// cross a joint (hakama at the hip, kusazuri over the thighs, sode over the
// shoulder) blend between two bones.

import { createKit } from './kit.js';
import { createRig } from './rig.js';
import { createArmor } from './armor.js';
import { createHead } from './head.js';
import { createLimbs } from './limbs.js';
import { createWeapons } from './weapons.js';

export function buildSamurai(THREE, { mergeGeometries, mergeVertices }) {
  const std = (name, color, roughness, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ name, color, roughness, metalness, ...extra });
  const M = {
    lacquer: std('black_lacquer', 0x15161a, 0.28, 0.35),
    lace: std('white_lacing', 0xe8e1cc, 0.85),
    red: std('red_cord', 0x9e2a22, 0.8),
    cloth: std('white_cloth', 0xdcd5c2, 0.95, 0, { side: THREE.DoubleSide }),
    hakama: std('hakama', 0x26272e, 0.9),
    gold: std('gold', 0xc9a04a, 0.3, 1),
    iron: std('iron_mail', 0x2a2b2e, 0.5, 0.75),
    skin: std('skin', 0xb9805c, 0.62),
    nail: std('nail', 0xd2a48a, 0.4),
    hair: std('hair', 0x15110e, 0.75),
    eye: std('iris', 0x1a120c, 0.25),
    eyeWhite: std('eye_white', 0xe6e0d6, 0.3),
    steel: std('steel', 0xd8dde2, 0.14, 1),
    hamon: std('steel_hamon', 0xf0f2f2, 0.38, 0.85),
    hilt: std('hilt_wrap', 0x1c1612, 0.8),
    same: std('rayskin', 0xe9e2d0, 0.7),
    horn: std('horn', 0x2a221c, 0.45, 0.1),
    rope: std('rope', 0xe3dccb, 0.9),
    straw: std('straw', 0x8a6b46, 0.92),
    tabi: std('tabi', 0x1e1f23, 0.85),
    banner: std('banner', 0xece6d6, 0.95, 0, { side: THREE.DoubleSide }),
    ink: std('banner_ink', 0x141414, 0.9, 0, { side: THREE.DoubleSide }),
    pole: std('pole', 0x101010, 0.4, 0.1),
  };

  const root = new THREE.Group();
  root.name = 'Samurai';
  const rig = createRig(THREE, root);
  rig.applyPose(rig.idle(0)); // rest (bind) pose
  const kit = createKit(THREE);
  const ctx = { THREE, kit, M, mergeGeometries, rig, root };
  const armor = createArmor(ctx);
  const head = createHead(ctx, armor);
  const limbs = createLimbs(ctx, armor);
  const weapons = createWeapons(ctx);

  // ---------- parts ----------
  limbs.legs();
  const waist = kit.group(rig.hips, kit.V(0, 0.05, 0)); // spine origin, but follows the hips
  armor.waist(waist, rig.hips, rig.upperLeg);
  weapons.saya(waist);
  armor.torso(rig.spine);
  weapons.wakizashi(rig.spine);
  armor.banner(rig.spine);
  head.build(rig.head);
  limbs.arms();
  weapons.katana(rig.katana);

  // ---------- bake to one skinned mesh ----------
  const { bones } = rig;
  root.updateMatrixWorld(true);
  const boneIndex = new Map(bones.map((b, i) => [b, i]));
  const parts = [];
  root.traverse((o) => { if (o.isMesh) parts.push(o); });
  const byMat = new Map();
  const wp = new THREE.Vector3(), lp = new THREE.Vector3();
  for (const o of parts) {
    let owner = o.parent;
    while (owner && !owner.isBone) owner = owner.parent;
    if (!owner) throw new Error(`mesh ${o.name || o.geometry.type} is not attached to a bone`);
    let rule = null;
    for (let p = o; p && !rule; p = p.parent) rule = p.userData.skin || null;
    const ownerInv = owner.matrixWorld.clone().invert();
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position;
    const si = new Uint16Array(pos.count * 4), swt = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      wp.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      lp.copy(wp).applyMatrix4(ownerInv);
      const ws = (rule ? rule(lp, wp) : [[owner, 1]]).filter(([, w]) => w > 1e-4);
      const sum = ws.reduce((acc, [, w]) => acc + w, 0);
      ws.forEach(([b, w], j) => { si[i * 4 + j] = boneIndex.get(b); swt[i * 4 + j] = w / sum; });
    }
    g.applyMatrix4(o.matrixWorld);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(swt, 4));
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  }
  for (const b of bones) for (const ch of [...b.children]) if (!ch.isBone) b.remove(ch);

  // One SkinnedMesh per material chunk; chunks stay under 65k vertices so the
  // exported indices fit in 16 bits. All chunks share one skeleton.
  const skeleton = new THREE.Skeleton(bones);
  const CHUNK_TRIS = 21000;
  for (const [mat, geos] of byMat) {
    let batch = [], tris = 0, k = 0;
    const flush = () => {
      if (!batch.length) return;
      const mesh = new THREE.SkinnedMesh(mergeVertices(mergeGeometries(batch), 1e-5), mat);
      mesh.name = `Samurai_${mat.name}_${k++}`;
      root.add(mesh);
      root.updateMatrixWorld(true);
      mesh.bind(skeleton);
      batch = []; tris = 0;
    };
    for (const g of geos) {
      const t = g.attributes.position.count / 3;
      if (tris + t > CHUNK_TRIS) flush();
      batch.push(g); tris += t;
    }
    flush();
  }

  const { clips, report } = rig.makeClips();
  return { model: root, clips, report, walkSpeed: rig.walkSpeed };
}
