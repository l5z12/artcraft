// Run against a local Vite dev server. Uses real rendering/serialization with
// mocked native file pickers; all remote requests are blocked.
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { installBrowserFixture } from "../performance/browser-fixture.mjs";
import { launchTestBrowser, captureBrowserFailure } from "./browser-test-utils.mjs";

const url = new URL(process.argv[2] || "http://127.0.0.1:6218");
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  throw new Error("Use a local development URL.");
}
const browser = await launchTestBrowser(chromium);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(installBrowserFixture);
  await context.addInitScript(() => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    window.__LOCAL_SCENE_TEST__ = { file: null, saved: [], calls: [], cancelOpen: false, confirm: true };
    window.__TAURI_INTERNALS__.invoke = async (command, args) => {
      const fixture = window.__LOCAL_SCENE_TEST__;
      fixture.calls.push(command);
      if (command === "storyteller_get_login_session_command") return null;
      if (command === "save_local_scene_command") {
        fixture.file = args.contents;
        fixture.saved.push(args.contents);
        return true;
      }
      if (command === "open_local_scene_command") return fixture.cancelOpen ? null : fixture.file;
      if (command === "plugin:dialog|message") return fixture.confirm ? "Open scene" : "Cancel";
      return invoke(command, args);
    };
  });
  await context.route("**/*", (route) => route.request().url().startsWith(url.origin)
    ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url.href);
  await page.getByRole("button", { name: "3D Stage Precision control. Great for AI film." }).click({ timeout: 60000 });
  const fileMenu = page.getByRole("button", { name: "File", exact: true });
  await expect(fileMenu).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Sign up to save", { exact: true })).toHaveCount(0);
  await fileMenu.click();
  await page.getByRole("menuitem", { name: /Save local scene/ }).click();
  await expect.poll(() => page.evaluate(() => window.__LOCAL_SCENE_TEST__.saved.length)).toBe(1);
  const initial = await page.evaluate(() => JSON.parse(window.__LOCAL_SCENE_TEST__.file));
  assert.equal(initial.format, "artcraft-scene");
  assert.ok(initial.scene.cameras.length > 0);

  // Include a shape, GLB and image plane, then reopen with the network blocked.
  await page.evaluate(() => {
    const f = JSON.parse(window.__LOCAL_SCENE_TEST__.file);
    f.title = "Offline round trip";
    f.scene.scene.push({
      version: 2, media_file_token: "Parim", object_name: "Local cube", object_user_data_name: "Local cube",
      object_uuid: "local-cube", position: { x: 2, y: 1, z: 0 }, rotation: { x: 0, y: 0.5, z: 0 },
      scale: { x: 1, y: 2, z: 1 }, color: "#ff0000", metalness: 0, shininess: 0.5, specular: 0,
      locked: false, visible: true, user_data: { shapeKey: "Box", name: "Local cube" },
    });
    const json = JSON.stringify({
      asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
        { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
      ],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }],
      buffers: [{ byteLength: 42 }],
    });
    const padded = json.padEnd(Math.ceil(json.length / 4) * 4, " ");
    const bytes = new Uint8Array(20 + padded.length + 8 + 44);
    const view = new DataView(bytes.buffer);
    for (const [offset, value] of [[0, 0x46546c67], [4, 2], [8, bytes.length], [12, padded.length], [16, 0x4e4f534a], [20 + padded.length, 44], [24 + padded.length, 0x004e4942]]) view.setUint32(offset, value, true);
    bytes.set(new TextEncoder().encode(padded), 20);
    bytes.set(new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer), 28 + padded.length);
    bytes.set(new Uint8Array(new Uint16Array([0, 1, 2]).buffer), 64 + padded.length);
    f.scene.embeddedAssets = {
      m_local_model: "data:model/gltf-binary;base64," + btoa(String.fromCharCode(...bytes)),
      "https://offline.invalid/image.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    };
    const cube = f.scene.scene.at(-1);
    f.scene.scene.push(
      { ...cube, media_file_token: "m_local_model", object_name: "Embedded triangle", object_uuid: "embedded-triangle", user_data: {} },
      { ...cube, media_file_token: "Image::https://offline.invalid/image.png", object_name: "Embedded image", object_uuid: "embedded-image", user_data: {} },
    );
    f.scene.timeline = { duration: 10, fps: 30, clipLanes: [], tracks: [{
      objectUuid: "local-cube", keyframes: [{
        id: "frame", time: 0, transform: { position: cube.position, rotation: cube.rotation, scale: cube.scale },
        easing: { p1x: 0, p1y: 0, p2x: 1, p2y: 1 },
      }],
    }] };
    window.__LOCAL_SCENE_TEST__.file = JSON.stringify(f);
  });
  await page.keyboard.press("Control+o");
  await expect(page.getByText("Offline round trip", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Local cube 3D Object", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Embedded triangle 3D Object", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Embedded image 3D Object", exact: true })).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect.poll(() => page.evaluate(() => window.__LOCAL_SCENE_TEST__.saved.length)).toBe(2);
  const saved = await page.evaluate(() => JSON.parse(window.__LOCAL_SCENE_TEST__.file));
  assert.equal(saved.title, "Offline round trip");
  assert.deepEqual(saved.scene.scene.find((o) => o.object_uuid === "local-cube").scale, { x: 1, y: 2, z: 1 });
  assert.equal(saved.scene.timeline.tracks[0].keyframes[0].id, "frame");
  assert.equal(Object.keys(saved.scene.embeddedAssets).length, 2);

  // The host's tab cache must retain embedded bytes across editor teardown.
  await page.evaluate(async () => {
    const { useTabStore } = await import("/src/pages/Stores/TabState.ts");
    await useTabStore.getState().setActiveTab("APPS");
  });
  await page.getByRole("button", { name: "3D Stage Precision control. Great for AI film." }).click();
  await expect(page.getByRole("button", { name: "Embedded triangle 3D Object", exact: true })).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect.poll(() => page.evaluate(() => window.__LOCAL_SCENE_TEST__.saved.length)).toBe(3);
  assert.equal(await page.evaluate(() => Object.keys(JSON.parse(window.__LOCAL_SCENE_TEST__.file).scene.embeddedAssets).length), 2);

  // Both file-picker and replacement-confirm cancellation preserve the scene.
  await page.evaluate(() => { window.__LOCAL_SCENE_TEST__.cancelOpen = true; });
  await page.keyboard.press("Control+o");
  await expect(page.getByRole("button", { name: "Local cube 3D Object", exact: true })).toBeVisible();
  await page.evaluate(() => { window.__LOCAL_SCENE_TEST__.cancelOpen = false; window.__LOCAL_SCENE_TEST__.confirm = false; });
  await page.keyboard.press("Control+o");
  await expect(page.getByRole("button", { name: "Local cube 3D Object", exact: true })).toBeVisible();

  // Invalid files must fail before replacing the active document.
  await page.evaluate(() => { window.__LOCAL_SCENE_TEST__.confirm = true; window.__LOCAL_SCENE_TEST__.file = "{}"; });
  await page.keyboard.press("Control+o");
  await expect(page.getByText(/Could not open scene: Unsupported ArtCraft/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Local cube 3D Object", exact: true })).toBeVisible();
  assert.deepEqual(errors, [], "Application runtime errors");
  console.log("PASS: signed-out local save/open, embedded GLB/image, cameras/timeline, tab-cache round trip, Ctrl+S/O, cancellation and malformed-file recovery.");
} catch (error) {
  await captureBrowserFailure(browser, "local-scene");
  throw error;
} finally {
  await browser.close();
}
