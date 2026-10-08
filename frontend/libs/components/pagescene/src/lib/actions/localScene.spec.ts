import { beforeEach, describe, it, expect, vi } from "vitest";
import type Editor from "../engine/editor";
import { usePageSceneStore } from "../PageSceneStore";
import { openLocalScene, saveLocalScene } from "./localScene";

describe("local scene actions", () => {
  beforeEach(() => {
    usePageSceneStore.setState({
      currentUserToken: undefined,
      sceneMode: "build",
      recordingProgress: null,
      editorLoader: { isShowing: false, message: "" },
      sceneMeta: { title: "Local test", token: "m_cloud", ownerToken: "other", isModified: true, isInitializing: false },
    });
  });

  it("saves without an account and never updates the cloud scene", async () => {
    const e = editorFixture();
    await saveLocalScene(e.editor);
    expect(e.adapter.saveLocalScene).toHaveBeenCalledWith({ saveJson: '{"scene":[]}', sceneTitle: "Local test" });
    expect(e.adapter.onSceneTitleChange).not.toHaveBeenCalled();
    expect(e.adapter.saveScene).not.toHaveBeenCalled();
    expect(e.bus.emit.mock.calls.at(-1)?.[0].visible).toBe(false);
  });

  it("leaves the current scene alone when opening is cancelled or invalid", async () => {
    const e = editorFixture();
    e.adapter.openLocalScene.mockResolvedValueOnce(null);
    await openLocalScene(e.editor);
    expect(e.applyJson).not.toHaveBeenCalled();
    e.adapter.openLocalScene.mockRejectedValueOnce(new Error("Invalid file"));
    await openLocalScene(e.editor);
    expect(e.applyJson).not.toHaveBeenCalled();
    expect(e.adapter.onSceneTitleChange).not.toHaveBeenCalled();
    expect(e.bus.emit.mock.calls.at(-1)?.[0].visible).toBe(false);
  });

  it("opens a local file as a new local document, clearing cloud ownership", async () => {
    const e = editorFixture();
    await openLocalScene(e.editor);
    expect(e.applyJson).toHaveBeenCalledWith("local json");
    expect(e.adapter.onSceneTitleChange).toHaveBeenCalledWith({
      title: "Opened", token: undefined, ownerToken: undefined, isModified: false,
    });
  });

  it("restores the prior snapshot when a model fails to load", async () => {
    const e = editorFixture();
    e.applyJson.mockRejectedValueOnce(new Error("Bad model"));
    await openLocalScene(e.editor);
    expect(e.applyJson.mock.calls.map(([json]) => json)).toEqual(["local json", '{"scene":[]}']);
    expect(e.adapter.onSceneTitleChange).not.toHaveBeenCalled();
    expect(e.adapter.showToast.mock.calls.at(-1)?.[1]).toContain("Bad model");
  });

  it("does not report success on cancellation or allow concurrent operations", async () => {
    const e = editorFixture();
    let finish!: (value: boolean) => void;
    e.adapter.saveLocalScene.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const saving = saveLocalScene(e.editor);
    await openLocalScene(e.editor);
    await saveLocalScene(e.editor);
    expect(e.adapter.saveLocalScene).toHaveBeenCalledTimes(1);
    expect(e.adapter.openLocalScene).not.toHaveBeenCalled();
    finish(false);
    await saving;
    expect(e.adapter.showToast).not.toHaveBeenCalled();
  });

  it("blocks replacing scenes during recording and clears the spinner on write failure", async () => {
    const e = editorFixture();
    usePageSceneStore.setState({ recordingProgress: { phase: "encoding", pct: 0.5 } });
    await openLocalScene(e.editor);
    expect(e.adapter.openLocalScene).not.toHaveBeenCalled();
    usePageSceneStore.setState({ recordingProgress: null });
    e.adapter.saveLocalScene.mockRejectedValueOnce(new Error("Disk full"));
    await saveLocalScene(e.editor);
    expect(e.adapter.showToast.mock.calls.at(-1)?.[1]).toContain("Disk full");
    expect(e.bus.emit.mock.calls.at(-1)?.[0].visible).toBe(false);
  });
});

function editorFixture() {
  const adapter = {
    saveLocalScene: vi.fn(async () => true),
    openLocalScene: vi.fn<() => Promise<{saveJson: string; sceneTitle: string} | null>>(async () => ({ saveJson: "local json", sceneTitle: "Opened" })),
    saveScene: vi.fn(),
    showToast: vi.fn(),
    onSceneTitleChange: vi.fn(),
    getCurrentUserToken: () => undefined,
  };
  const bus = { emit: vi.fn() };
  const applyJson = vi.fn(async (_json: string) => true);
  const editor = { adapter, bus, applyJson, positive_prompt: "", save_manager: { getSceneJson: () => ({ scene: [] }) } } as unknown as Editor;
  return { editor, adapter, bus, applyJson };
}
