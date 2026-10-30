# ChaiTailwind — Build Spec

> You are building **ChaiTailwind**, a lightweight utility-first CSS engine written in vanilla JavaScript.
> Read this whole document before writing code. Follow it exactly. Where something is marked **(Bonus)**, build it only after everything else works.

---

## 1. What it is

Users write class names starting with `chai-` in plain HTML. A single script scans the DOM after page load, parses each `chai-*` class, converts it into an inline style, applies it, and then removes the `chai-*` class from the element.

```html
<div class="chai-p-16 chai-bg-tomato chai-text-white chai-rounded-8 chai-text-center">
  Hello Chai
</div>
<script src="src/chai-tailwind.js"></script>
```

After the script runs, the element becomes:

```html
<div style="padding: 16px; background-color: tomato; color: white; border-radius: 8px; text-align: center;">
  Hello Chai
</div>
```

Other non-`chai-` classes on the element must be left untouched.

---

## 2. Hard constraints

- **Vanilla JavaScript only.** No frameworks, no npm dependencies, no build step, no bundler, no TypeScript.
- **No CSS file is generated or injected** for the utilities. Styles must be applied as **inline styles** via `element.style`.
- The library must be **a single file**: `src/chai-tailwind.js`, usable with one `<script>` tag.
- It must work by opening `index.html` directly in a browser and on static hosting (GitHub Pages / Vercel / Netlify).
- Wrap the library in an IIFE so it doesn't leak globals except `window.ChaiTailwind`.
- Unknown or malformed `chai-*` classes must **not throw**. Log a `console.warn` once per unknown class (only when debug mode is on, see §6) and leave that class on the element.
- Modern browsers only (ES2020 is fine).

---

## 3. Project structure

```
chai-tailwind/
├── index.html            # Landing + live demo + docs page, styled ONLY with chai-* classes
├── playground.html       # (Bonus) type classes into an input, see a live preview box
├── src/
│   └── chai-tailwind.js  # The engine (the only library file)
├── README.md             # How to use, supported utilities table, how it works
└── BUILD_SPEC.md         # This file
```

---

## 4. Class syntax and parsing rules

General pattern:

```
chai-<utility>-<value>
chai-<utility>             (for keyword-only utilities like chai-flex, chai-bold)
```

### 4.1 Values

| Value type | Example class | Result |
|---|---|---|
| Number → px | `chai-p-12` | `padding: 12px` |
| Zero | `chai-m-0` | `margin: 0px` |
| `auto` | `chai-mx-auto` | `margin-left: auto; margin-right: auto` |
| `full` | `chai-w-full` | `width: 100%` |
| `screen` | `chai-h-screen` | `height: 100vh` |
| Fraction | `chai-w-1/2` | `width: 50%` |
| Named color | `chai-bg-red` | `background-color: red` (any valid CSS named color) |
| Palette color | `chai-bg-chai-500` | value from the built-in palette (§5.3) |
| **Arbitrary value** | `chai-bg-[#ff6600]`, `chai-p-[1.5rem]`, `chai-w-[calc(100%-20px)]` | value inside brackets is used as-is |

Rules:
- A plain number is always treated as **px** (the assignment requires `chai-p-2 → padding: 2px`).
- Inside `[...]`, use the raw value. Convert `_` to a space so `chai-border-[1px_solid_red]` works.
- **Validate colors** with `CSS.supports('color', value)` before applying. If invalid, treat the class as unknown.
- Negative values with a leading dash: `chai--m-8` → `margin: -8px`. **(Bonus)**

### 4.2 Parsing approach

Do **not** write one giant `if/else` chain. Use a **utility registry**: a lookup object keyed by the utility prefix, where each entry knows which CSS properties it sets and how to resolve its value.

Suggested shape (you may improve it, but keep the idea):

```js
const UTILITIES = {
  p:  { props: ['padding'],                      value: 'spacing' },
  px: { props: ['paddingLeft', 'paddingRight'],  value: 'spacing' },
  bg: { props: ['backgroundColor'],              value: 'color'   },
  // ...
};

const KEYWORDS = {
  'flex':        { display: 'flex' },
  'text-center': { textAlign: 'center' },
  'bold':        { fontWeight: '700' },
  // ...
};
```

Resolution order for a class like `chai-text-xl`:
1. Strip the `chai-` prefix.
2. Check `KEYWORDS` for an exact match (e.g. `text-center`).
3. Otherwise, split into `<utility>` and `<value>`, matching the **longest** registered utility prefix first (so `rounded-tl-8` matches `rounded-tl`, not `rounded`).
4. Resolve the value with the utility's resolver (`spacing`, `color`, `fontSize`, `size`, etc.).
5. If anything fails, return `null` (unknown class).

Note the ambiguity in `text-*`: `chai-text-red` is a **color**, `chai-text-20` / `chai-text-xl` is **font size**, `chai-text-center` is **alignment**. The resolver must handle all three.

---

## 5. Supported utilities (minimum required)

### 5.1 Spacing

| Class | CSS |
|---|---|
| `chai-p-{v}` | padding |
| `chai-px-{v}` / `chai-py-{v}` | padding left+right / top+bottom |
| `chai-pt-{v}` `chai-pr-{v}` `chai-pb-{v}` `chai-pl-{v}` | single sides |
| `chai-m-{v}` `chai-mx-{v}` `chai-my-{v}` `chai-mt-{v}` `chai-mr-{v}` `chai-mb-{v}` `chai-ml-{v}` | same for margin (supports `auto`) |
| `chai-gap-{v}` | gap |

### 5.2 Sizing

| Class | CSS |
|---|---|
| `chai-w-{v}` / `chai-h-{v}` | width / height (px, `full`, `screen`, `auto`, fractions, arbitrary) |
| `chai-min-w-{v}` `chai-max-w-{v}` `chai-min-h-{v}` `chai-max-h-{v}` | min/max sizes |

### 5.3 Colors

| Class | CSS |
|---|---|
| `chai-bg-{color}` | background-color |
| `chai-text-{color}` | color |
| `chai-border-{color}` | border-color |

Built-in palette (in addition to all CSS named colors):

```js
const PALETTE = {
  'chai-50':  '#fdf8f0', 'chai-100': '#f7ead6', 'chai-300': '#e2b77a',
  'chai-500': '#c27c2c', 'chai-700': '#8a5216', 'chai-900': '#4a2a0a',
  'masala':   '#7b2d26', 'elaichi':  '#8fae6b', 'kesar':    '#f4a300',
  'dark':     '#1a1a1a', 'light':    '#f5f5f5',
};
```

So `chai-bg-chai-500`, `chai-text-kesar`, `chai-border-masala` all work.

### 5.4 Typography

| Class | CSS |
|---|---|
| `chai-text-{n}` | font-size: {n}px |
| `chai-text-xs/sm/base/lg/xl/2xl/3xl/4xl/5xl` | font-size: 12/14/16/18/20/24/30/36/48 px |
| `chai-text-left/center/right/justify` | text-align |
| `chai-font-thin/light/normal/medium/semibold/bold/black` | font-weight 100/300/400/500/600/700/900 |
| `chai-font-{100..900}` | font-weight number |
| `chai-bold`, `chai-italic`, `chai-underline`, `chai-uppercase`, `chai-lowercase`, `chai-capitalize` | keyword shortcuts |
| `chai-leading-{n}` | line-height (unitless if ≤ 3, e.g. `chai-leading-1.5`; otherwise px) |
| `chai-tracking-{n}` | letter-spacing px |
| `chai-font-sans` / `chai-font-serif` / `chai-font-mono` | font-family stacks |

### 5.5 Borders and radius

| Class | CSS |
|---|---|
| `chai-border` | `border: 1px solid currentColor` |
| `chai-border-{n}` | border-width: {n}px + border-style: solid |
| `chai-border-t-{n}` `-r-` `-b-` `-l-` | single side widths |
| `chai-border-solid/dashed/dotted/none` | border-style |
| `chai-border-{color}` | border-color |
| `chai-rounded` | border-radius: 4px |
| `chai-rounded-{n}` | border-radius: {n}px |
| `chai-rounded-full` | border-radius: 9999px |
| `chai-rounded-tl-{n}` `-tr-` `-bl-` `-br-` | single corners |

### 5.6 Layout

| Class | CSS |
|---|---|
| `chai-block` `chai-inline` `chai-inline-block` `chai-flex` `chai-inline-flex` `chai-grid` `chai-hidden` | display |
| `chai-flex-row` `chai-flex-col` `chai-flex-wrap` | flex-direction / flex-wrap |
| `chai-items-start/center/end/stretch` | align-items |
| `chai-justify-start/center/end/between/around/evenly` | justify-content |
| `chai-flex-1` | flex: 1 1 0% |
| `chai-grid-cols-{n}` | grid-template-columns: repeat(n, minmax(0, 1fr)) |
| `chai-relative` `chai-absolute` `chai-fixed` `chai-sticky` | position |
| `chai-top-{v}` `chai-right-{v}` `chai-bottom-{v}` `chai-left-{v}` | offsets |
| `chai-z-{n}` | z-index |
| `chai-overflow-hidden/auto/scroll` | overflow |

### 5.7 Effects

| Class | CSS |
|---|---|
| `chai-shadow` / `chai-shadow-sm/md/lg/xl` | box-shadow presets |
| `chai-opacity-{0..100}` | opacity: n/100 |
| `chai-cursor-pointer` | cursor |
| `chai-transition` | `transition: all 150ms ease` |

---

## 6. Public API

Expose exactly this on `window.ChaiTailwind`:

```js
ChaiTailwind.apply(root = document.body)  // scan root + all descendants, apply styles, return count of classes processed
ChaiTailwind.parse('chai-p-12')           // pure function → { padding: '12px' } or null. No DOM access.
ChaiTailwind.observe()                    // (Bonus) start a MutationObserver for elements/classes added later
ChaiTailwind.config({ debug: true, keepClasses: false })
ChaiTailwind.version                      // '1.0.0'
```

- `keepClasses: false` (default) removes processed `chai-*` classes after applying. `true` keeps them (helpful for debugging/demo).
- `debug: true` turns on the `console.warn` for unknown classes.
- **Auto-run:** on `DOMContentLoaded` (or immediately if the DOM is already loaded), call `apply(document.body)`.
- If the opt-out attribute `data-chai-manual` is on the `<script>` tag, skip the auto-run.

### Application rules
- Process the root element itself plus `root.querySelectorAll('[class*="chai-"]')`. Don't walk every node by hand.
- Copy `el.classList` into an array before modifying it. Never mutate a live list while iterating.
- Apply styles **in class order**, so a later class wins when two set the same property (`chai-p-4 chai-p-8` → `padding: 8px`).
- Use `el.style[camelProp] = value` or `el.style.setProperty(kebabProp, value)`. Pick one and use it consistently.
- Cache parse results in a `Map` (class string → style object). The same class appears many times on a page.
- If an element ends up with an empty `class` attribute, remove the attribute.

---

## 7. Demo page: `index.html`

This page is what gets hosted and shown in the video, so it should look good. **It must be styled entirely with `chai-*` classes.** No `<style>` blocks and no CSS files, except one optional tiny reset for `body { margin:0 }` and a Google Font `<link>`.

Sections:
1. **Hero**: name "ChaiTailwind ☕", tagline, two buttons (GitHub, Docs anchor). Use the chai palette.
2. **How it works**: 3 or 4 steps in a flex/grid row: *Write classes → Scan DOM → Parse → Inline styles*.
3. **Before / After**: show a code block of the HTML with `chai-*` classes, next to the rendered result.
4. **Utilities showcase**: one card per category (Spacing, Colors, Typography, Borders, Layout, Effects), each with live examples.
5. **Inspect tip**: tell the viewer to open DevTools and see that the classes are gone and inline styles are applied.
6. **Footer**: GitHub link, "Built for Web Dev Cohort 2026", author name placeholder.

Code blocks shown on the page must display the class names **as text** (inside `<pre><code>` with escaped `&lt;` `&gt;`), so the engine doesn't process them.

### (Bonus) `playground.html`
A text input where the user types classes (e.g. `chai-p-20 chai-bg-kesar chai-rounded-12`) and a preview box that updates live, plus a panel showing the generated inline CSS. Use `ChaiTailwind.parse()` for this.

---

## 8. Code quality requirements

- Clear sections in `chai-tailwind.js`, in this order: **config/constants → palette & scales → value resolvers → utility registry → parser → DOM applier → public API → auto-init**.
- Small, pure functions. `parse()` must not touch the DOM.
- JSDoc comment on each public function. Short comments only where the logic isn't obvious.
- `const`/`let` only, no `var`. Strict equality. No `eval`, no `innerHTML` in the library.
- The library file should be roughly 300–600 lines. Don't pad it.

---

## 9. README.md contents

1. Title + one-line description + live demo link + screenshot placeholder
2. Quick start (the `<script>` tag)
3. How it works (the 5 steps: traverse → identify → parse → apply → remove)
4. Supported utilities table (condensed from §5)
5. Arbitrary values `[...]` explanation
6. API (`apply`, `parse`, `config`, `observe`)
7. Limitations: no hover/focus/responsive variants, because inline styles can't express pseudo-classes or media queries
8. Run locally (open `index.html` or `npx serve .`)
9. Deploy (GitHub Pages / Vercel)

---

## 10. Acceptance checklist

Before saying you're done, verify each item:

- [ ] `chai-p-2` → `padding: 2px`
- [ ] `chai-bg-red` → `background-color: red`
- [ ] `chai-text-center` → `text-align: center`
- [ ] `chai-text-red` → `color: red`, `chai-text-24` → `font-size: 24px`, `chai-text-xl` → `font-size: 20px`
- [ ] `chai-mx-auto` sets both left and right margin to `auto`
- [ ] `chai-w-1/2` → `width: 50%`
- [ ] `chai-bg-[#ff6600]` and `chai-p-[1.5rem]` work
- [ ] `chai-bg-chai-500` uses the palette
- [ ] `chai-rounded-tl-8` sets only the top-left radius
- [ ] `chai-p-4 chai-p-8` → `padding: 8px` (last wins)
- [ ] Non-chai classes (e.g. `card`) are preserved
- [ ] `chai-*` classes are removed after processing (default config)
- [ ] `chai-bg-notacolor` and `chai-xyz-5` don't throw and are left on the element
- [ ] `ChaiTailwind.parse('chai-p-12')` returns `{ padding: '12px' }` without touching the DOM
- [ ] `index.html` works when opened directly from disk, with zero console errors
- [ ] No external JS dependencies

Add a simple `tests.html` that runs `ChaiTailwind.parse()` on every row of this checklist and prints PASS/FAIL to the page. **(Bonus, strongly encouraged.)**

---

## 11. Out of scope

- Hover, focus, dark-mode, or responsive prefixes (`hover:`, `md:`)
- Generating a stylesheet
- npm publishing, bundling, frameworks

---

## 12. When finished

Report back:
1. The final file tree
2. Anything from this spec you skipped or changed, and why
3. How to run it locally
