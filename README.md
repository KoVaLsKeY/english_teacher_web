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
| `assets/images/` | Teacher and lesson illustrations/photos; the interactive dog and house are inline SVGs in `index.html` |
| `tests/browser-check.cjs` | Optional development browser checks; not used by the website |

Replace the teacher and lesson images in `assets/images/` and update the paths in `data/content.js`. Set `SITE_CONTENT.teacher.email` for the live email link; also update the fallback `mailto:` and label in `index.html` for visitors with JavaScript disabled. The copy and artwork are placeholders.

## Interactions

- **Header:** glass navigation switches to a hamburger at 1050px. The mobile modal animates in and out, dims/blurs the page, locks background scrolling and traps focus. Close with its button, Escape, a backdrop click or a section link. Switching to desktop closes it automatically.
- **FAQ:** native `details` remains usable without JavaScript. With JavaScript, measured height animates through the Web Animations API, including reversed clicks during an animation. Resizing settles the animation to the intended state.
- **Cursor:** dark on light surfaces and lime on surfaces marked `data-cursor-theme="dark"`. Mark nested light surfaces with `data-cursor-theme="light"`. Movement uses transforms, and the trailing ring stops requesting frames when it catches up. The native cursor stays available before initialization, in the mobile modal, on touch devices and with reduced motion.
- **Marquee:** two identical groups repeat without a gap. JavaScript repeats the words until each group covers the viewport, then moves by exactly one group width at 55px/second. Width changes and loaded fonts trigger remeasurement; no extra network loading is needed. Edit the words in the first `.marquee-group` in `index.html`.
- **Lessons:** above 1050px, sticky cards expose an 84px header strip with each previous letter. The top offsets and card height are calculated from the header, viewport and number of cards, including the fourth card. A flow spacer lets the final card finish stacking and stay fully visible before the section exits. When the available height is less than 410px, or with reduced motion, cards use ordinary document flow.
- **Companion:** a cartoon golden retriever on two legs greets the visitor beside its house, then walks to the bottom center. Its googly pupils follow the pointer; its tail and greeting paw animate. Click/tap for an English phrase, with no immediate repeat; a second click, Escape or 6.5 seconds dismisses it. Drag with a mouse, pen or finger anywhere in the viewport; releasing sends the dog home. The house stays in the bottom-right corner and toggles between sending the dog home and calling it back out. The dog’s home button does the same; hiding is reversible and is not stored across reloads. The pause control stops decorative animation and eye tracking. Reduced motion makes travel immediate and disables decorative motion. Keyboard users can operate the dog and house buttons without dragging.
- **Footer:** the year comes from the visitor’s current date and refreshes once a minute and whenever the tab’s visibility changes, including after New Year in a tab left open.

## Accessibility and fallbacks

Keyboard navigation, visible focus indicators, a skip link, descriptive image text and live announcement of companion phrases are included. Native modal semantics handle focus and background isolation. Reduced-motion settings apply both on load and when changed while the page is open. Without JavaScript, images, content, mobile navigation links and native FAQ remain available.

## Optional browser checks

Node.js is used only for development tests, never to run or host the deployed site. Install Playwright locally and its test browser:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/browser-check.cjs
```

The check starts and stops its own local static test server under `/english_teacher_web/`. It covers widths from 320px to 3840px, marquee coverage and its repeat boundary, horizontal overflow, navigation focus/closing behavior and icon centering, FAQ reversal, cursor contrast, letter-strip visibility and full final-card stacking, dog eyes/phrases/house controls, mouse and touch dragging, reduced motion, calendar rollover and the no-JavaScript fallback.

Set `UI_SCREENSHOT_DIR` to save review screenshots. `CHROMIUM_PATH` optionally selects an already installed Chromium binary.
