from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()

    try:
        # 1. Dashboard - Check Voice Onboarding Tip
        print("Navigating to Dashboard...")
        page.goto("http://localhost:9002/dashboard")

        # Wait for page load
        page.wait_for_selector("h1:has-text('Dashboard')", timeout=60000)

        # Check for Voice Onboarding Tip
        print("Checking for Voice Onboarding Tip...")
        tip = page.locator("text=Try Voice Input!")
        expect(tip).to_be_visible(timeout=10000)
        print("Voice Onboarding Tip found!")

        # Take screenshot of Dashboard
        page.screenshot(path="verification/dashboard_voice_tip.png")

        # 2. Settings - Check Stats
        print("Navigating to Settings...")
        page.goto("http://localhost:9002/settings")

        # Wait for page load
        page.wait_for_selector("h1:has-text('Settings')", timeout=60000)

        # Check for Stats
        print("Checking for Voice Stats...")
        expect(page.locator("text=Voice Commands Used")).to_be_visible()
        expect(page.locator("text=Successful Parses")).to_be_visible()
        expect(page.locator("text=Avg. Processing Time")).to_be_visible()

        # Check values (should be 0 initially)
        expect(page.locator("text=Total attempts to use voice input").locator("..").locator("div")).to_have_text("0")

        print("Voice Stats found!")

        # Take screenshot of Settings
        page.screenshot(path="verification/settings_voice_stats.png")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
