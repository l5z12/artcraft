import type { ObjectJSON } from "./proxy/storyteller_proxy_3d_object";
import type { TimelineData } from "./engine/timeline/types";

export const LOCAL_SCENE_MAX_BYTES = 256 * 1024 * 1024;
export const WATER_NORMALS_URL = "https://threejs.org/examples/textures/waternormals.jpg";
const FORMAT = "artcraft-scene";
const FORMAT_VERSION = 1;
const ASSET_MIMES = new Set([
  "model/gltf-binary", "application/x-spz", "image/png", "image/jpeg",
  "image/webp", "image/gif", "video/mp4",
]);

export interface LocalSceneData {
  version: number;
  scene: ObjectJSON[];
  timeline?: TimelineData | null;
  embeddedAssets?: Record<string, string>;
  [key: string]: unknown;
}

export interface LocalSceneAssetSource {
  getMediaUrlByToken(token: string): Promise<string>;
  fetchAsset(url: string): Promise<Response>;
}

// A versioned JSON envelope, with base64 assets keyed by their original media
// tokens/URLs. Keeping the original IDs preserves rigs, clip lanes and cloud
// references. Built-in shapes, cameras and bundled skyboxes need no download.
export async function createLocalSceneFile(
  saveJson: string,
  title: string,
  source: LocalSceneAssetSource,
): Promise<string> {
  const scene = validateScene(JSON.parse(saveJson));
  const embeddedAssets: Record<string, string> = Object.create(null);
  let size = new TextEncoder().encode(JSON.stringify({ ...scene, embeddedAssets: {} })).length;
  // Sequential downloads bound peak memory for large models and splats.
  for (const id of sceneAssetIds(scene)) {
    if (Object.hasOwn(scene.embeddedAssets ?? {}, id)) {
      embeddedAssets[id] = scene.embeddedAssets![id];
      size += embeddedAssets[id].length;
      continue;
    }
    const url = id.startsWith("m_") ? await source.getMediaUrlByToken(id) : id;
    const response = await source.fetchAsset(url);
    if (!response.ok) throw new Error(`Could not include scene asset: ${id}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mime = assetMime(url, response.headers.get("content-type"), bytes);
    // Binary glTF can still point to external textures/buffers. Refuse an
    // incomplete archive instead of saving a file that silently needs a server.
    if (mime === "model/gltf-binary") validateGlb(bytes);
    size += Math.ceil(bytes.length / 3) * 4;
    if (size > LOCAL_SCENE_MAX_BYTES) throw new Error("Local scene exceeds the 256 MB file limit.");
    embeddedAssets[id] = `data:${mime};base64,${encodeBase64(bytes)}`;
  }
  const result = JSON.stringify({
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    title: title.trim() || "Untitled Scene",
    scene: { ...scene, embeddedAssets },
  });
  if (new TextEncoder().encode(result).length > LOCAL_SCENE_MAX_BYTES) {
    throw new Error("Local scene exceeds the 256 MB file limit.");
  }
  return result;
}

export function parseLocalSceneFile(contents: string): { saveJson: string; sceneTitle: string } {
  if (new TextEncoder().encode(contents).length > LOCAL_SCENE_MAX_BYTES) {
    throw new Error("Local scene exceeds the 256 MB file limit.");
  }
  let file;
  try {
    file = JSON.parse(contents);
  } catch {
    throw new Error("This is not a valid ArtCraft scene file.");
  }
  if (!isRecord(file) || file.format !== FORMAT || file.formatVersion !== FORMAT_VERSION) {
    throw new Error("Unsupported ArtCraft scene file format or version.");
  }
  if (typeof file.title !== "string") throw new Error("The scene file has no title.");
  const scene = validateScene(file.scene);
  const assets = scene.embeddedAssets;
  if (!isRecord(assets)) throw new Error("The scene file has no embedded assets.");
  for (const id of sceneAssetIds(scene)) {
    if (!Object.hasOwn(assets, id)) throw new Error(`The scene file is missing an asset: ${id}`);
  }
  for (const dataUrl of Object.values(assets)) {
    const match = typeof dataUrl === "string"
      ? /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
      : null;
    if (!match || !ASSET_MIMES.has(match[1]) || match[2].length % 4 !== 0) {
      throw new Error("The scene file contains an invalid embedded asset.");
    }
    if (match[1] === "model/gltf-binary") {
      validateGlb(Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0)));
    }
  }
  return { saveJson: JSON.stringify(scene), sceneTitle: file.title || "Untitled Scene" };
}

function sceneAssetIds(scene: LocalSceneData): Set<string> {
  const ids = new Set<string>();
  for (const object of scene.scene) {
    const id = object.media_file_token;
    if (id.startsWith("m_")) ids.add(id);
    else if (id.startsWith("Image::")) ids.add(id.slice("Image::".length));
    else if (id !== "Parim" && id !== "DirectionalLight" && !id.startsWith("Point::")) {
      throw new Error(`Cannot save this scene object locally: ${object.object_name}`);
    }
    if (object.user_data.water || object.user_data.shapeKey === "Water" || object.object_name === "Water") {
      ids.add(WATER_NORMALS_URL);
    }
  }
  for (const lane of scene.timeline?.clipLanes ?? []) {
    if (lane.strip.sourceMediaId) ids.add(lane.strip.sourceMediaId);
  }
  return ids;
}

function validateScene(value: unknown): LocalSceneData {
  if (!isRecord(value) || typeof value.version !== "number" || !Number.isFinite(value.version) || !Array.isArray(value.scene)) {
    throw new Error("The file does not contain a valid scene.");
  }
  for (const object of value.scene) {
    if (!isRecord(object) || typeof object.media_file_token !== "string" ||
        typeof object.object_uuid !== "string" || typeof object.object_name !== "string" ||
        !isRecord(object.user_data) || !isVector(object.position) ||
        !isVector(object.rotation) || !isVector(object.scale)) {
      throw new Error("The scene contains an invalid object.");
    }
  }
  if (value.camera_data != null && (!isRecord(value.camera_data) ||
      !isVector(value.camera_data.position) || !isRotation(value.camera_data.rotation))) {
    throw new Error("The scene contains an invalid camera.");
  }
  if (value.cameras != null && (!Array.isArray(value.cameras) || value.cameras.some((cam) =>
    !isRecord(cam) || typeof cam.id !== "string" || !isVector(cam.position) || !isVector(cam.rotation)))) {
    throw new Error("The scene contains invalid cameras.");
  }
  if (value.timeline != null) {
    const t = value.timeline;
    if (!isRecord(t) || !Number.isFinite(t.duration) || t.duration <= 0 || !Number.isFinite(t.fps) || t.fps <= 0 ||
        !Array.isArray(t.tracks) || !Array.isArray(t.clipLanes) ||
        t.tracks.some((track) => !isRecord(track) || typeof track.objectUuid !== "string" ||
          !Array.isArray(track.keyframes) || track.keyframes.some((k) =>
            !isRecord(k) || typeof k.id !== "string" || !Number.isFinite(k.time) ||
            !isRecord(k.transform) || !isVector(k.transform.position) || !isVector(k.transform.rotation) ||
            !isVector(k.transform.scale) || !isEasing(k.easing))) ||
        t.clipLanes.some((lane) => !isRecord(lane) || typeof lane.id !== "string" || typeof lane.objectUuid !== "string" ||
          !isRecord(lane.strip) || typeof lane.strip.id !== "string" || typeof lane.strip.sourceMediaId !== "string" ||
          !Number.isFinite(lane.strip.startTime) || !Number.isFinite(lane.strip.duration) ||
          (lane.strip.transitionEasing != null && !isEasing(lane.strip.transitionEasing)))) {
      throw new Error("The scene contains an invalid animation timeline.");
    }
  }
  return value as LocalSceneData;
}

function assetMime(url: string, contentType: string | null, bytes: Uint8Array): string {
  const extension = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url)?.[1].toLowerCase();
  const types: Record<string, string> = {
    glb: "model/gltf-binary", spz: "application/x-spz", png: "image/png",
    jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp4: "video/mp4",
  };
  const mime = types[extension ?? ""] ?? contentType?.split(";")[0];
  if (mime && ASSET_MIMES.has(mime)) return mime;
  if (bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46) return "model/gltf-binary";
  throw new Error("This asset format cannot be bundled locally yet. Use GLB models, SPZ splats, images or MP4 videos.");
}

function validateGlb(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20 || view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length ||
      view.getUint32(16, true) !== 0x4e4f534a || view.getUint32(12, true) > bytes.length - 20) {
    throw new Error("The scene contains an invalid GLB model.");
  }
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))));
  const dependencies = [...(json.buffers ?? []), ...(json.images ?? [])];
  if (dependencies.some((dep) => dep.uri && !dep.uri.startsWith("data:"))) {
    throw new Error("A GLB model uses external textures or buffers. Embed them in the GLB before saving locally.");
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isVector(value: unknown): boolean {
  return isRecord(value) && [value.x, value.y, value.z].every((n) => typeof n === "number" && Number.isFinite(n));
}

function isRotation(value: unknown): boolean {
  // THREE.Euler serializes its private coordinates; camera configs use x/y/z.
  return isVector(value) || (isRecord(value) && isVector({ x: value._x, y: value._y, z: value._z }));
}

function isEasing(value: unknown): boolean {
  return isRecord(value) && [value.p1x, value.p1y, value.p2x, value.p2y].every((n) => typeof n === "number" && Number.isFinite(n));
}

function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
  }
  return btoa(chunks.join(""));
}
