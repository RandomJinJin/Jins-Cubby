import * as THREE from 'three';
import { buildChain, hingeMatrix, type FaceData, type FaceLink } from './dodeca';

const PHI = (1 + Math.sqrt(5)) / 2;

export interface IcosaModel {
  faces: FaceData[];
  links: FaceLink[];
  root: number;
  rootQuaternion: THREE.Quaternion;
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

/** 正二十面体顶点：三个正交黄金矩形，归一化到外接球半径 1 */
function icosaVertices(): THREE.Vector3[] {
  const verts: THREE.Vector3[] = [];
  for (const y of [-1, 1]) {
    for (const z of [-PHI, PHI]) verts.push(new THREE.Vector3(0, y, z));
  }
  for (const x of [-1, 1]) {
    for (const y of [-PHI, PHI]) verts.push(new THREE.Vector3(x, y, 0));
  }
  for (const x of [-PHI, PHI]) {
    for (const z of [-1, 1]) verts.push(new THREE.Vector3(x, 0, z));
  }
  return verts.map((v) => v.normalize());
}

/** 相邻顶点构成棱，三个两两相连的顶点构成一个正三角形面 */
function buildRawFaces(verts: THREE.Vector3[]): RawFace[] {
  let minEdge = Infinity;
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      minEdge = Math.min(minEdge, verts[i].distanceTo(verts[j]));
    }
  }

  const adjacent = verts.map(() => new Set<number>());
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (Math.abs(verts[i].distanceTo(verts[j]) - minEdge) > 1e-6) continue;
      adjacent[i].add(j);
      adjacent[j].add(i);
    }
  }

  const raw: RawFace[] = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (!adjacent[i].has(j)) continue;
      for (let k = j + 1; k < verts.length; k++) {
        if (!adjacent[i].has(k) || !adjacent[j].has(k)) continue;
        const a = verts[i];
        const b = verts[j];
        const c = verts[k];
        const normal = new THREE.Vector3()
          .subVectors(b, a)
          .cross(new THREE.Vector3().subVectors(c, a))
          .normalize();
        const center = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
        if (normal.dot(center) < 0) normal.negate();

        // 绕外法线排成逆时针闭环
        const u = a.clone().sub(center).normalize();
        const w = new THREE.Vector3().crossVectors(normal, u).normalize();
        const ordered = [i, j, k]
          .map((index) => {
            const p = verts[index].clone().sub(center);
            return { index, angle: Math.atan2(p.dot(w), p.dot(u)) };
          })
          .sort((p, q) => p.angle - q.angle)
          .map(({ index }) => index);

        const upRef = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const xAxis = new THREE.Vector3().crossVectors(upRef, normal).normalize();
        const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
        const quaternion = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(xAxis, yAxis, normal),
        );
        const local = ordered.map((index) => {
          const p = verts[index].clone().sub(center);
          return new THREE.Vector2(p.dot(xAxis), p.dot(yAxis));
        });

        raw.push({ normal, center, quaternion, local, indices: ordered });
      }
    }
  }

  return raw;
}

function buildNeighbors(raw: RawFace[]): number[][] {
  const neighbors: number[][] = raw.map(() => []);
  for (let i = 0; i < raw.length; i++) {
    for (let j = i + 1; j < raw.length; j++) {
      const shared = raw[i].indices.filter((index) => raw[j].indices.includes(index));
      if (shared.length !== 2) continue;
      neighbors[i].push(j);
      neighbors[j].push(i);
    }
  }
  return neighbors;
}

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** 随机 DFS 生成一棵覆盖全部面的生成树 */
function buildTree(
  neighbors: number[][],
  root: number,
  seed: number,
): { parent: number[]; depth: number[] } {
  const parent = new Array<number>(neighbors.length).fill(-1);
  const depth = new Array<number>(neighbors.length).fill(0);
  const visited = new Array<boolean>(neighbors.length).fill(false);
  const random = lcg(seed);
  const stack = [root];
  visited[root] = true;

  while (stack.length) {
    const node = stack.pop()!;
    const order = [...neighbors[node]];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const next of order) {
      if (visited[next]) continue;
      visited[next] = true;
      parent[next] = node;
      depth[next] = depth[node] + 1;
      stack.push(next);
    }
  }
  return { parent, depth };
}

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

    const shared = face.indices.filter((index) => raw[p].indices.includes(index));
    if (shared.length !== 2) throw new Error('hinge edge not found');
    const a = verts[shared[0]];
    const b = verts[shared[1]];
    const axis = new THREE.Vector3().subVectors(b, a).normalize();
    const point = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

    // 完全展开时把子面法线转到父面法线方向
    const angle = Math.acos(THREE.MathUtils.clamp(face.normal.dot(raw[p].normal), -1, 1));
    const dotAt = (value: number) =>
      face.normal
        .clone()
        .applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, value))
        .dot(raw[p].normal);
    const positive = dotAt(angle);
    const negative = dotAt(-angle);

    links[child].hingePoint.copy(point);
    links[child].hingeAxis.copy(axis);
    links[child].openAngle = positive >= negative ? angle : -angle;
  });

  return links;
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

function flatPolygons(
  raw: RawFace[],
  verts: THREE.Vector3[],
  links: FaceLink[],
  root: number,
  rootQuaternion: THREE.Quaternion,
): { polys: THREE.Vector2[][]; width: number; height: number } {
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

  return { polys, width: maxX - minX, height: maxY - minY };
}

/** 随机搜索一棵展开后不自重叠、且尽量接近方形的生成树 */
export function buildIcosahedron(): IcosaModel {
  const verts = icosaVertices();
  const raw = buildRawFaces(verts);
  if (raw.length !== 20) throw new Error(`icosahedron faces: ${raw.length}`);
  const neighbors = buildNeighbors(raw);

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

  // 相对面编号之和为 21
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
    faces[b].number = 21 - (p + 1);
    faces[a].opposite = b;
    faces[b].opposite = a;
  });

  let best: { links: FaceLink[]; root: number; rootQuaternion: THREE.Quaternion; width: number; height: number } | null = null;
  let bestScore = Infinity;

  for (let root = 0; root < raw.length; root++) {
    for (let seed = 1; seed <= 12; seed++) {
      const { parent, depth } = buildTree(neighbors, root, root * 7919 + seed * 104729);
      const links = buildLinks(raw, verts, parent, depth);
      const rootQuaternion = faces[root].quaternion.clone().invert();
      const { polys, width, height } = flatPolygons(raw, verts, links, root, rootQuaternion);

      let overlapping = false;
      for (let i = 0; i < polys.length && !overlapping; i++) {
        for (let j = i + 1; j < polys.length; j++) {
          if (raw[i].indices.some((index) => raw[j].indices.includes(index))) continue;
          if (polygonsOverlap(polys[i], polys[j])) {
            overlapping = true;
            break;
          }
        }
      }
      if (overlapping) continue;

      const score = Math.abs(Math.log(width / height));
      if (score < bestScore) {
        bestScore = score;
        best = { links, root, rootQuaternion, width, height };
      }
      if (bestScore < 0.08) break;
    }
    if (bestScore < 0.08) break;
  }

  if (!best) throw new Error('icosahedron net not found');

  return {
    faces,
    links: best.links,
    root: best.root,
    rootQuaternion: best.rootQuaternion,
    netWidth: best.width,
    netHeight: best.height,
  };
}
