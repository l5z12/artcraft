use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use anyhow::{bail, Context, Result};
use serde_json::Value;
use tempfile::NamedTempFile;

const MAX_SCENE_BYTES: u64 = 256 * 1024 * 1024;

pub fn read_scene_file(path: &Path) -> Result<String> {
  let file = File::open(path).context("Could not open the scene file")?;
  let mut contents = String::new();
  file.take(MAX_SCENE_BYTES + 1).read_to_string(&mut contents).context("Could not read the scene file as UTF-8")?;
  validate_scene_file(&contents)?;
  Ok(contents)
}

pub fn write_scene_file(path: &Path, contents: &str) -> Result<()> {
  validate_scene_file(contents)?;
  let parent = path.parent().context("The selected file has no parent directory")?;
  // Complete and sync the new file before replacing an existing save. A failed
  // write leaves the old document intact, and the temporary file cleans itself up.
  let mut file = NamedTempFile::new_in(parent).context("Could not create the scene file")?;
  file.write_all(contents.as_bytes()).context("Could not write the scene file")?;
  file.as_file().sync_all().context("Could not sync the scene file")?;
  file.persist(path).context("Could not replace the scene file")?;
  Ok(())
}

pub fn validate_scene_file(contents: &str) -> Result<()> {
  if contents.len() as u64 > MAX_SCENE_BYTES {
    bail!("Local scene exceeds the 256 MB file limit.");
  }
  let file: Value = serde_json::from_str(contents).context("Invalid ArtCraft scene JSON")?;
  if file["format"] != "artcraft-scene" || file["formatVersion"] != 1 || !file["title"].is_string() || !file["scene"].is_object() {
    bail!("Unsupported ArtCraft scene file format or version.");
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;
  use tempfile::tempdir;

  const SCENE: &str = r#"{"format":"artcraft-scene","formatVersion":1,"title":"Test","scene":{"scene":[]}}"#;

  #[test]
  fn creates_and_replaces_a_local_file() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("scene.artcraft");
    write_scene_file(&path, SCENE).unwrap();
    assert_eq!(read_scene_file(&path).unwrap(), SCENE);
    let renamed = SCENE.replace("Test", "Renamed");
    write_scene_file(&path, &renamed).unwrap();
    assert_eq!(read_scene_file(&path).unwrap(), renamed);
    assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
  }

  #[test]
  fn invalid_write_preserves_existing_save() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("scene.artcraft");
    write_scene_file(&path, SCENE).unwrap();
    for invalid in ["not json", "{}", &SCENE.replace("\"formatVersion\":1", "\"formatVersion\":2")] {
      assert!(write_scene_file(&path, invalid).is_err());
      assert_eq!(read_scene_file(&path).unwrap(), SCENE);
    }
  }

  #[test]
  fn read_rejects_unrelated_files() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("scene.artcraft");
    fs::write(&path, "{}").unwrap();
    assert!(read_scene_file(&path).is_err());
  }
}
