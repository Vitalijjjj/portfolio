# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A single-page portfolio website exported from Webflow, located entirely in `Portfolio Template Webflow/`. It is pure static HTML/CSS/JS — there is no package.json, build step, linter, or test suite.

## Running the site

Serve the site directory with any static server (opening `index.html` directly also works, but a server avoids potential asset-loading quirks):

```bash
cd "Portfolio Template Webflow" && python3 -m http.server 8000
```

Note: the directory name contains spaces — always quote paths in shell commands.

## Architecture

Everything lives in `Portfolio Template Webflow/index.html` (~250 lines, minified single-line markup for most of the body). The page has two sections:

1. **Hero** (`.dd-hero`) — profile card, featured works grid (`.dd-works-card` links with hover overlays), services/stack lists (`.dd-info`), and a CTA anchor.
2. **CTA** (`.dd-cta`) — a hidden fullscreen section revealed by a scroll-triggered GSAP animation when the user scrolls past `.dd-cta-anchor`.

Code is split across three places inside `index.html`:

- **Inline `<style>` blocks** (inside `w-embed` divs at the top of `<body>`) — custom CSS added on top of Webflow's export: adaptive root font-size (`font-size: calc(16vw / 14.4)` desktop, `/3.93` mobile, fixed 16px above 1440px — so the whole layout scales with viewport via rem units), hover effects, and the `.line-mask` elements used by text animations.
- **Inline `<script>` at the bottom** — all custom animation logic: SplitText line-mask reveal on the CTA title (scrubbed by ScrollTrigger), the CTA section reveal timeline (staggered `clip-path` on `.dd-cta__bg-box` elements), and a mousemove parallax on work-card buttons (desktop only, via `gsap.matchMedia`).
- **`css/` and `js/`** — Webflow-generated files (the `dd-portfolio-template.*` files) plus vendored libraries: jQuery 3.5.1, GSAP with ScrollTrigger and SplitText plugins. Do not hand-edit the Webflow-generated files; make changes via the inline blocks or be aware a Webflow re-export would overwrite them.

Animation elements are tagged with custom attributes `dd-el="cta-title"` and `dd-el="cta-el"`, which the inline script queries. CSS classes follow a `dd-` prefix convention; Webflow design tokens are CSS variables like `--colors--black`, `--colors--gray-smoke`.

Assets: `images/` (with Webflow-generated responsive `-p-500`/`-p-800` variants referenced in `srcset`), `fonts/` (Inter, JetBrains Mono), `media/` (video for the first work card — note its `src` uses a URL-encoded filename).
