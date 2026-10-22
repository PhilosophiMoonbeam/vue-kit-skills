# Accessible Vue and Vuetify operation

Read for semantics, forms, keyboard/focus, overlays, contrast, scaling, responsive access, and nonvisual alternatives. Baseline: **Vue 3.5.44; Vuetify 4.3.0**, stable; **WCAG 2.2** is the standards target, not a library certification. This reference emphasizes common implementation risks; it is not an exhaustive conformance audit or legal opinion. A WCAG AA claim requires all applicable A and AA criteria, full pages and complete processes, not just the controls below. [Design-system.md](design-system.md) owns visual/product decisions; [testing.md](testing.md) owns automation.

For an existing or explicitly selected OpenVue application, pair these process-level requirements with [forms/control forwarding](openvue-forms.md#labels-messages-and-forwarding), [overlay focus and lifetime](openvue-overlays.md#dialog-drawer-popover-focus-and-dom-lifetime), [navigation semantics](openvue-navigation.md), and [theme/RTL/contrast boundaries](openvue-theming.md#rtl-contrast-focus-and-acceptance-boundaries) only as needed. Component defaults are not a conformance claim.

## 1. Start with the actual task and DOM

1. Identify the complete user process, changed components, supported input methods, locales/themes and consequential states. Preserve working platform affordances and the incumbent architecture.
2. Prefer semantic HTML and established component behavior. Inspect the rendered DOM/accessibility tree when authorized: a component's name is not its emitted role.
3. Define keyboard interaction, accessible name/state, error/status communication and focus transitions before styling the happy path.
4. Evaluate actual colors and dimensions in all affected states and themes. Do not infer contrast from a palette name, an unresolved CSS variable, or a screenshot's anti-aliased text pixels.
5. Exercise manual paths and appropriate assistive technology alongside automation. A clean scanner report cannot establish full accessibility or task usability.

### Semantics and information

| Intent | Implementation | Common failure |
| --- | --- | --- |
| Navigation | Real links with meaningful destinations; distinguish navigation landmarks when multiple exist | `div` click handler, dead `href="#"`, or button replacing an ordinary link |
| Action | Native button or a component emitting equivalent button semantics; explicit `type` in forms | Generic element plus `role="button"` without keyboard behavior |
| Page organization | Main landmark, useful headings, labeled navigation; working skip link to main content | Heading levels chosen only for size; duplicate main landmarks |
| Field | Persistent visible label, programmatic association, actual required state, instructions/units | Placeholder-only label; `aria-label` overwriting visible wording |
| Toggle/disclosure | Accurate `aria-pressed` or `aria-expanded` for the relevant pattern | Color or icon change without exposed state |
| Image/icon | Useful alternative for meaning/function; empty `alt` for decorative images; hide redundant decorative SVG/icon from AT | Filename as alternative; decorative icon announced beside an already clear button label |
| Tabular relationship | Native table, caption, header cells and appropriate scope/associations | Styled layout grid pretending to be a data table, or ARIA grid without grid keyboard behavior |

The accessible name must include the visible label text ([2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)); avoid unrelated `aria-label` replacements. Repeated icon-only controls need names with sufficient object context, such as “Delete draft: Q4 forecast.” Tooltips are supplemental, not the sole name or sole route to essential information. Content appearing on hover/focus needs applicable dismissible, hoverable and persistent behavior ([1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)).

Use `useId()` during setup for reusable field/dialog IDs, not random/time-based IDs or IDs generated inside computed getters. IDs are stable across Vue SSR/client rendering; multiple Vue apps can use `app.config.idPrefix`. [Vue helpers API](https://vuejs.org/api/composition-api-helpers.html#useid).

## 2. Contrast: apply the actual scope and exceptions

| Criterion | Required threshold | Scope and exceptions |
| --- | --- | --- |
| [1.4.3 Contrast (Minimum), AA](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | **4.5:1** normal text; **3:1** large text | Includes meaningful text, placeholder/help/error text and images of text. Large means at least 18 pt = 24 CSS px, or 14 pt ≈18.67 CSS px bold; do not classify by the HTML heading tag. Exceptions include inactive components, pure decoration/incidental text and logotypes under the criterion's definitions. Ordinary brand-colored UI copy is not exempt. |
| [1.4.11 Non-text Contrast, AA](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | **3:1** against adjacent colors | Applies to visual information required to identify active UI components/states and graphical parts required to understand content. Inactive controls and unmodified user-agent appearance are excepted; essential graphical presentation has an exception. Decorative separators, card borders and nonessential shadows need not all reach 3:1. |
| [1.4.1 Use of Color, A](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | No universal contrast-ratio substitute | Do not communicate errors, selection, required fields or chart series by hue alone. Use text, shape, pattern, position plus a programmatically available state as appropriate. Underlines are a robust default for inline links. |

Measure the **resolved** foreground and background, including alpha compositing, emphasis opacity, scrims, state layers, image/gradient regions, and supported themes. Report the pair and state; if a background or variable is unresolved, the result is unknown. Use the WCAG relative-luminance contrast calculation, `(Llighter + 0.05) / (Ldarker + 0.05)`, for these thresholds. Do not round a failing result into a pass: 4.499:1 fails 4.5:1; 2.999:1 fails 3:1. Thin fonts/lines may warrant additional margin for practical legibility even when the nominal colors pass.

A visible text label may identify a button without a 3:1 boundary; an input whose boundary is needed for identification must have an adequate cue. Required checks, slider thumbs, selected-state marks, and custom focus indicators need their applicable adjacent-color evaluation. 1.4.11 does **not** require 3:1 between a component's nonadjacent normal and hover-state colors. Supplemental hover decoration need not itself contrast 3:1, but must not erase required contrast. Disabled-control exemptions do not exempt a separate essential explanation or excuse making the workflow incomprehensible.

Vuetify can generate on-colors and state layers; this is not evidence that customized labels, icons and every state satisfy contrast. Use semantic roles and verify rendered combinations; see [vuetify-theme.md](vuetify-theme.md).

## 3. Targets, gestures, and keyboard

[WCAG 2.2 SC 2.5.8 Target Size (Minimum), AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) requires a pointer target of at least **24 × 24 CSS pixels**, with these exceptions:

- **Spacing:** for each undersized target, a 24 CSS-pixel-diameter circle centered on its bounding box must not intersect another target or the corresponding circle of another undersized target. “24 pixels between centers” alone is not sufficient when a neighboring target is large.
- **Equivalent:** another control on the same page achieves the same function and meets the criterion.
- **Inline:** a target in a sentence, or constrained by the line height of non-target text.
- **User agent control:** target size is determined by the browser and has not been modified by the author.
- **Essential:** the presentation is essential or legally required for the information conveyed; apply this narrowly, not as an excuse for dense toolbars.

Measure the actual operable region, not the icon glyph or a decorative box. Size compliance requires the target to contain an axis-aligned 24 × 24 CSS-pixel square; rounded/irregular shapes may need the spacing exception. Overlapping different actions cannot both claim the same hit region. Zoom does not change the CSS-pixel requirement. Aim for comfortable primary touch targets, often about 44 CSS pixels or larger, when product use warrants it; this is a design recommendation, **not** a universal AA minimum. The separate [2.5.5 Enhanced criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) is AAA and uses 44 × 44 with its own exceptions.

- Every function needs keyboard access unless the underlying function inherently depends on the movement path ([2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)). Preserve expected native Enter/Space activation; do not install conflicting global shortcuts or positive `tabindex` sequences.
- Tab/Shift+Tab should follow meaningful DOM order, not a CSS-reordered visual sequence. Composite widgets may use arrow keys/roving tabindex only with the correct pattern, names and selected states; see [headless-ui.md](headless-ui.md).
- Provide single-pointer alternatives to multipoint/path-based gestures and dragging where required. [2.5.7 Dragging Movements, AA](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) requires a **single-pointer method without dragging**, unless essential or unmodified user-agent behavior; a keyboard-only reorder shortcut does not by itself satisfy this criterion. “Move up/down” buttons can satisfy both needs.
- Respect pointer cancellation; do not trigger irreversible actions merely on pointer-down. Handle lost capture, interrupted drags and scrolling over controls without stranding state or trapping page scroll.
- Do not require a single screen orientation unless essential; do not suppress browser zoom or pinch-to-zoom to protect a layout.

### Custom pointer-control lifecycle

Prefer the incumbent accessible slider/drag implementation. If a custom gesture is actually required, own one initiating `pointerId`, ignore unrelated pointers, and use pointer capture when movement must continue outside the initial target. For a horizontal control inside a vertically scrolling page, declare a suitable `touch-action` such as `pan-y pinch-zoom` **before** interaction so page-axis panning and pinch zoom remain possible; changing it after pointer-down does not renegotiate the active gesture. Do not apply `touch-action: none` across a page to make a local control easier.

Commit only the intended completed operation. Treat `pointercancel`, `lostpointercapture`, surface teardown and window-focus loss as cleanup paths; release capture/listeners and reset transient drag state without pretending cancellation completed a mutation. Make pointer-up outside the initial hit region and the next gesture work. Test tap, intentional drag, scroll across, second-pointer interference, cancellation and recovery separately; a screenshot or pointer-down event proves none of these. Keep the no-drag single-pointer and keyboard alternatives from this section available throughout. [Pointer Events standard](https://www.w3.org/TR/pointerevents3/), [pointer capture/cancellation and touch-action explanation](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).

## 4. Focus, navigation, and dialogs

Visible focus is required by [2.4.7, AA](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html). Do not remove outlines without an adequate replacement. Custom focus indicators need applicable non-text contrast. [2.4.11 Focus Not Obscured (Minimum), AA](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) requires that a focused component is **not entirely hidden** by author-created content. Prefer keeping it fully visible, including under sticky headers, banners and toolbars; that stronger outcome is not the exact AA minimum. Use appropriate scroll padding/margins and verify zoomed layouts. [2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) has additional area/contrast requirements at **AAA**; do not present its geometry as a universal AA rule.

After full route changes, provide meaningful page title and predictable focus/announcement, such as focusing the new main heading after rendering. Do not reset focus for every query-string update, filter change or keystroke. After removing the focused item, move to a logical surviving control rather than the document body. Route scroll restoration and focus management need coordination; see [routing.md](routing.md).

For modal dialogs follow the [WAI-ARIA APG dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):

WCAG success criteria and normative ARIA requirements define conformance; the [APG is informative, not a separate conformance standard](https://www.w3.org/WAI/ARIA/apg/about/introduction/#apg-is-not-a-normative-standard). The pattern below is the recommended implementation contract, not a claim that WCAG mandates every listed tactic. In particular, a visible close button is strongly recommended by APG, while the appropriate initial/return focus target depends on content and workflow. Record the applicable criterion and observed failure separately from departures from a recommended pattern.

1. Give the dialog an accessible name tied to its visible title; associate a short simple description when useful. Do not flatten complex structured content into one `aria-describedby` announcement.
2. Move focus inside on opening. For destructive final steps, the least destructive action is often appropriate; for long structured content, a `tabindex="-1"` heading/intro can preserve reading context.
3. Contain Tab/Shift+Tab while modal, and prevent interaction with the background. `aria-modal="true"` is a semantic statement, not a focus trap or an implementation of inertness.
4. Provide a visible closing/cancel control. Escape should ordinarily dismiss. Do not set `persistent` on every Vuetify dialog merely to simplify state management; intentional blocking requires a usable, explained exit/workflow.
5. Restore focus to the invoker when it survives, otherwise a logical workflow destination. Exercise both cancel and confirm, nested overlays, and browser back where applicable.

Vuetify **4.3.0** `VDialog` defaults `captureFocus` and `retainFocus` to true, sets dialog semantics, and restores its registered activator on close. Bind **all** activator-slot props, not only `onClick`; they register the element and accessibility behavior. These are distinct capabilities; do not treat `retain-focus` alone as the complete focus-trap contract. Default behavior is useful source evidence, not proof that custom teleports, third-party editors or wrapper markup work correctly. [Exact VDialog source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDialog/VDialog.tsx), [VDialog API](https://vuetifyjs.com/en/api/v-dialog/).

Put `aria-labelledby`/`aria-describedby` on `VDialog` itself: in 4.3.0 its root owns `role="dialog"`. `content-props` labels a nested generic container and does **not** name that dialog. Inspect the emitted native field's required/invalid state and error association as well; visible validation messages alone do not establish those semantics.

### Nested overlays and native-dialog interop

Debug the actual layer and focus tree before increasing `z-index`. A native `<dialog>` opened with `showModal()` enters the browser top layer and makes outside document content inert; an ordinary body-teleported popup cannot escape that boundary merely with a larger `z-index`. Keep nested editors, pickers and their popup targets inside the active modal's usable subtree, or use the existing library's documented compatible overlay integration. Do not disable containment or suppress propagation globally to accommodate an inspector or an out-of-tree control. [HTML dialog semantics and modal algorithm](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element).

On nested close, restore focus within the still-open parent, then to the surviving invoker/workflow destination when the parent closes. Only the topmost applicable overlay should process dismissal; two active traps must not compete. Diagnose invisible-but-focusable nodes, transformed/clipped ancestors, detached activators and stale listeners after close/reopen. Exercise child-then-parent dismissal, keyboard/pointer use and reopened dialogs. With native `<dialog>`, use `close()` rather than manually removing `open`, which can leave the document blocked; this native lifecycle is distinct from a Vuetify `v-model` overlay. Do not assume every component named dialog uses the browser top layer.

## 5. Labels, errors, status: focused runnable example

This is a complete SFC for a **local, in-memory session note**, not a storage/network implementation. Mount it under the installed Vuetify `VApp`, with `vuetify/styles` loaded as in [vuetify-setup.md](vuetify-setup.md). It uses explicit component imports, native label/error associations, Enter submission, a persistent live region, and a named reset dialog with Cancel focus. Reset deliberately clears both draft and retained note; the invoker remains available for focus restoration. It does not manufacture loading or failure states for a synchronous operation.

```vue
<script setup lang="ts">
import { nextTick, ref, useId, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard, VCardActions, VCardText } from 'vuetify/components/VCard'
import { VDialog } from 'vuetify/components/VDialog'

const id = useId()
const draft = ref('')
const note = ref<string | null>(null)
const error = ref('')
const status = ref('')
const resetOpen = ref(false)
const field = useTemplateRef<HTMLInputElement>('field')
const cancel = useTemplateRef<HTMLButtonElement>('cancel')

async function keepNote() {
  error.value = ''
  if (!draft.value.trim()) {
    error.value = 'Enter note text before keeping the note.'
    status.value = ''
    await nextTick()
    field.value?.focus()
    return
  }
  note.value = draft.value.trim()
  status.value = 'Note kept for this session only. Reloading removes it.'
}

function resetNote() {
  draft.value = ''
  note.value = null
  error.value = ''
  status.value = 'Session note and draft cleared.'
  resetOpen.value = false
}
</script>

<template>
  <section :aria-labelledby="`${id}-heading`" class="note-panel">
    <h2 :id="`${id}-heading`">Session note</h2>
    <form novalidate @submit.prevent="keepNote">
      <label :for="`${id}-text`">Note text (required)</label>
      <p :id="`${id}-help`">Kept in memory on this page, not saved to a server.</p>
      <input
        :id="`${id}-text`"
        ref="field"
        v-model="draft"
        name="note"
        type="text"
        required
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="`${id}-help${error ? ` ${id}-error` : ''}`"
        @input="error = ''"
      >
      <p v-if="error" :id="`${id}-error`">{{ error }}</p>
      <VBtn type="submit">Keep session note</VBtn>
    </form>
    <p v-if="note !== null" class="note-value">{{ note }}</p>
    <p v-else>No note kept in this session.</p>
    <p role="status" aria-atomic="true">{{ status }}</p>
    <VDialog
      v-model="resetOpen"
      max-width="480"
      :aria-labelledby="`${id}-reset-title`"
      :aria-describedby="`${id}-reset-description`"
      @after-enter="cancel?.focus()"
    >
      <template #activator="{ props }">
        <VBtn v-bind="props" type="button">Reset session note</VBtn>
      </template>
      <VCard>
        <VCardText>
          <h2 :id="`${id}-reset-title`">Reset session note?</h2>
          <p :id="`${id}-reset-description`">This clears the note and draft on this page.</p>
        </VCardText>
        <VCardActions>
          <button ref="cancel" type="button" @click="resetOpen = false">Cancel</button>
          <VBtn type="button" @click="resetNote">Clear note and draft</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>

<style scoped>
.note-panel { min-inline-size: 0; }
.note-panel input { inline-size: 100%; max-inline-size: 32rem; font: inherit; }
.note-value { overflow-wrap: anywhere; }
</style>
```

For real asynchronous submissions, use actual pending/error/success state, prevent duplicate writes as required, preserve input after failure, and announce outcomes truthfully; see [forms.md](forms.md). `aria-busy` can identify the updating region but does not replace a useful status message. Native `disabled` removes ordinary focus/activation; explain prerequisites in reachable text, not only a tooltip on the disabled control. `aria-disabled` alone does **not** prevent activation: enforce it in behavior when that pattern is deliberately needed.

Use `aria-describedby` for help/error associations and `aria-invalid` when validation actually identifies invalid input. Provide textual error identification and suggestions when known, without guessing causes. For long forms, a focused error summary with links to fields may be preferable to focusing one field. Do not clear recoverable input on failure. Use correct input type, autocomplete and inputmode for the task; retain paste, password-manager and assistive entry support. Authentication has additional [WCAG 2.2 accessible-authentication requirements](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html); see [auth.md](auth.md).

[4.1.3 Status Messages, AA](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) covers programmatic announcement of relevant waiting/result/error status without moving focus. A mounted `role="status"` region is suitable for routine completion; reserve `role="alert"` for appropriately urgent information. Do not nest live regions, announce every keystroke/loading tick, or duplicate the same error via focus, alert and toast. A changed list is not automatically a status message, but “18 results” is. A toast is not the only place essential recovery or persistent failure details should exist. Announcement behavior still needs AT observation.

## 6. Text scaling, reflow, direction and localization

- [1.4.4 Resize Text, AA](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html): text can resize to **200%** without loss of content/functionality, without AT; captions and images of text have the criterion's exceptions. Use relative font sizes and growing containers; do not disable user zoom or shrink the root font to evade scaling.
- [1.4.10 Reflow, AA](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): vertically scrolling content must work at **320 CSS pixels** equivalent width without loss or two-dimensional scrolling; horizontally scrolling content uses **256 CSS pixels** equivalent height. A 1280 CSS-pixel viewport at 400% zoom is the common vertical-content test. Narrow responsive layout and desktop zoom are related but not identical runtime observations.
- Apply the reflow exception to parts that actually need two-dimensional layout, such as maps and data tables, not the entire page. Table cells still need appropriate text reflow. A contained, keyboard-operable scroll region can preserve a comparison task better than removing essential columns; make its purpose and full content discoverable.
- [1.4.12 Text Spacing, AA](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html): no content/function loss when users set line height ≥1.5× font size, paragraph spacing ≥2×, letter spacing ≥0.12× and word spacing ≥0.16× simultaneously. These are **override-resilience values**, not mandatory authored typography. Apply the standard's language/script exceptions for properties not used by that script.
- Avoid fixed text heights, absolute-positioned error overlays, nowrap primary actions, and clipped consent/instructions. Truncation needs an accessible route to the full value; hover-only disclosure is insufficient. Test short, long, missing and unbroken strings, real translations and script-appropriate fonts.
- Set page `lang` accurately and mark relevant language changes. Use locale-aware formatting/plurals and full translated messages, not concatenated English syntax. Preserve real currency/time-zone semantics. See [i18n-head.md](i18n-head.md).
- Use logical properties (`margin-inline`, `padding-block`, `text-align: start`), an intentional `dir` context and isolation such as `<bdi>` for mixed-direction user content. Mirror directional navigation where appropriate, not every logo, media-control symbol, number or chart. Verify keyboard, reading order and clipped text in actual RTL locales; CSS mirroring alone is insufficient.

## 7. Motion, charts and equivalent information

Honor `prefers-reduced-motion: reduce` by removing/replacing nonessential spatial movement while preserving content, feedback and completion. Do not hide an element by default and rely on an animation to reveal it. A **contextual CSS fragment** for an authored decorative entrance effect:

```css
.result-panel { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
  .result-panel { animation: result-enter 160ms ease-out; }
}
@keyframes result-enter {
  from { opacity: 0; transform: translateY(0.25rem); }
  to { opacity: 1; transform: translateY(0); }
}
```

This fragment does not disable library transitions, programmatic smooth scrolling, canvas animation or every effect in an app. Check those separately using the selected library's controls; [motion.md](motion.md) owns APIs. [2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) is **AAA**, not a general AA reduced-motion criterion. A/AA still include applicable flash limits and pause/stop/hide requirements for moving content. Avoid flashing and uncontrolled auto-motion; reduced-motion support does not by itself establish those criteria.

For charts/diagrams, provide a useful name plus text explaining the important finding and an equivalent route to the underlying information (often a visible or discoverable data table). Include units, period, missing values, filtering scope and uncertainty where material. Distinguish series with labels/patterns/markers as well as color; required graphical parts need applicable contrast. Hover-only tooltips and a generic “chart” alternative are inadequate. Keyboard users need equivalent access to any essential point selection/filtering, not thousands of unnecessary focus stops.

Use real table markup and relationships for a tabular alternative; sortable headers should expose `aria-sort` on the appropriate header and an operable sorting control. Virtualization can remove rows from the accessibility tree and from browser find/printing; provide a suitable accessible reading/pagination/export path rather than declaring the visual viewport a complete alternative. See [visualization.md](visualization.md), [data-tables.md](data-tables.md), [virtualization.md](virtualization.md) and [tresjs.md](tresjs.md) for library-specific boundaries. Canvas/3D visuals do not become accessible merely by adding a label to the canvas.

For audio/video and auto-updating regions, identify applicable media alternatives and timing controls rather than treating a reduced-motion preference as sufficient: relevant captions, transcripts or audio description; usable pause/stop and mute/volume controls; no essential audio-only feedback. Do not autoplay sound or force a person to complete a time-limited educational overlay without a supported adjustment/exit. Native and hybrid work additionally needs actual system text/contrast/motion settings and VoiceOver/TalkBack observation; web emulation is not native evidence. [WCAG 2.2 media, timing and moving-content requirements](https://www.w3.org/TR/WCAG22/), [platform adaptation contracts](design-system.md#platform-adaptation-and-alternate-outputs).

## 8. Verification matrix and claims

This matrix specifies **checks to perform when authorized**, not checks already performed. Record each applicable row as observed pass, observed defect, unobserved, or not applicable with a reason; do not convert “unobserved” into a pass.

| Check | Exercise / measure | Required record |
| --- | --- | --- |
| Semantics | Inspect actual DOM/tree for landmarks, headings, names, roles, values and states | Route/component/state; observed associations and mismatches |
| Keyboard | Entire changed task using Tab/Shift+Tab, activation, composite keys and Escape | Focus order, visible indicator, no trap; actual result |
| Dialog | Open, cycle forward/back, cancel, confirm; surviving/removed invoker; background access | Initial focus, modal containment, exit and restoration |
| Forms | Empty/invalid submission, recovery, async failure/pending where real, repeated submission | Preserved input, linked error, meaningful announcement, truthful outcome |
| Contrast | Resolved text/icon/boundary/focus pairs across themes and active states | Color pair/compositing context, exact ratio, applicable threshold/exception |
| Targets/gestures | Actual hit regions and spacing; touch/pointer operation; no-drag alternative | CSS dimensions or specific exception; complete interaction, not pointer-down only |
| Scaling/reflow | 200% text resize, 320px/256px effective dimension as applicable, spacing overrides | Runtime/zoom/viewport; full-content and action access; scoped 2D exceptions |
| Localization | Long real translations, mixed-direction strings, correct locale/language | RTL reading/focus order, formatting, label growth, font coverage |
| Motion | Normal/reduced preference; interruption, loading, nonanimated outcome | Effects actually observed and any untested library/canvas behavior |
| Nonvisual content | Images, chart/table alternatives, meaningful dynamic updates | Equivalent information/action available; actual AT reading where exercised |
| Assistive technology | Primary task in relevant browser/screen-reader combinations | Exact browser/AT/platform versions and observed result |
| Automation | Applicable scanner, component and browser assertions | Tool/version/scope and findings; never a universal compliance certificate |

Separate **actual-source evidence** (current markup/handler/style exists), **rendered evidence** (named runtime/viewport/theme/state), **behavioral evidence** (an exercised transition and result), and **measured evidence** (contrast, dimensions, tree observation or profile with conditions). A tree observation is not a screen-reader test; a screenshot is not keyboard proof; emulated touch is not a real-device/Safari test. Identify stale captures and refresh affected evidence after relevant edits. Label unobserved conclusions as inference.

When runtime inspection is prohibited or unavailable, report source-level completion and exact missing runtime/device/fixture observations. Do not perform unsafe real transactions to prove accessibility. Prioritize blocked tasks, traps, false success, lost input and unavailable alternatives; never average them away with a numerical score. A component library, scanner or one manual pass cannot justify “fully accessible” or unrestricted WCAG conformance claims.

## Sources

- [WCAG 2.2 Recommendation and conformance requirements](https://www.w3.org/TR/WCAG22/); criterion-specific W3C Understanding links above explain scope and exceptions.
- [WAI-ARIA APG modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/); [WAI table tutorial](https://www.w3.org/WAI/tutorials/tables/); [WAI complex-images guidance](https://www.w3.org/WAI/tutorials/images/complex/).
- [Vue 3.5.44 registry metadata](https://registry.npmjs.org/vue/3.5.44); [Vue accessibility guide](https://vuejs.org/guide/best-practices/accessibility.html); [useId/useTemplateRef API](https://vuejs.org/api/composition-api-helpers.html).
- [Vuetify 4.3.0 registry metadata](https://registry.npmjs.org/vuetify/4.3.0); [VDialog API](https://vuetifyjs.com/en/api/v-dialog/); exact [VDialog](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDialog/VDialog.tsx) and [VOverlay](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VOverlay/VOverlay.tsx) implementations.
- [Platform reduced-motion media query](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
- [HTML Standard: dialog, top layer and modal lifecycle](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element); [Pointer Events standard](https://www.w3.org/TR/pointerevents3/); [pointer capture, cancellation and touch-action](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).
