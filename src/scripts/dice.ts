import * as THREE from 'three';
import gsap from 'gsap';
import { buildIcosahedron } from '../lib/icosa';
import type { FaceData } from '../lib/dodeca';
import { ROLL_PAGES, pageOfFace } from '../config/dice.config';

type Mode = 'die' | 'rolling' | 'settled' | 'unfolding' | 'net' | 'folding';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const IDLE_AXIS = new THREE.Vector3(0.35, 1, 0).normalize();
/** 骰子在画面里的半尺寸，越大骰子越小 */
const DIE_HALF = 1.62;
/** 展开后像地图一样放大，只显示整张网的这一比例，其余靠指针贴边平移查看 */
const NET_ZOOM = 0.52;
const PAN_DEAD_ZONE = 0.45;

interface FaceView {
  data: FaceData;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  numberMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  /** 白色面用的深色数字 */
  darkMap: THREE.Texture;
  /** 悬停反色后用的浅色数字 */
  lightMap: THREE.Texture;
  baseMatrix: THREE.Matrix4;
}

function buildFaceGeometry(face: FaceData) {
  const verts = face.localVertices;
  const radius = Math.max(...verts.map((v) => v.length()));
  const positions: number[] = [];
  const uvs: number[] = [];

  // 以第一个顶点为扇心的三角剖分，正三角形与正五边形通用
  for (let i = 1; i < verts.length - 1; i++) {
    for (const v of [verts[0], verts[i], verts[i + 1]]) {
      positions.push(v.x, v.y, 0);
      uvs.push(v.x / (2 * radius) + 0.5, v.y / (2 * radius) + 0.5);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function numberTexture(n: number, color: string) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = String(n);
  const fontSize = text.length > 1 ? 105 : 145;
  ctx.font = `500 ${fontSize}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.fillText(text, size / 2, size / 2 + fontSize * 0.04);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function mountDice(): void {
  const root = document.querySelector<HTMLElement>('[data-dice-root]');
  if (!root) return;

  const host = root.querySelector<HTMLElement>('[data-canvas]');
  const result = root.querySelector<HTMLElement>('[data-result]');
  const resultTitle = root.querySelector<HTMLElement>('[data-result-title]');
  const tip = root.querySelector<HTMLElement>('[data-tip]');
  const hint = document.querySelector<HTMLElement>('[data-hint]');
  const rollBtn = document.querySelector<HTMLButtonElement>('[data-roll]');
  if (!host || !result || !resultTitle || !rollBtn) return;

  const labels = new Map<number, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-label]').forEach((el) => {
    labels.set(Number(el.dataset.label), el);
  });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  scene.add(camera);
  scene.add(new THREE.AmbientLight(0xffffff, 2.7));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(3, 5, 6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-5, -3, -4);
  scene.add(fillLight);

  const model = buildIcosahedron();
  const group = new THREE.Group();
  scene.add(group);

  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
  const one = new THREE.Vector3(1, 1, 1);
  const views: FaceView[] = [];

  for (const face of model.faces) {
    const geometry = buildFaceGeometry(face);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.userData.faceIndex = face.index;

    const outline = new THREE.LineLoop(setupOutlineGeometry(face), outlineMaterial);
    outline.position.z = 0.0015;
    mesh.add(outline);

    const darkMap = numberTexture(face.number, '#1a1a1a');
    const lightMap = numberTexture(face.number, '#f5f5f5');
    const numberMesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        map: darkMap,
        transparent: true,
        depthWrite: false,
      }),
    );
    numberMesh.position.z = 0.002;
    mesh.add(numberMesh);

    group.add(mesh);
    views.push({
      data: face,
      mesh,
      numberMesh,
      darkMap,
      lightMap,
      baseMatrix: new THREE.Matrix4().compose(face.center, face.quaternion, one),
    });
  }

  // —— 沿共享边逐级展开：每个面只绕与父面的铰链旋转 ——
  const links = model.links;
  const angles = links.map(() => 0);
  const chainMats = links.map(() => new THREE.Matrix4());
  const hingeMats = links.map(() => new THREE.Matrix4());
  const depthOrder = links
    .map((link, i) => ({ i, depth: link.depth }))
    .sort((a, b) => a.depth - b.depth)
    .map((item) => item.i);
  const maxDepth = links.reduce((max, link) => Math.max(max, link.depth), 0);
  // 二十面体层级更深，按最大层级压缩错峰，保证在 1.1s 内全部放平
  const STAGGER = Math.min(0.11, 0.55 / Math.max(1, maxDepth));
  const SPAN = 1 - STAGGER * maxDepth;
  const scratchRot = new THREE.Matrix4();
  const scratchTrans = new THREE.Matrix4();

  function applyHinges(t: number) {
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const local = THREE.MathUtils.clamp((t - link.depth * STAGGER) / SPAN, 0, 1);
      angles[i] = link.openAngle * (local * local * (3 - 2 * local));
    }
    for (const i of depthOrder) {
      if (i === model.root) {
        chainMats[i].identity();
        continue;
      }
      const link = links[i];
      hingeMats[i]
        .makeTranslation(link.hingePoint.x, link.hingePoint.y, link.hingePoint.z)
        .multiply(scratchRot.makeRotationAxis(link.hingeAxis, angles[i]))
        .multiply(scratchTrans.makeTranslation(-link.hingePoint.x, -link.hingePoint.y, -link.hingePoint.z));
      chainMats[i].copy(chainMats[link.parent]).multiply(hingeMats[i]);
    }
    for (const view of views) {
      view.mesh.matrix.copy(chainMats[view.data.index]).multiply(view.baseMatrix);
      view.mesh.matrixWorldNeedsUpdate = true;
    }
  }

  const initialGroupQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, 0.55, 0.08));
  group.quaternion.copy(initialGroupQuaternion);
  applyHinges(0);

  let mode: Mode = 'die';
  let hovered: FaceView | null = null;
  let dragging = false;
  let pointerDown = false;
  let travel = 0;
  let lastX = 0;
  let lastY = 0;
  let downAt = 0;
  let pointerClientX = 0;
  let pointerClientY = 0;

  const pointer = new THREE.Vector2(-2, -2);
  const raycaster = new THREE.Raycaster();
  const faceMeshes = views.map((view) => view.mesh);

  function fitDistance(halfWidth: number, halfHeight: number, aspect = camera.aspect) {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    return Math.max(halfHeight / tan, halfWidth / (tan * aspect));
  }

  const netBox = new THREE.Box3();
  const netCenter = new THREE.Vector3();

  function measureNet() {
    const quaternion = group.quaternion.clone();
    const position = group.position.clone();
    group.quaternion.copy(model.rootQuaternion);
    group.position.set(0, 0, 0);
    applyHinges(1);
    group.updateMatrixWorld(true);
    netBox.makeEmpty();
    for (const view of views) netBox.expandByObject(view.mesh);
    netBox.getCenter(netCenter);
    group.quaternion.copy(quaternion);
    group.position.copy(position);
    applyHinges(0);
    group.updateMatrixWorld(true);
  }

  const netBase = new THREE.Vector3();
  const panTarget = new THREE.Vector2();
  const panCurrent = new THREE.Vector2();

  const netDistance = (aspect = camera.aspect) =>
    fitDistance(
      ((netBox.max.x - netBox.min.x) / 2) * NET_ZOOM,
      ((netBox.max.y - netBox.min.y) / 2) * NET_ZOOM,
      aspect,
    );

  /** 网在视口内的可平移余量（网比视口大时才有） */
  function panLimits() {
    const halfW = (netBox.max.x - netBox.min.x) / 2;
    const halfH = (netBox.max.y - netBox.min.y) / 2;
    const visibleH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
    const visibleW = visibleH * camera.aspect;
    return {
      x: Math.max(0, halfW - visibleW * 0.46),
      y: Math.max(0, halfH - visibleH * 0.46),
    };
  }

  /** 跟手拖动：像素位移换算成世界坐标位移，被限制在可平移范围内 */
  function panByPixels(dx: number, dy: number) {
    const limits = panLimits();
    if (!limits.x && !limits.y) return;
    const worldPerPixel =
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z) /
      Math.max(1, canvas.clientHeight);
    panTarget.x = THREE.MathUtils.clamp(panTarget.x + dx * worldPerPixel, -limits.x, limits.x);
    panTarget.y = THREE.MathUtils.clamp(panTarget.y - dy * worldPerPixel, -limits.y, limits.y);
    // 拖动时不做缓动，直接跟随手指
    panCurrent.copy(panTarget);
  }

  /** 指针靠近画面边缘时朝该方向平移，靠近中心时回正 */
  function updatePanTarget() {
    if (mode !== 'net' || !hostWidth || !hostHeight) return;
    const limits = panLimits();
    const u = (pointerClientX - (stageLeft + hostLeft + hostWidth / 2)) / (hostWidth / 2);
    const v = (pointerClientY - (stageTop + hostTop + hostHeight / 2)) / (hostHeight / 2);
    const steer = (n: number) => {
      const t = THREE.MathUtils.clamp((Math.abs(n) - PAN_DEAD_ZONE) / (1 - PAN_DEAD_ZONE), 0, 1);
      return Math.sign(n) * t * t;
    };
    panTarget.set(-steer(u) * limits.x, steer(v) * limits.y);
  }

  let stageLeft = 0;
  let stageTop = 0;
  let stageWidth = 0;
  let stageHeight = 0;
  let hostLeft = 0;
  let hostTop = 0;
  let hostWidth = 0;
  let hostHeight = 0;

  function measure() {
    const stageRect = root!.getBoundingClientRect();
    stageLeft = stageRect.left;
    stageTop = stageRect.top;
    stageWidth = stageRect.width;
    stageHeight = stageRect.height;
    const hostRect = host!.getBoundingClientRect();
    hostLeft = hostRect.left - stageRect.left;
    hostTop = hostRect.top - stageRect.top;
    hostWidth = hostRect.width;
    hostHeight = hostRect.height;
  }

  /** 画布始终全屏，骰子仍按舞台的比例取景，画面大小与舞台内的观感一致 */
  const dieZoom = () =>
    fitDistance(DIE_HALF, DIE_HALF, stageWidth / stageHeight) * (hostHeight / stageHeight);

  function resize() {
    const width = host!.clientWidth;
    const height = host!.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    measure();
    if (mode === 'net') camera.position.z = netDistance();
    else if (mode === 'die' || mode === 'settled') camera.position.z = dieZoom();
  }

  const visualViewport = window.visualViewport;

  /** 画布贴合手机可见视口，避免浏览器地址栏收放造成画面相对可视区域偏移 */
  function syncViewport() {
    if (!visualViewport) return;
    host!.style.inset = 'auto';
    host!.style.left = `${visualViewport.offsetLeft}px`;
    host!.style.top = `${visualViewport.offsetTop}px`;
    host!.style.width = `${visualViewport.width}px`;
    host!.style.height = `${visualViewport.height}px`;
    resize();
  }

  function syncUI() {
    rollBtn!.disabled = mode !== 'die';
    if (hint) {
      hint.textContent =
        mode === 'net'
          ? '点击已分配的面进入 · 点击空白处收起'
          : mode === 'rolling'
            ? '投掷中…'
            : mode === 'settled'
              ? '即将进入…'
              : '拖动旋转 · 悬停查看页面 · 点击空白处展开';
    }
    root!.classList.toggle('is-net', mode === 'net');
    root!
      .closest('.home')
      ?.classList.toggle('is-net', mode === 'net' || mode === 'unfolding' || mode === 'folding');
  }

  function updateCursor() {
    canvas.style.cursor =
      hovered
        ? 'pointer'
        : mode === 'die'
          ? dragging
            ? 'grabbing'
            : 'grab'
          : 'default';
  }

  function setHover(view: FaceView | null) {
    if (hovered === view) return;
    if (hovered) {
      gsap.to(hovered.mesh.material.color, { r: 1, g: 1, b: 1, duration: 0.18, overwrite: true });
      hovered.numberMesh.material.map = hovered.darkMap;
      labels.get(hovered.data.number)?.classList.remove('is-active');
    }
    hovered = view;
    if (hovered) {
      // 反色：面变纯黑（黑色材质不受灯光提亮）、数字变白；展开网里数字已隐藏，只留白色标签
      gsap.to(hovered.mesh.material.color, { r: 0, g: 0, b: 0, duration: 0.18, overwrite: true });
      hovered.numberMesh.material.map = mode === 'net' ? hovered.darkMap : hovered.lightMap;
      if (mode === 'net') labels.get(hovered.data.number)?.classList.add('is-active');
    }
    updateCursor();
  }

  function showTip(title: string) {
    if (!tip) return;
    tip.textContent = title.toUpperCase();
    tip.classList.add('is-visible');
    tip.style.transform = `translate3d(${pointerClientX - stageLeft}px, ${
      pointerClientY - stageTop
    }px, 0) translate(-50%, -170%)`;
  }

  function hideTip() {
    tip?.classList.remove('is-visible');
  }

  function updateHover() {
    if (mode !== 'die' && mode !== 'net') {
      setHover(null);
      hideTip();
      return;
    }
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(faceMeshes, false)[0];
    const view = hit ? views[hit.object.userData.faceIndex as number] : null;
    const page = view ? pageOfFace(view.data.number) : undefined;
    const active = page?.url ? view : null;
    setHover(active);
    if (active && page && mode === 'die') showTip(page.title);
    else hideTip();
  }

  function updatePointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function updateLabels() {
    const tmp = new THREE.Vector3();
    for (const view of views) {
      const label = labels.get(view.data.number);
      if (!label) continue;
      view.mesh.getWorldPosition(tmp).project(camera);
      const x = hostLeft + (tmp.x * 0.5 + 0.5) * hostWidth;
      const y = hostTop + (-tmp.y * 0.5 + 0.5) * hostHeight;
      label.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }
  }

  function showResult(title: string) {
    resultTitle!.textContent = title.toUpperCase();
    result!.classList.add('is-visible');
  }

  function hideResult() {
    result!.classList.remove('is-visible');
  }

  /** 当前朝向相机（+Z）的那一面 */
  function frontFace() {
    let front: FaceView | null = null;
    let best = -Infinity;
    for (const view of views) {
      const z = view.data.normal.clone().applyQuaternion(group.quaternion).z;
      if (z > best) {
        best = z;
        front = view;
      }
    }
    return front;
  }

  const unfoldState = { t: 0 };
  const idleSpin = { mix: 1 };

  /** 空闲自转的加速，收起结束时从静止缓缓转起来，不在结尾突然启动 */
  function resumeIdleSpin(duration: number) {
    gsap.to(idleSpin, { mix: 1, duration, ease: 'power2.out', overwrite: true });
  }

  function unfold() {
    if (mode !== 'die') return;
    mode = 'unfolding';
    syncUI();
    panTarget.set(0, 0);
    panCurrent.set(0, 0);

    const timeline = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onComplete: () => {
        mode = 'net';
        resize();
        syncUI();
        updateCursor();
      },
    });

    // 画布本来就铺满视口，相机从舞台取景直接连续推远到整张网，第一帧就起步
    timeline.to(camera.position, { z: netDistance(), duration: 1.25 }, 0);

    const from = group.quaternion.clone();
    const turn = { t: 0 };
    timeline.to(
      turn,
      {
        t: 1,
        duration: 0.55,
        onUpdate: () => group.quaternion.copy(from).slerp(model.rootQuaternion, turn.t),
      },
      0.05,
    );

    timeline.to(
      unfoldState,
      {
        t: 1,
        duration: 1.1,
        onUpdate: () => applyHinges(unfoldState.t),
      },
      0.2,
    );

    timeline.to(
      group.position,
      { x: netBase.x, y: netBase.y, z: netBase.z, duration: 0.9 },
      0.35,
    );

    views.forEach((view) => {
      timeline.to(view.numberMesh.material, { opacity: 0, duration: 0.35 }, 0.1);
      if (!pageOfFace(view.data.number)?.url) {
        timeline.to(view.mesh.material.color, { r: 0.914, g: 0.914, b: 0.914, duration: 0.45 }, 0.75);
      }
    });
  }

  function fold() {
    if (mode !== 'net') return;
    mode = 'folding';
    syncUI();
    setHover(null);
    hideTip();
    hideResult();
    // 折叠期间不自转，结束后由 resumeIdleSpin 从静止缓缓转起来
    idleSpin.mix = 0;

    const timeline = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onComplete: () => {
        // 收起后强制归位，避免手机端视口变化导致骰子偏离画面中心
        applyHinges(0);
        group.position.set(0, 0, 0);
        group.quaternion.copy(initialGroupQuaternion);
        panTarget.set(0, 0);
        panCurrent.set(0, 0);
        mode = 'die';
        // 按当前视口重新取景，保证骰子尺寸与居中位置都是最新的
        resize();
        syncUI();
        updateCursor();
        resumeIdleSpin(1.2);
      },
    });

    // 相机连续推近回舞台取景，画布尺寸全程不变，结尾没有突变
    timeline.to(camera.position, { z: dieZoom(), duration: 1.2 }, 0);

    const from = group.quaternion.clone();
    const turn = { t: 0 };
    timeline.to(
      turn,
      {
        t: 1,
        duration: 0.55,
        onUpdate: () => group.quaternion.copy(from).slerp(initialGroupQuaternion, turn.t),
      },
      0.55,
    );

    timeline.to(
      unfoldState,
      {
        t: 0,
        duration: 1.1,
        onUpdate: () => applyHinges(unfoldState.t),
      },
      0,
    );

    timeline.to(group.position, { x: 0, y: 0, z: 0, duration: 1.1 }, 0);

    views.forEach((view) => {
      timeline.to(view.mesh.material.color, { r: 1, g: 1, b: 1, duration: 0.45 }, 0);
      timeline.to(view.numberMesh.material, { opacity: 1, duration: 0.3 }, 0.8);
    });
  }

  function roll() {
    if (mode !== 'die') return;
    if (!ROLL_PAGES.length) return;

    mode = 'rolling';
    syncUI();
    setHover(null);
    hideTip();
    hideResult();

    // 复位上一轮可能被标黑的面
    views.forEach((view) => {
      view.mesh.material.color.setRGB(1, 1, 1);
    });

    const page = ROLL_PAGES[Math.floor(Math.random() * ROLL_PAGES.length)];
    const startQuaternion = group.quaternion.clone();
    const endQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        (Math.random() - 0.5) * Math.PI * 2,
        (Math.random() - 0.5) * Math.PI * 2,
        (Math.random() - 0.5) * Math.PI * 2,
      ),
    );
    const axis = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ).normalize();
    const turns = 4 + Math.floor(Math.random() * 3);
    const state = { t: 0 };
    const spinQuaternion = new THREE.Quaternion();
    const alignEase = gsap.parseEase('power2.inOut');
    const spinEase = gsap.parseEase('power3.out');

    // 投掷时骰子变成纯白，不显示数字
    views.forEach((view) => {
      gsap.to(view.numberMesh.material, { opacity: 0, duration: 0.25, overwrite: true });
    });

    const timeline = gsap.timeline({
      onComplete: () => {
        mode = 'settled';
        syncUI();
        // 停下后把朝向相机的面染黑，标出随机落点
        const front = frontFace();
        if (front) {
          gsap.to(front.mesh.material.color, { r: 0, g: 0, b: 0, duration: 0.35, overwrite: true });
        }
        showResult(page.title);
        gsap.delayedCall(1.1, () => {
          if (mode === 'settled') window.location.assign(page.url);
        });
      },
    });

    timeline
      .addLabel('toss', 0)
      .to(group.position, { y: 0.5, duration: 0.5, ease: 'power2.out' }, 'toss')
      .to(group.position, { y: 0, duration: 0.95, ease: 'power2.in' }, 'toss+=0.5')
      .to(group.position, { y: 0.06, duration: 0.1, ease: 'power1.out' }, 'toss+=1.35')
      .to(group.position, { y: 0, duration: 0.16, ease: 'power2.in' }, 'toss+=1.45')
      .to(
        state,
        {
          t: 1,
          duration: 2.1,
          ease: 'none',
          onUpdate: () => {
            group.quaternion.copy(startQuaternion).slerp(endQuaternion, alignEase(state.t));
            spinQuaternion.setFromAxisAngle(axis, Math.PI * 2 * turns * spinEase(state.t));
            group.quaternion.multiply(spinQuaternion);
          },
        },
        'toss',
      );
  }

  /** 从浏览器缓存（bfcache）返回时，把页面与骰子恢复到初始状态 */
  function resetDice() {
    if (hovered) {
      labels.get(hovered.data.number)?.classList.remove('is-active');
      hovered = null;
    }
    gsap.killTweensOf([group.position, camera.position, unfoldState, idleSpin]);
    views.forEach((view) => {
      gsap.killTweensOf(view.mesh.material.color);
      gsap.killTweensOf(view.numberMesh.material);
    });

    pointerDown = false;
    dragging = false;
    unfoldState.t = 0;
    idleSpin.mix = 1;
    applyHinges(0);
    group.position.set(0, 0, 0);
    group.quaternion.copy(initialGroupQuaternion);
    panTarget.set(0, 0);
    panCurrent.set(0, 0);

    views.forEach((view) => {
      view.mesh.material.color.setRGB(1, 1, 1);
      view.numberMesh.material.map = view.darkMap;
      view.numberMesh.material.opacity = 1;
    });

    hideTip();
    hideResult();
    mode = 'die';
    resize();
    syncUI();
    updateCursor();
    group.updateMatrixWorld(true);
  }

  // 投掷后跳转到目标页，浏览器后退回到本页时页面可能直接从缓存恢复（state 仍是 settled），
  // 这里在恢复时重置动画与骰子状态
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) resetDice();
  });

  function handleTap() {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(faceMeshes, false)[0];
    const view = hit ? views[hit.object.userData.faceIndex as number] : null;

    if (mode === 'net') {
      // 点击空白处收起
      if (!view) {
        fold();
        return;
      }
      const page = pageOfFace(view.data.number);
      if (page?.url) window.location.assign(page.url);
      return;
    }

    if (mode !== 'die') return;
    const page = view ? pageOfFace(view.data.number) : undefined;
    if (page?.url) {
      window.location.assign(page.url);
      return;
    }
    // 只有空白处才展开，避免与点击面进入页面冲突
    if (!view) unfold();
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (mode !== 'die' && mode !== 'net') return;
    pointerDown = true;
    travel = 0;
    downAt = performance.now();
    lastX = event.clientX;
    lastY = event.clientY;
    updatePointer(event);
    canvas.setPointerCapture(event.pointerId);
    if (mode === 'net') updateHover();
  });

  canvas.addEventListener('pointermove', (event) => {
    updatePointer(event);

    if (mode === 'net') {
      if (pointerDown) {
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        travel += Math.abs(dx) + Math.abs(dy);
        lastX = event.clientX;
        lastY = event.clientY;
        panByPixels(dx, dy);
      } else if (event.pointerType !== 'touch') {
        // 鼠标仍保留贴边平移，触屏改为跟手拖动
        updatePanTarget();
      }
      updateHover();
      return;
    }

    if (!pointerDown) {
      updateHover();
      return;
    }

    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    travel += Math.abs(dx) + Math.abs(dy);
    lastX = event.clientX;
    lastY = event.clientY;

    if (mode === 'die' && travel > 4) {
      dragging = true;
      setHover(null);
      hideTip();
      const qx = new THREE.Quaternion().setFromAxisAngle(X_AXIS, dy * 0.006);
      const qy = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, dx * 0.006);
      group.quaternion.premultiply(qy).premultiply(qx);
    }
  });

  const endPointer = (event: PointerEvent) => {
    if (!pointerDown) return;
    pointerDown = false;
    const quick = performance.now() - downAt < 500;
    if (travel < 8 && quick) handleTap();
    dragging = false;
    updateCursor();
    updatePointer(event);
    if (mode === 'die' || mode === 'net') updateHover();
  };

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', () => {
    pointerDown = false;
    dragging = false;
    updateCursor();
  });
  canvas.addEventListener('pointerleave', () => {
    if (pointerDown) return;
    setHover(null);
    hideTip();
  });

  rollBtn.addEventListener('click', roll);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mode === 'net') fold();
  });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  window.addEventListener('resize', resize);

  if (visualViewport) {
    syncViewport();
    visualViewport.addEventListener('resize', syncViewport);
    visualViewport.addEventListener('scroll', syncViewport);
  }

  measureNet();
  netBase.set(-netCenter.x, -netCenter.y, -netCenter.z);
  resize();
  syncUI();
  updateCursor();
  group.updateMatrixWorld(true);

  const clock = { last: performance.now() };
  const idleQuaternion = new THREE.Quaternion();

  function frame() {
    const now = performance.now();
    const delta = Math.min((now - clock.last) / 1000, 0.05);
    clock.last = now;
    // 悬停到某个面时暂停自旋，否则目标面会从指针下转走，无法稳定点击
    if (mode === 'die' && !dragging && !hovered) {
      idleQuaternion.setFromAxisAngle(IDLE_AXIS, delta * 0.14 * idleSpin.mix);
      group.quaternion.premultiply(idleQuaternion);
    }
    if (mode === 'net') {
      // 指针贴边时平滑移动整张网，像地图一样查看屏幕外的部分
      panCurrent.lerp(panTarget, 1 - Math.exp(-delta * 7));
      group.position.x = netBase.x + panCurrent.x;
      group.position.y = netBase.y + panCurrent.y;
      updateLabels();
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  requestAnimationFrame(() => root!.classList.add('is-ready'));
}

function setupOutlineGeometry(face: FaceData) {
  const positions: number[] = [];
  for (const v of face.localVertices) positions.push(v.x, v.y, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}
