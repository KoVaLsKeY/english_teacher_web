# English Teacher — B2 Portfolio

A responsive one-page portfolio in plain HTML, CSS and JavaScript. All website features run in the browser. No build, framework, database, API, Node.js backend or production dependencies are required.

## Run and publish

Open `index.html` directly, or serve the directory with any static server. For GitHub Pages, select the branch containing these files and `/ (root)` in **Settings → Pages**. All asset paths are relative, so the site works at a repository URL such as `/english_teacher_web/` as well as a domain root.

## Structure and customization

| File | Purpose |
| --- | --- |
| `index.html` | Sections, navigation, FAQ questions and answers |
| `css/style.css` | Responsive layout, glass header, colors, transitions and companion styling |
| `js/main.js` | Navigation, FAQ animation, cursor, card stack and companion behavior |
| `data/content.js` | Image paths and contact email |
| `data/mascot-phrases.js` | Editable array of English companion phrases |
| `assets/images/` | Every illustration/photo, including `owl-mascot.svg` |
| `tests/browser-check.cjs` | Optional development browser checks; not used by the website |

Replace the teacher and lesson images in `assets/images/` and update the paths in `data/content.js`. Set `SITE_CONTENT.teacher.email` for the live email link; also update the fallback `mailto:` and label in `index.html` for visitors with JavaScript disabled. The copy and artwork are placeholders.

## Interactions

- **Header:** glass navigation switches to a hamburger at 1050px. The mobile modal animates in and out, dims/blurs the page, locks background scrolling and traps focus. Close with its button, Escape, a backdrop click or a section link. Switching to desktop closes it automatically.
- **FAQ:** native `details` remains usable without JavaScript. With JavaScript, measured height animates through the Web Animations API, including reversed clicks during an animation. Resizing settles the animation to the intended state.
- **Cursor:** dark on light surfaces and lime on surfaces marked `data-cursor-theme="dark"`. Mark nested light surfaces with `data-cursor-theme="light"`. Movement uses transforms, and the trailing ring stops requesting frames when it catches up. The native cursor stays available before initialization, in the mobile modal, on touch devices and with reduced motion.
- **Lessons:** option A, overlapping sticky cards, runs above 1050px on viewports at least 650px tall. IntersectionObserver limits scroll work to visible cards. On small/short screens and with reduced motion, all cards use ordinary document flow.
- **Companion:** the SVG owl drifts near the bottom of the screen. Click/tap for a randomly selected English phrase, with no immediate repeat; it pauses while speaking. A second click or 6.5 seconds dismisses the phrase. Hover and keyboard focus pause movement. The pause control stops it indefinitely; the dismiss control hides it for the browser tab’s session. Reduced motion disables its movement while retaining phrase interaction.

## Accessibility and fallbacks

Keyboard navigation, visible focus indicators, a skip link, descriptive image text and live announcement of companion phrases are included. Native modal semantics handle focus and background isolation. Reduced-motion settings apply both on load and when changed while the page is open. Without JavaScript, images, content, mobile navigation links and native FAQ remain available.

## Optional browser checks

Node.js is used only for development tests, never to run or host the deployed site. Install Playwright locally and its test browser:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/browser-check.cjs
```

The check starts and stops its own local static test server under `/english_teacher_web/`. It covers widths from 320px to 1920px, horizontal overflow, navigation focus/closing behavior, FAQ reversal, cursor contrast, sticky progress, companion controls and timeout, touch interaction, reduced motion and the no-JavaScript fallback.

Set `UI_SCREENSHOT_DIR` to save review screenshots. `CHROMIUM_PATH` optionally selects an already installed Chromium binary.
