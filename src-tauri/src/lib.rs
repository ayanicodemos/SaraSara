// Copyright (C) 2026 Aya Nicodemos (Ayasoft Studios)
// SaraSara is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License.

use tauri::menu::{Menu, Submenu, PredefinedMenuItem, AboutMetadata};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_persisted_scope::init())
    .setup(|app| {
      let handle = app.handle();
      
      let about_metadata = AboutMetadata {
        name: Some("SaraSara".to_string()),
        version: Some("1.0.0".to_string()),
        copyright: Some("Desenvolvido por Aya Nicodemos - Ayasoft Studios 2026.".to_string()),
        authors: Some(vec!["Aya Nicodemos".to_string()]),
        website: Some("https://ayasoft.com.br/sarasara".to_string()),
        comments: Some("Desenvolvido por Aya Nicodemos - Ayasoft Studios 2026.".to_string()),
        website_label: Some("ayasoft.com.br/sarasara".to_string()),
        ..Default::default()
      };

      let app_menu = Submenu::with_items(
        handle,
        "SaraSara",
        true,
        &[
          &PredefinedMenuItem::about(handle, Some("Sobre SaraSara"), Some(about_metadata))?,
          &PredefinedMenuItem::separator(handle)?,
          &PredefinedMenuItem::hide(handle, None)?,
          &PredefinedMenuItem::hide_others(handle, None)?,
          &PredefinedMenuItem::show_all(handle, None)?,
          &PredefinedMenuItem::separator(handle)?,
          &PredefinedMenuItem::quit(handle, None)?,
        ],
      )?;

      let edit_menu = Submenu::with_items(
        handle,
        "Editar",
        true,
        &[
          &PredefinedMenuItem::undo(handle, None)?,
          &PredefinedMenuItem::redo(handle, None)?,
          &PredefinedMenuItem::separator(handle)?,
          &PredefinedMenuItem::cut(handle, None)?,
          &PredefinedMenuItem::copy(handle, None)?,
          &PredefinedMenuItem::paste(handle, None)?,
          &PredefinedMenuItem::select_all(handle, None)?,
        ],
      )?;

      let window_menu = Submenu::with_items(
        handle,
        "Janela",
        true,
        &[
          &PredefinedMenuItem::minimize(handle, None)?,
          &PredefinedMenuItem::separator(handle)?,
          &PredefinedMenuItem::fullscreen(handle, None)?,
        ],
      )?;

      let menu = Menu::with_items(
        handle,
        &[
          &app_menu,
          &edit_menu,
          &window_menu,
        ],
      )?;

      app.set_menu(menu)?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
