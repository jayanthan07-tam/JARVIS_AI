#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    webview::Url,
    Manager,
};

#[cfg(desktop)]
struct SetupPageUrl(Url);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.setup(|app| {
            let setup_url = app
                .get_webview_window("main")
                .expect("main J.A.R.V.I.S. window is missing")
                .url()?;
            app.manage(SetupPageUrl(setup_url));

            let change_server = MenuItem::with_id(
                app,
                "change_server",
                "Change server address…",
                true,
                Some("CmdOrCtrl+Shift+S"),
            )?;
            let quit = MenuItem::with_id(
                app,
                "quit",
                "Quit J.A.R.V.I.S. AI",
                true,
                Some("CmdOrCtrl+Q"),
            )?;
            let menu = Menu::with_items(app, &[&change_server, &quit])?;
            app.set_menu(menu)?;

            app.on_menu_event(|app, event| match event.id().as_ref() {
                "change_server" => {
                    let mut setup_url = app.state::<SetupPageUrl>().0.clone();
                    setup_url.set_query(Some("setup=1"));
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.navigate(setup_url);
                    }
                }
                "quit" => app.exit(0),
                _ => {}
            });

            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running J.A.R.V.I.S. AI Desktop");
}
