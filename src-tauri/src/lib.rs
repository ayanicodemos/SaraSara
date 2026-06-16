// Copyright (C) 2026 Aya Nicodemos (Ayasoft Studios)
// SaraSara is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License.

use tauri::menu::{Menu, Submenu, PredefinedMenuItem, AboutMetadata};
use tauri::{Emitter, Manager};
use std::sync::Mutex;

#[derive(Default)]
struct PendingFilesState(Mutex<Vec<String>>);

fn create_menu(handle: &tauri::AppHandle, lang: &str) -> tauri::Result<Menu<tauri::Wry>> {
  let about_label = match lang {
    "en" => "About SaraSara",
    "ja" => "SaraSara について",
    "de" => "Über SaraSara",
    "zh-CN" => "关于 SaraSara",
    "es" => "Acerca de SaraSara",
    "fr" => "À propos de SaraSara",
    "ko" => "SaraSara 정보",
    "it" => "Informazioni su SaraSara",
    "ru" => "О программе SaraSara",
    _ => "Sobre SaraSara",
  };
  
  let copyright = match lang {
    "en" => "Developed by Aya Nicodemos - Ayasoft Studios 2026.",
    "ja" => "Aya Nicodemos - Ayasoft Studios 2026. によって开发されました。",
    "de" => "Entwickelt von Aya Nicodemos - Ayasoft Studios 2026.",
    "zh-CN" => "由 Aya Nicodemos - Ayasoft Studios 2026 开发。",
    "es" => "Desarrollado por Aya Nicodemos - Ayasoft Studios 2026.",
    "fr" => "Développé par Aya Nicodemos - Ayasoft Studios 2026.",
    "ko" => "Aya Nicodemos - Ayasoft Studios 2026 제작.",
    "it" => "Sviluppato da Aya Nicodemos - Ayasoft Studios 2026.",
    "ru" => "Разработано Aya Nicodemos - Ayasoft Studios 2026.",
    _ => "Desenvolvido por Aya Nicodemos - Ayasoft Studios 2026.",
  };

  let edit_label = match lang {
    "en" => "Edit",
    "ja" => "編集",
    "de" => "Bearbeiten",
    "zh-CN" => "编辑",
    "es" => "Editar",
    "fr" => "Éditer",
    "ko" => "편집",
    "it" => "Modifica",
    "ru" => "Правка",
    _ => "Editar",
  };

  let window_label = match lang {
    "en" => "Window",
    "ja" => "ウィンドウ",
    "de" => "Fenster",
    "zh-CN" => "窗口",
    "es" => "Ventana",
    "fr" => "Fenêtre",
    "ko" => "윈도우",
    "it" => "Finestra",
    "ru" => "Окно",
    _ => "Janela",
  };

  let about_metadata = AboutMetadata {
    name: Some("SaraSara".to_string()),
    version: Some("1.2.0".to_string()),
    copyright: Some(copyright.to_string()),
    authors: Some(vec!["Aya Nicodemos".to_string()]),
    website: Some("https://ayasoft.com.br/sarasara".to_string()),
    comments: Some(copyright.to_string()),
    website_label: Some("ayasoft.com.br/sarasara".to_string()),
    ..Default::default()
  };

  let app_menu = Submenu::with_items(
    handle,
    "SaraSara",
    true,
    &[
      &PredefinedMenuItem::about(handle, Some(about_label), Some(about_metadata))?,
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
    edit_label,
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
    window_label,
    true,
    &[
      &PredefinedMenuItem::minimize(handle, None)?,
      &PredefinedMenuItem::separator(handle)?,
      &PredefinedMenuItem::fullscreen(handle, None)?,
    ],
  )?;

  Menu::with_items(
    handle,
    &[
      &app_menu,
      &edit_menu,
      &window_menu,
    ],
  )
}

#[tauri::command]
fn update_native_menu(app: tauri::AppHandle, lang: String) -> Result<(), String> {
  let menu = create_menu(&app, &lang).map_err(|e| e.to_string())?;
  app.set_menu(menu).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
fn open_in_browser(url: String) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    std::process::Command::new("open")
      .arg(&url)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(target_os = "windows")]
  {
    std::process::Command::new("cmd")
      .args(["/C", "start", &url])
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(not(any(target_os = "macos", target_os = "windows")))]
  {
    std::process::Command::new("xdg-open")
      .arg(&url)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
fn get_pending_files(state: tauri::State<'_, PendingFilesState>) -> Result<Vec<String>, String> {
  let mut lock = state.0.lock().map_err(|e| e.to_string())?;
  let files = std::mem::take(&mut *lock);
  Ok(files)
}

#[tauri::command]
fn get_file_modified_time(path: String) -> Result<u64, String> {
  let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
  let modified = metadata.modified().map_err(|e| e.to_string())?;
  let duration = modified
    .duration_since(std::time::SystemTime::UNIX_EPOCH)
    .map_err(|e| e.to_string())?;
  Ok(duration.as_millis() as u64)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_persisted_scope::init())
    .invoke_handler(tauri::generate_handler![
      update_native_menu,
      open_in_browser,
      get_pending_files,
      get_file_modified_time
    ])
    .setup(|app| {
      app.manage(PendingFilesState::default());

      let handle = app.handle();
      let menu = create_menu(handle, "pt-BR")?;
      app.set_menu(menu)?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    });

  let app = builder
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    if let tauri::RunEvent::Opened { urls } = event {
      let mut paths = Vec::new();
      for url in urls {
        if url.scheme() == "file" {
          if let Ok(path) = url.to_file_path() {
            if let Some(path_str) = path.to_str() {
              paths.push(path_str.to_string());
            }
          }
        }
      }
      if !paths.is_empty() {
        // Try to emit directly to frontend (if frontend is already running and listening)
        let _ = app_handle.emit("open-files", &paths);
        // Also save to pending files state for startup querying
        if let Some(state) = app_handle.try_state::<PendingFilesState>() {
          if let Ok(mut lock) = state.0.lock() {
            lock.extend(paths);
          }
        }
      }
    }
  });
}
