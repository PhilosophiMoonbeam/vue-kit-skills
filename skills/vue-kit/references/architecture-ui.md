# UI architecture: one interaction owner across the stack

## When to read and version boundary

Read when a screen combines Vuetify, design tokens, forms, overlays, tables/charts, motion, or localization. This is **authored synthesis**: it chooses responsibility and interaction protocols; library guarantees are linked separately. Baseline **Vue 3.5.44** and **Vuetify 4.3.0**. Additional libraries are conditional capabilities, not a default installation list; use their specialist reference's exact version/status before importing them. Do not migrate an incumbent UI framework during a narrow feature task.

Start with [application architecture](architecture.md) for feature/deployment boundaries; [data architecture](architecture-data.md) owns server-state and save concurrency. Here the unit of design is a complete user interaction, including focus, interrupted work, reduced motion, and narrow layouts—not a collection of component demos.

For new or existing Nuxt applications, [Nuxt](nuxt.md) owns pages/layouts, SSR and hydration; [Nuxt integrations](nuxt-integrations.md) owns the selected Vuetify setup. Reuse component/interaction contracts here, not standalone `main.ts`, manual router installation, or app-wide plugin factories.

## Compose capabilities without duplicating ownership

| Requirement | Mechanism (synthesis) | Rejected alternative and consequence | Specialist route |
| --- | --- | --- | --- |
| Consistent controls and responsive workspace | Vuetify components and incumbent semantic tokens; add only missing roles | Combining full frameworks or adding a parallel token layer creates competing defaults, themes, CSS and overlay behavior | [Vuetify setup](vuetify-setup.md), [components](vuetify-components.md) |
| Product-specific hierarchy and density | Semantic tokens, typography roles, purposeful layout and stable component policies | Styling every screen independently produces inconsistent error/focus/state behavior | [design system](design-system.md), [Vuetify theme](vuetify-theme.md) |
| An uncommon accessible interaction | First assess the existing component; then one headless primitive/positioner where a real gap exists | Adding Reka/Floating UI just for a different look duplicates responsibility | [headless UI](headless-ui.md) |
| Enter/leave or list movement | Built-in Vue transition or existing component transition first | Several animation engines writing one element's transform create timing and cleanup conflicts | [motion](motion.md) |
| Data-heavy editable list | Existing Vuetify table for its supported needs; headless table only for a justified modeling/control gap | A second table state machine duplicates sort/filter/selection; row count alone does not choose a library | [data tables](data-tables.md) |
| Measured DOM/memory bottleneck | Virtualization with explicit keyboard/measurement policy | Virtualization is not server pagination, permission filtering, or a full accessibility strategy | [virtualization](virtualization.md) |
| Understandable analytical view | One chart engine, derived presentation model, text summary and equivalent data access | Decorative charts or pointer-only tooltips conceal meaning and exclude users | [visualization](visualization.md) |
| Actual 3D interaction | TresJS only when spatial content is required | WebGL decoration adds loading, fallback, lifecycle and access costs | [TresJS](tresjs.md) |
| Translated interface and route metadata | One locale/direction coordinator; app and component catalogs follow it | Updating text but not RTL, dates, charts, validation and page title yields a mixed-locale screen | [i18n and head](i18n-head.md) |
| An established OpenVue or Quasar application | Extend its existing components, token system and interaction owners | Preferred-stack migration can dominate an unrelated feature | [OpenVue ownership](openvue.md), [Quasar](alternative-ui.md) |

Vuetify preference is a project default, not an assertion that every component meets every accessibility requirement. A headless primitive provides behavior only within its own documented contract; a positioner computes placement, not complete menu semantics. Evaluate the assembled interaction.

## Assign one owner to each interaction boundary

**Synthesis:** one owner means one authority for open/close, commit/cancel, and focus policy. It does not forbid a library component from implementing its internal mechanics.

| Boundary | Owner | Public contract | Keep out of that contract |
| --- | --- | --- | --- |
| Screen intent | Route/screen coordinator | Normalized view, domain navigation actions | DOM nodes, pointer movement, internal validation refs |
| Edit workflow | Editor/form | Initial snapshot, typed save command, semantic outcome/dirty status | Mutable query-cache objects or whole app stores |
| Modal interaction | One overlay owner using one dialog implementation | Open/close intent, current step, close eligibility, logical return target | Second independently active focus trap for the same surface |
| Shared selection | Nearest feature owner whose lifetime matches selection | Stable IDs and select/clear operations | Implicit selection by visual row index |
| Table rendering | Table component/model | Rows, stable row identity, controlled state where external ownership is required | A hidden second route-filter source |
| Chart interaction | Chart component | Domain selection intent and accessible description | Mutation of list cache or router from low-level drawing callbacks |
| Motion | Owning UI/composable and one engine per property | State transition and reduced-motion policy | Business completion waiting on an entrance animation |
| Locale/theme | Application presentation coordinator | Resolved locale/direction/theme and semantic tokens | Independent per-widget locale or color truth |

Place DOM refs, resize observers, focus, drag listeners and cleanup with the UI that owns them. Do not move them into a global Pinia store for convenience. If descendants share a capability, provide a typed scoped instance at their actual owner; do not inject an entire screen controller. [Components](components.md) and [composables](composables.md) own those patterns.

The route/feature creates the overlay interaction instance; opening allocates an edit-session identity, not another global controller. Closing retires that identity and its delayed UI effects. The UI owner must disconnect observers and remove external listeners/subscriptions on unmount; Vue does not automatically dispose arbitrary DOM resources. [KeepAlive deactivation](https://vuejs.org/guide/built-ins/keep-alive.html#lifecycle-of-cached-instance) is not unmount: define suspend/close behavior and resume only the still-current interaction. See [composable side-effect cleanup](https://vuejs.org/guide/reusability/composables.html#side-effects). Neither path undoes a server write. Scope-loss disposal follows [data architecture](architecture-data.md#tenant-switch-logout-and-permission-loss-protocol).

### Overlay protocol and focus ledger

For every modal or popup, record: opener, semantic name, initial focus, keyboard behavior, scroll/portal container, close routes, pending-work policy, and return-focus fallback. This small ledger exposes composition bugs before CSS tuning.

- Bind Vuetify activator slot props to the actual interactive activator. They carry handlers and accessibility attributes; manually toggling `open` is not an equivalent replacement for the full activator relationship.
- For a modal, choose initial focus deliberately: short confirmation often favors Cancel; long structured content may favor a focusable heading. Do not announce a whole complex dialog through one enormous `aria-describedby` string.
- Make Cancel/Close visible. Decide what Escape, outside click, browser Back, explicit close, and route navigation mean for dirty and pending states. A persistent dialog still needs an operable, truthful exit policy.
- A dirty-close confirmation can replace the editor's content/step within the same modal owner. Do not casually mount a second framework's dialog on top and let two focus managers race. If nested dialogs are genuinely required, specify their stack and focus-return protocol using supported primitives.
- Keep popups from selects/date pickers inside the chosen overlay's supported composition model. Check portal ancestry, clipping, z-index, scroll lock, inertness, outside-click and focus retention together. A z-index increase cannot fix broken ownership.
- On close, return focus to the opener when it still exists and is usable. If the save removed its row or changed the page, choose a surviving row action, list heading, or toolbar action consistent with the task. Never restore focus to hidden/retired tenant content.

These behavior goals follow the [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Vuetify **4.3.0** supplies dialog focus capture/retention defaults and activator return-focus behavior in its [distributed VDialog implementation](https://unpkg.com/vuetify@4.3.0/lib/components/VDialog/VDialog.js); it cannot choose the application's fallback when the original row disappears. A library's default focus action is not evidence that the whole workflow was exercised.

## Worked design: support inbox, editor, chart, and localized table

**Illustrative design, not an implemented support backend.** The operator's job is to find and update a case without losing list context. Lead with a clear page heading, filter controls and list; keep the summary chart subordinate unless analytical exploration is the primary task.

1. **Initial view:** route arguments define filters/sort/page and optional case selection. The query cache owns authorized results. Labels, table text, validation and timestamps share the resolved locale. A loading region preserves the page heading and navigation; it does not replace the whole document with a spinner.
2. **Chart selection:** a status segment emits `open`/`closed` domain intent. The route coordinator resets page and updates the canonical filter. The chart's equivalent text/filter controls permit the same action without a pointer. Clearing the route filter clears the chart selection, including through Back.
3. **Table selection and detail:** stable case IDs survive sorting/refetch. Row actions are named links/buttons rather than a clickable `<tr>` as the only path. Opening detail creates an edit-session identity; the overlay owner records the opener. A route-selected case may be absent from the current page without being nonexistent or unauthorized.
4. **Editing:** the form owns draft/errors and a submission lock. The dialog owns focus and close policy. No auto-refetch overwrites dirty fields. A failed validation focuses an error summary or the first invalid control without closing or clearing the form.
5. **Save:** the server enforces authorization and the conditional write; the data coordinator handles their outcomes and cache reconciliation as described in [data architecture](architecture-data.md). The overlay reacts only to the current edit session's semantic outcome. A saved-but-refresh-stale outcome is not “Save failed.”
6. **Return:** if the case leaves the filtered list, focus moves to the agreed list/toolbar fallback and a concise status reports the confirmed result. Do not return to a now-unmounted row or move focus just because a background refresh finished.
7. **Narrow viewport:** filters wrap, the dialog fits available height with reachable actions, and the list preserves essential identity/status/action. Choose a horizontally scrollable table or a consciously designed compact representation based on the task; do not silently drop required columns or keyboard actions.
8. **Locale/access change:** locale updates labels, formatting, direction and chart descriptions without destroying draft semantics. Tenant/session loss closes the old private interaction, removes private state, and invalidates pending focus/notification work. The next tenant must not see the old dialog or its completion toast.

### Typed interaction states, not boolean combinations

This complete TypeScript declaration documents a **proposed application protocol**, not a ready-made reducer or library API. Its single `step` prevents contradictory states such as editor and discard-confirmation both claiming to be the active modal. The form still owns actual draft/validation state; the protocol does not copy the draft into a UI store.

```ts
export type EditInteraction =
  | { step: 'closed' }
  | {
      step: 'editing'
      sessionId: number
      caseId: string
      openerId: string
    }
  | {
      step: 'confirm-discard'
      sessionId: number
      caseId: string
      openerId: string
    }
  | {
      step: 'saving'
      sessionId: number
      caseId: string
      openerId: string
    }
  | {
      step: 'outcome-unknown'
      sessionId: number
      caseId: string
      openerId: string
    }

export type EditIntent =
  | { type: 'open'; caseId: string; openerId: string }
  | { type: 'request-close'; sessionId: number; dirty: boolean }
  | { type: 'keep-editing'; sessionId: number }
  | { type: 'discard'; sessionId: number }
  | { type: 'submit-valid-draft'; sessionId: number }
  | { type: 'write-rejected'; sessionId: number }
  | { type: 'write-confirmed'; sessionId: number }
  | { type: 'write-unconfirmed'; sessionId: number }
  | { type: 'reconciled-uncommitted'; sessionId: number }
  | { type: 'access-lost' }
```

| Current state + intent | Transition/policy (synthesis) |
| --- | --- |
| `closed + open` | Allocate a new session ID and enter editing; record stable opener identity |
| `editing + request-close(clean)` | Close and restore logical focus |
| `editing + request-close(dirty)` | Enter confirm-discard in the same modal owner |
| `confirm-discard + keep-editing` | Return to editor; preserve draft and place focus meaningfully |
| `confirm-discard + discard` | Reset local draft and close; no server mutation |
| `editing + submit-valid-draft` | Enter saving once; form has already validated and locked the submission path |
| `saving + write-rejected` | Return to editing with draft intact and meaningful error focus |
| `saving + write-confirmed` | Close only according to current-session reconciliation policy; report confirmed save separately from refresh failure |
| `saving + write-unconfirmed` | Enter outcome-unknown; preserve draft and explain that server confirmation was lost; do not allow blind resubmission |
| `outcome-unknown + write-confirmed` | Apply the same confirmed-write reconciliation/close policy |
| `outcome-unknown + reconciled-uncommitted` | Return to editing only when the real server contract establishes that resubmission is safe |
| `outcome-unknown + request-close` | Permit leaving after an explicit uncertainty notice; retire this UI session without claiming cancellation; reconcile on next entry |
| `saving + request-close` | In this design, retain modal and explain pending work; changing this requires transferring operation ownership |
| `any + access-lost` | Retire session and close immediately; no restoration into hidden private content |
| Any completion with another session ID | No UI transition; the data coordinator separately handles any real server outcome |

Implement only transitions valid for the current step and session; the union alone does not enforce that policy. Ignore duplicate or out-of-step completions without resetting the draft or moving focus. An `open` intent while an editor is active must pass through its dirty/pending close policy before allocating a replacement session; changing the selected case is not permission to discard work.

Do not dispatch `write-rejected` merely because the transport lost its response. An ordinary refetch that happens not to show the change may be insufficient to prove a command cannot still commit. If the real service cannot establish an outcome, retain the uncertainty warning and offer navigation/reload/contact guidance appropriate to the product rather than manufacturing an idempotency guarantee. Use the richer outcomes in [data architecture](architecture-data.md).

Async validation remains form-owned while the interaction is `editing`. If close/discard retires that session before validation finishes, its completion must not dispatch `submit-valid-draft`, focus an error, or publish errors into a later session. Retaining the dialog during validation is another valid policy, but must be explicit; the submission lock alone protects neither navigation nor session ownership.

## Focused component example: real local selection clearing

This **complete SFC** is runnable inside an already configured Vue 3.5.44/Vuetify 4.3.0 application with `vuetify/styles` and a `VApp` ancestor; [Vuetify setup](vuetify-setup.md) supplies that context. It implements only in-memory selection and confirmation—no backend, persistence, or case-management integration. It demonstrates one dialog owner, bound activator props, stable accessible IDs, explicit Cancel, and truthful local success. Its opener remains mounted/enabled after clearing, so ordinary dialog return focus has a surviving target.

```vue
<script setup lang="ts">
import { ref, useId } from 'vue'
import {
  VBtn, VCard, VCardActions, VCardText, VCardTitle,
  VCheckbox, VDialog,
} from 'vuetify/components'

const headingId = useId()
const dialogTitleId = useId()
const dialogDescriptionId = useId()
const selected = ref<string[]>(['alpha'])
const open = ref(false)
const status = ref('')
const choices = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'beta', label: 'Beta' },
] as const

function clearSelection() {
  selected.value = []
  status.value = 'Selection cleared for this page session.'
  open.value = false
}
</script>

<template>
  <section :aria-labelledby="headingId" class="selection-panel">
    <h2 :id="headingId">Local selection</h2>
    <p>No changes are saved to a server.</p>
    <VCheckbox
      v-for="choice in choices"
      :key="choice.id"
      v-model="selected"
      :label="choice.label"
      :value="choice.id"
      hide-details
      @update:model-value="status = ''"
    />
    <p>{{ selected.length }} selected</p>
    <VDialog
      v-model="open"
      max-width="28rem"
      :transition="false"
      :aria-labelledby="dialogTitleId"
      :aria-describedby="dialogDescriptionId"
    >
      <template #activator="{ props: activatorProps }">
        <VBtn v-bind="activatorProps" type="button">Clear selection</VBtn>
      </template>
      <VCard>
        <VCardTitle :id="dialogTitleId">Clear local selection?</VCardTitle>
        <VCardText :id="dialogDescriptionId">
          This clears the current page selection, not any saved records.
        </VCardText>
        <VCardActions class="selection-actions">
          <VBtn type="button" @click="open = false">Cancel</VBtn>
          <VBtn
            type="button"
            :disabled="selected.length === 0"
            @click="clearSelection"
          >
            Confirm clear
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
    <p role="status">{{ status }}</p>
  </section>
</template>

<style scoped>
.selection-panel {
  max-inline-size: 36rem;
  margin-inline: auto;
  padding: 1rem;
}
.selection-actions {
  flex-wrap: wrap;
}
</style>
```

The example intentionally disables the dialog transition rather than claiming a global reduced-motion policy. It leaves initial focus to the dialog implementation; a destructive real-world action may require explicit Cancel/heading focus using the current supported component/ref lifecycle. That policy must be observed with keyboard and assistive technology, not inferred from markup alone. Do not add a second custom focus trap around `VDialog` to achieve it.

## Design tokens, accessibility, adaptive states

**Synthesis:** tokens express semantic roles and coordinated state. Use roles such as primary action, error, focus, selected, surface, and muted text, not a page's hard-coded color. Map them into Vuetify themes/defaults and chart series/text/selection styles through one design-system policy. A semantic error token does not itself prove contrast on every surface; light/dark, disabled, hover/focus, selected, and chart overlays need separate evaluation. Use shape, labels and icons/text as well as color.

**Peccable visual-system policy (synthesis):** infer the current system from actual tokens, shared components, assets and rendered states. Refine an established identity; extend it for a demonstrated missing role/state; replace it only under an authorized redesign. Preserve incumbent token names and one authoritative definition per role rather than adding parallel “semantic” aliases to an existing semantic system. Extract repeated intent and behavior, not merely similar pixels; keep one-off composition local. Record meaningful exceptions in existing system documentation. [Design system](design-system.md) owns the typography/color/layout/interaction implementation routes; no extra design framework or mandatory sidecar is required.

| State | Visual/content behavior | Interaction/focus behavior |
| --- | --- | --- |
| Initial loading | Stable heading and task context; bounded progress indication | Keep navigation available; no focus jump to each skeleton update |
| Refreshing existing data | Keep authorized old content with appropriate freshness feedback | Do not reset selection/draft or announce every polling cycle |
| Empty collection | Explain no records and offer permitted next action | Primary action works by keyboard; no fake data to fill layout |
| No filter results | Show current filters and a clear-filter action | Preserve filter controls and route semantics |
| Read/refresh error | Explain whether no data or old data remains; retry actual read | Preserve draft, selection and a reachable recovery action |
| Validation error | Field-specific messages plus summary where appropriate | Associate errors and focus the meaningful first correction |
| Pending save | Precise progress and duplicate protection | Preserve readable form context; explicit policy for close and background navigation |
| Permission denied/lost | Truthful access state, no stale private content | Close retired overlays; focus surviving public/access context |
| Confirmed success | State what actually happened, including local-only versus server-confirmed | Announce concise status; move focus only when workflow requires it |

Responsive behavior includes long translations, RTL, zoom, touch targets, virtual keyboard height and reduced viewport height—not just device-width breakpoints. Prefer CSS reflow when it can preserve one DOM/interaction instance. Rendering desktop and mobile copies of an editor can duplicate IDs, forms, subscriptions and focus owners. If an adaptive representation genuinely remounts, define what happens to draft, pending work, scroll position and focus.

## Motion, data presentation, and locale compose through meaning

- **Motion:** use one engine per animated property; do not combine Vuetify transition, Vue `Transition`, Motion, and VueUse Motion transforms on the same node. Keep content/action availability independent of animation completion. Reduced motion should remove nonessential spatial movement while preserving state feedback. Follow [motion](motion.md); interaction-triggered motion disablement is [WCAG 2.3.3, Level AAA](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), not by itself a claim of full conformance.
- **Tables:** choose one source for sort/filter/pagination. For server pagination, operate on server totals and page contracts; do not present locally filtered one-page results as the full dataset. Define selection scope: visible page, loaded rows, or all matching server results are different features. Virtualization must preserve stable keys, measured sizes, focus/keyboard reachability, and row/column meaning; it does not create those semantics automatically.
- **Charts:** derive series from canonical data, preserve stable series/category identity, and use domain values rather than translated labels as keys. Provide the important trend/meaning in text plus accessible values, with keyboard-equivalent filtering where interactive. A canvas/SVG chart or hover tooltip alone is not a complete data interface. See [WAI complex-image guidance](https://www.w3.org/WAI/tutorials/images/complex/) and [visualization](visualization.md).
- **Localization:** keep server timestamps, numeric values, revisions and IDs canonical; format only at presentation boundaries. Carry translated validation messages, Vuetify locale, direction, dates/numbers, chart labels and document language/head together. Locale belongs in a remote key only when the response depends on it. Reformatting a title must not mutate the draft or server record. Own route/head entry disposal to avoid stale titles from departed screens.
- **SSR:** use deterministic initial locale/theme/IDs and purposeful client-only boundaries for browser-dependent renderers. Vue's `useId()` is stable across server/client rendering within its documented scope; call it in setup, not computed getters. See the [Vue helper contract](https://vuejs.org/api/composition-api-helpers.html#useid). Avoid relying on browser width to render a conflicting initial server/client tree.

## Minimum progressive reading and evidence

| Task | Minimum reading set | Add only if the requirement exists |
| --- | --- | --- |
| Build a Vuetify feature | [Vuetify components](vuetify-components.md), [accessibility](accessibility.md) | [forms](forms.md) for a draft/submit workflow |
| Change application visual language | [Design system](design-system.md), the incumbent token owner | [OpenVue theming](openvue-theming.md), [Vuetify theme](vuetify-theme.md) or [Quasar](alternative-ui.md) only for that framework |
| Add an overlay capability gap | Incumbent dialog/component contract, then [accessibility](accessibility.md) | [Headless UI](headless-ui.md) only for a demonstrated unsupported behavior; preserve one interaction owner |
| Data-rich screen | [data tables](data-tables.md) or [visualization](visualization.md) | [virtualization](virtualization.md) only for its actual performance need |
| Add animation | [motion](motion.md) | No second engine without a concrete capability reason |
| Locale/head or SSR composition | [i18n and head](i18n-head.md), [debugging and SSR](debugging-ssr.md) | [data architecture](architecture-data.md) when server responses vary by locale/access |
| Demonstrate behavior | [testing](testing.md) | Manual keyboard/assistive-technology and adaptive-state checks |

**Not observed here:** rendered layout, screen-reader output, focus timing, reduced-motion rendering, or browser integration. Proposed acceptance evidence: keyboard open/submit/cancel/Escape/Back; row removal after save; popup inside dialog; resize with dirty input and virtual keyboard; long translation and RTL; light/dark focus and error contrast; chart interaction without pointer; virtualized focus across scrolling; access loss during animation/save; initial SSR hydration. Screenshots show only captured appearance, not functioning interaction or accessibility. The local SFC is a complete example, not an executed verification result.

## Sources

- [Vue 3.5.44 package metadata](https://registry.npmjs.org/vue/3.5.44), [Vue 3.5.44 runtime-core declarations](https://unpkg.com/@vue/runtime-core@3.5.44/dist/runtime-core.d.ts), [Vue stable IDs](https://vuejs.org/api/composition-api-helpers.html#useid).
- [Vuetify 4.3.0 metadata](https://registry.npmjs.org/vuetify/4.3.0), [dialog documentation](https://vuetifyjs.com/en/components/dialogs/), [4.3.0 dialog implementation](https://unpkg.com/vuetify@4.3.0/lib/components/VDialog/VDialog.js), [4.3.0 declarations](https://unpkg.com/vuetify@4.3.0/lib/components/VDialog/VDialog.d.ts).
- [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [WAI complex data-image alternatives](https://www.w3.org/WAI/tutorials/images/complex/), [WCAG 2.3.3 motion disablement](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
- [Vue SSR hydration and platform boundaries](https://vuejs.org/guide/scaling-up/ssr.html#writing-ssr-friendly-code).
