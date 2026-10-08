use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use super::scene_file::read_scene_file;

#[tauri::command]
pub async fn open_local_scene_command(app: AppHandle) -> Result<Option<String>, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let Some(file) = app.dialog().file().set_title("Open local ArtCraft scene").add_filter("ArtCraft scene", &["artcraft"]).blocking_pick_file() else {
      return Ok(None);
    };
    let path = file.into_path().map_err(|err| err.to_string())?;
    read_scene_file(&path).map(Some).map_err(|err| format!("{err:#}"))
  })
  .await
  .map_err(|err| err.to_string())?
}
