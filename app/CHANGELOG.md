# WFD — What's for Dinner · Changelog

Versions are MAJOR.MINOR.PATCH:
- **PATCH** (1.1.x) — small tweaks and fixes.
- **MINOR** (1.x.0) — new features.
- **MAJOR** (x.0.0) — big milestones (e.g. the app-store launch, a redesign).

## 1.8.0 — Nov 24, 2026
- Pull down from the top of any screen to refresh: it installs a newer version of the app if there is one, otherwise it fetches the latest plans, lists, recipes and pantry.

## 1.7.1 — Nov 24, 2026
- The floating cart button no longer shows on More / Settings.

## 1.7.0 — Nov 24, 2026
- Recipes in the bottom bar: one place for My recipes and Find new.
- Faster recipe finding: results are remembered, so tapping cuisines and meal types back and forth is instant, and only the newest search's results show.
- Search actually finds things now: it looks for the dish name (tacos → taco), each word, and recipes that use it as an ingredient (salmon, chickpeas), best matches first. Results appear as you type, and recipe-website results are labeled separately.

## 1.6.2 — Nov 24, 2026
- The links at the bottom (Privacy, Help, Contact us, What's new, version) now show on every screen, including sign-in.
- Help and Privacy pages have a ← Back to WFD button, and open in the app instead of a new browser tab.

## 1.6.1 — Nov 24, 2026
- Health note now mentions heart conditions and high blood pressure, and that nutrition numbers are estimates.
- Invite codes: Settings always shows the code for the household you're in (it refreshes when you switch), says which household it's for, and the "join" box no longer shows a sample code that looked like a real one.

## 1.6.0 — Nov 24, 2026
- Nutrition for every meal: estimated calories, protein, carbs and fat per serving, worked out from the ingredients. Shown on saved recipes, the meal picker, each meal and day total in the week plan, and the Prep recipe cards.
- Clearer diet and allergy checks: each recipe now says exactly which ingredient doesn't fit ("Not Low-FODMAP — garlic, onion"), and shows a ✓ for the diets it does fit. Look-alikes no longer trip the checks (garlic-infused oil, lactose-free milk, green beans, butternut squash, almond flour, a bunch of cilantro). Keto, low-carb, low-fat and high-protein are judged from the nutrition numbers instead of word lists.
- Starter stores are now plain chains (no addresses); your home address finds the real ones near you.

## 1.5.3 — Nov 23, 2026
- The example household name is now "Smith Family".

## 1.5.2 — Nov 23, 2026
- Up to 3 ads per screen: the pinned bar, one near the top, and one at the bottom of Plan, Shop, Pantry and Prep. Saved recipes has two in the list. Still none between cooking steps.

## 1.5.1 — Nov 23, 2026
- What's new now also shows for people who were already using WFD before it existed.

## 1.5.0 — Nov 23, 2026
- Ads in more visible places: a slim banner pinned above the tab bar on Plan, Shop, Pantry and Saved recipes (✕ hides it for the visit), and in-page ads moved near the top of each screen. In the phone app the pinned banner is an AdMob ad (test ads until the real IDs are in).
- Cook day on your Lock Screen: in the iPhone app, a live card shows the step you're on, progress, what's next and the next timer counting down. It also appears in the Dynamic Island and on Apple Watch. Turn on ⌚ Phone & watch updates in Prep.
- Pantry updates itself after cooking: finishing the last step takes out the fresh things you used and adds the cooked meals, with Undo. It now catches scanned items too. You can switch it off.
- What's new: after an update you'll see this list once; it's also linked at the bottom of More.
- Phone app: camera permission covers pantry scanning.

## 1.4.1 — Nov 23, 2026
- Fix: the pantry picker on Plan didn't appear when some saved recipes used none of your pantry items.

## 1.4.0 — Nov 23, 2026
- Pantry → 📷 Add with the camera: scan barcodes one after another (product names looked up automatically; scan twice to count 2), check the list, then add. A "photo of a shelf or fridge" option turns on once photo recognition is set up on the server.
- Plan → Cook from your pantry: pick which pantry items to use (use-soon items picked for you). Each item shows how many of your saved recipes it goes in; saved recipes rank by how many of your picks they use; "New recipes using these" finds fresh ideas that use them, and + saves one straight into this week. Pick for me favors your picks too.
- New accounts are asked to name their household first (shown on invites and the household switcher).

## 1.3.0 — Nov 23, 2026
- Full-screen cooking: big step text and buttons, progress bar, "up next", swipe or ← → keys (Enter = Done → Next, Esc = exit); works on phone, iPad and desktop; timers stay visible.
- Phone & watch updates: a notification each time you finish a step (and when timers go off) — shows on Apple Watch when the iPhone is locked.
- Ads allowed on Prep (bottom banner, and a small banner in full screen); privacy policy updated.

## 1.2.3 — Nov 21, 2026
- Fix: popups (first-time setup, receipt, etc.) scroll on small screens, so their buttons are always reachable; setup buttons stay pinned at the bottom.

## 1.2.2 — Nov 21, 2026
- Home addresses on streets not yet on the map now work: the app uses the town/ZIP for distances and says so.

## 1.2.1 — Nov 21, 2026
- Leftovers land on a random later meal 1–3 days after cooking (not always the next day's lunch).

## 1.2.0 — Nov 21, 2026
- Pick for me: choose cuisines for the week (starts from your favorites); finds and saves new recipes when saved ones run short.
- Every recipe is eaten at most twice: cooked once, leftovers once at the next meal (tonight's dinner → tomorrow's lunch).

## 1.1.0 — Nov 21, 2026
- Dietary needs (Diabetes-friendly, Heart-healthy, Low-sodium, Low-FODMAP, Low-fat, Kidney-friendly, Pregnancy-safe), Halal, Kosher, High-protein; "not medical advice" note.
- Owner dashboards: usage, ads, data storage; first-party usage analytics.
- Ad slots (Plan, Shop, Pantry, Saved recipes, Find recipes) with admin previews; never on Prep.
- Freezer meals option always visible in Prep.
- Privacy policy updated for analytics, ads, partners and health info.

## 1.0.0 — Nov 21, 2026
- Version number in the footer; Contact us form (app + support page); email removed from help pages.
- Recipe photos, meal preferences and allergies, friendlier day planner, Start / Save Draft / Delete Plan.
- 25-mile adjustable store range, one meal vs full meal prep, household-named list, freezer meals.
- "Where's home?" setup, invite links always join, fixed "no household" errors.
