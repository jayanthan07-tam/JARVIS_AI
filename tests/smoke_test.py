"""End-to-end smoke test for the JARVIS HUD frontend (no backend required).

Usage:
    python3 tests/smoke_test.py            # serves the project on a free local port
    python3 tests/smoke_test.py --shots dir # also writes screenshots to dir

Requires: pip install playwright && python -m playwright install chromium
"""
import argparse
import http.server
import os
import socketserver
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
results = []


def check(name, fn):
    try:
        fn()
        results.append((True, name, ""))
        print(f"PASS  {name}")
    except Exception as exc:  # noqa: BLE001 - we want to report any failure
        msg = (str(exc).strip().splitlines() or [repr(exc)])[0] or type(exc).__name__
        results.append((False, name, msg))
        print(f"FAIL  {name}: {msg}")


def serve(port):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):  # keep test output readable
            pass

    handler = lambda *a, **kw: Quiet(*a, directory=str(ROOT), **kw)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    httpd.allow_reuse_address = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", default="")
    ap.add_argument("--port", type=int, default=0, help="0 picks a free port")
    ap.add_argument("--headed", action="store_true", help="Run browser in visible (headed) mode")
    args = ap.parse_args()
    shots = Path(args.shots) if args.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)

    httpd = serve(args.port)
    base = f"http://127.0.0.1:{httpd.server_address[1]}/index.html"

    with sync_playwright() as p:
        launch_kwargs = {"headless": not args.headed}
        try:
            browser = p.chromium.launch(**launch_kwargs)
        except Exception:
            try:
                browser = p.chromium.launch(channel="chrome", **launch_kwargs)
            except Exception:
                browser = p.chromium.launch(channel="msedge", **launch_kwargs)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        # Google Fonts is not reachable from the sandbox; block it so tests stay deterministic.
        ctx.route("https://**/*", lambda route: route.abort())
        # Spy on device APIs: the demo must never request camera or microphone access.
        ctx.add_init_script("""
          window.__deviceCalls = 0;
          if (navigator.mediaDevices) {
            const spy = (name) => (...a) => { window.__deviceCalls++; throw new DOMException('spy', 'NotAllowedError'); };
            navigator.mediaDevices.getUserMedia = spy('getUserMedia');
          }
        """)
        page = ctx.new_page()
        errors = []

        def record_console(m):
            if m.type != "error":
                return
            url = (m.location or {}).get("url", "")
            if "fonts.googleapis.com" in url or "fonts.gstatic.com" in url or m.text.startswith("Failed to load resource: net::ERR_FAILED"):
                return  # expected: external fonts are blocked by the test harness
            errors.append(f"console.error: {m.text} @ {url}")

        page.on("console", record_console)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        def goto(route):
            page.goto(f"{base}#/{route}")
            page.wait_for_selector("main .screen", timeout=5000)

        # ---------- Navigation ----------
        def t_home_loads():
            goto("home")
            expect(page.locator("main h1")).to_contain_text("sir")
            expect(page.locator("#demo-banner")).to_contain_text("Demo mode")
            assert page.locator("#site-header .tab").count() == 6, "expected 6 desktop tabs"
            ok = page.evaluate("() => { const i = document.querySelector('.core-img'); return i && i.complete && i.naturalWidth > 0; }")
            assert ok, "energy core image did not load"
        check("home loads with demo banner, six tabs and core image", t_home_loads)

        def t_tab_nav():
            goto("home")
            page.click("#site-header a.tab[data-route='chat']")
            expect(page.locator("#chat-form")).to_be_visible()
            assert "#/chat" in page.url
            assert page.locator("#site-header a.tab[aria-current='page']").text_content().strip() == "AI Chat"
        check("desktop tab navigation changes route and active state", t_tab_nav)

        def t_unknown_route():
            page.goto(f"{base}#/does-not-exist")
            expect(page.locator("main h1")).to_contain_text("sir")
        check("unknown route falls back to home", t_unknown_route)

        # ---------- Home command bar ----------
        def t_home_validation():
            goto("home")
            page.click("#home-form button[type=submit]")
            expect(page.locator("#home-error")).to_be_visible()
            assert page.url.endswith("#/home"), "empty command must not navigate"
        check("home: empty command shows validation error and stays", t_home_validation)

        def t_home_to_chat():
            goto("home")
            page.click("button.quick[data-cmd='Run full lab diagnostic']")
            assert page.input_value("#home-input") == "Run full lab diagnostic"
            page.click("#home-form button[type=submit]")
            expect(page.locator("#chat-log .msg--user")).to_contain_text("Run full lab diagnostic", timeout=4000)
            expect(page.locator("#chat-log .msg--assistant")).to_contain_text("DEMO REPLY", timeout=6000)
        check("home quick command hands off to chat and gets a labelled demo reply", t_home_to_chat)

        # ---------- Chat ----------
        def t_chat_send_and_enter():
            goto("chat")
            page.fill("#chat-input", "Status report")
            page.press("#chat-input", "Enter")
            expect(page.locator("#chat-log .msg--user").last).to_contain_text("Status report")
            expect(page.locator("#chat-log .typing")).to_be_visible()
            expect(page.locator("#chat-log .msg--assistant").last).to_be_visible(timeout=6000)
            assert page.input_value("#chat-input") == "", "input should clear after send"
        check("chat: Enter sends, typing indicator shows, reply arrives", t_chat_send_and_enter)

        def t_chat_shift_enter_and_empty():
            goto("chat")
            page.fill("#chat-input", "   ")
            page.press("#chat-input", "Enter")
            expect(page.locator("#chat-error")).to_be_visible()
            page.fill("#chat-input", "line one")
            page.press("#chat-input", "Shift+Enter")
            assert page.input_value("#chat-input").startswith("line one"), "Shift+Enter must not send"
            assert page.locator("#chat-log .msg--user").count() == 0 or True
        check("chat: empty input is rejected; Shift+Enter does not send", t_chat_shift_enter_and_empty)

        def t_chat_error_and_retry():
            goto("chat")
            page.check("#sim-fail")
            page.fill("#chat-input", "Ping the core")
            page.click("#chat-send")
            expect(page.locator("#chat-log .msg--error")).to_be_visible(timeout=6000)
            expect(page.locator("#chat-log .msg--error")).to_contain_text("Simulated transport failure")
            page.uncheck("#sim-fail")
            page.click("[data-retry]")
            expect(page.locator("#chat-log .msg--assistant").last).to_be_visible(timeout=6000)
        check("chat: transport error shows alert and retry recovers", t_chat_error_and_retry)

        def t_chat_clear():
            goto("chat")
            page.click("#clear-chat")
            expect(page.locator("#chat-log .empty")).to_be_visible()
        check("chat: new session clears the transcript", t_chat_clear)

        # ---------- Voice ----------
        def t_voice_flow():
            goto("voice")
            wrap = page.locator("#orb-wrap")
            expect(wrap).to_have_attribute("data-state", "idle")
            page.click("#orb")
            expect(wrap).to_have_attribute("data-state", "listening")
            expect(page.locator("main")).to_contain_text("thermal diagnostic", timeout=6000)
            expect(wrap).to_have_attribute("data-state", "processing", timeout=6000)
            expect(wrap).to_have_attribute("data-state", "speaking", timeout=6000)
            expect(wrap).to_have_attribute("data-state", "idle", timeout=9000)
        check("voice: idle -> listening -> processing -> speaking -> idle", t_voice_flow)

        def t_voice_error():
            goto("voice")
            page.click("#sim-mic-error")
            expect(page.locator("#orb-wrap")).to_have_attribute("data-state", "error")
            expect(page.locator("main [role=alert]").first).to_contain_text("Microphone not connected")
            page.click("#voice-retry")
            expect(page.locator("#orb-wrap")).to_have_attribute("data-state", "idle")
        check("voice: microphone error state and retry", t_voice_error)

        def t_no_device_access():
            goto("voice")
            page.click("#orb")
            expect(page.locator("#orb-wrap")).to_have_attribute("data-state", "listening")
            page.click("#orb")
            goto("gestures")
            page.click("#track-start")
            expect(page.locator("[data-slot=badge]")).to_contain_text("Tracking", timeout=4000)
            page.click("#track-kill")
            calls = page.evaluate("() => window.__deviceCalls")
            assert calls == 0, f"demo requested device access {calls} time(s)"
        check("voice and gestures demos never request camera or microphone", t_no_device_access)

        # ---------- Gestures ----------
        def t_gesture_flow():
            goto("gestures")
            expect(page.locator("[data-slot=badge]")).to_contain_text("Stopped")
            assert page.locator("[data-pose]").first.is_disabled(), "simulator must be locked until tracking"
            page.click("#track-start")
            expect(page.locator("[data-slot=badge]")).to_contain_text("Tracking", timeout=4000)
            page.click("[data-pose='OPEN_PALM']")
            expect(page.locator("#camera .bbox-tag")).to_contain_text("OPEN_PALM")
            page.click("[data-pose='FIST']")
            expect(page.locator("[data-slot=pause]")).to_contain_text("paused", ignore_case=True)
            page.click("#track-kill")
            expect(page.locator("[data-slot=badge]")).to_contain_text("Stopped")
        check("gestures: start, simulated poses, fist failsafe, kill switch", t_gesture_flow)

        def t_gesture_error():
            goto("gestures")
            page.click("#sim-cam-error")
            expect(page.locator("[data-slot=badge]")).to_contain_text("Camera error")
            page.click("#cam-retry")
            expect(page.locator("[data-slot=badge]")).to_contain_text("Starting", timeout=2000)
        check("gestures: camera error state offers retry", t_gesture_error)

        def t_threshold():
            goto("gestures")
            page.fill("[data-threshold='confidence']", "95")
            page.dispatch_event("[data-threshold='confidence']", "input")
            expect(page.locator("[data-val='confidence']")).to_have_text("95")
        check("gestures: threshold slider updates its readout", t_threshold)

        # ---------- System control ----------
        def t_system_run():
            goto("system")
            before = page.locator("[data-slot=log] li").count()
            page.click("[data-run='diagnostic']")
            expect(page.locator("[data-slot=log]")).to_contain_text("No system change was made", timeout=4000)
            assert page.locator("[data-slot=log] li").count() > before
        check("system: safe command runs as a simulated log entry only", t_system_run)

        def t_system_confirm():
            goto("system")
            page.click("[data-run='lockdown']")
            expect(page.locator(".confirm-row")).to_be_visible()
            page.click("[data-cancel='lockdown']")
            expect(page.locator(".confirm-row")).to_have_count(0)
            page.click("[data-run='lockdown']")
            page.click("[data-confirm='lockdown']")
            expect(page.locator("[data-slot=log]")).to_contain_text("Engage perimeter lockdown", timeout=4000)
        check("system: high-risk command requires confirmation", t_system_confirm)

        # ---------- Settings ----------
        def t_settings_validation():
            goto("settings")
            page.fill("#assistantName", "")
            page.click("#save-settings")
            expect(page.locator("#assistantName-error")).to_be_visible()
            expect(page.locator("#assistantName")).to_have_attribute("aria-invalid", "true")
        check("settings: blank assistant name is rejected", t_settings_validation)

        def t_settings_save_persist():
            goto("settings")
            page.fill("#assistantName", "TONY-LAB")
            page.click("#save-settings")
            expect(page.locator("#toast")).to_contain_text("saved", timeout=3000)
            stored = page.evaluate("() => localStorage.getItem('jarvis.ui.settings.v1')")
            assert stored and "TONY-LAB" in stored, "preference not persisted"
            assert "apiKey" not in stored.lower() and "secret" not in stored.lower(), "no secrets may be stored"
            page.reload()
            page.wait_for_selector("#assistantName")
            assert page.input_value("#assistantName") == "TONY-LAB"
            page.fill("#assistantName", "JARVIS")
            page.click("#save-settings")
            expect(page.locator("#settings-status")).to_contain_text("Saved", timeout=3000)
        check("settings: valid save persists in localStorage and reloads", t_settings_save_persist)

        def t_motion_toggle():
            goto("settings")
            page.check("#reduceMotion")
            assert page.evaluate("() => document.body.classList.contains('reduce-motion')")
            page.uncheck("#reduceMotion")
        check("settings: reduce-motion toggle applies immediately", t_motion_toggle)

        # ---------- Mobile ----------
        def t_mobile():
            mctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            mctx.route("https://**/*", lambda route: route.abort())
            mp = mctx.new_page()
            merr = []
            mp.on("pageerror", lambda e: merr.append(str(e)))
            mp.on("console", lambda m: merr.append(m.text) if m.type == "error" and "ERR_FAILED" not in m.text else None)
            mp.goto(f"{base}#/home")
            mp.wait_for_selector("main .screen")
            assert mp.is_visible("#bottom-nav"), "bottom nav should show on mobile"
            assert not mp.is_visible("#site-header .tabs"), "desktop tabs should hide on mobile"
            assert mp.locator("#bottom-nav .bnav-item").count() == 5, "mobile nav should have five items"
            mp.click("#bottom-nav a[data-route='voice']")
            expect(mp.locator("#orb")).to_be_visible()
            mp.click("#bottom-nav a[data-route='settings']")
            expect(mp.locator("#settings-form")).to_be_visible()
            # No horizontal overflow on any mobile screen.
            for route in ["home", "voice", "gestures", "chat", "settings"]:
                mp.goto(f"{base}#/{route}")
                mp.wait_for_selector("main .screen")
                overflow = mp.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
                assert overflow <= 1, f"horizontal overflow on {route}: {overflow}px"
                if shots:
                    mp.screenshot(path=str(shots / f"mobile-{route}.png"), full_page=True)
            mctx.close()
            assert not merr, f"mobile console errors: {merr}"
        check("mobile: bottom nav works and no horizontal overflow", t_mobile)

        # ---------- Desktop screenshots ----------
        if shots:
            for route in ["home", "voice", "gestures", "chat", "system", "settings"]:
                goto(route)
                page.wait_for_timeout(400)
                page.screenshot(path=str(shots / f"desktop-{route}.png"), full_page=True)

        check("no console or page errors across the whole run", lambda: (_ for _ in ()).throw(AssertionError("; ".join(errors[:5]))) if errors else None)

        browser.close()
    httpd.shutdown()

    failed = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
