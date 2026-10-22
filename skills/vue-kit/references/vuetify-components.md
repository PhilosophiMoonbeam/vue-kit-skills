# Vuetify 4 component decisions and interactions

Read when composing application layout, forms, overlays, tables, navigation, or file selection. **Target: Vuetify 4.3.0 and Vue 3.5.44.** Install the plugin/global CSS/icon set through [vuetify-setup.md](vuetify-setup.md); use [vuetify-theme.md](vuetify-theme.md) for token and migration decisions. Examples below use public 4.3 exports and explicit component imports. Descendant examples mount inside an existing `VApp`/`VMain`; do not nest a new application root for every feature.

## Choose by behavior, not component count

| User task | Prefer | Boundary |
| --- | --- | --- |
| Application shell | `VApp`, app bar/drawer, `VMain` | Layout registration supplies main insets; ordinary `VToolbar` is not an app bar. |
| Responsive columns | `VContainer`, `VRow`, `VCol` | Twelve-column grid with CSS gaps in v4. |
| Simple actions or navigation | `VBtn`, `VList`/`VListItem` | Real links for navigation; buttons for actions. |
| Labeled local form | `VForm` + supported input rules | Async validation; not server validation or a persistence layer. |
| Fixed choices / filtered choices / user-created values | `VSelect` / `VAutocomplete` / `VCombobox` | Free text in combobox changes the model contract. |
| Modal decision | `VDialog` | Accessible name, focus containment/return, cancel path. |
| Anchored popup actions | `VMenu` | Bind all activator props; retain keyboard navigation. |
| Noncritical transient feedback | `VSnackbar` | Not the only place an error or essential instruction appears. |
| Plain tabular content | `VTable` | Styled semantic table without a data-management engine. |
| Whole small dataset in memory | `VDataTable` | Client sorting/filtering/pagination. |
| Remote sorting/filtering/pagination | `VDataTableServer` | App supplies current rows and total matching count. |
| Many loaded rows without pagination | `VDataTableVirtual` | Bounded viewport and rendering tradeoffs; not remote fetching. |
| Pick files / dropzone with list | `VFileInput` / `VFileUpload` | Selects local files; does not upload them. |

Use `VAlert` for persistent contextual errors/status, `VProgressLinear`/`VProgressCircular` for genuine work, and a skeleton only when content is actually loading. Use cards to group coherent content, not to wrap every sentence; chips represent concise state/filter/selection rather than disguising unrelated controls. See [accessibility.md](accessibility.md) for interaction semantics.

## Application shell and grid

Complete root SFC for an already-installed Vuetify app. The drawer is intentionally temporary at every viewport; it does not need a viewport-dependent server tree.

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import { VApp } from 'vuetify/components/VApp'
import { VAppBar } from 'vuetify/components/VAppBar'
import { VNavigationDrawer } from 'vuetify/components/VNavigationDrawer'
import { VMain } from 'vuetify/components/VMain'
import { VContainer, VRow, VCol } from 'vuetify/components/VGrid'
import { VBtn } from 'vuetify/components/VBtn'
import { VList, VListItem } from 'vuetify/components/VList'
import { VCard, VCardText } from 'vuetify/components/VCard'

const drawer = shallowRef(false)
</script>

<template>
  <VApp>
    <VAppBar title="Workspace">
      <template #prepend>
        <VBtn aria-label="Open navigation" @click="drawer = true">Menu</VBtn>
      </template>
    </VAppBar>
    <VNavigationDrawer v-model="drawer" temporary>
      <nav aria-label="Workspace navigation">
        <VList>
          <VListItem title="Summary" href="#summary" @click="drawer = false" />
          <VListItem title="Details" href="#details" @click="drawer = false" />
        </VList>
      </nav>
    </VNavigationDrawer>
    <VMain>
      <VContainer>
        <h1 id="summary" class="text-headline-large mb-4">Summary</h1>
        <VRow class="align-stretch" :gap="16">
          <VCol cols="12" md="6">
            <VCard title="Session data" height="100%">
              <VCardText>This example stores changes only in memory.</VCardText>
            </VCard>
          </VCol>
          <VCol cols="12" md="6">
            <VCard id="details" title="Details" height="100%">
              <VCardText>Columns stack below the md breakpoint.</VCardText>
            </VCard>
          </VCol>
        </VRow>
      </VContainer>
    </VMain>
  </VApp>
</template>
```

`cols="12" md="6"` stacks then splits; `md` starts at **840px** in 4.3, not v3's 960px. Numeric `gap` values are CSS pixels; a tuple sets horizontal/vertical gaps. `density="compact"` controls grid spacing; `dense`, `align`, `justify`, column `order`, and `align-self` are deprecated compatibility props, not recommended new APIs. Use utility classes such as `align-center`, `justify-space-between`, and responsive `order-md-2`. Do not port v3's negative-margin compensation onto the gap grid. [Exact grid props](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VGrid/VRow.ts), [breakpoints](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/display.ts).

Use `useDisplay()` for behavior that truly needs viewport state, such as choosing a temporary versus permanent drawer; use CSS/grid utilities for presentation. `mobile` defaults to below the `lg` threshold (1145px), not necessarily a phone. Runtime threshold changes do not rewrite compiled CSS breakpoints. In a routed app, `VListItem`/`VBtn` accept `to` through Vue Router integration; install the router and use actual declared routes rather than fabricated destinations. [routing.md](routing.md) owns route guards and history.

### Incumbent shell and navigation variants

- `VContainer` is max-width constrained unless `fluid`; a `VCol` with no span shares remaining space, while `cols="auto"` sizes to content. Use `offset="3" cols="6"` for a centered half-width column, or responsive `offset-md`. Nest a new `VRow` inside a column for another grid. The grid is a CSS layout convention, not a Vue runtime rule that a row outside a container must render nothing. `VMain` needs the applicable layout injection; it need not be an immediate DOM child of `VApp`. Avoid wrapping layout children in a second unrelated `VApp`.
- A permanent drawer reserves layout width; a temporary drawer overlays content and uses a scrim. `rail` changes its width independently from the open `v-model`; keep rail state separate and give collapsed controls accessible names. `rail-width`, `width`, and logical `location="start"`/`"end"` are deliberate geometry choices. `expand-on-hover` may supplement, never replace, a reachable toggle. `append` is useful for a persistent drawer action.
- `VAppBar scroll-behavior="hide elevate"` combines hiding on downward scroll/showing on upward scroll with elevation changes at its threshold; `collapse`, `fade-image`, and `inverted` are separate supported behaviors. Set `scroll-target` to the actual scroll container when it is not the document, and verify short-page/bottom-of-page behavior rather than assuming every scroll moves the bar. `location="bottom"` creates a bottom app bar.
- `VFooter app` registers a footer inset; an ordinary `VFooter` belongs to document flow. For an independently constrained layout, use `VLayout` and its descendants rather than manually copying app-bar padding onto `VMain`.
- `VBottomNavigation` registers a bottom inset and groups `VBtn` items with stable `value`s; its `v-model` is selected identity, **not routing**. Use real `to`/`href` navigation, or explicitly bind selection to local content. `grow`, `mode="horizontal"`/`"shift"`, `color`, and `bg-color` control supported presentation; hide with its `active` model if app scroll policy requires it. The 4.3 component does not expose the copied `scroll-behavior` or `icon` props from old snippets.
- `VBreadcrumbs :items` presents location hierarchy; use actual `href`/`to` entries and leave the current page non-navigating. Do not replace a route-aware trail with button click simulations. Tooltip activator props follow the same binding contract as menus; a tooltip supplements, not supplies, an icon button's accessible name.

Use `useLayout()` **inside a descendant of the layout provider** to read `mainRect`, `mainStyles`, `layoutRect`, or `getLayoutItem(name)` when integrating an external measured surface. `mainRect` holds insets, not the viewport rectangle; `layoutRect` may be undefined before measurement, and an unknown item name returns undefined. Diagnose missing/doubled main padding by checking registration, `name`/`order`, active state, and the actual scroll container before applying CSS offsets. [Layout source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/layout.ts), [app bar](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VAppBar/VAppBar.tsx), [drawer](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VNavigationDrawer/VNavigationDrawer.tsx), [bottom navigation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VBottomNavigation/VBottomNavigation.tsx).

## Actions, cards, alerts, and chip selection

| Component | Usable contract |
| --- | --- |
| `VBtn` | `variant` chooses `elevated`, `flat`, `tonal`, `outlined`, `text`, or `plain`; color interpretation depends on variant. Named sizes `x-small` through `x-large` differ from density. Use `block`, `rounded`, `prepend-icon`/`append-icon`, or a named slot instead of internal CSS. For icon-only actions use `icon` plus an accessible name; there is no need for an invented `circle` prop. Loading reflects real pending state; disable duplicate actions and guard the handler. Buttons default to native `type="button"`; set submit explicitly. |
| `VCard` | Compose `VCardItem`, title/subtitle, text, media, and actions, or use supported title/subtitle/text props. For a media region use `VImg` with actual `src`, meaningful `alt`, intentional `height`/`aspect-ratio`, and `cover` only when cropping is acceptable. `image` is a card background, not a substitute for informative image alt text. `loading` displays activity, not a request; a string is indicator color, not a custom work-state name. Avoid nesting controls inside an all-card link. Use a real link for a single-destination card or separate actions for multiple behaviors. |
| `VAlert` | `type` is `success`, `info`, `warning`, or `error` and chooses an icon/color; it has no implicit info type. The default variant is `flat`, not elevated. `title`, `text`/slots, `prominent`, logical `border`, and `border-color` express supported presentation; `:icon="false"` removes a decorative icon. `v-model` controls visibility; `closable` emits `click:close`. Keep essential recovery instructions present after a message is dismissed. |
| `VChip` | A status chip is not automatically an action. The 4.3 default variant is `tonal`, not flat. Use `prepend-icon`/`append-icon`, not nonexistent `prepend`/`append` icon props. `v-model` controls visibility, **not selection**; `closable` hides it and emits `click:close`, but does not remove a domain item. Use `VChipGroup v-model` and explicit chip `value`s for selection; `multiple` makes that model an array, `mandatory` prevents clearing the last selection, and `column` allows wrapping. |

For supporting content, `VAvatar` presents an actual image/icon or initials in its slot; keep the person's text name visible and do not repeat a redundant decorative avatar announcement. `VBadge`'s `content`/`max` displays a count, `dot` conveys a marker, `location` positions it, and `model-value` controls visibility; a badge is not its own notification button. Keep the parent control named and avoid duplicate live announcements: the 4.3 badge itself defaults to `role="status"`/polite announcement. A tooltip is additional help, not that name. `VProgressLinear`/`VProgressCircular` can expose determinate `model-value` progress; use `indeterminate` when no trustworthy percentage exists. A `VSkeletonLoader` represents the shape of content genuinely being fetched; gate it on actual loading and separately render recoverable error/empty states. `VOverlay` is a lower-level scrim/positioning primitive, not a ready named dialog: when choosing it instead of `VDialog`/`VMenu`, the app owns the appropriate semantics, focus and exit contract. [Badge announcement implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VBadge/VBadge.tsx), [public component exports](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/index.ts).

Complete descendant SFC: chip values actually filter local content; the dismissible alert describes that same state.

```vue
<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VChip } from 'vuetify/components/VChip'
import { VChipGroup } from 'vuetify/components/VChipGroup'
import { VBtn } from 'vuetify/components/VBtn'

const visible = shallowRef(true)
const categories = shallowRef<string[]>([])
const rows = [
  { id: 1, category: 'review', title: 'Review copy' },
  { id: 2, category: 'publish', title: 'Publish release' },
]
const filtered = computed(() => rows.filter(row =>
  categories.value.length === 0 || categories.value.includes(row.category)))
</script>

<template>
  <VAlert v-model="visible" type="info" variant="tonal" title="Local filters" closable>
    No categories selected means all session items are shown.
  </VAlert>
  <VBtn v-if="!visible" variant="text" @click="visible = true">Show filter help</VBtn>
  <VChipGroup v-model="categories" multiple column aria-label="Categories">
    <VChip value="review" filter>Review</VChip>
    <VChip value="publish" filter>Publish</VChip>
  </VChipGroup>
  <ul>
    <li v-for="row in filtered" :key="row.id">{{ row.title }}</li>
  </ul>
</template>
```

For a closable domain tag, remove its stable ID in `click:close` and choose a surviving focus target; hiding a chip alone is not a persisted deletion. Alerts have `role="alert"` by default, so reserve interruptive error announcements for meaningful changes; ordinary informational status may need a polite role. [Button implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VBtn/VBtn.tsx), [card](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VCard/VCard.tsx), [alert](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VAlert/VAlert.tsx), [chip](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VChip/VChip.tsx).

## A complete validated local interaction

This descendant SFC adds notes in memory, announces honest session-only success, and confirms reset. It has no network, fake delay, or persistence claim. Enter submits through the form. Invalid input is preserved. The submit handler awaits **the validation already started by VForm**.

```vue
<script setup lang="ts">
import { nextTick, ref, shallowRef, useTemplateRef } from 'vue'
import type { SubmitEventPromise, ValidationRule } from 'vuetify'
import { VForm } from 'vuetify/components/VForm'
import { VTextField } from 'vuetify/components/VTextField'
import { VBtn } from 'vuetify/components/VBtn'
import { VDialog } from 'vuetify/components/VDialog'
import { VCard, VCardTitle, VCardText, VCardActions } from 'vuetify/components/VCard'
import { VSnackbar } from 'vuetify/components/VSnackbar'

const form = useTemplateRef<InstanceType<typeof VForm>>('noteForm')
const titleField = useTemplateRef<InstanceType<typeof VTextField>>('titleField')
const title = shallowRef('')
const pending = shallowRef(false)
const resetOpen = shallowRef(false)
const notificationOpen = shallowRef(false)
const notification = shallowRef('')
const notes = ref<{ id: number; title: string }[]>([])
let nextId = 1

const titleRules: ValidationRule[] = [
  value => typeof value === 'string' && value.trim().length > 0 || 'Enter a note title.',
  value => typeof value === 'string' && value.trim().length <= 80 || 'Use at most 80 characters.',
]

async function submit(event: SubmitEventPromise) {
  if (pending.value) return
  pending.value = true
  try {
    const { valid } = await event
    if (!valid) return
    notes.value.push({ id: nextId++, title: title.value.trim() })
    title.value = ''
    await nextTick()
    form.value?.resetValidation()
    notification.value = 'Note added for this session only.'
    notificationOpen.value = true
    titleField.value?.focus()
  } finally {
    pending.value = false
  }
}

function resetNotes() {
  notes.value = []
  resetOpen.value = false
  notification.value = 'Session notes cleared.'
  notificationOpen.value = true
}

function restoreResetFocus() {
  if (notes.value.length === 0) titleField.value?.focus()
}
</script>

<template>
  <section aria-labelledby="notes-heading">
    <h2 id="notes-heading" class="text-headline-small mb-4">Session notes</h2>
    <VForm ref="noteForm" validate-on="submit" @submit.prevent="submit">
      <VTextField
        ref="titleField"
        v-model="title"
        label="Note title"
        :rules="titleRules"
        :readonly="pending"
        counter="80"
      />
      <VBtn type="submit" color="primary" :loading="pending" :disabled="pending">
        Add note
      </VBtn>
    </VForm>
    <ul v-if="notes.length" class="my-4">
      <li v-for="note in notes" :key="note.id">{{ note.title }}</li>
    </ul>
    <p v-else class="my-4">No session notes yet.</p>
    <VDialog
      v-model="resetOpen"
      max-width="440"
      aria-labelledby="reset-heading"
      aria-describedby="reset-description"
      @after-leave="restoreResetFocus"
    >
      <template #activator="{ props: activatorProps }">
        <VBtn v-bind="activatorProps" :disabled="pending || notes.length === 0" variant="outlined">
          Reset notes
        </VBtn>
      </template>
      <VCard>
        <VCardTitle id="reset-heading">Clear all session notes?</VCardTitle>
        <VCardText id="reset-description">This cannot be undone.</VCardText>
        <VCardActions>
          <VBtn autofocus @click="resetOpen = false">Cancel</VBtn>
          <VBtn color="error" @click="resetNotes">Clear notes</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
    <VSnackbar v-model="notificationOpen" :timeout="5000">
      {{ notification }}
      <template #actions>
        <VBtn variant="text" @click="notificationOpen = false">Dismiss</VBtn>
      </template>
    </VSnackbar>
  </section>
</template>
```

`VForm.validate()` returns `Promise<{ valid, errors }>`; testing the promise or the whole result object as a boolean is incorrect. `VForm`'s `v-model` can be `null` before validation, and `validate-on="submit"` is not permission to submit without awaiting. For an **imperative action outside a form submit**, use `const result = await form.value.validate()` after checking the ref; for `@submit`, await the `SubmitEventPromise` instead of starting a redundant validation pass. `.prevent` prevents the default native navigation. Async rules must settle to `true`/an error message and handle their own expected service errors. Keep duplicate mutations disabled while validation/submission is pending. [VForm source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VForm/VForm.tsx), [validation types](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/form.ts).

`reset()` clears field models and validation; `resetValidation()` clears validation state without intentionally clearing the input. In Vuetify 4, VForm **slot** values such as `isValid` are already unwrapped. Do not write slot `isValid.value`. Server field errors remain authoritative; client rules are only UX. Complex schemas and app-owned form state belong in [forms.md](forms.md), [vee-validate.md](vee-validate.md), or [tanstack-form.md](tanstack-form.md), without two independent validation engines fighting for the same field state.

The return types differ: `validate()` and the submit event are awaitable, but **form-level** `reset()`/`resetValidation()` return `void` in 4.3. They invoke each registered field's reset without aggregating its promises. Do not treat `await form.resetValidation()` as proof that all field work has settled; use `nextTick()` for a required Vue DOM update, not as a replacement validation result. [Exact form implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/form.ts).

### Input models, timing, and cross-field validation

| User input | Component and model contract |
| --- | --- |
| Single/multiline text | `VTextField` / `VTextarea` with a visible label; `placeholder` is only a hint. `auto-grow`/`rows` controls textarea height. A clearable text field can emit null; normalize deliberately at the domain boundary. Choose `outlined`, `filled`, `plain`, `underlined`, `solo`, `solo-filled`, or `solo-inverted` only where supported by the input, not from the button variant list. |
| Password | `type="password"` with `autocomplete="current-password"` or `"new-password"` as appropriate. A visible text Show/Hide `VBtn type="button"` can toggle the field type with an accessible label/state; an append icon click must also remain keyboard-operable. Never log the credentials. |
| Boolean preference | `VSwitch` for an immediate setting, `VCheckbox` for agreement/selection. Default boolean models may be customized with true/false values. Label the control and await real persistence before announcing saved state. |
| Selected values | Checkboxes sharing an array model use distinct `value`s. `indeterminate` is separate visual state, not a third domain value: compute it from some-but-not-all selection and update selection intentionally. |
| One of a few / bounded number | `VRadioGroup` + `VRadio` with explicit values; `inline` is presentation. `VSlider` uses numeric `min`/`max`/`step` and needs an accessible label/value. `VNumberInput` is convenient floating-point input, not arbitrary-precision money; a text field plus the app's decimal parser preserves precision when required. |

`validate-on="input"` is the default and also validates on blur; `blur` validates on leaving a field; `submit` avoids input/blur-triggered passes but does not eliminate the requirement to await submission. `lazy` skips initial validation (`lazy` alone means `input lazy`), **not** “submit only” or “wait until first submit”. `eager` makes initial errors visible; combine timing deliberately, such as `blur lazy`. Invalid-input timing can recheck already-invalid fields. [4.3 timing implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/validation.ts).

A cross-field rule should read the other current value through a closure; when that other value changes, explicitly revalidate the dependent field if its displayed error must update immediately. Do not assume a rule's closure creates an automatic dependency watcher. For wizard forms, put one form/ref per step or explicitly validate the active step; await before advancing, keep draft data above lazy/unmounted step panels, and perform final authoritative validation of **all** submitted data. A disabled Next button based only on pristine `isValid` is not a validation algorithm. Keep external `error-messages` until the app's documented edit/retry policy clears them, not merely until a local rule passes.

The examples use readable runtime-native `type`/`@click`/input attributes. For a strict checker rejecting the undeclared native surface in published Vuetify types, use the [typed native-bag recipe](vuetify-setup.md#strict-template-checking-and-native-fallthrough), without suppressing unknown-prop/event checks.

### Optional rule builders

Plain function rules above need no extra plugin. In 4.3, `useRules` and `createRulesPlugin` are public `vuetify` exports; the old `vuetify/labs/rules` import is not the current path. `useRules()` needs separate rules-plugin installation. Complete alternative entry, using the plugin module from [vuetify-setup.md](vuetify-setup.md):

```ts
import { createApp } from 'vue'
import { createRulesPlugin } from 'vuetify'
import App from './App.vue'
import { vuetify } from './plugins/vuetify'

createApp(App)
  .use(vuetify)
  .use(createRulesPlugin({}, vuetify.locale))
  .mount('#app')
```

Then call `const rules = useRules()` in setup and supply builders such as `[rules.required(), rules.email()]`. Alias rules such as `'$required'` also require that plugin; without it a string rule can be treated as a literal error message. Do not assume built-in `required()` rejects whitespace, validates a domain-specific number, or replaces server validation. [Exact rule implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/rules/rules.ts).

## Overlays: activators, focus, and feedback

Bind **all** `activator` slot `props` to the real focusable activator. They contain event handlers, accessibility attributes, and activator identity; replacing them with only a click handler loses behavior. A custom button wrapper must forward those attributes/listeners to its actual button. Do not combine an unbound slot with manually toggling the model and assume focus return is preserved.

`VDialog` captures/retains focus by default and returns focus to its activator on close. Name it, describe consequences, provide visible Cancel, and keep the activator mounted. If the action removes/disables the activator (as reset above does after the list empties), move focus to a surviving logical control after close. `persistent` blocks normal dismissal, so use it only when a safe explicit exit remains. Leave focus containment enabled unless deliberately integrating another focus-owning widget. Native `autofocus` alone is not proof of the final focused element after a lazy overlay transition. Check keyboard behavior in the integrated app. [Dialog focus source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDialog/VDialog.tsx).

Complete descendant popup-actions SFC:

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import { VMenu } from 'vuetify/components/VMenu'
import { VBtn } from 'vuetify/components/VBtn'
import { VList, VListItem } from 'vuetify/components/VList'

const menuOpen = shallowRef(false)
const sortDirection = shallowRef<'ascending' | 'descending'>('ascending')

function choose(direction: 'ascending' | 'descending') {
  sortDirection.value = direction
  menuOpen.value = false
}
</script>

<template>
  <VMenu v-model="menuOpen" location="bottom start">
    <template #activator="{ props: activatorProps }">
      <VBtn v-bind="activatorProps">Sort: {{ sortDirection }}</VBtn>
    </template>
    <VList aria-label="Sort direction">
      <VListItem title="Ascending" @click="choose('ascending')" />
      <VListItem title="Descending" @click="choose('descending')" />
    </VList>
  </VMenu>
</template>
```

Menus default to closing on content click; forms/multiselect panels may need `:close-on-content-click="false"`. Use keyboard-operable list items and preserve provided roles/props when customizing. Hover-only menus are not sufficient for touch/keyboard users. `VMenu` supplies activator ARIA and arrow-key behavior; do not replace it with hover CSS. [Menu source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VMenu/VMenu.tsx).

A snackbar confirms noncritical success; keep the actual state visible elsewhere. Use a persistent `VAlert` for errors needing recovery. The old `multi-line` prop is not a v4 API; use supported layout/`min-height` sizing. `timeout="-1"` can keep a snackbar open until an explicit dismiss action, but do not put an essential time-sensitive action only in a transient message. Overlay content can teleport outside scoped ancestor selectors; style via supported props/classes and inspect the target, not by guessing a parent descendant selector.

For long modal content, combine `scrollable` with a bounded card text region so actions remain reachable; alternatively use a deliberate `overflow-y-auto` inner region with a maximum height. `max-width` constrains desktop sizing; `fullscreen` is appropriate for a full-screen editing workflow, not a cure for missing focus management. The dialog title belongs to its card/content; `VDialog` does not provide a title prop that automatically names it. Use supported `transition` options and reduced-motion policy without replacing the visibility model with `v-if`. Snackbar `location` accepts positions such as `top end`; `vertical`, `text`/content, `actions`, rounded and variant props control presentation. The default 4.3 snackbar location is `bottom center`, not bottom-right. [Dialog props](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDialog/VDialog.tsx), [snackbar props](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VSnackbar/VSnackbar.tsx).

## Client tables: identity and local state

Complete descendant SFC with real local rows, client pagination/filtering, and ID selection:

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import type { DataTableHeader } from 'vuetify'
import { VTextField } from 'vuetify/components/VTextField'
import { VDataTable } from 'vuetify/components/VDataTable'
import { VChip } from 'vuetify/components/VChip'

const search = shallowRef('')
const selectedIds = shallowRef<number[]>([])
const headers: DataTableHeader[] = [
  { title: 'Name', key: 'name' },
  { title: 'State', key: 'state' },
]
const rows = [
  { id: 11, name: 'Review copy', state: 'Ready' },
  { id: 12, name: 'Check labels', state: 'Active' },
  { id: 13, name: 'Publish release', state: 'Ready' },
]
</script>

<template>
  <section aria-label="Session work items">
    <VTextField v-model="search" label="Search work items" clearable />
    <VDataTable
      v-model="selectedIds"
      :headers="headers"
      :items="rows"
      :search="search ?? ''"
      item-value="id"
      show-select
      select-strategy="page"
      :items-per-page="5"
    >
      <template #item.state="{ item }">
        <VChip :color="item.state === 'Ready' ? 'success' : 'info'" size="small">
          {{ item.state }}
        </VChip>
      </template>
      <template #no-data>No work items match.</template>
    </VDataTable>
    <p role="status">{{ selectedIds.length }} selected</p>
  </section>
</template>
```

- Header `key` controls named cell slots; `value` can choose a different data accessor. `sortable: false` is appropriate for action columns.
- Use stable unique `item-value` keys across filtering, pagination, and refreshed object instances. Never use row index as domain identity. `v-model` is selected values; `return-object` deliberately changes it to raw objects and complicates refresh reconciliation.
- `select-strategy="page"` selects visible page rows; `all` addresses items actually supplied, not every unseen database row. 4.3 also supports `filtered` for filtered local items and `single` for one selection. A remote “select all results” needs an explicit server/domain selection contract.
- Keep headers outside render expressions for stable configuration; this is a maintainability/performance recommendation, not a claim that any inline array forces a complete table rerender.
- An `item.<key>` slot receives the raw app item. Internal slot APIs may also expose `internalItem`; do not apply a blanket `item.raw` transformation to every slot.

[Selection strategies](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDataTable/composables/select.ts), [item transformation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDataTable/composables/items.ts).

### Sorting, expansion, grouping, and custom rows

Bind `v-model:sort-by` to an array of `{ key, order: 'asc' | 'desc' }`; use `multi-sort` when the UI should keep more than one ordering. A header `value` accepts a nested property path or an accessor function; `key` remains the slot/sort identity. Header object fields `align`, `width`, `minWidth`, `maxWidth`, and `fixed: 'start' | 'end'` control column layout. Header `sort` compares extracted values; `sortRaw` compares raw rows. Current per-column filtering is `filter` (or table `filter-keys`/`custom-key-filter`), **not** a guaranteed `filterable` header prop. Return a boolean or supported match location from `custom-filter`; do not coerce a valid zero match index to false.

Add `show-expand` and `v-model:expanded` with stable item-value keys for row details. `expanded-row` must render valid table rows/cells and span the supplied `columns.length` including selection/expansion columns. `group-by` takes sort-item descriptors; `group-header` receives a **group wrapper**, not a domain row. Use its `toggleGroup(item)`/`isGroupOpen(item)` helpers, and do not confuse group IDs/opened state with expanded row IDs. Nested `item.items` includes subgroups, so its length is not necessarily the recursive row count.

Contextual extension of the complete client-table example: retain its `headers`, `rows`, imports, and `item-value="id"`; import `VBtn` from `vuetify/components/VBtn`. This uses each row's existing `state`:

```vue
<VDataTable :headers="headers" :items="rows" item-value="id"
  :group-by="[{ key: 'state', order: 'asc' }]" show-expand>
  <template #group-header="{ item, columns, toggleGroup, isGroupOpen }">
    <tr>
      <td :colspan="columns.length">
        <VBtn variant="text" :aria-expanded="isGroupOpen(item)" @click="toggleGroup(item)">
          {{ isGroupOpen(item) ? 'Collapse' : 'Expand' }} {{ item.value }}
        </VBtn>
      </td>
    </tr>
  </template>
  <template #expanded-row="{ item, columns }">
    <tr><td :colspan="columns.length">Session item {{ item.id }}: {{ item.name }}</td></tr>
  </template>
</VDataTable>
```

`hide-default-footer` hides controls but **does not disable pagination**; set `items-per-page="-1"` only when rendering all supplied rows is intentional and affordable. `fixed-header` requires an actual scrolling height to be useful. `loading`/`loading-text`, `no-data`, `top`, and `bottom` slots describe real loading/empty/control states; do not leave a no-data error masquerading as success.

Replacing a cell preserves most table behavior; replacing the entire `item` row makes the app responsible for forwarding row `props`, selection/expansion handlers, semantics, and keyboard-accessible actions. In `VDataTableVirtual` also bind supplied `itemRef` to the rendered `tr` so measurement observes the actual row. Contrary to older snippets, **4.3 virtual tables support grouping and expanded rows**; they still do not perform remote fetching or regular page slicing. [Headers/types](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDataTable/types.ts), [row slots](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDataTable/VDataTableRows.tsx), [4.3 virtual pipeline](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDataTable/VDataTableVirtual.tsx).

## Server tables: UI options are a request, not a fetch implementation

`VDataTableServer` does not fetch, filter, sort, or page server data for you. Supply one page in `items`, the **total matching row count** in `items-length`, and `loading` during the actual request. `update:options` fires initially and on relevant changes; do not also perform a duplicate mount fetch. Page numbers are one-based. Keep remote-cache ownership in [tanstack-query.md](tanstack-query.md) or [pinia-colada.md](pinia-colada.md) if the app already uses one.

Complete service-boundary SFC: its required `loadPage` prop is an **application-owned implementation contract**, not a fabricated endpoint. The caller must implement authenticated server access, allowlisted sort keys, filtering, and total counts. This component is not runnable without that supplied function.

```vue
<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import type { DataTableHeader, DataTableSortItem } from 'vuetify'
import { VDataTableServer } from 'vuetify/components/VDataTable'
import { VTextField } from 'vuetify/components/VTextField'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'

type Row = { id: number; name: string; state: string }
type PageRequest = {
  page: number
  itemsPerPage: number
  sortBy: DataTableSortItem[]
  search: string
}
type PageResult = { items: Row[]; total: number }
const props = defineProps<{
  loadPage: (request: PageRequest, signal: AbortSignal) => Promise<PageResult>
}>()

const headers: DataTableHeader[] = [
  { title: 'Name', key: 'name' },
  { title: 'State', key: 'state' },
]
const pageSizes = [10, 25, 50]
const rows = shallowRef<Row[]>([])
const total = shallowRef(0)
const page = shallowRef(1)
const pageSize = shallowRef(10)
const search = shallowRef('')
const selectedIds = shallowRef<number[]>([])
const loading = shallowRef(false)
const error = shallowRef('')
const lastRequest = shallowRef<PageRequest>({ page: 1, itemsPerPage: 10, sortBy: [], search: '' })
let active: AbortController | undefined

async function load(options: Omit<PageRequest, 'search'> & { search?: string }) {
  active?.abort()
  const controller = new AbortController()
  active = controller
  const request: PageRequest = { ...options, search: options.search ?? '' }
  lastRequest.value = request
  loading.value = true
  error.value = ''
  try {
    const result = await props.loadPage(request, controller.signal)
    if (active !== controller) return
    rows.value = result.items
    total.value = result.total
  } catch (cause) {
    if (active !== controller || controller.signal.aborted) return
    rows.value = []
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    if (active === controller) loading.value = false
  }
}

onBeforeUnmount(() => {
  active?.abort()
  active = undefined
})
</script>

<template>
  <section aria-label="Remote work items">
    <VTextField v-model="search" label="Search remote work items" />
    <VAlert v-if="error" type="error" class="mb-4">
      {{ error }}
      <VBtn :disabled="loading" variant="text" @click="load(lastRequest)">Retry</VBtn>
    </VAlert>
    <VDataTableServer
      v-model="selectedIds"
      v-model:page="page"
      v-model:items-per-page="pageSize"
      :items="rows"
      :items-length="total"
      :headers="headers"
      :search="search"
      :loading="loading"
      :items-per-page-options="pageSizes"
      item-value="id"
      show-select
      select-strategy="page"
      @update:options="load"
    >
      <template #no-data>{{ error ? 'Could not load work items.' : 'No matching work items.' }}</template>
    </VDataTableServer>
  </section>
</template>
```

Abort and latest-request identity prevent stale responses replacing newer options, including implementations that ignore cancellation. For an installed query cache, use its equivalent cancellation/key semantics instead of layering this local loader beside it. Forward search to the server; the server table's search option is not client filtering. Search changes reset the page in 4.3; other app-owned filters may need an explicit page reset. Restrict page-size choices when the API cannot support `-1` (“all”). Reconcile an out-of-range page after deletion according to the service contract. Server authorization and sort-key allowlisting cannot be delegated to a table prop. [Server table](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDataTable/VDataTableServer.tsx), [options behavior](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDataTable/composables/options.ts).

Use `VDataTableVirtual` only when all required rows are already available and rendering is the bottleneck. Give it an intentional viewport/height for a bounded-scrolling design; do not claim omission always renders nothing. Virtual DOM rows do not provide full-DOM find/print behavior. For headless table engines and large lists, use [data-tables.md](data-tables.md) and [virtualization.md](virtualization.md).

## Lists, tabs, selects, and local files

Navigation lists use real `href`/`to` destinations; selection lists use `v-model:selected` with explicit item values and an appropriate select strategy. `VListGroup` uses an activator slot whose props belong on its `VListItem`. Do not use array indexes as persistent selected IDs, and do not treat a navigation list as a form input without an explicit input contract.

Complete descendant SFC combining two local panels, keyed choice values, and genuine local file selection. It deliberately makes no upload claim:

```vue
<script setup lang="ts">
import { shallowRef, type HTMLAttributes } from 'vue'
import { VTabs, VTab, VTabsWindow, VTabsWindowItem } from 'vuetify/components/VTabs'
import { VSelect } from 'vuetify/components/VSelect'
import { VListItem } from 'vuetify/components/VList'
import { VFileInput } from 'vuetify/components/VFileInput'

const tablistAttrs: Pick<HTMLAttributes, 'aria-label' | 'class' | 'style'> = {
  'aria-label': 'Draft panels',
}

const tab = shallowRef('details')
const priority = shallowRef<string | null>('normal')
const files = shallowRef<File[]>([])
const rejectedNames = shallowRef<string[]>([])
const priorities = [
  { code: 'normal', title: 'Normal', description: 'Use the standard queue.' },
  { code: 'urgent', title: 'Urgent', description: 'Needs time-sensitive review.' },
]

function selectFiles(value: File | File[] | null | undefined) {
  files.value = value == null ? [] : Array.isArray(value) ? value : [value]
}

function rejectFiles(value: File[]) {
  rejectedNames.value = value.map(file => file.name)
}
</script>

<template>
  <section aria-label="Draft settings">
    <VTabs v-model="tab" v-bind="tablistAttrs" align-tabs="start">
      <VTab value="details">Details</VTab>
      <VTab value="attachments">Attachments</VTab>
    </VTabs>
    <VTabsWindow v-model="tab">
      <VTabsWindowItem value="details" class="pt-4">
        <VSelect
          v-model="priority"
          :items="priorities"
          item-title="title"
          item-value="code"
          label="Priority"
        >
          <template #item="{ item, props: itemProps }">
            <VListItem v-bind="itemProps" :subtitle="item.description" />
          </template>
        </VSelect>
        <p>Selected priority: {{ priority ?? 'None' }}</p>
      </VTabsWindowItem>
      <VTabsWindowItem value="attachments" class="pt-4">
        <VFileInput
          :model-value="files"
          multiple
          chips
          show-size
          label="Local attachments"
          filter-by-type="image/png,image/jpeg"
          hint="Choose PNG or JPEG files."
          persistent-hint
          @update:model-value="selectFiles"
          @rejected="rejectFiles"
        />
        <p>Files are local only; nothing has been uploaded.</p>
        <p v-if="rejectedNames.length" role="status">
          Last rejected files: {{ rejectedNames.join(', ') }}. Only PNG and JPEG files are selected.
        </p>
        <ul>
          <li v-for="(file, index) in files" :key="`${file.name}-${file.lastModified}-${index}`">
            {{ file.name }}: {{ file.size }} bytes
          </li>
        </ul>
      </VTabsWindowItem>
    </VTabsWindow>
  </section>
</template>
```

Tab and panel values must match; `align-tabs`, not obsolete `align`/`centered` snippets, controls alignment. Use tab/window components together to retain their integration. Tabs switch local panels; route navigation belongs to the router. Check keyboard navigation and actual tab/panel naming in the integrated UI. [Tabs source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VTabs/VTabs.tsx).

The locally checked `tablistAttrs` bag keeps the accessible name on the actual `role="tablist"`: 4.3 forwards `VTabs` attributes to its `VSlideGroup` tablist, although its published props omit `aria-label`. As in [strict native fallthrough](vuetify-setup.md#strict-template-checking-and-native-fallthrough), the narrow annotation retains optional shared `class`/`style` keys without emitting them or widening unrelated component props. Keep the name on `VTabs`, not only on the surrounding section.

In 4.3 `VSelect`'s **slot name remains `item`**. Its payload `item` is raw domain data; `internalItem` is the normalized wrapper. Bind slot `props` to `VListItem` to preserve selection, refs, and accessibility. `item-title` is the visible label, `item-value` is the model identity, `return-object` changes the model to the object, and `multiple` changes it to an array. A `VAutocomplete` owns filtered choices, while `VCombobox` permits values absent from the list; validate those intentionally. Server-backed autocomplete search/request ownership belongs to a query layer, not a huge local list. [Select slot implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VSelect/VSelect.tsx).

For lists, `lines="one"|"two"|"three"` sets presentation; use `title`/`subtitle`, prepend icons/avatars, and append slots for actual content rather than assuming `text` creates a third-line API. `nav` changes styling, not navigation. Bind `v-model:opened` for nested groups and `v-model:selected` for selection. Use the current `select-strategy` (`single-independent` for one independent leaf, `independent` for independent multiple selection) instead of copying a nonexistent list `multiple` prop. Bind group activator props and distinct values; append actions must not accidentally trigger the parent navigation/selection handler.

For dynamic tabs, use stable values/keys rather than indexes; when removing the active tab, choose a surviving value and logical focus target. `grow`, `fixed-tabs`, `show-arrows`, `align-tabs`, and `direction="vertical"` express current presentation. `VTabsWindowItem` is lazy by default; use `eager` only when eager mounting is required, and keep drafts outside panels if their lifetime must outlast removal. `VWindow` remains a general-purpose component, not a removed API; use `VTabsWindow` for the tabs-specific integration. [List/nested strategies](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/nested/selectStrategies.ts), [list props](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VList/VList.tsx), [tab/window integration](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VTabs/VTabsWindow.tsx).

`VAutocomplete :custom-filter` can implement prefix matching with `(value, query) => value.toLocaleLowerCase().startsWith(query.toLocaleLowerCase())`; it filters supplied data, not an absent remote dataset. For server search, bind `v-model:search`, use the cache/request owner to replace items, use `no-filter` when results are already server-filtered, and preserve selected identity while the suggestion page changes. For multiple file rules the input value is a **file array**: validate every file with `Array.isArray(value) && value.every(file => file.size <= limit)` after deciding the empty-selection policy; a rule reading `value.size` from a multiple input is incorrect.

`VFileInput` emits an array with `multiple` and a single file otherwise; initializing its non-multiple model to `[]` does not preserve array output. Clearing can emit an empty value, so do not blindly read `files[0].name`. A multiple model initialized to `[]` is convenient. `accept` is a chooser hint; 4.3 `filter-by-type` additionally filters selected/dropped files and emits `rejected` for rejected files. Neither is a security boundary. Enforce size/type/content/server limits in the real upload implementation. `VFileUpload` is **stable** in 4.3 at `vuetify/components/VFileUpload`, offers a dropzone/list, and still performs no HTTP request. Upload progress must reflect real transport events, not a timer. If previews use object URLs, revoke them on replacement/unmount. [File input](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VFileInput/VFileInput.tsx), [file upload](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VFileUpload/VFileUpload.tsx), [file filtering](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/fileFilter.ts).

The `multiple` flag controls runtime shape, but 4.3's published `update:modelValue` signature remains `File | File[]`; the fence normalizes that boundary to an app-owned `File[]` and handles empty clears. `filter-by-type` also supplies the native chooser's accept pattern. Keep rejected-file feedback visible instead of silently discarding input. [Tagged file-input model, filtering, and native input](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VFileInput/VFileInput.tsx).

## Public hotkey, scrolling, and mask workflows

All public composables import from `vuetify` and should run in setup with the installed service context. `useDisplay()` returns refs (`name`, `width`, `height`, breakpoint flags, `mobile`, platform data); destructure those refs rather than freezing `.value` into local constants. Threshold/mobile policy belongs in `createVuetify({ display })`; SSR sizing belongs in [vuetify-setup.md](vuetify-setup.md#ssr-is-an-integration-not-a-boolean-only-solution). Theme, date, locale/RTL, layout, defaults, and rules composables are covered in their owning sections above or the setup/theme companions.

Complete descendant SFC with an actual shortcut, an in-page scroll target, and mask feedback:

```vue
<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useGoTo, useHotkey, useMask } from 'vuetify'
import { VBtn } from 'vuetify/components/VBtn'
import { VTextField } from 'vuetify/components/VTextField'

const target = useTemplateRef<HTMLElement>('details')
const detailsOpen = shallowRef(true)
const code = shallowRef('')
const goTo = useGoTo({ duration: 250 })
const mask = useMask({ mask: '####-####' })
const preview = computed(() => mask.mask(code.value))
const complete = computed(() => mask.isComplete(code.value))

useHotkey('cmd+shift+k', event => {
  if (!event.repeat) detailsOpen.value = !detailsOpen.value
})

async function jump() {
  const element = target.value
  if (!element) return
  await goTo(element, { layout: true, offset: -8 })
  element.focus()
}
</script>

<template>
  <VBtn @click="jump">Jump to details</VBtn>
  <VTextField v-model="code" label="Eight-digit local code" hint="Preview inserts the dash." persistent-hint />
  <p>Masked preview: {{ preview }}; {{ complete ? 'complete' : 'incomplete' }}</p>
  <section ref="details" tabindex="-1" aria-label="Shortcut details">
    <VBtn :aria-expanded="detailsOpen" @click="detailsOpen = !detailsOpen">Toggle details</VBtn>
    <p v-if="detailsOpen">Command/Control + Shift + K also toggles these details outside text inputs.</p>
  </section>
</template>
```

`useHotkey` uses keydown, ignores focused input/textarea/contenteditable by default, and prevents the matching native default by default. `cmd` maps to Command on macOS and Control elsewhere. `inputs: true` opts into text-entry shortcuts; do not steal normal editing commands unintentionally. `event`, `inputs`, `preventDefault`, and `sequenceTimeout` are configurable; sequences such as `'g d'` use the timeout. The returned function unregisters, and scope disposal removes listeners; disable a conditionally active registration by passing a reactive undefined key rather than leaving hidden views handling global shortcuts.

`useGoTo()` accepts a number, selector, DOM element, or supported component instance and resolves a promise. `container` selects the actual scroller, `layout: true` accounts for the target's layout offset, `offset` adds an adjustment, and `.horizontal(...)` uses horizontal/RTL scrolling. A missing selector can fall back to zero, so validate app targets; scrolling does **not** move keyboard focus. Invoke after mount/user interaction, not during SSR. Reduced-motion preference selects instant easing in the current implementation.

`useMask({ mask })` supplies `mask`, `unmask`, `isValid`, `isComplete`, and `isDelimiter`. `isValid` allows valid **partial** input; require `isComplete` if the application needs all positions. `#` is a digit; `A`/`a` and `N`/`n` normalize letter/alphanumeric case; an object mask may supply custom token patterns/tests/converters. `unmask(null)` can return null. Helpers do not manage input caret/composition events and do not establish semantic validity (a mask-shaped date can be impossible). For caret-managed input, evaluate the still-labs `VMaskInput` at `vuetify/labs/VMaskInput`; keep domain/server validation separate. [Hotkey source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/hotkey/hotkey.ts), [scroll source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/goto.ts), [mask source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/mask/mask.ts).

## Page composition and transactional editing

| Page responsibility | Composition and data boundary |
| --- | --- |
| Login | Center a constrained `VCol`/card inside the existing shell using current flex utilities. A labeled credential `VForm` awaits its submit event; use the app's real authentication provider, request state, and accessible error result. Remember-me is a provider/session policy, not saving a password in local storage. Keep a working Cancel/alternate route and never log credentials or show a fake authenticated result. See [auth.md](auth.md). |
| List page | Put search and creation actions in a wrapping toolbar/header, define stable headers/IDs, render status chips and real row actions, and distinguish loading/error/empty states. Choose client versus server ownership before wiring search/pagination; see the complete table examples above. |
| Card grid | Loop over real keyed items with `cols="12" sm="6" md="4" lg="3"` as appropriate, use equal-height cards only where useful, and let actions wrap at text zoom. Supply informative media alt text and a real destination/action. Price/date formatting belongs to the domain locale, not string concatenation. |
| Dashboard | Reuse the registered bar/drawer/main shell, compose labeled statistic cards and the appropriate table, and derive summaries from real data. An active navigation value alone does not navigate; old `dark` props or fabricated KPI values do not establish a working dashboard. |
| Detail/edit page | Hold a draft separate from the loaded entity; label related sections, use a responsive grid, and connect Save to the form even when its button is outside (native `form` attribute/ID or an explicit awaited imperative validation action). Cancel discards only the draft. Preserve draft/errors on failed saves and coordinate dirty-navigation policy with [routing.md](routing.md). |
| Modal CRUD | Keep stable selected identity and a separate draft. Open prepopulates without mutating the row, Cancel has no mutation, Save awaits validation and the authoritative operation, Delete names the specific entity and requires confirmation. Close/notify only after success; keep errors and values on failure and restore focus to a surviving logical control. |

Complete local-only descendant SFC: creation, editing, cancellation, and confirmed deletion change real in-memory rows. It intentionally implements focus return manually for its externally controlled dialog; there is no unused activator slot or simulated service delay.

```vue
<script setup lang="ts">
import { nextTick, ref, shallowRef, useTemplateRef } from 'vue'
import type { DataTableHeader, SubmitEventPromise, ValidationRule } from 'vuetify'
import { VDataTable } from 'vuetify/components/VDataTable'
import { VDialog } from 'vuetify/components/VDialog'
import { VCard, VCardText, VCardActions } from 'vuetify/components/VCard'
import { VForm } from 'vuetify/components/VForm'
import { VTextField } from 'vuetify/components/VTextField'
import { VBtn } from 'vuetify/components/VBtn'

type Row = { id: number; title: string }
const rows = ref<Row[]>([{ id: 1, title: 'Review copy' }])
const headers: DataTableHeader[] = [
  { title: 'Title', key: 'title' },
  { title: 'Actions', key: 'actions', sortable: false },
]
const search = shallowRef('')
const open = shallowRef(false)
const deleting = shallowRef(false)
const pending = shallowRef(false)
const selectedId = shallowRef<number | null>(null)
const draftTitle = shallowRef('')
const status = shallowRef('')
const addButton = useTemplateRef<HTMLButtonElement>('addButton')
const editor = useTemplateRef<InstanceType<typeof VForm>>('editor')
let nextId = 2
let returnTarget: HTMLElement | null = null
const rules: ValidationRule[] = [
  value => typeof value === 'string' && value.trim().length > 0 || 'Enter a title.',
]

async function begin(row: Row | null, remove: boolean, event: MouseEvent) {
  returnTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  selectedId.value = row?.id ?? null
  draftTitle.value = row?.title ?? ''
  deleting.value = remove
  open.value = true
  await nextTick()
  editor.value?.resetValidation()
}

async function save(event: SubmitEventPromise) {
  if (pending.value) return
  pending.value = true
  try {
    if (!(await event).valid) return
    if (selectedId.value === null) {
      rows.value.push({ id: nextId++, title: draftTitle.value.trim() })
    } else {
      const row = rows.value.find(row => row.id === selectedId.value)
      if (!row) return
      row.title = draftTitle.value.trim()
    }
    status.value = 'Session item saved.'
    open.value = false
  } finally {
    pending.value = false
  }
}

function remove() {
  rows.value = rows.value.filter(row => row.id !== selectedId.value)
  status.value = 'Session item deleted.'
  open.value = false
}

function restoreFocus() {
  if (returnTarget?.isConnected) returnTarget.focus()
  else addButton.value?.focus()
}
</script>

<template>
  <h2>Session items</h2>
  <button ref="addButton" type="button" @click="begin(null, false, $event)">Add item</button>
  <VTextField v-model="search" label="Search session items" />
  <VDataTable :headers="headers" :items="rows" :search="search" item-value="id">
    <template #item.actions="{ item }">
      <button type="button" :aria-label="`Edit ${item.title}`" @click="begin(item, false, $event)">Edit</button>
      <button type="button" :aria-label="`Delete ${item.title}`" @click="begin(item, true, $event)">Delete</button>
    </template>
  </VDataTable>
  <VDialog v-model="open" max-width="480" aria-labelledby="editor-title" @after-leave="restoreFocus">
    <VCard>
      <VCardText>
        <h3 id="editor-title">{{ deleting ? 'Delete item?' : 'Edit session item' }}</h3>
        <p v-if="deleting">Delete “{{ draftTitle }}” from this session? This cannot be undone.</p>
        <VForm v-else id="session-editor" ref="editor" validate-on="submit lazy" @submit.prevent="save">
          <VTextField v-model="draftTitle" label="Title" :rules="rules" :readonly="pending" />
        </VForm>
      </VCardText>
      <VCardActions>
        <VBtn :disabled="pending" @click="open = false">Cancel</VBtn>
        <VBtn v-if="deleting" color="error" @click="remove">Delete</VBtn>
        <VBtn v-else type="submit" form="session-editor" :loading="pending" :disabled="pending">Save</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
  <p role="status">{{ status }} All changes are in memory only.</p>
</template>
```

When connecting this pattern to a real service, await its success before changing canonical rows/closing, or implement the app cache's explicit optimistic-update/rollback contract. Keep pending state through the request, retain errors beside the form, and prevent dismissal that would silently lose in-flight user work. Reconcile selected/expanded IDs and remote page count after deletion. A reset-to-empty-form action differs from restoring the loaded draft: `VForm.reset()` does not reload an entity. Do not universally add `persistent` merely because a dialog contains fields; choose a deliberate discard/cancellation policy. These are application architecture recommendations built on the [form](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VForm/VForm.tsx) and [dialog](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VDialog/VDialog.tsx) contracts.

## Verification boundary

These are complete focused examples or explicitly marked application-service integrations, informed by exact 4.3 source/declarations; they are not reports of executed builds or browser checks. In the owning app, exercise Enter and invalid/async submission, rapid repeated submit, cancel/confirm focus return, Escape/Tab/arrow keys, remote error/retry and out-of-order replies, page counts/selection after refresh, both themes, RTL, small viewports, text scaling, and rejected/cleared files. Test outcomes belong in [testing.md](testing.md), not assumptions about library-provided accessibility.

## Sources

- [Vuetify 4.3.0 registry](https://registry.npmjs.org/vuetify/4.3.0), [Vue 3.5.44 registry](https://registry.npmjs.org/vue/3.5.44), [4.3 stable component exports](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/index.ts).
- [4.3 public types](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/types.ts), [4.3 upgrade guide](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/getting-started/upgrade-guide.md).
- Exact component/composable implementation links appear beside the version-sensitive decisions above; use the tagged source when the live docs reader exposes only metadata.
