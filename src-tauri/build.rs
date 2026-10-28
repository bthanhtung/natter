fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "set_unread",
            "notify",
            "get_theme",
            "open_preferences",
            "open_external",
            "get_preferences",
            "set_preferences",
        ]),
    ))
    .expect("Tauri build configuration must be valid");
}
