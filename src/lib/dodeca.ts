import * as THREE from 'three';

const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;
/** 正十二面体顶点归一化到外接球半径 1 */
const VERTEX_SCALE = 1 / Math.sqrt(3);

export interface FaceData {
  /** 几何序号 0-11 */
  index: number;
  /** 骰子面编号 1-12，相对面之和为 13 */
  number: number;
  /** 相对面序号 */
  opposite: number;
  normal: THREE.Vector3;
  center: THREE.Vector3;
  /** 骰子状态下该面在 group 局部空间中的朝向 */
  quaternion: THREE.Quaternion;
  localVertices: THREE.Vector2[];
  vertexIndices: number[];
}

/** 展开时每个面绕与父面共享的边旋转 */
export interface FaceLink {
  parent: number;
  children: number[];
  depth: number;
  /** 铰链经过的点（骰子坐标系） */
  hingePoint: THREE.Vector3;
  /** 铰链方向（单位向量） */
  hingeAxis: THREE.Vector3;
  /** 完整展开时绕铰链旋转的角度（带符号） */
  openAngle: number;
}

export interface DodecaModel {
  faces: FaceData[];
  links: FaceLink[];
  /** 展开网的根面 */
  root: number;
  /** 把根面摆正（法线朝 +Z、数字朝上）的四元数 */
  rootQuaternion: THREE.Quaternion;
  pentagonRadius: number;
  netWidth: number;
  netHeight: number;
}

interface RawFace {
  normal: THREE.Vector3;
  center: THREE.Vector3;
  quaternion: THREE.Quaternion;
  local: THREE.Vector2[];
  indices: number[];
}

function dodecaVertices(): THREE.Vector3[] {
  const verts: THREE.Vector3[] = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) verts.push(new THREE.Vector3(x, y, z));
    }
  }
  for (const y of [-1, 1]) {
    for (const z of [-1, 1]) verts.push(new THREE.Vector3(0, y * INV_PHI, z * PHI));
  }
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) verts.push(new THREE.Vector3(x * INV_PHI, y * PHI, 0));
  }
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) verts.push(new THREE.Vector3(x * PHI, 0, z * INV_PHI));
  }
  return verts.map((v) => v.multiplyScalar(VERTEX_SCALE));
}

interface FacePlane {
  normal: THREE.Vector3;
  offset: number;
}

/** 枚举三点确定的平面，含 5 个顶点的平面即正十二面体的面 */
function dodecaFacePlanes(verts: THREE.Vector3[]): FacePlane[] {
  const candidates: FacePlane[] = [];

  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      for (let k = j + 1; k < verts.length; k++) {
        const normal = new THREE.Vector3()
          .subVectors(verts[j], verts[i])
          .cross(new THREE.Vector3().subVectors(verts[k], verts[i]));
        if (normal.lengthSq() < 1e-10) continue;
        normal.normalize();

        let offset = normal.dot(verts[i]);
        if (Math.abs(offset) < 1e-6) continue;
        if (offset < 0) {
          normal.negate();
          offset = -offset;
        }

        const members = verts.filter((v) => Math.abs(v.dot(normal) - offset) < 1e-4);
        if (members.length !== 5) continue;
        candidates.push({ normal, offset });
      }
    }
  }

  // 同一法线方向上有外侧的面与穿心的截面，取距离原点更远的那个
  const planes: FacePlane[] = [];
  for (const candidate of candidates) {
    const same = planes.find((plane) => plane.normal.dot(candidate.normal) > 0.999);
    if (!same) {
      planes.push({ normal: candidate.normal.clone(), offset: candidate.offset });
    } else if (candidate.offset > same.offset) {
      same.normal.copy(candidate.normal);
      same.offset = candidate.offset;
    }
  }

  return planes;
}

function buildRawFaces(): { raw: RawFace[]; pentagonRadius: number; verts: THREE.Vector3[] } {
  const verts = dodecaVertices();
  const planes = dodecaFacePlanes(verts);
  if (planes.length !== 12) throw new Error(`dodecahedron faces: ${planes.length}`);
  let pentagonRadius = 0;

  const raw = planes.map(({ normal, offset }) => {
    const indices = verts
      .map((v, i) => ({ i, d: v.dot(normal) }))
      .filter(({ d }) => Math.abs(d - offset) < 1e-4)
      .map(({ i }) => i);

    if (indices.length !== 5) throw new Error('dodecahedron face extraction failed');

    const center = indices
      .reduce((acc, i) => acc.add(verts[i]), new THREE.Vector3())
      .multiplyScalar(1 / 5);

    // 绕外法线把 5 个顶点排成逆时针闭环
    const u = verts[indices[0]].clone().sub(center).normalize();
    const w = new THREE.Vector3().crossVectors(normal, u).normalize();
    const ordered = indices
      .map((i) => {
        const p = verts[i].clone().sub(center);
        return { i, angle: Math.atan2(p.dot(w), p.dot(u)) };
      })
      .sort((a, b) => a.angle - b.angle)
      .map(({ i }) => i);

    const upRef = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(upRef, normal).normalize();
    const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(xAxis, yAxis, normal),
    );

    const local = ordered.map((i) => {
      const p = verts[i].clone().sub(center);
      return new THREE.Vector2(p.dot(xAxis), p.dot(yAxis));
    });

    for (const p of local) pentagonRadius = Math.max(pentagonRadius, p.length());

    return { normal: normal.clone(), center, quaternion, local, indices: ordered };
  });

  return { raw, pentagonRadius, verts };
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

function buildEdgeMap(raw: RawFace[]): Map<string, Array<{ face: number; edge: number }>> {
  const map = new Map<string, Array<{ face: number; edge: number }>>();
  raw.forEach((face, f) => {
    face.indices.forEach((a, k) => {
      const b = face.indices[(k + 1) % 5];
      const key = edgeKey(a, b);
      const list = map.get(key) ?? [];
      list.push({ face: f, edge: k });
      map.set(key, list);
    });
  });
  return map;
}

function buildNeighbors(raw: RawFace[]): number[][] {
  const edges = buildEdgeMap(raw);
  const neighbors: number[][] = raw.map(() => []);
  for (const list of edges.values()) {
    if (list.length !== 2) continue;
    const a = list[0].face;
    const b = list[1].face;
    if (!neighbors[a].includes(b)) neighbors[a].push(b);
    if (!neighbors[b].includes(a)) neighbors[b].push(a);
  }
  return neighbors;
}

/**
 * 双花形展开树，对应参考图的展开形状：
 * 根面 + 它的 5 个邻面是第一朵花；对置面 + 它的 5 个邻面是第二朵花，
 * 两朵花通过 ring2 上的一个面接回第一朵花，从而只留一条缝。
 */
function buildFlowerTree(
  neighbors: number[][],
  root: number,
  opposite: number,
  bridge: number,
): { parent: number[]; depth: number[] } | null {
  const total = neighbors.length;
  const parent = new Array<number>(total).fill(-1);
  const depth = new Array<number>(total).fill(0);

  for (const n of neighbors[root]) {
    parent[n] = root;
    depth[n] = 1;
  }

  const ring2 = neighbors[opposite].filter((n) => n !== root);
  if (ring2.length !== 5 || !ring2.includes(bridge)) return null;

  const anchor = neighbors[bridge].find((n) => depth[n] === 1);
  if (anchor === undefined) return null;
  parent[bridge] = anchor;
  depth[bridge] = 2;

  parent[opposite] = bridge;
  depth[opposite] = 3;

  for (const face of ring2) {
    if (face === bridge) continue;
    parent[face] = opposite;
    depth[face] = 4;
  }

  if (parent.some((p, i) => p < 0 && i !== root)) return null;
  return { parent, depth };
}

/** 正十二面体的二面角 116.565°，展开时需要反向旋转的补角 */
const OPEN_ANGLE = Math.PI - Math.acos(-1 / Math.sqrt(5));

function buildLinks(
  raw: RawFace[],
  verts: THREE.Vector3[],
  parent: number[],
  depth: number[],
): FaceLink[] {
  const links: FaceLink[] = raw.map((_, i) => ({
    parent: parent[i],
    children: [],
    depth: depth[i],
    hingePoint: new THREE.Vector3(),
    hingeAxis: new THREE.Vector3(),
    openAngle: 0,
  }));

  raw.forEach((face, child) => {
    const p = parent[child];
    if (p < 0) return;
    links[p].children.push(child);

    const shared = face.indices.filter((i) => raw[p].indices.includes(i));
    if (shared.length !== 2) throw new Error('hinge edge not found');
    const a = verts[shared[0]];
    const b = verts[shared[1]];
    const axis = new THREE.Vector3().subVectors(b, a).normalize();
    const point = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

    const dotAt = (angle: number) =>
      face.normal.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, angle));
    const positive = dotAt(OPEN_ANGLE).dot(raw[p].normal);
    const negative = dotAt(-OPEN_ANGLE).dot(raw[p].normal);

    links[child].hingePoint.copy(point);
    links[child].hingeAxis.copy(axis);
    links[child].openAngle = positive >= negative ? OPEN_ANGLE : -OPEN_ANGLE;
  });

  return links;
}

/** 绕任意直线旋转的 4x4 矩阵 */
export function hingeMatrix(point: THREE.Vector3, axis: THREE.Vector3, angle: number): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeTranslation(point.x, point.y, point.z)
    .multiply(new THREE.Matrix4().makeRotationAxis(axis, angle))
    .multiply(new THREE.Matrix4().makeTranslation(-point.x, -point.y, -point.z));
}

/** 按展开树逐级累计变换，返回每个面在骰子坐标系下的矩阵 */
export function buildChain(links: FaceLink[], angles: number[], root: number): THREE.Matrix4[] {
  const chain: THREE.Matrix4[] = links.map(() => new THREE.Matrix4());
  const order = links
    .map((link, i) => ({ i, depth: link.depth }))
    .sort((a, b) => a.depth - b.depth);

  for (const { i } of order) {
    if (i === root) {
      chain[i].identity();
      continue;
    }
    const link = links[i];
    chain[i]
      .copy(chain[link.parent])
      .multiply(hingeMatrix(link.hingePoint, link.hingeAxis, angles[i]));
  }
  return chain;
}

function flatPolygons(
  raw: RawFace[],
  verts: THREE.Vector3[],
  links: FaceLink[],
  root: number,
  rootQuaternion: THREE.Quaternion,
): { polys: THREE.Vector2[][]; minX: number; maxX: number; minY: number; maxY: number } {
  const chain = buildChain(
    links,
    links.map((link) => link.openAngle),
    root,
  );
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const polys = raw.map((face, i) => {
    const points = face.indices.map((index) => {
      const p = verts[index].clone().applyMatrix4(chain[i]).applyQuaternion(rootQuaternion);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      return new THREE.Vector2(p.x, p.y);
    });
    return points;
  });

  return { polys, minX, maxX, minY, maxY };
}

/** 凸多边形分离轴检测；共边或共点视为不重叠 */
function polygonsOverlap(a: THREE.Vector2[], b: THREE.Vector2[]): boolean {
  const axes: THREE.Vector2[] = [];
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      axes.push(new THREE.Vector2(-(q.y - p.y), q.x - p.x));
    }
  }

  for (const axis of axes) {
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;
    for (const p of a) {
      const d = p.dot(axis);
      minA = Math.min(minA, d);
      maxA = Math.max(maxA, d);
    }
    for (const p of b) {
      const d = p.dot(axis);
      minB = Math.min(minB, d);
      maxB = Math.max(maxB, d);
    }
    if (maxA <= minB + 1e-4 || maxB <= minA + 1e-4) return false;
  }
  return true;
}

function sharesVertex(a: RawFace, b: RawFace): boolean {
  return a.indices.some((i) => b.indices.includes(i));
}

export function buildDodecahedron(): DodecaModel {
  const { raw, pentagonRadius, verts } = buildRawFaces();
  const neighbors = buildNeighbors(raw);

  // 相对面编号之和为 13
  const faces: FaceData[] = raw.map((face, index) => ({
    index,
    number: 0,
    opposite: -1,
    normal: face.normal,
    center: face.center,
    quaternion: face.quaternion,
    localVertices: face.local,
    vertexIndices: face.indices,
  }));

  const used = new Set<number>();
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < faces.length; i++) {
    if (used.has(i)) continue;
    const j = faces.findIndex((f, k) => k !== i && !used.has(k) && f.normal.dot(faces[i].normal) < -0.99);
    if (j < 0) throw new Error('opposite face not found');
    used.add(i);
    used.add(j);
    pairs.push([i, j]);
  }
  pairs.forEach(([a, b], p) => {
    faces[a].number = p + 1;
    faces[b].number = 13 - (p + 1);
    faces[a].opposite = b;
    faces[b].opposite = a;
  });

  let best: { links: FaceLink[]; root: number; rootQuaternion: THREE.Quaternion; width: number; height: number } | null = null;
  let bestScore = Infinity;

  for (let root = 0; root < raw.length; root++) {
    const opposite = faces[root].opposite;
    for (const bridge of neighbors[opposite]) {
      const tree = buildFlowerTree(neighbors, root, opposite, bridge);
      if (!tree) continue;

      const links = buildLinks(raw, verts, tree.parent, tree.depth);
      const rootQuaternion = faces[root].quaternion.clone().invert();
      const { polys, minX, maxX, minY, maxY } = flatPolygons(raw, verts, links, root, rootQuaternion);

      let overlapping = false;
      for (let i = 0; i < polys.length && !overlapping; i++) {
        for (let j = i + 1; j < polys.length; j++) {
          if (sharesVertex(raw[i], raw[j])) continue;
          if (polygonsOverlap(polys[i], polys[j])) {
            overlapping = true;
            break;
          }
        }
      }
      if (overlapping) continue;

      // 参考图里的展开网接近方形，选宽高比最接近 1.15 的
      const width = maxX - minX;
      const height = maxY - minY;
      const score = Math.abs(Math.log(width / height / 1.15));
      if (score < bestScore) {
        bestScore = score;
        best = { links, root, rootQuaternion, width, height };
      }
    }
  }

  if (!best) throw new Error('dodecahedron net not found');

  return {
    faces,
    links: best.links,
    root: best.root,
    rootQuaternion: best.rootQuaternion,
    pentagonRadius,
    netWidth: best.width,
    netHeight: best.height,
  };
}
