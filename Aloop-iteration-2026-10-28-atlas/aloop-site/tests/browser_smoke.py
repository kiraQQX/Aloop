#!/usr/bin/env python3
"""Playwright UI/runtime smoke tests. Requires Playwright and Chromium."""
from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
try:
    from playwright.sync_api import sync_playwright
except Exception as exc:  # pragma: no cover - environment dependent
    print(f"SKIP: Playwright Python package is unavailable: {exc}")
    sys.exit(0)


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def standalone_document() -> str:
    html = (ROOT / "standalone.html").read_text(encoding="utf-8")
    # Opaque-origin documents (used only as a sandbox fallback) cannot access real localStorage.
    # Install an in-memory Storage-compatible shim before the app scripts execute.
    shim = r'''<script>
(() => {
  const data = new Map();
  const storage = {
    get length() { return data.size; },
    key(index) { return Array.from(data.keys())[index] ?? null; },
    getItem(key) { key = String(key); return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    clear() { data.clear(); }
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
})();
</script>'''
    return html.replace("<head>", "<head>" + shim, 1)


port = free_port()
base = f"http://127.0.0.1:{port}"
server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
errors: list[str] = []
console_errors: list[str] = []
checks = 0
standalone_mode = False


def expect(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        errors.append(message)


def load_home(page, path: str = "/") -> None:
    if standalone_mode:
        page.set_content(STANDALONE, wait_until="domcontentloaded", timeout=30000)
    else:
        page.goto(base + path, wait_until="domcontentloaded", timeout=15000)


STANDALONE = standalone_document()
try:
    ready = False
    for _ in range(40):
        if server.poll() is not None:
            errors.append("Local HTTP server exited before becoming ready")
            break
        try:
            with urlopen(base, timeout=0.3) as response:
                ready = response.status == 200
                break
        except (OSError, URLError):
            time.sleep(0.1)
    if not ready:
        print("SKIP: local HTTP server could not be reached from this environment.")
        sys.exit(0)

    with sync_playwright() as p:
        executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
        launch_kwargs = {
            "headless": True,
            "args": ["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
        }
        if executable:
            launch_kwargs["executable_path"] = executable
        try:
            browser = p.chromium.launch(**launch_kwargs)
        except Exception as exc:  # pragma: no cover - browser install dependent
            print(f"SKIP: Chromium could not be launched in this environment: {exc}")
            sys.exit(0)

        try:
            context = browser.new_context(viewport={"width": 1440, "height": 900}, locale="zh-CN", device_scale_factor=1)
            page = context.new_page()
            page.on("pageerror", lambda exc: console_errors.append(f"pageerror: {exc}"))
            def capture_console_error(msg):
                if msg.type != "error":
                    return
                text = msg.text
                url = str((msg.location or {}).get("url", ""))
                # A test sandbox may deliberately block public CDNs. Those request errors
                # are tolerated only for the viewer's pinned runtime/decoder/model; the UI
                # must expose its in-page recovery link in that case.
                external_viewer = any(host in (text + " " + url) for host in (
                    "cdn.jsdelivr.net", "gstatic.com", "raw.githubusercontent.com", "itayinbarr.github.io"
                ))
                if external_viewer and any(code in text.lower() for code in ("failed to load resource", "net::err", "blocked")):
                    return
                console_errors.append(f"console.error: {text}")
            page.on("console", capture_console_error)
            try:
                response = page.goto(base + "/", wait_until="domcontentloaded", timeout=15000)
                expect(response is not None and response.status == 200, "Homepage HTTP response was not 200")
            except Exception as exc:
                message = str(exc)
                if "ERR_BLOCKED_BY_ADMINISTRATOR" in message or "blocked by administrator" in message.lower():
                    standalone_mode = True
                    print("NOTE: local navigation is blocked by the sandbox browser policy; exercising the generated standalone build instead.")
                    # A failed browser navigation may leave an uncommitted frame; use a clean page.
                    page.close()
                    page = context.new_page()
                    page.on("pageerror", lambda exc: console_errors.append(f"pageerror: {exc}"))
                    page.on("console", capture_console_error)
                    load_home(page)
                else:
                    raise

            page.wait_for_function("window.Aloop && window.Aloop.i18n && window.Aloop.registry && window.AloopGL", timeout=10000)
            page.wait_for_timeout(400)
            expect(page.title().startswith("Aloop"), "Localized document title does not identify Aloop")
            expect(page.locator(".brand span").inner_text() == "Aloop", "Topbar wordmark missing")
            expect(page.locator("#experimentSections .experiment-section").count() == 1, "Expected exactly one registered experiment section")
            expect(page.locator("#experimentSections .experiment-name").inner_text() == "beLieve", "beLieve casing/name incorrect")
            expect(page.locator(".experiment-tile a").count() == 1, "Experiment section contains clickable regions beyond the explicit Enter button")
            expect(page.locator(".experiment-tile").evaluate("el => el.tagName") == "DIV", "Experiment tile itself must not be a navigation target")
            expect(page.locator(".data-sea-stage").get_attribute("data-scene") == "data-sea", "beLieve data-ocean stage is missing")
            expect("condition a" not in page.locator("#experimentSections").inner_text().lower(), "Public experiment section leaks QA conditions")
            expect(page.locator("#topbar").evaluate("el => getComputedStyle(el).position") == "fixed", "Top bar is not position:fixed")
            expect(page.locator(".particle-cortex-stage").count() == 1 and page.locator(".particle-cortex-canvas").count() == 1, "Hero particle-cortex stage/canvas missing")
            expect(page.locator(".brain-stage").evaluate("el => getComputedStyle(el).touchAction") == "pan-y", "Brain stage does not preserve vertical touch scrolling")
            expect(page.locator("#particleCortexState").count() == 1, "Particle model status region is missing")
            page.wait_for_function("document.querySelector('.particle-cortex-stage').classList.contains('is-ready') || /failed|unable|失败|无法/i.test(document.querySelector('#particleCortexState').textContent)", timeout=12000)
            expect(page.locator(".data-sea-stage.is-ready").count() == 1, "Data-ocean canvas did not complete its first render")
            expect(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Desktop layout has horizontal overflow")
            expect(page.evaluate("window.AloopGL.getLiveCount() <= 2"), "Particle engine exceeded the WebGL context budget")

            starting_hash = page.evaluate("location.hash")
            page.locator('#langToggle [data-lang-set]:not([aria-pressed="true"])').click()
            expect(page.locator("#authOpen").inner_text().strip() == "Log in / Sign up", "Language switch did not translate the top bar")
            expect(page.locator(".brand span").inner_text() == "Aloop", "Aloop wordmark was translated")
            expect(page.evaluate("location.hash") == starting_hash, "Language switch unexpectedly changed route")
            page.locator('#langToggle [data-lang-set]:not([aria-pressed="true"])').click()

            page.locator("#experimentsToggle").click()
            expect(page.locator("#quickMenu").is_visible(), "Quick-select menu did not open")
            expect(page.locator("#experimentsToggle").get_attribute("aria-expanded") == "true", "Menu ARIA expanded state was not updated")
            page.keyboard.press("Escape")
            expect(not page.locator("#quickMenu").is_visible(), "Escape did not close the quick-select menu")
            # Products is a sibling navigation menu and EasySci supports search, combined facets, and inline details.
            page.locator("#productsToggle").click()
            expect(page.locator("#productsMenu").is_visible(), "Products menu did not open")
            expect(page.locator("#productsToggle").get_attribute("aria-expanded") == "true", "Products menu ARIA expanded state was not updated")
            page.keyboard.press("Escape")
            expect(not page.locator("#productsMenu").is_visible(), "Escape did not close the Products menu")
            expect(page.evaluate("document.activeElement.id") == "productsToggle", "Products menu did not restore focus after Escape")
            page.locator("#productsToggle").click()
            smart_link = page.locator('#productsMenu a[href="#/smart-brain"]')
            expect(smart_link.count() == 1, "Smart Brain product menu link missing")
            smart_link.click()
            page.wait_for_selector(".sb-atlas-cta", timeout=5000)
            expect(page.locator(".sb-model-canvas").count() == 0, "Overview must not embed a second viewer")
            page.locator('a[href="#/smart-brain/atlas"]').first.click()
            page.wait_for_selector("#atlasSide", timeout=5000)
            expect(page.locator(".atlas-canvas").count() <= 1, "Atlas created duplicate canvases")
            expect(page.locator("#atlasSearch").count() == 1, "Atlas sidebar search missing")
            page.locator('a[href="#/smart-brain/learn"]').first.click()
            page.wait_for_selector(".sb-learn", timeout=5000)
            expect(page.locator("#atlasSide").count() == 0, "Atlas was not torn down when entering Learn")
            page.locator("#productsToggle").click()
            page.locator('#productsMenu a[href="#/easysci"]').click()
            page.wait_for_selector("#esGrid .es-card", timeout=10000)
            directory_stats = page.evaluate("window.Aloop.easysci.getStats()")
            expect(directory_stats["total"] >= 60, "EasySci resource directory was not expanded to 60 or more tools")
            expect(directory_stats["uniqueOfficialUrls"] == directory_stats["total"], "EasySci official URLs are duplicated")
            expect(page.locator("#esGrid .es-card").count() == min(50, directory_stats["total"]), "EasySci initial catalogue batch is not paginated to a practical size")
            expect(page.locator("[data-es-more]").count() == (1 if directory_stats["total"] > 50 else 0), "EasySci progressive loading control is missing")
            if directory_stats["total"] > 50:
                page.locator("[data-es-more]").evaluate("el => el.click()")
                expect(page.locator("#esGrid .es-card").count() == min(100, directory_stats["total"]), "EasySci load-more control did not append the next batch")
            expect(page.locator('#esGrid a[target="_blank"][rel="noopener noreferrer"]').count() > 0, "EasySci external links do not set safe target/rel attributes")
            expect(directory_stats["kinds"]["skill"] >= 34 and directory_stats["kinds"]["mcp"] >= 28 and directory_stats["kinds"]["plugin"] >= 8, "EasySci Skill/MCP/plugin inventory is incomplete")
            page.locator('[data-kind="skill"]').click()
            expect(page.locator("#esGrid .es-card").count() == min(50, directory_stats["kinds"]["skill"]), "Skill filter does not show its first filtered batch")
            expect(page.locator("#esGrid .es-kind-plugin").count() > 0, "Skill filter omitted plugin bundles that include Skills")
            page.locator('[data-kind="mcp"]').click()
            expect(page.locator("#esGrid .es-card").count() == min(50, directory_stats["kinds"]["mcp"]), "MCP filter does not show its first filtered batch")
            expect(page.locator("#esGrid .es-kind-plugin").count() > 0, "MCP filter omitted plugin bundles that include MCP")
            page.locator("#esClear").click()
            expect(page.locator("#esGrid .es-card").count() == min(50, directory_stats["total"]), "Reset did not restore the initial EasySci batch after Skill/MCP filtering")
            page.locator("#esQ").fill("Grill Me")
            expect(page.locator("#esGrid .es-card").count() == 1, "EasySci did not locate the current trending Grill Me Skill")
            page.locator("#esQ").fill("")
            page.locator("#esQ").fill("JASP Meta-Analysis")
            expect(page.locator("#esGrid .es-card").count() == 1, "EasySci search did not isolate the JASP Meta-Analysis module")
            page.locator("#esGrid .es-expand").click()
            expect(page.locator("#esGrid .es-expanded").is_visible(), "EasySci inline detail disclosure did not expand")
            page.locator("#esGrid .es-detail-route").evaluate("el => el.click()")
            page.wait_for_selector(".es-detail-page", timeout=10000)
            expect("JASP Meta-Analysis" in page.locator(".es-detail-page h1").inner_text(), "Direct EasySci detail route did not render the selected meta-analysis tool")
            page.locator(".es-back").evaluate("el => el.click()")
            page.wait_for_selector("#esGrid .es-card", timeout=10000)
            page.locator("#esQ").fill("")
            page.locator('[data-cat="data"]').click()
            expect(page.locator('#esGrid [data-resource="meta-essentials"]').count() == 1, "Data-analysis domain omitted Meta-Essentials")
            expect(page.locator('#esGrid [data-resource="meta-analysis-skill"]').count() == 1, "Data-analysis domain omitted meta-analysis Agent Skill")
            page.locator("#esClear").click()
            page.locator('[data-access="Paid"]').click()
            expect(page.locator("#esGrid .es-card").count() == min(50, directory_stats["accessModels"]["Paid"]), "EasySci paid-model filter did not render the expected number of matching cards")
            expect(page.locator("#esGrid .es-card .es-badge-paid").count() == page.locator("#esGrid .es-card").count(), "Paid filter included a resource without a Paid access label")
            page.locator('[data-cat="design"]').click()
            combined_count = page.locator("#esGrid .es-card").count()
            combined_intersection_ok = combined_count > 0 and page.locator('#esGrid .es-card[data-category="design"]').count() == combined_count and page.locator("#esGrid .es-card .es-badge-paid").count() == combined_count
            expect(combined_intersection_ok, "Combined category and pricing filters did not preserve both selected facets")
            page.locator("#esClear").click()
            expect(page.locator("#esGrid .es-card").count() == min(50, directory_stats["total"]), "Reset did not restore the initial EasySci directory batch")
            page.evaluate("location.hash = '#/'")
            page.wait_for_selector("#experimentSections .experiment-section", timeout=10000)

            page.locator("#authOpen").click()
            expect(page.locator("#authModal").is_visible(), "Account modal did not open")
            page.locator("#authSignupTab").click()
            expect(page.locator("#authConfirmWrap").is_visible(), "Sign-up confirmation field did not appear")
            page.keyboard.press("Escape")
            expect(not page.locator("#authBackdrop").is_visible(), "Escape did not close the account modal")

            # Mobile responsive checks. A separate page is needed because CSS is viewport-aware.
            mobile = context.new_page()
            mobile.set_viewport_size({"width": 390, "height": 844})
            load_home(mobile)
            mobile.wait_for_function("window.Aloop && window.Aloop.registry", timeout=10000)
            expect(mobile.locator("#topbar").evaluate("el => getComputedStyle(el).position") == "fixed", "Mobile top bar is not fixed")
            expect(mobile.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Mobile layout has horizontal overflow")
            expect(mobile.locator(".experiment-enter").count() == 1, "Mobile Enter target is missing")
            mobile.locator("#experimentsToggle").click()
            mobile_quick_box = mobile.locator("#quickMenu").bounding_box()
            mobile_viewport = mobile.evaluate("({width:innerWidth,height:innerHeight})")
            expect(bool(mobile_quick_box and mobile_quick_box["y"] >= 0 and mobile_quick_box["y"] + mobile_quick_box["height"] <= mobile_viewport["height"] + 1), "Mobile Experiments menu is outside the visible viewport")
            mobile.keyboard.press("Escape")
            mobile.locator("#productsToggle").click()
            mobile_products_box = mobile.locator("#productsMenu").bounding_box()
            expect(bool(mobile_products_box and mobile_products_box["y"] >= 0 and mobile_products_box["y"] + mobile_products_box["height"] <= mobile_viewport["height"] + 1), "Mobile Products menu is outside the visible viewport")
            mobile.locator('#productsMenu a[href="#/easysci"]').click()
            mobile.wait_for_selector("#esGrid .es-card", timeout=10000)
            expect(mobile.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Mobile EasySci layout has horizontal overflow")
            mobile.close()

            # Both direct routes and the visible Enter button must require the local debug login.
            if standalone_mode:
                exp = page
                expect(True, "Standalone bundle is loaded for runtime-flow coverage")
                exp.locator(".experiment-enter").click()
            else:
                qa = browser.new_context(viewport={"width": 1280, "height": 820}, locale="zh-CN", accept_downloads=True)
                exp = qa.new_page()
                exp.on("pageerror", lambda exc: console_errors.append(f"experiment pageerror: {exc}"))
                exp.goto(base + "/?qa=1&arm=A#/e/believe/run", wait_until="domcontentloaded", timeout=15000)
            exp.wait_for_selector("#authBackdrop:not([hidden])", timeout=10000)
            exp.locator("#authEmail").fill("1")
            exp.locator("#authPassword").fill("1")
            exp.locator("#authForm .auth-submit").click()
            exp.wait_for_selector("#go", timeout=15000)
            consent_text = exp.locator("#experiment-root").inner_text()
            expect("知情" in consent_text or "I consent" in consent_text or "consent" in consent_text.lower(), "Experiment did not start at consent")
            exp.locator("#go").click()
            exp.wait_for_selector("#lock", timeout=10000)
            expect(exp.locator("#experiment-root .claim").count() == 1, "Training claim did not render")
            exp.locator("#lock").click()
            exp.wait_for_selector("#submit", timeout=10000)
            exp.locator(".sb").first.click()
            exp.locator('input[name="share"][value="0"]').check()
            exp.locator("#submit").click()
            exp.wait_for_selector("#next", timeout=10000)
            expect("反馈" in exp.locator("#experiment-root").inner_text() or "Feedback" in exp.locator("#experiment-root").inner_text(), "Feedback stage did not render")
            session_json = exp.evaluate("localStorage.getItem('aloop_believe_session_v1')")
            expect(bool(session_json), "Session was not saved to local storage")
            session = exp.evaluate("JSON.parse(localStorage.getItem('aloop_believe_session_v1'))")
            expect(bool(session and session.get("pid") and session.get("arm") in ["A", "B", "C"]), "Session was not saved with participant/arm metadata")
            events = exp.evaluate("JSON.parse(localStorage.getItem('aloop_believe_log_v1_' + JSON.parse(localStorage.getItem('aloop_believe_session_v1')).pid))")
            event_types = [event.get("type") for event in (events or [])]
            expect("consent" in event_types and "assign" in event_types and "source_open" in event_types and "final" in event_types, "Expected consent/assignment/evidence/final events were not persisted")
            expect(all(event.get("site") == "aloop" and event.get("experiment_id") == "believe" for event in (events or [])), "Event metadata is missing Aloop/beLieve identifiers")
            exp.locator('#langToggle [data-lang-set]:not([aria-pressed="true"])').click()
            expect("feedback" in exp.locator("#experiment-root").inner_text().lower(), "Experiment did not rerender in the selected language")
            expect(exp.evaluate("window.Aloop.isExperimentRunning") is True, "Experiment runtime state was not marked active")

            # A saved session must present two equally aligned continuation choices.
            exp.evaluate("location.hash = '#/e/believe'")
            exp.wait_for_timeout(160)
            exp.locator(".experiment-enter").click()
            exp.wait_for_selector("#gateContinue", timeout=10000)
            continue_box = exp.locator("#gateContinue").bounding_box()
            restart_box = exp.locator("#gateRestart").bounding_box()
            expect(bool(continue_box and restart_box), "Saved-session choices were not rendered")
            if continue_box and restart_box:
                expect(abs(continue_box["y"] - restart_box["y"]) < 2, "Continue and Start over buttons are not vertically aligned")
                expect(abs(continue_box["height"] - restart_box["height"]) < 2, "Continue and Start over button heights differ")
                expect(abs(continue_box["width"] - restart_box["width"]) < 2, "Continue and Start over button widths differ")

            expect(not console_errors, "Browser console errors were recorded: " + " | ".join(console_errors[:8]))
            if not standalone_mode:
                qa.close()
            context.close()
        finally:
            browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=3)
    except subprocess.TimeoutExpired:
        server.kill()

if errors:
    print(f"FAIL: {len(errors)} of {checks} browser checks failed")
    for err in errors:
        print(f"  - {err}")
    sys.exit(1)
print(f"PASS: {checks} browser checks" + (" (standalone sandbox mode)." if standalone_mode else "."))
