import { describe, it, expect, vi } from "vitest";
import { createLocalSceneFile, parseLocalSceneFile, WATER_NORMALS_URL } from "./localSceneFile";

const VECTOR = { x: 0, y: 0, z: 0 };

describe("portable local scenes", () => {
  it("round-trips objects, poses, cameras and animation, deduplicating assets", async () => {
    const scene = makeScene();
    scene.scene.push({ ...scene.scene[0], object_uuid: "second" });
    const source = makeSource();
    const contents = await createLocalSceneFile(JSON.stringify(scene), "My scene", source);
    const result = parseLocalSceneFile(contents);
    const restored = JSON.parse(result.saveJson);
    expect(result.sceneTitle).toBe("My scene");
    expect(restored).toMatchObject(scene);
    expect(Object.keys(restored.embeddedAssets)).toEqual(["m_model", "m_animation"]);
    expect(source.getMediaUrlByToken).toHaveBeenCalledTimes(2);
    expect(source.fetchAsset).toHaveBeenCalledTimes(2);
  });

  it("resaves an opened local file without resolving or downloading any assets", async () => {
    const saved = await createLocalSceneFile(JSON.stringify(makeScene()), "First", makeSource());
    const opened = parseLocalSceneFile(saved);
    const source = makeSource();
    source.fetchAsset.mockRejectedValue(new Error("offline"));
    const resaved = await createLocalSceneFile(opened.saveJson, "Renamed", source);
    expect(parseLocalSceneFile(resaved).sceneTitle).toBe("Renamed");
    expect(source.fetchAsset).not.toHaveBeenCalled();
    expect(source.getMediaUrlByToken).not.toHaveBeenCalled();
  });

  it("saves built-in shapes offline and includes direct image/video planes and water textures", async () => {
    const scene = makeScene();
    scene.timeline.clipLanes = [];
    scene.scene = [
      { ...scene.scene[0], media_file_token: "Parim", object_name: "Box", user_data: { shapeKey: "Box" } },
    ];
    const source = makeSource();
    const shapeFile = await createLocalSceneFile(JSON.stringify(scene), "Shapes", source);
    expect(JSON.parse(parseLocalSceneFile(shapeFile).saveJson).embeddedAssets).toEqual({});
    expect(source.fetchAsset).not.toHaveBeenCalled();
    scene.scene.push(
      { ...scene.scene[0], media_file_token: "Image::https://example.test/plane.png" },
      { ...scene.scene[0], media_file_token: "Image::https://example.test/plane.mp4" },
      { ...scene.scene[0], object_name: "Water", user_data: { shapeKey: "Water" } },
    );
    source.fetchAsset.mockImplementation(async () => new Response(new Uint8Array([1, 2, 3])));
    const file = await createLocalSceneFile(JSON.stringify(scene), "Planes", source);
    const assets = JSON.parse(parseLocalSceneFile(file).saveJson).embeddedAssets;
    expect(assets["https://example.test/plane.png"]).toBe("data:image/png;base64,AQID");
    expect(assets["https://example.test/plane.mp4"]).toBe("data:video/mp4;base64,AQID");
    expect(assets[WATER_NORMALS_URL]).toBe("data:image/jpeg;base64,AQID");
  });

  it("rejects missing assets, unsupported versions and malformed files before loading", async () => {
    const file = JSON.parse(await createLocalSceneFile(JSON.stringify(makeScene()), "Scene", makeSource()));
    expect(() => parseLocalSceneFile("not json")).toThrow("valid ArtCraft");
    expect(() => parseLocalSceneFile(JSON.stringify({ ...file, formatVersion: 2 }))).toThrow("version");
    file.scene.embeddedAssets = {};
    expect(() => parseLocalSceneFile(JSON.stringify(file))).toThrow("missing an asset");
    file.scene.scene[0].position = null;
    expect(() => parseLocalSceneFile(JSON.stringify(file))).toThrow("invalid object");
  });

  it("fails a save when an asset download fails rather than creating an incomplete file", async () => {
    const source = makeSource();
    source.fetchAsset.mockResolvedValue(new Response("Missing", { status: 404 }));
    await expect(createLocalSceneFile(JSON.stringify(makeScene()), "Scene", source)).rejects.toThrow("Could not include");
  });

  it("rejects GLBs that rely on external textures and unsupported MMD models", async () => {
    const source = makeSource();
    source.fetchAsset.mockImplementation(async () => new Response(makeGlb({ images: [{ uri: "texture.png" }] })));
    await expect(createLocalSceneFile(JSON.stringify(makeScene()), "Scene", source)).rejects.toThrow("external textures");
    source.getMediaUrlByToken.mockResolvedValue("https://example.test/model.pmx");
    source.fetchAsset.mockImplementation(async () => new Response(new Uint8Array([1])));
    await expect(createLocalSceneFile(JSON.stringify(makeScene()), "Scene", source)).rejects.toThrow("format cannot be bundled");
  });
});

function makeSource() {
  return {
    getMediaUrlByToken: vi.fn(async (id: string) => `https://example.test/${id}.glb`),
    fetchAsset: vi.fn(async (_url: string) => new Response(makeGlb())),
  };
}

function makeScene() {
  return {
    version: 2,
    scene: [{
      media_file_token: "m_model", object_uuid: "object", object_name: "Model",
      position: VECTOR, rotation: VECTOR, scale: { x: 1, y: 1, z: 1 },
      user_data: { shapeKey: "" }, rigData: { bones: [{ name: "Arm", rotation: VECTOR }] },
    }],
    positivePrompt: "Test prompt", skybox: "m_1", selectedCameraId: "main",
    cameras: [{ id: "main", position: VECTOR, rotation: VECTOR, focalLength: 35 }],
    camera_data: { position: VECTOR, rotation: { _x: 0, _y: 0, _z: 0, _order: "XYZ" } },
    timeline: {
      duration: 10, fps: 30, tracks: [],
      clipLanes: [{ id: "lane", objectUuid: "object", strip: {
        id: "strip", sourceMediaId: "m_animation", name: "Walk", startTime: 0, duration: 3, loop: true,
      } }],
    },
  };
}

function makeGlb(extra = {}) {
  const json = JSON.stringify({ asset: { version: "2.0" }, ...extra });
  const padded = json.padEnd(Math.ceil(json.length / 4) * 4, " ");
  const bytes = new Uint8Array(20 + padded.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, padded.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(new TextEncoder().encode(padded), 20);
  return bytes;
}
