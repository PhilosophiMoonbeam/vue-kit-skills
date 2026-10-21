---
title: Vue Kit README branding is a standalone vector scene
author: PhilosophiMoonbeam
date: 2026-10-21
branch: main
touches:
  - README.md
  - assets/branding/vue-kit-hero.svg
---

## Decided
The README opens with assets/branding/vue-kit-hero.svg, an original 1600 x 760 SVG combining Material-inspired solid geometric planes with a vaporwave pirate ship. The README's unified-agent-skill positioning supplies the line "One skill. Open horizons." Keep the branding outside skills/vue-kit so decorative repository assets do not expand the installed skill or its content-addressed audit footprint.

## Tried and ruled out
Raster generation was unnecessary for the explicitly requested SVG. The geometric wordmark uses original paths; all artwork is native vector geometry. There are no external images, scripts, animation, or downloaded fonts. Small supporting text uses a system sans-serif stack.

## Watch out
Keep the SVG title/description, README alt text, and local fragment references intact. Preview both the standalone SVG and an img embed on light and dark backgrounds. Headless Chrome's command-line window size clamps narrow windows to 500 CSS pixels in this environment; use device metrics emulation and inspect innerWidth to check a real 390-pixel viewport. Main identity and silhouette must remain clear when supplementary banner text shrinks on phones.
