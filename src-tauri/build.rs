fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["set_unread", "notify", "window_control"]),
    ))
    .expect("Tauri build configuration must be valid");
}
