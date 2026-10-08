import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import {
  createLocalSceneFile,
  parseLocalSceneFile,
  type PageSceneAdapter,
} from "@storyteller/ui-pagescene";

export function withLocalSceneFiles<T extends PageSceneAdapter>(
  source: T,
): T & Pick<PageSceneAdapter, "saveLocalScene" | "openLocalScene"> {
  return {
    ...source,
    async saveLocalScene({ saveJson, sceneTitle }) {
      const contents = await createLocalSceneFile(saveJson, sceneTitle, {
        getMediaUrlByToken: source.getMediaUrlByToken,
        fetchAsset: (url) => /^(data:|blob:)/.test(url) ? fetch(url) : source.fetchAsset(url),
      });
      return invoke<boolean>("save_local_scene_command", { contents, title: sceneTitle });
    },
    async openLocalScene() {
      const contents = await invoke<string | null>("open_local_scene_command");
      if (contents === null) return null;
      const file = parseLocalSceneFile(contents);
      const replace = await confirm(
        "Open this local scene? Unsaved changes to the current scene will be lost.",
        { title: "Open local scene", kind: "warning", okLabel: "Open scene", cancelLabel: "Cancel" },
      );
      return replace ? file : null;
    },
  };
}
