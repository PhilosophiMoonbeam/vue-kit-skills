# OpenVue layout, media, feedback and scoped utilities

Read for the remaining OpenVue **1.0.0** component families after choosing the existing UI owner. [Forms](openvue-forms.md), [data](openvue-data.md), [navigation](openvue-navigation.md), [overlays](openvue-overlays.md) and [theming](openvue-theming.md) own their separate contracts. Import explicit `openvue/<component>` subpaths; neither a theme nor a component import installs plugin services, icon fonts or unrelated optional peers.

## Layout and local presentation

| Family | Exact composition/state contract | Consequence for consumers |
| --- | --- | --- |
| [Card](https://openvue.dev/card) | Slots `header`, `title`, `subtitle`, `content`, `footer`; no application state owner | Supply real heading semantics in a title slot; a visual card is not a button, landmark or dialog |
| [Panel](https://openvue.dev/panel) | `header`, `toggleable`, `v-model:collapsed`; `toggleButtonProps` names the generated disclosure button | Keep its generated `aria-controls`/expanded state and content relationship; custom header/icons must not erase the toggle's name |
| [Fieldset](https://openvue.dev/fieldset) | `legend`, optional `toggleable` and collapsed state group related controls | Use for a meaningful form group, not generic page chrome; retain the legend and keyboard-operable toggle |
| [Toolbar](https://openvue.dev/toolbar) | Slots `start`, `center`, `end`; layout and toolbar semantics, not action state | Name the toolbar; buttons still need names/types. Do not assume an application-specific roving-keyboard policy |
| [Divider](https://openvue.dev/divider) | Horizontal/vertical `layout`, alignment and line `type`, optional content | A separator is not a heading or action; decorative labels do not replace document structure |
| [Splitter / SplitterPanel](https://openvue.dev/splitter) | Panel percentage `size`/`minSize`; horizontal/vertical layout; resize events carry `{ originalEvent, sizes }` | There is no invented `v-model:sizes`. Bound geometry, preserve separator keyboard behavior, and use `resetState()` for actual reset. Optional `stateKey`/`stateStorage` persists layout, not records |
| [Inplace](https://openvue.dev/inplace) | `v-model:active`, `#display`, `#content="{ closeCallback }"`, `open`/`close` events | Open/close is not save/rollback. Own draft/commit separately. The 1.0.0 close path schedules display focus; do not synchronously destroy that owner from the close callback |
| [Fluid](https://openvue.dev/fluid) | Makes supporting descendants fluid; individual controls can choose their declared fluid behavior | Does not create a responsive grid, change selection or validate inputs; bound the parent layout |

Inplace's display is keyboard-focusable and opens on Enter in the inspected source; do not assume it supplies every native-button behavior or edit workflow. Prefer a normal labeled editor/dialog when conditional destruction, focus transfer or authoritative saves need a different lifecycle. [Published Inplace](https://unpkg.com/openvue@1.0.0/inplace/index.mjs), [Splitter declarations](https://unpkg.com/openvue@1.0.0/splitter/index.d.ts).

## Feedback, identity and measured progress

| Family | Contract | Avoid |
| --- | --- | --- |
| [Avatar / AvatarGroup](https://openvue.dev/avatar) | Label, icon or image representation; group composes avatars | Names/meaning still need text or appropriate image alternatives. An avatar is not identity verification; avoid redundant announcements beside the same visible name |
| [Badge / OverlayBadge](https://openvue.dev/badge) | `value`, severity/size and optional overlay composition are presentation | A count is not automatically an accessible control name or live announcement. Include its meaning; do not convey urgency only through color |
| [Chip](https://openvue.dev/chip) | Label/icon/image and optional removal; `remove` emits the browser event | The component hides itself on removal; the application must also update its real collection. A dismissal is not server deletion or an authorization check |
| [Tag](https://openvue.dev/tag) | Text `value`, severity, optional icon/rounding | Derive severity from actual state and show its meaning in text; do not use color as the only result |
| [Message](https://openvue.dev/message) | Severity/content, optional close/lifetime and icon slots | Error messages need appropriate association/announcement. Do not auto-dismiss unresolved errors or create duplicate live regions; a local message is not proof an operation succeeded |
| [ProgressBar](https://openvue.dev/progressbar) | Finite measured `value` or `mode="indeterminate"`; `showValue` controls displayed text | Never advance a random/timed percentage for unknown work. Name the progressbar through its declared PT root; keep the true count/denominator and pending owner explicit |
| [ProgressSpinner](https://openvue.dev/progressspinner) | Indefinite activity indicator with an accessible name | Does not measure completion. Bind presence to actual pending state, avoid trapping focus, and honor reduced motion |
| [MeterGroup](https://openvue.dev/metergroup) | `value` array of labeled measurements, with `min`/`max` and label/orientation choices | Define a meaningful scale and validate finite inputs. Keep category labels/data available without relying on segment colors |
| [Skeleton](https://openvue.dev/skeleton) | Shape/size and optional animation represent a real content placeholder | Do not make placeholders focusable, report invented progress or leave essential SSR content permanently hidden; the application owns loading/error/empty transitions |
| [Timeline](https://openvue.dev/timeline) | `value` plus content/opposite/marker/connector slots and layout/alignment | Own record order/timezone and accessible text; arbitrary array order is not chronology or live event delivery |

The progress demo below derives a real percentage from three local checkbox values. It deliberately performs no network operation and makes no persistence claim.

### Complete `ChecklistProgress.vue`

```vue
<script setup lang="ts">
import { computed, ref, shallowRef, useId } from 'vue'
import Button from 'openvue/button'
import Panel from 'openvue/panel'
import ProgressBar from 'openvue/progressbar'
import Tag from 'openvue/tag'
import Toolbar from 'openvue/toolbar'

const id = useId()
const collapsed = shallowRef(false)
const completed = ref<string[]>([])
const checks = [
  { id: 'label', text: 'Controls have visible names' },
  { id: 'keyboard', text: 'Actions work from the keyboard' },
  { id: 'error', text: 'Errors explain the next action' },
]
const percentage = computed(() => Math.round(completed.value.length / checks.length * 100))
</script>

<template>
  <section class="checklist-demo" :aria-labelledby="`${id}-title`">
    <h2 :id="`${id}-title`">Local review checklist</h2>
    <Toolbar :pt="{ root: { 'aria-label': 'Checklist actions' } }">
      <template #start><span>Session-only review</span></template>
      <template #end>
        <Button type="button" label="Reset local checks" @click="completed = []" />
      </template>
    </Toolbar>
    <p role="status">{{ completed.length }} of {{ checks.length }} checks selected; nothing was saved.</p>
    <ProgressBar :value="percentage" :pt="{ root: { 'aria-label': 'Selected local review checks' } }" />
    <Tag :value="percentage === 100 ? 'All checks selected' : 'Review incomplete'"
      :severity="percentage === 100 ? 'success' : 'warn'" />
    <Panel header="Checklist items" toggleable v-model:collapsed="collapsed">
      <fieldset>
        <legend>Readiness checks</legend>
        <label v-for="check in checks" :key="check.id" :for="`${id}-${check.id}`">
          <input :id="`${id}-${check.id}`" v-model="completed" :value="check.id" type="checkbox" />
          {{ check.text }}
        </label>
      </fieldset>
    </Panel>
  </section>
</template>

<style scoped>
.checklist-demo { display: grid; gap: 1rem; max-width: 36rem; }
fieldset { display: grid; gap: .75rem; }
label { display: flex; gap: .5rem; align-items: baseline; }
</style>
```

## Media identity and interaction

| Family | Model/slots | Accessibility and ownership |
| --- | --- | --- |
| [Carousel](https://openvue.dev/carousel) | `value`, item slot, numeric `v-model:page`, `numVisible`, `numScroll`, responsive options | Page index is not selected-record identity. Disable unnecessary autoplay; any autoplay needs pause and reduced-motion policy. Check hidden-slide tab stops |
| [Galleria](https://openvue.dev/galleria) | Data `value`, `v-model:activeIndex`, item/thumbnail templates; fullscreen uses its declared visible model | Own current-image identity when data reorders. Label images/navigation, check fullscreen focus/dismissal and offscreen interactive content; a gallery is not upload/storage security |
| [Image](https://openvue.dev/image) | Image source/alternative, optional preview and declared image/preview parts | Put alternative text on the actual image, distinguish decorative content, and test preview keyboard/portal/focus behavior. Never insert untrusted HTML as a caption |
| [ImageCompare](https://openvue.dev/imagecompare) | Direct `left`/`right` slots and an internal native range input, not a public comparison model | Give each visual a useful alternative and **name the range through `pt.slider`**; labeling only the root does not name the input. Keep one real root per slot and matching geometry |

ImageCompare 1.0.0 updates the element immediately before its range input, while the dependency-compatible **`@openuxkit/styles@1.1.0`** geometry/clipping CSS uses descendant `img` and adjacent-sibling `img + img` selectors (not direct-child selectors). Keep exactly one real `img` per slot: wrappers would make the range's previous sibling a wrapper rather than the clipped image, and inline `svg` does not match the image rules. It exposes neither a documented controlled slider value nor a business change event; do not invent `v-model`. [Published implementation](https://unpkg.com/openvue@1.0.0/imagecompare/index.mjs), [published style rules](https://unpkg.com/@openuxkit/styles@1.1.0/dist/imagecompare/index.mjs), [declared style dependency](https://registry.npmjs.org/openvue/1.0.0).

### Complete `LocalComparison.vue`

The two data-URI SVG images are explicitly local illustrative layouts, not customer evidence or remote assets. Their fixed white canvas belongs to the illustration, not the application's theme. The native range remains keyboard-operable; a restrictive CSP must allow `data:` in `img-src` or use equivalent same-origin image assets.

```vue
<script setup lang="ts">
import ImageCompare from 'openvue/imagecompare'

const original = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="white"/><rect x="12" y="12" width="296" height="156" fill="none" stroke="black"/><path d="M24 48H296M24 90H180M24 132H240" stroke="black" stroke-width="4"/></svg>',
)
const alternate = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="white"/><rect x="12" y="12" width="296" height="156" fill="none" stroke="black"/><path d="M24 48H296M24 90H120M200 90H296M24 132H120M200 132H296" stroke="black" stroke-width="4"/></svg>',
)
</script>

<template>
  <figure class="layout-comparison">
    <ImageCompare :pt="{ slider: { 'aria-label': 'Reveal alternate layout' } }">
      <template #left>
        <img :src="original" alt="Original illustrative layout" width="320" height="180" />
      </template>
      <template #right>
        <img :src="alternate" alt="Alternate illustrative layout" width="320" height="180" />
      </template>
    </ImageCompare>
    <figcaption>Use Left/Right arrow keys on the comparison slider to reveal each arrangement.</figcaption>
  </figure>
</template>

<style scoped>
.layout-comparison { max-width: 36rem; margin: 0; }
img { display: block; object-fit: contain; }
figcaption { margin-top: .75rem; }
</style>
```

## Complete data-driven carousel

Replace only `src/App.vue` in the [dedicated Vite shell](openvue-setup.md#setup-in-a-dedicated-vite-app) with this complete SFC. OpenVue **1.0.0** uses `value`, `#item="{ data, index }"` and `v-model:page`; **there are no CarouselContent/CarouselItem/CarouselPrev/CarouselNext imports**. `value` is the documented data API, not deprecated. `numVisible`/`numScroll` control layout; `responsiveOptions` overrides breakpoints. One item per page keeps the displayed stage count correct. [Carousel](https://openvue.dev/carousel), [exact declarations](https://unpkg.com/openvue@1.0.0/carousel/index.d.ts).

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import Carousel from 'openvue/carousel'

const page = shallowRef(0)
const cards = [
  { id: 'draft', title: 'Draft', detail: 'Write a local proposal.' },
  { id: 'review', title: 'Review', detail: 'Ask a colleague for feedback.' },
]
</script>

<template>
  <main class="stage-preview">
    <h1>Planning stages</h1>
    <Carousel
      v-model:page="page" :value="cards" :num-visible="1" :num-scroll="1"
      :autoplay-interval="0" :circular="false" :pt="{ root: { 'aria-label': 'Planning stages' } }"
      :prev-button-props="{ 'aria-label': 'Previous stage' }"
      :next-button-props="{ 'aria-label': 'Next stage' }"
    >
      <template #item="{ data }">
        <article :key="data.id" class="stage-card">
          <h2>{{ data.title }}</h2>
          <p>{{ data.detail }}</p>
        </article>
      </template>
    </Carousel>
    <p role="status">Stage {{ page + 1 }} of {{ cards.length }}</p>
  </main>
</template>

<style scoped>
.stage-preview { max-width: 36rem; margin: 2rem auto; padding: 1rem; }
.stage-card { padding: 1rem; overflow-wrap: anywhere; }
</style>
```

**Carousel acceptance plan, not an observed pass:** at 320px and 1280px, navigate with labeled previous/next buttons and indicators, confirm page/status updates and disabled end controls, and inspect visible/hidden slide semantics and focus. No autoplay or remote images are involved. Adding autoplay requires a user-operable pause policy and reduced-motion consideration; adding interactive slides requires checking that offscreen controls cannot receive focus.


## Scoped scroll, visibility and directive effects

| Capability | Contract and boundary |
| --- | --- |
| [ScrollPanel](https://openvue.dev/scrollpanel) | Bound actual width/height; custom scrollbars do not remove native content/keyboard needs. The 1.0.0 runtime has `refresh()` and `scrollTop(number)`, but its published component declaration exposes neither method. Do not present them as a strict typed ref API; use a native scroll region when application-controlled scrolling is required |
| [ScrollTop](https://openvue.dev/scrolltop) | `target` chooses window/parent, `threshold` controls visibility and `behavior` chooses scrolling. Supply a named button and choose non-smooth behavior under reduced motion; scrolling does not automatically move focus |
| [DeferredContent](https://openvue.dev/deferredcontent) | Renders children only once its mounted viewport/window-scroll test succeeds, then emits `load`; not dynamic module import, request cancellation or a cache. Initial SSR has no child slot, so do not hide essential content behind it |
| [AnimateOnScroll](https://openvue.dev/animateonscroll) | Explicit directive registration plus supplied enter/leave classes; the app supplies animation CSS and reduced-motion behavior. In 1.0.0 an `enterClass` immediately sets inline `opacity: 0` until entry, so apply it only to nonessential decoration, not essential content. Merely reducing CSS animation duration does not undo that hiding |
| [StyleClass](https://openvue.dev/styleclass) | Trusted local selector plus `toggleClass` or enter/leave class lifecycle; relative selectors address nearby nodes. CSS classes do not create a focus trap, dialog model, disabled control or authorization state |
| [Ripple](https://openvue.dev/ripple) | Register the directive and deliberately enable plugin ripple; cosmetic pointer feedback only | 
| [KeyFilter](https://openvue.dev/keyfilter) | Static supported preset/regular expression filters input behavior; not parsing, a mask, accessibility policy or server validation. Preserve paste/composition/mobile input paths and validate the complete accepted value |
| [Terminal](https://openvue.dev/terminal) | Local command display with module-global `TerminalService`; only a sole synchronous host/responder is appropriate for the example below. No process, shell, network or authorization implementation is supplied |

DeferredContent listens to **window scroll**, not every nested scrolling container; a hidden/nested owner needs its own actual visibility policy. Unmount removes its listener; `load` is visibility completion, not completion of async descendants. Use a genuine async component/import when code splitting is required. [Exact implementation](https://unpkg.com/openvue@1.0.0/deferredcontent/index.mjs).

Do not copy a StyleClass example that toggles a disabled-looking CSS class and assume a control became disabled: use the actual `disabled` property and matching application state. Likewise, animation classes from a separate utility plugin are not built into a core OpenVue import. Keep global plugin/stylesheet choices with [theming](openvue-theming.md).

These utility limits come from the published release, not assumed ancestry: [ScrollPanel declarations](https://unpkg.com/openvue@1.0.0/scrollpanel/index.d.ts), [ScrollPanel runtime methods](https://unpkg.com/openvue@1.0.0/scrollpanel/index.mjs), [AnimateOnScroll opacity/observer lifecycle](https://unpkg.com/openvue@1.0.0/animateonscroll/index.mjs).

### Complete `LocalTerminal.vue`: narrow incumbent boundary

Mount only after an explicit user action: Terminal focuses its input on mount. There must be one active host/responder across the module's consumers; responses are applied to the latest command without request IDs. Do not use this service for overlapping async work or several independent terminals. Its module-global bus is not an app/request-private message channel.

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import Terminal from 'openvue/terminal'
import TerminalService from 'openvue/terminalservice'

const handled = shallowRef(0)
function respond(input: string) {
  handled.value++
  const command = input.trim().toLowerCase()
  const response = command === 'help'
    ? 'Local commands: help, status. No shell or network is connected.'
    : command === 'status'
      ? `Handled ${handled.value} local commands in this mounted session.`
      : 'Unknown local command. Type help.'
  TerminalService.emit('response', response)
}
onMounted(() => TerminalService.on('command', respond))
onBeforeUnmount(() => TerminalService.off('command', respond))
</script>

<template>
  <section>
    <h2>Local command reference</h2>
    <p>Help and status only; no process is executed and nothing is persisted.</p>
    <Terminal prompt="local &gt;" welcome-message="Type help."
      :pt="{ commandText: { 'aria-label': 'Local reference command' } }" />
  </section>
</template>
```

The default renderer escapes command/response text. Retain that boundary; never route input into `eval`, a shell, dynamic imports or privileged APIs. Unsolicited responses and multiple hosts are unsafe in this release because the response listener assumes a latest command exists. An application-owned command interface is preferable when correlation, async cancellation or private instances are required. [Terminal runtime](https://unpkg.com/openvue@1.0.0/terminal/index.mjs), [service](https://unpkg.com/openvue@1.0.0/terminalservice/index.mjs).

## Verification boundary

The [coverage ledger](../assets/openvue-coverage.json) maps all official component pages to their owners, including source-only findings. [Scoped verification](../assets/verification.json) records executed consumers and versions. Proposed consumer checks here: real checklist percentage/reset/disclosure, comparison range keyboard/clipping, carousel endpoints and hidden focus, and sole terminal command/remount ownership. Do not infer all-media, screen-reader, browser or hydration certification from these bounded paths.

