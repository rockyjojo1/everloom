import XCTest

/// Gate 5B: proves the committed Capacitor app actually installs, launches,
/// and remains functional inside a booted iOS Simulator -- and that the
/// existing local (IndexedDB) save survives backgrounding and a genuine
/// native process termination/relaunch.
///
/// This exercises the real, unmodified apps/game production web bundle
/// inside the real Capacitor WKWebView via real accessibility-tree queries
/// and real touch/system events. It does not mock Capacitor, does not use
/// Playwright, does not inject a save, does not call store functions
/// directly, and does not use a remote server or a hidden test route.
///
/// A single ordered journey (not several order-dependent test methods) is
/// used deliberately: phases B/C/D all depend on the fresh-install state
/// phase A establishes, and Xcode does not guarantee method run order.
final class AppUITests: XCTestCase {
    private let app = XCUIApplication()
    private let shortTimeout: TimeInterval = 15
    private let launchTimeout: TimeInterval = 30

    override func setUpWithError() throws {
        continueAfterFailure = false
        // Landscape before launch: the product has no portrait gameplay
        // (Info.plist declares landscape-only orientations for this exact
        // reason -- see Gate 5A).
        XCUIDevice.shared.orientation = .landscapeLeft
    }

    override func tearDownWithError() throws {
        if app.state != .notRunning {
            app.terminate()
        }
    }

    // MARK: - Helpers

    /// WKWebView's accessibility bridge does not always classify a given
    /// DOM element as the XCUIElementType a native developer would expect
    /// (a <button> can surface as .button or as a generic element carrying
    /// the button trait, depending on WebKit/iOS version). Searching by
    /// label across `.any` is the documented-safe way to query WKWebView
    /// content reliably, without weakening *which* label must exist.
    private func element(labeled text: String, in root: XCUIElement? = nil) -> XCUIElement {
        let scope = root ?? app
        return scope.descendants(matching: .any).matching(NSPredicate(format: "label == %@", text)).firstMatch
    }

    private func attach(_ name: String) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func waitAndAssert(_ el: XCUIElement, _ message: String, timeout: TimeInterval? = nil) {
        XCTAssertTrue(el.waitForExistence(timeout: timeout ?? shortTimeout), message)
    }

    /// WKWebView-hosted elements frequently report `isHittable == false`
    /// even when they are visually rendered and genuinely tappable -- a
    /// known WebKit/XCUITest accessibility-frame quirk, confirmed directly
    /// against this app in CI (see Gate 5B VERIFICATION_LOG.md). Falling
    /// back to a coordinate tap at the element's own centre still targets
    /// exactly this element, not an arbitrary point on screen. This does
    /// not weaken what is proven: every call site still requires a
    /// specific downstream UI transition (a panel opening, the HUD
    /// appearing, etc.) as proof the tap actually worked, not just that
    /// `.tap()` was called.
    private func tap(_ el: XCUIElement) {
        if el.isHittable {
            el.tap()
        } else {
            el.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
    }

    /// A tap is delivered to a WKWebView-hosted `<input>` before WebKit has
    /// necessarily finished focusing the underlying DOM element and
    /// surfacing the system keyboard; `typeText()` requires genuine
    /// keyboard focus to synthesize key events, so typing immediately
    /// after `tap()` can fail with "Neither element nor any descendant has
    /// keyboard focus" even though the tap itself succeeded. Waiting for
    /// the keyboard to actually appear is the real signal that focus
    /// landed, confirmed directly against this app in CI.
    private func tapAndWaitForKeyboardFocus(_ el: XCUIElement) {
        tap(el)
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: shortTimeout), "Keyboard never appeared after tapping '\(el.label)' -- the field did not receive focus.")
    }

    /// Taps `el` and waits for `expected` to appear. WKWebView's
    /// accessibility-frame cache can briefly lag behind the real DOM
    /// layout immediately after a large re-render (such as mounting the
    /// whole GameWorld/HUD after entering Meadowrest, which involves a
    /// WebGL scene initialization), so a single tap can occasionally land
    /// at a stale coordinate. Retrying the tap once, only after a real
    /// wait has genuinely elapsed with no result, is a standard UI-test
    /// resilience pattern -- it does not change what must ultimately be
    /// true: `expected` must appear, or the test still fails with the
    /// exact same message.
    private func tapUntil(_ el: XCUIElement, expected: XCUIElement, _ message: String, timeout: TimeInterval? = nil) {
        let total = timeout ?? shortTimeout
        tap(el)
        if expected.waitForExistence(timeout: total / 2) { return }
        tap(el)
        waitAndAssert(expected, message, timeout: total / 2)
    }

    // MARK: - The journey

    func testEverloomNativeLifecycleAndPersistenceJourney() throws {
        // ===== PHASE A: fresh native launch =====
        app.launch()

        let washedAshore = element(labeled: "Who washed ashore?")
        waitAndAssert(washedAshore, "Fresh-install character creator heading 'Who washed ashore?' did not appear -- app may be blank, crashed, or stuck loading.", timeout: launchTimeout)

        let nameField = element(labeled: "Character name")
        waitAndAssert(nameField, "Character name field (aria-label 'Character name') was not found in the accessibility tree.")

        let enterButton = element(labeled: "Enter Meadowrest")
        waitAndAssert(enterButton, "'Enter Meadowrest' control was not found -- fresh character creation is not usable.")

        let fatalHeading = app.staticTexts["The thread snagged."]
        XCTAssertFalse(fatalHeading.exists, "App is showing its fatal-error screen on fresh launch.")

        attach("01-fresh-native-launch")

        // ===== PHASE B: real user entry =====
        tapAndWaitForKeyboardFocus(nameField)
        // A freshly focused field's cursor lands at index 0 (start), not
        // the end -- deleting backward from there deletes nothing.
        // Triple-tap is the standard iOS/WebKit gesture to select all
        // existing text in a single-line field, so typing next replaces
        // it, rather than prepending onto the untouched default value.
        nameField.tripleTap()
        nameField.typeText("Native QA")

        // Dismiss the keyboard before tapping Enter Meadowrest: in
        // landscape the on-screen keyboard can obscure controls further
        // down the character-creation form. Tapping the (non-interactive)
        // heading blurs the text field without touching any real control
        // under test.
        tap(washedAshore)
        _ = app.keyboards.firstMatch.waitForNonExistence(timeout: shortTimeout)

        tap(enterButton)

        // `Hud` (Pack/Skills/Thread/Options/HP/etc.) renders unconditionally
        // once a local save exists -- including *underneath* the character
        // creator, before it is ever dismissed. So the HUD's controls
        // existing in the accessibility tree is not proof Enter Meadowrest
        // actually worked: a full-screen accessibility-tree capture taken
        // during Gate 5B CI debugging showed the HUD and the still-present
        // character creator coexisting in the same snapshot. The only
        // unambiguous signal that entry actually completed is the
        // character creator itself disappearing.
        if !washedAshore.waitForNonExistence(timeout: shortTimeout) {
            tap(enterButton)
        }
        XCTAssertTrue(
            washedAshore.waitForNonExistence(timeout: launchTimeout),
            "Character creator ('Who washed ashore?') did not dismiss after tapping 'Enter Meadowrest' -- the HUD renders behind it regardless, so its presence alone would not prove entry worked."
        )

        let packButton = element(labeled: "Pack")
        waitAndAssert(packButton, "HUD 'Pack' control did not appear -- the game world/HUD did not become ready after entering Meadowrest.", timeout: launchTimeout)

        let skillsButton = element(labeled: "Skills")
        waitAndAssert(skillsButton, "HUD 'Skills' control did not appear.")
        let threadButton = element(labeled: "Thread")
        waitAndAssert(threadButton, "HUD 'Thread' control did not appear.")
        let optionsButton = element(labeled: "Options")
        waitAndAssert(optionsButton, "HUD 'Options' control did not appear.")
        let hp = element(labeled: "HP")
        waitAndAssert(hp, "HUD 'HP' label did not appear.")

        // Let WKWebView's accessibility-frame cache catch up after the
        // heavy GameWorld/HUD mount (WebGL scene init) before the first
        // interactive tap -- see tapUntil()'s doc comment.
        Thread.sleep(forTimeInterval: 1.5)

        let closePanel = element(labeled: "Close panel")
        tapUntil(packButton, expected: closePanel, "Pack panel did not open -- 'Close panel' control never appeared after tapping Pack.", timeout: launchTimeout)
        tap(closePanel)
        XCTAssertFalse(closePanel.waitForExistence(timeout: 3), "Pack panel did not close after tapping 'Close panel'.")

        attach("02-meadowrest-world-ready")

        // ===== PHASE C: background and foreground =====
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 3)
        app.activate()

        waitAndAssert(packButton, "HUD 'Pack' control is gone after returning from the background -- resume did not restore the world.", timeout: launchTimeout)

        let skillsClose = element(labeled: "Close panel")
        tapUntil(skillsButton, expected: skillsClose, "Skills panel did not open after backgrounding/resume -- touch handling did not survive the lifecycle transition.")
        tap(skillsClose)

        attach("03-background-resume")

        // ===== PHASE D: terminate and relaunch =====
        app.terminate()
        app.launch()

        // The fresh character creator must NOT return: the local save from
        // Phase B must have persisted across a genuine process termination.
        let washedAshoreAgain = app.staticTexts["Who washed ashore?"]
        XCTAssertFalse(
            washedAshoreAgain.waitForExistence(timeout: 5),
            "Character creator reappeared after terminate/relaunch -- the local save did not persist across process termination."
        )

        let packAfterRelaunch = element(labeled: "Pack")
        waitAndAssert(packAfterRelaunch, "HUD did not return after terminate/relaunch -- save did not load, or the world failed to reinitialize.", timeout: launchTimeout)
        Thread.sleep(forTimeInterval: 1.5)
        let relaunchClose = element(labeled: "Close panel")
        tapUntil(packAfterRelaunch, expected: relaunchClose, "Pack panel did not open after terminate/relaunch -- touch handling did not survive.", timeout: launchTimeout)
        tap(relaunchClose)

        attach("04-terminated-relaunched-save-present")
    }
}
