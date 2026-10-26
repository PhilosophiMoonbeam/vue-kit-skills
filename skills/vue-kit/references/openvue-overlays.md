# OpenVue overlays, services, and focus

OpenVue **1.0.0**, Vue 3.5, Composition API. Use [selection](openvue.md), [installation and SSR setup](openvue-setup.md), [theme scope](openvue-theming.md), and [navigation](openvue-navigation.md). Imports are explicit; service plugins do not register visual hosts. The named fences below form a complete standalone local application; each fence is an exact file, not pseudocode. Supply a normal `index.html` with `<div id="app"></div>` and a module script for `/src/main.ts`.

## Choose by interaction contract

| Need | Import / state owner | Consequential contract |
| --- | --- | --- |
| Controlled task window | `openvue/dialog`; caller owns `v-model:visible` boolean | **Set `modal` explicitly**; default is nonmodal. `header` names it; footer/default/header slots keep normal structure. `container` replaces it and must retain naming, close controls, and focusable content. |
| Edge panel | `openvue/drawer`; `v-model:visible` boolean | `position`: left/right/top/bottom/full. Modal defaults true and uses `role="dialog"`; nonmodal uses `role="complementary"`. Give the task an accessible name through its header or `pt.root`, and choose a deliberate role for nonmodal content. Size with CSS; a full panel is not a separate route. |
| Anchored rich content | `openvue/popover`; component ref | `toggle(event)`, `show(event, target?)`, `hide()`, not an activator slot or `v-model:open`. Capture the actual `event.currentTarget`, not an icon's `event.target`. Render one outside a row loop; separately store the selected record ID. |
| Transient outcome | `openvue/toast` + ToastService + `useToast()` | A notification is not the operation, persistence, validation, a pending-state owner, or an undo implementation. |
| Modal decision | `openvue/confirmdialog` + ConfirmationService + `useConfirm()` | `require(options)` selects host by exact `group`; accept/reject are synchronous notification callbacks, not awaited transaction hooks. |
| Anchored decision | `openvue/confirmpopup` + same service | Requires a live `target: HTMLElement`; scroll, resize, outside click, and Escape may dismiss without running reject. |
| Runtime-loaded task | `openvue/dynamicdialog` + DialogService + `useDialog()` | One host; `open(Content, options)` returns a closeable instance. Content receives an injected **Ref** under `'dialogRef'`. |
| Constrain tabbing only | `openvue/focustrap` directive | Not a dialog: no role, label, mask, inert background, Escape, trigger relationship, scroll lock, or focus restoration. |
| Visual busy mask | `openvue/blockui` | `blocked` boolean, optional `fullScreen`; updates `aria-busy`. Does not disable controls or authorize operations. |
| Advisory text | `openvue/tooltip` directive | Local `import vTooltip from 'openvue/tooltip'` enables `v-tooltip`. Use `.focus` for focus triggers and `.top/.bottom/.left/.right` for placement; default is hover/right. |

## Dialog, Drawer, Popover: focus and DOM lifetime

Dialog uses `role=dialog`, associates the generated header ID through `aria-labelledby`, and traps tab focus **only when modal**. `closeOnEscape` and `dismissableMask` are distinct; outside-mask dismissal is opt-in for Dialog. Keep `closable`, explicit cancel, and Escape policies consistent with draft loss. `show` occurs on entry; `hide` starts leaving; `after-hide` is the point after mask/listener cleanup. Dialog remembers the active element on entry and restores it on leave. A removed/disabled trigger cannot receive focus: choose a stable fallback after destructive actions. Width plus `breakpoints` accommodates small screens; long content scrolls. `maximizable`/dragging affect geometry, not task ownership.

Drawer has its own `dismissable`/modal/Escape policies; do not copy Dialog's mask prop name. Its published implementation does not remember and restore the opener like Dialog: capture a connected target and restore it on `after-hide` yourself. Use `blockScroll` explicitly when needed; modal defaults true but does not itself enable that scroll lock. Use header/footer or `container` slots intentionally. Both controlled overlays need trigger `aria-controls` and `aria-expanded`; do not assume a `visible` model creates those attributes. Strict templates may reject undeclared native root attributes: use the component's declared `pt.root`, not casts or global type augmentation.

Popover provides dialog semantics and a tab trap but is not equivalent to a full-screen modal with an inert background. `dismissable` governs outside click; `closeOnEscape` governs Escape. Escape from its content hides it and focuses its anchor in the published implementation; a plain `hide()`/outside dismissal does **not** promise that same restoration. If a workflow needs it for explicit close, retain the anchor and focus it when it remains connected. `show`/`hide` events are visibility notifications, not commit signals. A different target while already open requires deliberate hide/show and updated selected identity; never let an old record callback act on a newly selected row.

Most overlay content portals to `body`; descendant selectors under `#app` will not reach it. Put the dark-mode selector on `html`, load tokens globally, and inspect the actual body portal. `appendTo="self"` or an HTMLElement changes clipping, stacking, and theme ancestry; it is not a universal fix for a theme bug. Use configured z-index layers, not arbitrary giant values. DOM targets are client-only: never read `document`, focus, or call `show()` during SSR setup. Open only after mount/user interaction; see setup for Nuxt profiles.

## Service installation, host, caller: all three are required

`useToast`, `useConfirm`, and `useDialog` must run in setup below their respective app plugins. Install each once per app; mount matching hosts before callers can issue requests. Event buses are shared by the package; avoid parallel apps/SSR cross-request assumptions. A `group` is routing, not a queue, authorization, or a component instance ID. Two hosts with the same group both react; an absent host loses the request. ConfirmationService `close()` is **global**, not group-scoped. Do not call it in arbitrary route cleanup when another feature owns a confirmation.

The following setup is a complete Vite entry. Theme dependency is `@openvue/themes@1.0.0`; no icon font is required by these examples. The feature component owns its hosts, so removing the feature also removes its portals. A single application-wide DynamicDialog is usual for route-persistent callers; this local host instead deliberately has the same lifetime as its only caller.

<!-- fixture: src/main.ts -->
```ts
import { createApp } from 'vue'
import OpenVue from 'openvue/config'
import Aura from '@openvue/themes/aura'
import ConfirmationService from 'openvue/confirmationservice'
import DialogService from 'openvue/dialogservice'
import ToastService from 'openvue/toastservice'
import App from './App.vue'
import './style.css'

createApp(App)
  .use(OpenVue, { theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } })
  .use(ConfirmationService)
  .use(DialogService)
  .use(ToastService)
  .mount('#app')
```

### Confirmation is a decision, not a transaction boundary

ConfirmDialog's documentation says a target is mandatory for alignment; the published `ConfirmationOptions` makes it optional and Dialog itself is not anchored. Supply the clicked button anyway to preserve caller identity, but do **not** rely on automatic trigger ARIA wiring: the 1.0.0 ConfirmDialog implementation computes `target` without wiring its ARIA relationship. ConfirmPopup really uses it for position and restoration. Preserve one stable target and ID per pending decision; don't retain the transient Event to read `currentTarget` later.

Set `defaultFocus: 'reject'` for destructive actions. `acceptProps` and `rejectProps` configure labels/severity; message/icon slots customize content, while `container` exposes accept/reject/close callbacks and transfers the full UI responsibility to you. `accept` runs only for explicit acceptance; `reject` only for its explicit button. X/Escape can call `onHide`, while `close()`, outside/scroll popup dismissal, and host unmount are **not a guaranteed reject/onHide sequence**. `onShow` is dispatched before the entry transition, not proof focus has arrived. Do not build a Promise that resolves only on reject and then hangs on dismissal. Never put deletion in `onHide`, `finally`, or toast-close.

The service does not await an async accept callback; its UI closes immediately. Catch failures in an application-owned async function, keep busy/error state outside the disappearing confirmation, revalidate the record/permission at commit, and notify success **after** commit. Confirmation is not protection against stale data or a second caller. Server-backed applications must repeat authorization/concurrency checks on the server. The local store below checks the protected flag and compares the originally displayed record with current storage in the same IndexedDB read/write transaction as the change; a stale rename or deletion fails instead of overwriting another tab's work.

### Complete local persistence and service-backed flow

This is real browser IndexedDB, not a fake network call. A fresh database seeds two local records once; remounting preserves edits/deletion. `AbortSignal` aborts outstanding transactions on owner disposal, but cannot undo an already committed change. Aborting at that completion boundary can throw `InvalidStateError`, so the cancellation helper ignores only that finished-transaction condition; every async UI continuation still checks its owner. Draft cancellation never starts a write. The type guards protect the untyped dynamic-dialog boundary rather than casting its payload. This application intentionally serializes local decisions and allows only one dynamic dialog at a time: 1.0.0's host uses shared `currentInstance` bookkeeping during close transitions, so overlapping close lifetimes are not a contract to depend on.

<!-- fixture: src/project-store.ts -->
```ts
export interface Project { id: string; title: string; protected: boolean }
export function isProject(value: unknown): value is Project {
  return typeof value === 'object' && value !== null && 'id' in value &&
    typeof value.id === 'string' && 'title' in value && typeof value.title === 'string' &&
    'protected' in value && typeof value.protected === 'boolean'
}

function abortPending(tx: IDBTransaction) {
  try { tx.abort() }
  catch (cause) {
    if (!(cause instanceof DOMException && cause.name === 'InvalidStateError')) throw cause
  }
}

function database(signal: AbortSignal): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const request = indexedDB.open('openvue-interaction-projects', 1)
    let refused = false
    request.onupgradeneeded = () => {
      if (signal.aborted || refused) { request.transaction?.abort(); return }
      const store = request.result.createObjectStore('projects', { keyPath: 'id' })
      store.put({ id: 'draft', title: 'Field notes', protected: false })
      store.put({ id: 'policy', title: 'Retention policy', protected: true })
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => { refused = true; reject(new Error('Close other project tabs and reload.')) }
    request.onsuccess = () => {
      if (signal.aborted || refused) { request.result.close(); reject(signal.reason ?? new Error('Database open cancelled.')); return }
      resolve(request.result)
    }
  })
}

export async function readProjects(signal: AbortSignal): Promise<Project[]> {
  const db = await database(signal)
  return new Promise((resolve, reject) => {
    if (signal.aborted) { db.close(); reject(signal.reason); return }
    const tx = db.transaction('projects', 'readonly')
    const request = tx.objectStore('projects').getAll()
    let result: Project[] = []
    let failure: Error | null = null
    const abort = () => abortPending(tx)
    signal.addEventListener('abort', abort, { once: true })
    request.onsuccess = () => {
      const values: unknown = request.result
      if (Array.isArray(values) && values.every(isProject)) result = values
      else { failure = new Error('Invalid stored project data.'); tx.abort() }
    }
    tx.oncomplete = () => { cleanup(); resolve(result) }
    tx.onabort = () => { cleanup(); reject(failure ?? tx.error ?? new Error('Read cancelled.')) }
    function cleanup() { signal.removeEventListener('abort', abort); db.close() }
  })
}

export async function changeProject(
  expected: Project, change: { kind: 'delete' } | { kind: 'rename'; title: string }, signal: AbortSignal
): Promise<void> {
  const db = await database(signal)
  return new Promise((resolve, reject) => {
    if (signal.aborted) { db.close(); reject(signal.reason); return }
    const tx = db.transaction('projects', 'readwrite')
    const store = tx.objectStore('projects')
    const request = store.get(expected.id)
    let failure: Error | null = null
    const abort = () => abortPending(tx)
    signal.addEventListener('abort', abort, { once: true })
    request.onsuccess = () => {
      const project: unknown = request.result
      if (!isProject(project)) failure = new Error('Project no longer exists.')
      else if (project.protected) failure = new Error('Protected projects cannot be changed.')
      else if (project.title !== expected.title || project.protected !== expected.protected) {
        failure = new Error('Project changed elsewhere. Reload before trying again.')
      }
      else if (change.kind === 'rename' && !change.title.trim()) failure = new Error('Title is required.')
      else if (change.kind === 'delete') store.delete(expected.id)
      else store.put({ ...project, title: change.title.trim() })
      if (failure) tx.abort()
    }
    tx.oncomplete = () => { cleanup(); resolve() }
    tx.onabort = () => { cleanup(); reject(failure ?? tx.error ?? new Error('Change cancelled.')) }
    function cleanup() { signal.removeEventListener('abort', abort); db.close() }
  })
}
```

DynamicDialog passes **Dialog props**, not content props, through `options.props`. Pass input through `data`; its content can inject `Ref<DynamicDialogInstance>`. `templates.header/footer` accepts components; `emits` supplies `onEvent` handlers for emitted content events. `close(payload)` reports `{ type: 'config-close', data: payload }`; X/Escape reports `dialog-close` without successful data. The declaration's `onClose` argument is optional; handle absence. Do not treat any close as save. An external `instance.close()` also produces `config-close`; require your own discriminated success payload. Injection and return types are intentionally loose in the package, so validate both ingress and egress.

<!-- fixture: src/RenameProject.vue -->
```vue
<script setup lang="ts">
import { inject, shallowRef, type Ref } from 'vue'
import Button from 'openvue/button'
import type { DynamicDialogInstance } from 'openvue/dynamicdialogoptions'
import { isProject } from './project-store'

const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')
if (!dialogRef) throw new Error('RenameProject requires DynamicDialog.')
const input: unknown = dialogRef.value.data
if (!isProject(input)) throw new Error('RenameProject requires project data.')
const projectId = input.id
const title = shallowRef(input.title)
const error = shallowRef('')
function save() {
  const next = title.value.trim()
  if (!next) { error.value = 'Title is required.'; return }
  dialogRef?.value.close({ kind: 'rename', id: projectId, title: next })
}
function cancel() { dialogRef?.value.close() }
</script>

<template>
  <form @submit.prevent="save">
    <label for="project-title">Project title</label>
    <input id="project-title" v-model="title" autofocus :aria-invalid="!!error" aria-describedby="title-error" />
    <p id="title-error" role="alert">{{ error }}</p>
    <Button type="button" label="Cancel rename" severity="secondary" @click="cancel" />
    <Button type="submit" label="Save title" />
  </form>
</template>
```

<!-- fixture: src/ProjectActions.vue -->
```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
import Button from 'openvue/button'
import ConfirmDialog from 'openvue/confirmdialog'
import ConfirmPopup from 'openvue/confirmpopup'
import DynamicDialog from 'openvue/dynamicdialog'
import Toast from 'openvue/toast'
import { useConfirm } from 'openvue/useconfirm'
import { useDialog } from 'openvue/usedialog'
import { useToast } from 'openvue/usetoast'
import type { DynamicDialogInstance } from 'openvue/dynamicdialogoptions'
import RenameProject from './RenameProject.vue'
import { changeProject, readProjects, type Project } from './project-store'

const confirm = useConfirm()
const dialog = useDialog()
const toast = useToast()
const projects = shallowRef<Project[]>([])
const busy = shallowRef(true)
const error = shallowRef('')
const outcome = shallowRef('Loading local projects…')
const heading = useTemplateRef<HTMLHeadingElement>('heading')
const lifetime = new AbortController()
let alive = true
let opened: DynamicDialogInstance | null = null

let decisionOpen = false
let restoreAfterOperation = false
function restoreOutcomeFocus() {
  if (!alive || busy.value || decisionOpen || opened || !restoreAfterOperation) return
  restoreAfterOperation = false
  heading.value?.focus()
}
function afterDecisionHide() {
  decisionOpen = false
  restoreOutcomeFocus()
}
onMounted(async () => {
  try {
    const next = await readProjects(lifetime.signal)
    if (!alive) return
    projects.value = next
    outcome.value = 'Ready'
  }
  catch (cause) {
    if (alive) { error.value = message(cause); outcome.value = 'Could not load local projects' }
  }
  finally { if (alive) busy.value = false }
})
onBeforeUnmount(() => {
  alive = false
  lifetime.abort()
  opened?.close()
  opened = null
})
function message(cause: unknown) { return cause instanceof Error ? cause.message : String(cause) }
async function commit(project: Project, change: { kind: 'delete' } | { kind: 'rename'; title: string }) {
  if (!alive || busy.value) return
  busy.value = true
  error.value = ''
  restoreAfterOperation = true
  try {
    await changeProject(project, change, lifetime.signal)
    const next = await readProjects(lifetime.signal)
    if (!alive) return
    projects.value = next
    outcome.value = change.kind === 'delete' ? 'Project deleted' : 'Project renamed'
    toast.add({ group: 'projects', severity: 'success', summary: outcome.value, life: 3500 })
  } catch (cause) {
    if (alive) { error.value = message(cause); outcome.value = 'Operation failed; stored state may need reloading' }
  } finally {
    if (alive) { busy.value = false; restoreOutcomeFocus() }
  }
}
function askDelete(event: MouseEvent, project: Project, popup: boolean) {
  const target = event.currentTarget
  if (!alive || !(target instanceof HTMLElement) || busy.value || opened || decisionOpen) return
  if (project.protected) { error.value = 'Protected projects cannot be changed.'; return }
  decisionOpen = true
  confirm.require({
    group: popup ? 'project-popup' : 'project-delete', target,
    header: 'Delete project?', message: `Delete ${project.title}?`, defaultFocus: 'reject',
    rejectProps: { label: 'Keep project', severity: 'secondary' },
    acceptProps: { label: 'Delete permanently', severity: 'danger' },
    accept: () => { void commit(project, { kind: 'delete' }) },
    reject: () => { if (alive) outcome.value = 'Deletion rejected' }
  })
}
function rename(project: Project) {
  if (!alive || busy.value || opened || decisionOpen || project.protected) return
  const dialogProps = {
    header: 'Rename project', modal: true, style: { width: 'min(32rem, 95vw)' }, draggable: false,
    onAfterHide: () => { opened = null; restoreOutcomeFocus() }
  }
  opened = dialog.open(RenameProject, {
    props: dialogProps,
    data: { ...project },
    onClose: (options) => {
      const data: unknown = options?.data
      if (alive && options?.type === 'config-close' && typeof data === 'object' && data !== null &&
          'kind' in data && data.kind === 'rename' && 'id' in data && data.id === project.id &&
          'title' in data && typeof data.title === 'string') {
        void commit(project, { kind: 'rename', title: data.title })
      }
    }
  })
}
</script>

<template>
  <section aria-labelledby="projects-heading" :aria-busy="busy">
    <h2 id="projects-heading" ref="heading" tabindex="-1">Local projects</h2>
    <p role="status">{{ outcome }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <ul>
      <li v-for="project in projects" :key="project.id" :id="`project-${project.id}`">
        <span>{{ project.title }}</span>
        <span v-if="project.protected"> (protected)</span>
        <Button :label="`Rename ${project.title}`" :disabled="busy || project.protected" @click="rename(project)" />
        <Button :label="`Delete ${project.title}`" :disabled="busy || project.protected" @click="askDelete($event, project, false)" />
        <Button :label="`Quick delete ${project.title}`" :disabled="busy || project.protected" @click="askDelete($event, project, true)" />
      </li>
    </ul>
    <ConfirmDialog group="project-delete" :draggable="false" :pt="{ transition: { onAfterLeave: afterDecisionHide } }" />
    <ConfirmPopup group="project-popup" :pt="{ root: { 'aria-label': 'Quick delete project' }, transition: { onAfterLeave: afterDecisionHide } }" />
    <DynamicDialog />
    <Toast group="projects" position="bottom-right" />
  </section>
</template>
```

**Completion and focus policy:** the inferred `dialogProps` object includes the Dialog's Vue `onAfterHide` listener; passing this variable preserves structural typing without inventing an event on DynamicDialog or casting its options. Clear the single active handle only after transition cleanup. `onClose` occurs earlier; immediately opening another dialog from it races the host's shared close bookkeeping. Confirm hosts use their declared `pt.transition.onAfterLeave` to release the same local decision guard. Persistence may finish before or after a portal leaves: only restore the stable outcome heading when **both** operation and overlay cleanup have finished. Otherwise the library's leave-time restoration can target a disabled or deleted opener, or override application focus. Cancel/reject still use the live opener's native restoration. A conflict remains an inline error; reload to inspect current data before making a new decision.

### Complete application shell and overlay consumer

These files complete the entry, store, and service workflow above. `OverlayControls` exercises controlled Dialog/Drawer, event-anchored Popover, escaped focus tooltip, mounted standalone trap and explicit fallback restoration, and BlockUI with real disabled controls. It owns its DOM targets; no generic activator abstraction hides their lifetime. The root's optional default slot can host independent page content without coupling it to the overlay owners.

<!-- fixture: src/OverlayControls.vue -->
```vue
<script setup lang="ts">
import { nextTick, shallowRef, useTemplateRef } from 'vue'
import BlockUI from 'openvue/blockui'
import Button from 'openvue/button'
import Dialog from 'openvue/dialog'
import Drawer from 'openvue/drawer'
import Popover from 'openvue/popover'
import vFocustrap from 'openvue/focustrap'
import vTooltip from 'openvue/tooltip'

const visible = shallowRef(false)
const drawer = shallowRef(false)
const trapped = shallowRef(false)
const blocked = shallowRef(false)
const edits = shallowRef(0)
const popover = useTemplateRef('popover')
const trapTrigger = useTemplateRef<HTMLButtonElement>('trapTrigger')
let popoverTarget: HTMLElement | null = null
let drawerTarget: HTMLElement | null = null
function openDrawer(event: MouseEvent) {
  if (!(event.currentTarget instanceof HTMLElement)) return
  drawerTarget = event.currentTarget
  drawer.value = true
}
function restoreDrawerFocus() { if (drawerTarget?.isConnected) drawerTarget.focus() }
function togglePopover(event: MouseEvent) {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  popoverTarget = target
  popover.value?.toggle(event)
}
function closePopover() {
  popover.value?.hide()
  if (popoverTarget?.isConnected) popoverTarget.focus()
}
async function closeTrap() {
  trapped.value = false
  await nextTick()
  trapTrigger.value?.focus()
}
function edit() { if (!blocked.value) edits.value++ }
</script>

<template>
  <section aria-labelledby="controls-heading">
    <h2 id="controls-heading">Overlay controls</h2>
    <Button label="Open controlled dialog" :aria-expanded="visible" aria-controls="controlled-dialog" @click="visible = true" />
    <Dialog v-model:visible="visible" modal header="Controlled dialog" :draggable="false" :pt="{ root: { id: 'controlled-dialog' } }">
      <label for="dialog-note">Dialog note</label><input id="dialog-note" autofocus />
      <Button label="Close controlled dialog" @click="visible = false" />
    </Dialog>
    <Button label="Open drawer" :aria-expanded="drawer" aria-controls="controlled-drawer" @click="openDrawer" />
    <Drawer v-model:visible="drawer" modal blockScroll header="Project filters" position="right" :pt="{ root: { id: 'controlled-drawer', role: 'dialog', 'aria-label': 'Project filters' } }" @after-hide="restoreDrawerFocus">
      <label for="drawer-filter">Filter</label><input id="drawer-filter" autofocus />
    </Drawer>
    <Button label="Open anchored help" @click="togglePopover" />
    <Popover ref="popover" :pt="{ root: { 'aria-label': 'Anchored help' } }">
      <p>Drafts are not published until you confirm.</p>
      <Button label="Close help" autofocus @click="closePopover" />
    </Popover>
    <button ref="trapTrigger" type="button" @click="trapped = true">Open focus region</button>
    <div v-if="trapped" v-focustrap="{ autoFocus: true }" role="group" aria-label="Focus region">
      <button type="button">First focus action</button>
      <button type="button" @click="closeTrap">Leave focus region</button>
    </div>
    <Button v-tooltip.focus.top="'Supplemental keyboard help'" label="Focus for tip" aria-describedby="keyboard-help-description" />
    <span id="keyboard-help-description" class="visually-hidden">Supplemental keyboard help</span>
    <button type="button" @click="blocked = !blocked">{{ blocked ? 'Unblock editor' : 'Block editor' }}</button>
    <BlockUI :blocked="blocked" :pt="{ root: { style: 'position: relative' } }">
      <Button label="Increment edit" :disabled="blocked" @click="edit" />
      <p>Edits: {{ edits }}</p>
    </BlockUI>
  </section>
</template>
```

<!-- fixture: src/App.vue -->
```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import OverlayControls from './OverlayControls.vue'
import ProjectActions from './ProjectActions.vue'
const mounted = shallowRef(true)
function toggleTheme() { document.documentElement.classList.toggle('app-dark') }
</script>

<template>
  <main>
    <h1>Interaction reference consumer</h1>
    <button type="button" @click="toggleTheme">Toggle global theme</button>
    <button type="button" @click="mounted = !mounted">{{ mounted ? 'Dispose interaction owners' : 'Mount interaction owners' }}</button>
    <template v-if="mounted"><ProjectActions /><OverlayControls /></template>
    <slot />
  </main>
</template>
```

<!-- fixture: src/style.css -->
```css
:root { font-family: system-ui, sans-serif; color-scheme: light; }
html.app-dark { color-scheme: dark; }
body { margin: 0; background: var(--p-content-background); color: var(--p-text-color); }
main { max-width: 64rem; margin: auto; padding: 1rem; }
section { margin-block: 2rem; }
button, input { margin: .35rem; font: inherit; }
input { padding: .5rem; }
label { display: block; }
li { margin-block: .5rem; }
:focus-visible { outline: 3px solid var(--p-primary-color); outline-offset: 3px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
```

## Toast, FocusTrap, BlockUI, Tooltip limits

ToastService `add({ id?, group?, severity, summary, detail, life? })` returns a string/number ID. `remove({ id })`, `removeGroup(group)`, and `removeAllGroups()` have different scopes. Omit `life` for sticky messages; `closable` controls dismiss UI. Hosts filter exact groups; default and named groups are not interchangeable. Supported severities include success/info/warn/error/secondary/contrast: toast **error**, button **danger**. `message` slot changes message content; `container` receives `{ message, closeCallback }` and replaces the whole presentation. Keep names and working close controls. Default alert/live announcements can be assertive; avoid one toast per keystroke and keep actionable errors inline. Closing/removing/expiring a toast cancels no request unless the application deliberately connects that action to an AbortController. Never leave a background timer running after its owner disappears.

In this release, service dispatch is synchronous but rendering/transitions are not. Toast's explicit close and `remove({ id })` emit `close`; timeout emits **`life-end`**, not `close`. `removeGroup(group)` clears that host without per-message close events, while `removeAllGroups()` emits `close` for each currently held message before clearing them. Host unmount unsubscribes its bus listeners and each message clears its expiry timer; it does not report successful work or a synthetic close outcome. Do not wait for a single toast-close callback as a universal completion/cleanup signal. These differences are explicit in the [Toast runtime](https://unpkg.com/openvue@1.0.0/toast/index.mjs) and [ToastService runtime](https://unpkg.com/openvue@1.0.0/toastservice/index.mjs).

Standalone FocusTrap can be locally registered as `import vFocustrap from 'openvue/focustrap'` and used on a real DOM container. Its binding supports `disabled`, `autoFocus`, and focusable selectors. The 1.0.0 implementation only unbinds on `disabled` updates; it does not symmetrically rebuild a trap when toggling back, and hidden sentinels are not a complete modal implementation. Prefer mounting/unmounting the trapped region for lifecycle changes. Do not stack a standalone trap around Dialog/Popover or trap ordinary page navigation. Restore focus yourself when removing a standalone region.

BlockUI creates a mask; local blocking needs a positioning context. Full-screen mode appends a mask to body, locks scroll, and blurs the active element. Neither local nor full-screen mask makes underlying controls disabled/inert, prevents keyboard activation or programmatic mutation, or restores the old focus for you. Bind `disabled` on real controls, guard handlers, expose a status/error and recovery, and avoid competing full-page scroll locks. Treat `aria-busy` as an announcement, not a lock.

Tooltip renders a generated tooltip ID and Escape hides it, but the published 1.0.0 directive does **not** write the `aria-describedby` relationship advertised by its documentation. The example supplies a persistent, visually hidden accessible description through the native target's explicit `aria-describedby`; the visible tooltip repeats that advisory text. Do not rely on a missing generated relationship or point at an element that does not exist while hidden. Tooltip is supplemental, never the only name, field error, or essential instruction. Use a native focusable target; disabled controls do not reliably emit focus/hover. Object binding supports `value`, `showDelay`, `hideDelay`, `autoHide`, and `escape`; keep escaping enabled for untrusted text. `autoHide: false` permits pointer movement onto tooltip text, not an interactive popover. If content contains links/buttons, use Popover instead. See the [published directive runtime](https://unpkg.com/openvue@1.0.0/tooltip/index.mjs) for the release boundary.

## Evidence and release boundaries

Primary official pages: [Dialog](https://openvue.dev/dialog/), [Drawer](https://openvue.dev/drawer/), [Popover](https://openvue.dev/popover/), [Toast](https://openvue.dev/toast/), [ConfirmDialog](https://openvue.dev/confirmdialog/), [ConfirmPopup](https://openvue.dev/confirmpopup/), [DynamicDialog](https://openvue.dev/dynamicdialog/), [FocusTrap](https://openvue.dev/focustrap/), [BlockUI](https://openvue.dev/blockui/), [Tooltip](https://openvue.dev/tooltip/). Read alongside published [confirmation options](https://unpkg.com/openvue@1.0.0/confirmationoptions/index.d.ts), [ConfirmDialog runtime](https://unpkg.com/openvue@1.0.0/confirmdialog/index.mjs), [ConfirmPopup runtime](https://unpkg.com/openvue@1.0.0/confirmpopup/index.mjs), [DynamicDialog options](https://unpkg.com/openvue@1.0.0/dynamicdialogoptions/index.d.ts), [DynamicDialog runtime](https://unpkg.com/openvue@1.0.0/dynamicdialog/index.mjs), [Dialog declarations](https://unpkg.com/openvue@1.0.0/dialog/index.d.ts), [Popover runtime](https://unpkg.com/openvue@1.0.0/popover/index.mjs), [ToastService declarations](https://unpkg.com/openvue@1.0.0/toastservice/index.d.ts), [FocusTrap runtime](https://unpkg.com/openvue@1.0.0/focustrap/index.mjs), [BlockUI runtime](https://unpkg.com/openvue@1.0.0/blockui/index.mjs), and [Tooltip options](https://unpkg.com/openvue@1.0.0/tooltip/index.d.ts). Source snapshot: official showcase corpus at commit `d064f02ac75c3aaeb60a676c70e5ee08e3e3042e`; release runtime/declarations outrank later prose.

The local cancellation boundary follows the browser's [`IDBTransaction.abort()` contract](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/abort): finished transactions cannot be aborted. Same-store read/write transactions serialize; keeping the snapshot comparison and write together prevents a different tab's committed edit being silently replaced.
