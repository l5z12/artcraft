import type Editor from "../engine/editor";
import { EditorLoaderEvent } from "../engine/events/EngineEvent";
import { ToastTypes } from "../enums";
import { usePageSceneStore } from "../PageSceneStore";
import { getSceneGenerationMetaData } from "../sceneMetadata";

const pending = new WeakSet<Editor>();

export async function saveLocalScene(editor: Editor): Promise<void> {
  if (!editor.adapter.saveLocalScene || !canStart(editor)) return;
  pending.add(editor);
  editor.bus.emit(new EditorLoaderEvent(true, "Saving local scene…"));
  try {
    const sceneTitle = usePageSceneStore.getState().sceneMeta.title || "Untitled Scene";
    const saveJson = snapshot(editor);
    if (await editor.adapter.saveLocalScene({ saveJson, sceneTitle })) {
      editor.adapter.showToast(ToastTypes.SUCCESS, "Scene saved to your computer.");
    }
  } catch (error) {
    editor.adapter.showToast(ToastTypes.ERROR, `Could not save scene: ${errorMessage(error)}`);
  } finally {
    pending.delete(editor);
    editor.bus.emit(new EditorLoaderEvent(false));
  }
}

export async function openLocalScene(editor: Editor): Promise<void> {
  if (!editor.adapter.openLocalScene || !canStart(editor)) return;
  pending.add(editor);
  editor.bus.emit(new EditorLoaderEvent(true, "Opening local scene…"));
  try {
    // The host validates the entire file and confirms replacement before
    // returning. Cancellation never calls applyJson or changes cloud identity.
    const file = await editor.adapter.openLocalScene();
    if (!file) return;
    const previous = snapshot(editor);
    try {
      if (!await editor.applyJson(file.saveJson)) return;
    } catch (error) {
      await editor.applyJson(previous);
      throw error;
    }
    editor.adapter.onSceneTitleChange?.({
      title: file.sceneTitle,
      token: undefined,
      ownerToken: editor.adapter.getCurrentUserToken?.(),
      isModified: false,
    });
    editor.adapter.showToast(ToastTypes.SUCCESS, "Local scene opened.");
  } catch (error) {
    editor.adapter.showToast(ToastTypes.ERROR, `Could not open scene: ${errorMessage(error)}`);
  } finally {
    pending.delete(editor);
    editor.bus.emit(new EditorLoaderEvent(false));
  }
}

function canStart(editor: Editor): boolean {
  const state = usePageSceneStore.getState();
  return !pending.has(editor) && !state.editorLoader.isShowing &&
    state.recordingProgress === null && state.sceneMode === "build";
}

function snapshot(editor: Editor): string {
  return JSON.stringify(editor.save_manager.getSceneJson({
    sceneGenerationMetadata: getSceneGenerationMetaData(editor),
  }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
