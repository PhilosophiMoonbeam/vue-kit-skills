# Product-specific design and continuous systems

Read when composing a Vue surface, refining a Vuetify application, extending shared UI, or reviewing visual/interaction quality. This is implementation guidance, not a command framework or authorization to redesign unrelated screens. API baseline: **Vue 3.5.44; Vuetify 4.3.0**, stable releases. Design recommendations below are authored judgments; accessibility thresholds belong to [accessibility.md](accessibility.md), not aesthetic preferences. Use [vuetify-theme.md](vuetify-theme.md) for theme APIs and [vuetify-components.md](vuetify-components.md) for component contracts.

## 1. Establish the task and authority

Inspect the affected route, neighboring components, current tokens, data contracts, content/assets, and applicable product requirements before choosing a treatment. Existing coherent implementation establishes a system even without a design document. A narrow defect does not authorize a stack migration or a new brand.

Record only decisions that affect this task:

- **Job:** who arrives, in what context, and what they must understand or accomplish.
- **Outcome:** the observable improvement; for example, locating an overdue item and correcting its owner, not “a modern dashboard.”
- **Boundary:** changed surface, shared dependencies, identity commitments, and behaviors that stay untouched.
- **Material:** real copy, licensed assets, actual data ranges, and necessary states.
- **Evidence:** available source, current captures, permitted runtime observations, and unknowns.

| Authority | Appropriate intervention | Preserve |
| --- | --- | --- |
| Refine/polish | Improve hierarchy, grouping, labels, responsiveness, and control consistency | Recognizable identity, factual meaning, working behavior, routes, content |
| Extend | Fill a demonstrated missing state, token, pattern, or surface using incumbent logic | Existing roles, component vocabulary, density and interaction conventions |
| Replace/redesign or greenfield | Establish a deliberate new composition and visual language within the mandate | Product truth, required capabilities/content, accessibility, explicit brand commitments |

Resolve reversible craft choices from project evidence. Escalate only unreachable consequential facts, purpose, or authority; never ask the user to choose routine spacing or design tactics. “Make it better” is not identity-replacement authority. Do not invent prices, customer proof, metrics, integrations, saving guarantees, endpoints, or capabilities. Label illustrative content; it cannot satisfy missing real behavior.

If a supplied comp is the designated visual target, preserve it and correct the implementation rather than editing the reference to make comparison pass. Inspiration images are not automatically binding targets. A settled viewport does not establish mobile, keyboard, other states, or accessibility.

Continue settled decisions and user-reported defects rather than restarting discovery or requiring a reproduction to acknowledge them. Choose the smallest coherent **causal** intervention: repair lost input before rewriting its error message; restore a hidden primary action before polishing icons. Before changing routes, anchors, metadata, analytics hooks, logos or legal content, identify and preserve their consumers unless the mandate includes the change. Planning delivers a scoped brief, and read-only review delivers prioritized findings with location, evidence, impact and remedy; neither authorizes unsolicited implementation or persisted sidecars. No runtime access changes what can be proved, not what source-level work can be completed.

## 2. Compose around the product's work

Choose a structural thesis: what leads, what the person sees next, where they act, and which real artifact or mechanism makes this product recognizable. Carry that decision through the whole scoped surface, not only the first viewport.

| Surface/job | Lead with | Avoid |
| --- | --- | --- |
| Repeated operational task | Current work, actionable status, scoped filters, familiar controls | Decorative metrics above the actual task; charts unrelated to decisions |
| Evaluate/decide | Actual offer, relevant proof, consequences, working next action | Poster-like hero with hidden action; fabricated endorsements |
| Read/understand | Reader's question, clear content sequence, calm reading area, wayfinding | Repeated intro copy; ornamental chrome competing with information |
| Explore an artifact | Work/subject, useful browsing and contextual detail | Interface decoration dominating the artifact |

Use contrast in scale, placement, grouping, and information sequence before adding containers. Cards are useful for independent selectable entities, not mandatory wrappers around every paragraph. Gradients, serifs, system fonts, dark themes, rounded surfaces, and flat treatments are neither intrinsically good nor forbidden. Preserve conventions that help this audience; reject interchangeable decoration when it hides the subject. One dominant expressive idea often benefits from quiet supporting regions.

## 3. Define a small, coherent vocabulary

Keep one authoritative definition for each role. Reuse the incumbent theme, CSS variables, assets, and component API; do not add parallel aliases just to rename them. Separate primitives from semantic roles only when coordinated change benefits from that distinction.

For an OpenVue application, [OpenVue theming](openvue-theming.md) owns primitive/semantic/component tokens, scheme-specific overrides, PT/layer contracts and the document-root dark selector; [overlays](openvue-overlays.md) owns interaction lifetimes. Reuse those existing owners instead of installing Vuetify or a second theme controller to repair one component.

| Vocabulary | Implementation decision | Failure to prevent |
| --- | --- | --- |
| Color | Surface/background, text/on-color pairs, action, selection, focus, and feedback roles per supported theme | Reusing “primary” for every status; dark mode as indiscriminate inversion |
| Type | Family, size, weight, line height, tracking as meaningful roles | Font-size-only hierarchy; metadata made unreadably faint |
| Space | Repeated intra-control, group, section, and page relationships | Arbitrary gaps everywhere; equal spacing obscuring related items |
| Shape/depth | Radius, border, tonal surface, and elevation with a hierarchy purpose | Every region raised; decorative border mistaken for a required indicator |
| Motion | State-transition purpose, timing, interruption and reduced-motion behavior | Motion as a prerequisite for reading or activating content |
| Behavior | Focus, pressed/selected, disabled, pending, error, and recovery contracts | A shared component unifying pixels but not operation |

Do not tokenize every literal. Local editorial composition can remain local. Extract shared patterns when repeated intent and behavior are clear, not after an arbitrary number of uses. Favor composition over a universal component with unrelated boolean props. A shared field owns label/help/error associations; a shared dialog owns focus/dismissal/restoration; a shared pending action retains its accessible name.

### Palette ramps, materials, and data

Retain the incumbent color format. In CSS palettes, OKLCH can help tune lightness/chroma independently, but perceptual lightness is not WCAG luminance and out-of-gamut colors can change on conversion. Reduce excessive chroma near ramp endpoints, check supported output gamuts, and retain a compatible fallback; do not assume an arbitrary CSS color function is accepted by the theme parser. For sequential scales make ordering readable, for diverging scales identify the meaningful midpoint, and for categorical scales provide distinguishable labels/markers rather than adding endless hues. [CSS Color 4](https://www.w3.org/TR/css-color-4/) defines the color spaces; these palette choices are authored recommendations.

A calmer surface removes competing chroma/decorative layers before dimming useful text. Depth should distinguish actual layers; keep material highlights/shadows consistent with the intended light direction. Translucent surfaces need a legible solid backing when blur is unsupported, transparency is reduced, or underlying content varies. Evaluate the weakest text-over-image/gradient region, not one favorable sample. In each theme inspect pressed, selected, focus, disabled and error states, with color-vision/grayscale simulation as supplemental evidence, not a replacement for contrast calculation or redundant cues.

### Vuetify role mapping

The following is a complete **example theme module**, not a universal palette or a claim that every rendered component passes contrast. Merge these options into the application's existing Vuetify registration; installation, component registration, and style loading are owned by [vuetify-setup.md](vuetify-setup.md). Replace example colors with authorized product roles and evaluate the actual text, opacity, state layers, and backgrounds in both themes.

```ts
import { createVuetify } from 'vuetify'

export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#F7F8FA', 'on-background': '#17202A',
          surface: '#FFFFFF', 'on-surface': '#17202A',
          primary: '#174A8B', 'on-primary': '#FFFFFF',
          error: '#A51D32', 'on-error': '#FFFFFF',
          'focus-ring': '#174A8B',
        },
      },
      dark: {
        dark: true,
        colors: {
          background: '#101820', 'on-background': '#F1F4F8',
          surface: '#1A2633', 'on-surface': '#F1F4F8',
          primary: '#B2D0FF', 'on-primary': '#102E51',
          error: '#FFB3BC', 'on-error': '#590015',
          'focus-ring': '#B2D0FF',
        },
      },
    },
  },
})
```

Vuetify 4.3.0 generates RGB channel variables such as `--v-theme-surface`; use `rgb(var(--v-theme-surface))`, not `var(--v-theme-surface)` as a complete color. It can derive unspecified on-colors, but derivation is not rendered contrast evidence. `defaultTheme: 'light'` above is explicit; the upstream default is `system`. [Theme documentation](https://vuetifyjs.com/en/features/theme/), [exact 4.3.0 implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/theme.ts).

## 4. Typography, layout, and density

- Choose fonts for the subject and real language coverage. Verify licensing and delivery; a declared font is not evidence it loaded. Keep fallback text readable, load only required weights, and inspect layout after font swap. Do not gate the page on font readiness.
- Assign distinct roles to page/section headings, body, labels, help, metadata, and numeric data. Use real heading elements independently of visual size. Vuetify 4 uses MD3 typography roles such as `headline-*`, `body-large`, and `label-large`; do not copy Vuetify 3 `text-h*` examples uncritically. See [vuetify-theme.md](vuetify-theme.md).
- Tune measure, line height, spacing, and size to content and usage. A reading column and a repeated financial table need different density. Tabular numerals help aligned quantities; preserve signs, units, precision, and qualifiers. Avoid making critical information secondary through opacity alone.
- Prefer fluid containers, content-driven breakpoints, wrapping action groups, and intrinsic sizing. Grid/flex children often need `min-inline-size: 0`. Long names, URLs, translated labels, multiline errors, missing images, zero values, and large counts must not break grouping.
- Compact density is a task choice, not a license to shrink hit areas or remove help. Assess visual density separately from the actual pointer target and available spacing. Offer comfortable density when warranted; do not infer input method from viewport width.
- Preserve meaningful DOM reading/focus order when rearranging visually. Keep primary functionality reachable on narrow screens; responsive design may move information but cannot simply discard necessary content.

**Contextual CSS pattern:** apply these classes to the existing page, repeated entity list, and wrapping toolbar. These are starting values, not mandatory aesthetic numbers. Keep global system values in the existing token stylesheet, not repeated in every SFC.

```css
.task-page {
  inline-size: min(100%, 76rem);
  margin-inline: auto;
  padding-inline: clamp(1rem, 3vw, 2rem);
  color: rgb(var(--v-theme-on-background));
}
.entity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 1.25rem;
}
.entity-grid > * { min-inline-size: 0; }
.task-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.task-copy { max-inline-size: 65ch; overflow-wrap: anywhere; }
.task-heading { font-size: clamp(1.75rem, 1.25rem + 2vw, 3rem); line-height: 1.2; }
```

Do not force layout-only CSS choices through JavaScript viewport watchers. Use framework display state only when behavior actually differs, preserving SSR/hydration correctness; see [debugging-ssr.md](debugging-ssr.md).

### Typography and layout diagnostics

Choose an additional family only for a distinct job; inspect actual glyphs, italics, punctuation, diacritics and numeric alignment, not only a specimen heading. Prose around 45–75 rendered characters and line height around 1.4–1.6 are starting points, not requirements or source-character counts: DOM text, code units, script shaping and actual line breaks differ. Tune tracking to the face/script and give wrapped display type room for accents, descenders and italic overhang. Do not insert hard line breaks merely to make one English capture fit.

For shipped fonts, declare each static face's actual weight/style, or only the range the variable asset actually supports. `font-display: swap` favors early readable fallback with possible late reflow; `optional` can retain fallback rather than swapping late. Reduce disruptive shifts using measured fallback `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override`, not copied percentages. Subsetting must preserve supported scripts and user content. Preload only demonstrably critical faces; verify requests and rendered-font identity before attributing wrapping to CSS. [Font delivery and rendering contracts](https://web.dev/articles/font-best-practices).

When rhythm fails, inspect computed `gap`, padding and collapsing margins. Keep headings closer to their content than to the preceding group, align comparable baselines/records, and use content-sized shared rows instead of fixed-height spacers for comparisons. An inset rounded enclosure may derive its inner radius from `max(0, outer radius − inset)`; unrelated controls keep their own role. Reused components may need container queries rather than page-width assumptions. Check intermediate widths and reset wide-layout spans, overlaps and transforms when stacking; `auto-fit` expands sparse rows, which is not always the intended alignment. Leave a clear conclusion or next action at the end of the scoped flow.

### Media, composition references, and provenance

Use imagery to show the actual subject, product or artifact; decorative gradients, charts and stock scenes cannot replace required evidence. Choose focal point, crop/aspect ratio and scale for each layout. Separate live copy/controls from production media; separate foreground, frame and background when responsive placement or movement requires independent layers. Organic edges require a real cut-out/matte, not an unrelated geometric clip. Verify actual alpha on light and dark backgrounds: painted checkerboards are not transparency, holes must reveal the intended layer, and edge halos or unexpectedly translucent solid paint are defects.

Supply appropriately sized/compressed candidates: width-descriptor `srcset` describes intrinsic candidate widths and `sizes` describes expected layout width; neither sets CSS width or guarantees the browser chooses a particular file. Use `<picture>` for actual art direction/format alternatives with a usable `<img>` fallback, and reserve dimensions/aspect ratio. Never lazy-load a critical initial image by reflex. Inspect the chosen source, responsive crop, sharpness and transfer/decode cost rather than claiming success from a decodable file. [Responsive-image selection](https://web.dev/learn/images/descriptive).

Optional sketches/composition prompts should specify authorized content in reading order, the primary action, one dominant idea, and the intended viewport/output scale. A reference comp is not a live control or production image; retain an accepted comp rather than regenerate it to disguise implementation drift. Map reference regions to widths, alignment, type wrapping, spacing and crops at equivalent viewport/theme/state; resized screenshot pixels are not necessarily CSS pixels. Preserve original asset/license provenance and applicable third-party notices when reusing material; this guide grants no font, image or code rights.

## 5. Copy and complete state contracts

Read the complete path around a message. Use one term per concept, concrete verbs/objects, and tone proportionate to risk. “Delete project” is clearer than “Yes”; “Enter a date after today” gives recovery where “Invalid input” does not. Keep legal meaning, eligibility, scope, and irreversible consequences. Full messages belong to localization resources rather than concatenated fragments; see [i18n-head.md](i18n-head.md).

| State | Truthful content and behavior | Verification target |
| --- | --- | --- |
| Initial/first use | Explain what belongs here; offer a supported first action | New user can begin without prior product knowledge |
| Loading | Name the real operation; retain useful context; prevent duplicate writes when required | No fake countdown/progress or artificial delay; status communicated accessibly |
| Empty | Distinguish genuine zero data from first use and intentionally cleared data | Supported action, not a decorative dead end |
| No results | Retain query/filter context; offer clear/reset adjustment | Does not suggest creation when the task is searching |
| Error | Explain what is known, retain recoverable input, offer a real safe recovery | Failure is not displayed as zero results; retry does not duplicate an uncertain write |
| Success | Confirm the actual result and relevant next consequence | Local-only state says session-only; optimistic state is not claimed as persisted |
| Disabled | Explain the actual prerequisite near the control | Explanation remains available without hovering a disabled element |
| Permission | State the access boundary and genuine next option, without leaking protected content | Hiding a button is not authorization; backend remains authoritative |
| Interrupted/uncertain | Preserve draft/context where supported; distinguish cancellation, stale data and unknown outcome | Navigation/retry cannot silently overwrite or falsely confirm work |

Only implement states that the scoped flow actually needs, but do not omit failure/denied states to make the happy path appear complete. Use [forms.md](forms.md), [auth.md](auth.md), and the selected server-state reference for the real operation contract rather than inventing one in the UI.

### Task topology, recovery, and contextual learning

Map entry, decision evidence, destination, exit and return before rearranging screens. Use peer navigation for peer destinations, hierarchy for parent/child context and sequences only for dependent steps; retain visible location/selection and keep evidence beside the decision it supports. Separate nested row actions into distinct operable targets rather than placing a button inside another action.

Keep useful data during background refresh, distinguish initial load from pagination, and retain meaningful scroll/selection. Partial/stale content must identify what is missing; conflict recovery retains local work for compare/reload/resolve rather than silently overwriting it. Ignore/cancel obsolete query work so late responses cannot replace newer choices. Distinguish expired authentication from insufficient permission. An uncertain write result needs authoritative reconciliation before unsafe retry, and optimistic feedback needs credible rejection/rollback handling. These are UI obligations over the application's actual server-state contract, not authorization to invent offline queues.

Prefer truthful undo for safely reversible changes; disclose its implemented lifetime. Use proportionate object-specific confirmation for irreversible/high-impact actions and keep them away from habitual primary targets. Leaving dirty work needs distinct Save/Discard/Cancel behavior when loss is possible. Put eligibility, format, units and material consequences before submission; validate at useful moments, preserve entered/uploaded work on recoverable failure, and keep internal diagnostics out of primary error copy. Existing [forms.md](forms.md), [routing.md](routing.md) and [auth.md](auth.md) own validation, leave guards and access implementation.

Collect only information the actual task needs; explain the purpose of unfamiliar personal-data requests before entry. Reuse the project's glossary, keep helper text informative rather than restating labels, and do not strengthen privacy, saving or timing promises beyond implemented behavior. Retain currency, signs, units and time-zone meaning when formatting or shortening content.

Teach only what reaches a useful outcome: necessary setup, working templates/contextual examples, optional skippable/dismissible/replayable help and remembered dismissal where implemented. Request permissions when purpose is clear and preserve an honest denial path. Practice for consequential tasks must be identified as practice, never disguised as a real transaction.

## 6. Interaction, motion, and performance

Use native elements and established Vuetify behavior before building custom controls. Preserve browser navigation, text selection, focus feedback, touch scrolling, and keyboard activation. Drag-only, hover-only, and color-only information need accessible alternatives; [accessibility.md](accessibility.md) owns the requirements.

Motion should explain a relationship or acknowledge an operation, not delay task completion. Keep content present without an entrance sequence, permit interruption, and avoid moving the focus target during interaction. Respect reduced motion with an equivalent stable state, not a hidden result. Do not globally zero every animation if business logic depends on completion events; fix that dependency and target the relevant effects. Detailed implementation: [motion.md](motion.md).

Diagnose slow startup, typing, filtering, navigation, or scrolling separately. Reserve media dimensions, keep primary content available, avoid lazy-loading the initial LCP image, and defer genuinely noncritical work. Profile expensive effects and hot paths before memoization, virtualization, or architectural changes; preserve search, keyboard, printing, and full-content access. [virtualization.md](virtualization.md) owns large-list constraints.

[Core Web Vitals](https://web.dev/articles/vitals) good thresholds are LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1, assessed at the 75th percentile of visits with appropriate segmentation. One laboratory run cannot establish a field percentile. A skeleton improves feedback, not necessarily latency. Name build mode, runtime/device, network/cache conditions, data size, and equivalent before/after conditions when claiming improvement.

### Motion ownership and interruption

Choose the smallest existing mechanism that explains the relationship: transform/opacity for ordinary movement, FLIP/shared-element transitions for continuity, masks/occlusion for a meaningful reveal, and springs for manipulation rather than universal bounce. Starting timing ranges are 100–150 ms for immediate feedback, 150–300 ms for routine change, 300–500 ms for view/overlay continuity and occasionally 500–800 ms for an authored focal event; tune travel/frequency, let entrances settle and exits finish promptly, and cap total stagger. These are design recommendations, not library guarantees.

Real state is authoritative; give each animated property one owner. Reversal, repeated activation and navigation must interrupt without stale temporary styles, hidden tabbable controls or competing engines. Scope targets and release observers, timelines, frame callbacks and listeners on teardown or preference changes. Scroll-linked travel derives from current container geometry and refreshes when content changes; disabling pinning/effects must restore normal reading flow. Bound blur/shadows, promote layers with `will-change` only while useful, and pause nonessential loops offscreen/backgrounded. A 60 Hz frame offers about 16.7 ms and 120 Hz about 8.3 ms **for all frame work**, not an animation-only budget. Profile actual devices: transforms alone do not establish smoothness. Keep repeated-use feedback brief; celebration must not trivialize loss or delay a result.

### Performance investigation by symptom

Record the affected task, production/development build, runtime/hardware, network/cache warmth and data volume before choosing a remedy. Separate network, scripting, decode, layout and paint cost; compare repeated equivalent samples, not unrelated headline scores. Source-only hypotheses are not measurements.

| Observed bottleneck | Investigation and scoped correction | Preserve |
| --- | --- | --- |
| Late primary content | Inspect request waterfall, discovery and transfer; right-size media, split noncritical route/features and remove unused payload via the incumbent build | Immediate primary text/control access; no tiny-chunk waterfall or indiscriminate preload/prefetch |
| Font/content shifts | Compare fallback/loaded metrics, reserved media and asynchronous insertions | Script coverage, growing text, useful scroll context; no fixed height clipping to improve CLS |
| Slow typing/filtering | Trace long handlers/computation; keep typing immediate, debounce expensive work only when useful, reject obsolete results | Current query/result truth and recoverable input |
| Broad Vue updates | Inspect component update causes, stable props/keys and computed reuse; narrow state ownership before targeted memoization | Correct reactive dependencies, not `v-once` freezing live data |
| Layout/paint jank | Batch reads before writes, throttle repeated work or use observers, bound effects and avoid unnecessary layer promotion | Focus, browser scrolling and actual final layout |
| Long computation | Split interruptible work; move computation to a worker only when measured savings justify transfer/coordination overhead | Cancellation, result ordering and meaningful progress |
| Large collections | Paginate/incrementally fetch and virtualize only the rendering bottleneck | Selection, search over the claimed collection, full-content/AT/print path |
| Repeated navigation growth | Compare repeated mount/unmount and background lifetimes; release subscriptions, timers, observers, requests and frame work | Intended cached state and account-isolated data |
| Slow refresh/network | Reuse existing cache/deduplication/invalidation; cancel obsolete reads and avoid unnecessary embeds/third parties within scope | Protected data isolation, freshness after mutation and required capabilities |

Containment or deferred offscreen rendering needs explicit sizing, focus, find, printing and AT checks; hiding work is not equivalent to making information available. Use existing profiling/build facilities, not a parallel pipeline. [Vue performance guidance](https://vuejs.org/guide/best-practices/performance.html) distinguishes load/update cost and scoped optimization; [virtualization.md](virtualization.md), [architecture-data.md](architecture-data.md) and [setup-tooling.md](setup-tooling.md) own implementation detail. Stop when evidence no longer identifies an in-scope user-relevant bottleneck.

## 7. Keep the system continuous

Before changing a shared token/component, identify actual consumers and intentional variants, including dark theme, compact views, validation and pending states. Specify the needed contract, migrate every affected caller in the authorized cutover, and remove superseded styles, dead imports, duplicated components and obsolete examples. Do not leave two competing conventions or broaden a local change into unrelated cleanup.

Update the existing component catalog or system documentation when implemented knowledge is reusable. Explain roles, behavior, responsive constraints and justified exceptions; link authoritative values instead of maintaining another palette table. Distinguish observed conventions from proposed changes. A coherent system makes the next screen easier to build without requiring a hidden service or the original author's memory.

### Platform adaptation and alternate outputs

Identify the actual shipped runtime first: responsive Vue/Vuetify is web UI, not a native iOS/Android implementation. Preserve task, terminology, information architecture and business logic across platforms; rebuild presentation/navigation/accessibility at the native boundary instead of copying web chrome. The following are design/interop contracts, not unverified native SDK examples.

| Context | Adaptation contract |
| --- | --- |
| Mobile web and hybrid webview | Detect capabilities, not device names; hover/fine-pointer queries enhance but do not remove keyboard/touch paths. Account for browser chrome, safe-area insets, sticky actions and on-screen keyboard without hiding focused fields/errors. Use growing minimum viewport heights and choose stable/dynamic viewport units for the intended behavior. A readable `1rem`/16px body is a starting point, not a universal minimum; sub-16px inputs may cause focus zoom in iOS Safari. Keep core operation available when optional enhancements fail, without falsely promising a JavaScript SPA works without JavaScript. |
| iOS/iPadOS native | Use tabs for peer destinations, stacks/back navigation for hierarchy and sheets for focused subtasks; preserve system Back/edge-swipe and clear Cancel/Done. Keep controls inside safe/keyboard regions while backgrounds may extend. Use system text styles/Dynamic Type, meaningful native labels/traits/values, coherent symbols and appropriate grouped settings/pickers rather than imitated browser controls. Brand fonts/colors need scaling, dark/increased-contrast variants and reduced-motion support. Apple's current HIG lists **44 × 44 pt default** and **28 × 28 pt minimum** controls for iOS/iPadOS, not a universal 44pt minimum; aim for comfortable targets and spacing. |
| Android native | Use Material roles/control conventions where appropriate, bars for compact peer navigation and rails/drawers for wider windows; top app bars establish context and FABs serve a suitable primary action. Preserve system/predictive Back; distinguish history Back from hierarchy Up and dismiss transient UI without trapping or losing work. Respect edge-to-edge, gesture/IME insets without double-padding, scalable `sp` text, **48 × 48 dp** targets, TalkBack semantics and system motion settings. Dynamic Color needs an appropriate static fallback and cannot override binding brand requirements; critical errors need durable context beyond a snackbar. |
| Tablet, multi-window, foldable | Derive structure from available window constraints, not device identity. Switch single-pane/list-detail/sidebar arrangements without losing selection, drafts, return path or focus. Handle portrait/landscape, narrow split windows, keyboard/pointer input, hinge occlusion and supported posture changes. A large display does not imply fast hardware. |
| Print and email | Print reveals required hidden content, removes irrelevant controls, uses sensible page breaks and non-color chart distinctions. Email follows actual client-compatible markup/styles and links to complex web tasks; do not assume rich Vue interaction executes in an email client. |

Primary platform boundaries: [Apple navigation](https://developer.apple.com/design/human-interface-guidelines/navigation-and-search), [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Android accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility), [Android adaptive windows and continuity](https://developer.android.com/develop/ui/compose/layouts/adaptive/get-started-with-adaptive-apps). Do not substitute a browser mockup for native evidence. Proposed checks include actual native launch/frame pacing, image decode/recycling, repeated navigation memory, background/battery behavior, system text/contrast/motion settings, VoiceOver/TalkBack and supported back/gesture/posture paths; record emulator/simulator separately from hardware.

## 8. Verification and evidence matrix

The following is a **verification plan**, not a report of checks performed by this reference. Respect edit-only/read-only authority. Without runtime access, finish reachable source work and name missing observations; do not claim visual verification or production readiness.

| Evidence | What to record | What it does not prove |
| --- | --- | --- |
| Actual source | Current component/style/token/handler and state branch, with location | Rendered appearance, a successful interaction, or measured speed |
| Rendered | Current route, runtime, viewport/device, theme, state, loaded assets/fonts; opening and lower content | Submission, keyboard operation, persistence, or another viewport |
| Behavioral | Exercised entry→outcome path, focus movement, cancellation, recovery, data effect | Unexercised permissions, devices, or states |
| Measured | Resolved foreground/background, contrast result, accessibility-tree observation, profile and conditions | Screen-reader usability, universal compliance, or population performance |
| Inference | Explicitly labeled hypothesis and missing observation | Any observed pass/failure claim |

| Review slice | Representative cases | Acceptance observation |
| --- | --- | --- |
| Product/hierarchy | Primary path plus demanding real content | Subject, decision and next action clear; no invented claims |
| Layout | Reported width, narrow/wide content breakpoints, full scoped surface | No essential clipping or gratuitous scrolling; coherent grouping |
| System | Every affected consumer, theme, density and state | Same role has consistent treatment and behavior |
| Operation | Keyboard/pointer, touch where supported, errors and interruption | Real result, understandable recovery, meaningful focus/status |
| Accessibility | Contrast, scaling, reflow, names/roles, assistive technology | Evidence recorded against applicable criteria, not scanner-only approval |
| Performance | Relevant cold/warm load and interaction traces | User task improves under equivalent conditions without regressions |

Current captures must name route/state/theme/freshness. A stale screenshot establishes only historical appearance. Refresh affected observations after relevant code/assets/fonts/dependencies change; retain unrelated evidence. Correct blocked tasks, inaccessible controls, false claims and data-loss risks before ornamental defects. Stop speculative redesign once the scoped outcome holds; disclose exact missing fixtures, access or device coverage rather than inventing a pass.

Before using captures, confirm the intended route/state is shown, not an incidental login, challenge or server error. Let normal loading/motion settle while separately inspecting intentional transition states, ensure fonts/assets actually loaded, and open captures to detect blank regions, clipping or incorrect scroll position. Compare the whole scoped surface and demanding content, not only the opening view; omit temporary inspector overlays. Reinspect after causal corrections until requirements hold or an exact missing prerequisite blocks them; do not invent a fixed pass ceiling, speculative fault-injection framework, or numerical score that averages away a blocked task. Stop temporary inspection resources you created, preserving user-owned resources.

## Sources

- [Vue 3.5.44 registry metadata](https://registry.npmjs.org/vue/3.5.44); [Vue accessibility guidance](https://vuejs.org/guide/best-practices/accessibility.html).
- [Vuetify 4.3.0 registry metadata](https://registry.npmjs.org/vuetify/4.3.0); [theme docs](https://vuetifyjs.com/en/features/theme/); [4.3.0 theme source/types](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/theme.ts).
- [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/), with criterion-specific evidence in [accessibility.md](accessibility.md).
- [Google Web Vitals: metrics, thresholds and field interpretation](https://web.dev/articles/vitals).
- [CSS Color 4 color spaces and gamut handling](https://www.w3.org/TR/css-color-4/); [responsive image descriptors and selection](https://web.dev/learn/images/descriptive); [font delivery, display and fallback metrics](https://web.dev/articles/font-best-practices).
- [Vue load/update performance](https://vuejs.org/guide/best-practices/performance.html); [Apple HIG accessibility and current platform size table](https://developer.apple.com/design/human-interface-guidelines/accessibility); [Apple navigation](https://developer.apple.com/design/human-interface-guidelines/navigation-and-search).
- [Android accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility); [adaptive windows, posture, input and continuity](https://developer.android.com/develop/ui/compose/layouts/adaptive/get-started-with-adaptive-apps).
