use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use super::scene_file::{validate_scene_file, write_scene_file};

#[tauri::command]
pub async fn save_local_scene_command(app: AppHandle, contents: String, title: String) -> Result<bool, String> {
  tauri::async_runtime::spawn_blocking(move || {
    validate_scene_file(&contents).map_err(|err| format!("{err:#}"))?;
    let name: String = title.chars().take(100).map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c }).collect();
    // A prefix also avoids Windows reserved device filenames (CON, NUL, etc.).
    let filename = format!("Scene-{}.artcraft", name.trim().trim_end_matches('.'));
    let Some(file) = app.dialog().file().set_title("Save local ArtCraft scene").set_file_name(&filename).add_filter("ArtCraft scene", &["artcraft"]).blocking_save_file() else {
      return Ok(false);
    };
    let path = file.into_path().map_err(|err| err.to_string())?;
    write_scene_file(&path, &contents).map_err(|err| format!("{err:#}"))?;
    Ok(true)
  })
  .await
  .map_err(|err| err.to_string())?
}
