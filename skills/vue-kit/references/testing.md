# Behavioral testing for Vue

Read when adding a regression test, choosing a runner, diagnosing a flaky assertion, or mounting components with plugins, asynchronous setup, Teleport or transitions. Start with the existing application and its lockfile: preserve a working runner during a narrow fix. See [debugging and SSR](debugging-ssr.md) for causal diagnosis, [tooling](setup-tooling.md) for application setup, and [accessibility](accessibility.md) for interaction requirements.

## Version and evidence boundary

Reference baseline: **Vue 3.5.44**, **@vue/test-utils 2.5.1** (Vue 3 API), **Vitest 5.0.5**, **jsdom 30.1.3**, **@playwright/test 1.64.1**, **Vite 8.3.4**, **@vitejs/plugin-vue 6.0.10**. These releases were confirmed from npm metadata; VTU exports and cleanup signatures were checked in the versioned declarations. Use **Node 24.15.0 or newer supported Node 24** for this exact combination: jsdom 30.1.3 requires `^22.22.2 || ^24.15.0 || >=26.0.0`; Vitest 5.0.5 requires `^22.12.0 || ^24.0.0 || >=26.0.0`. Do not infer these engine floors from older Vitest tutorials. [Vitest setup](https://vitest.dev/guide/), [VTU API](https://test-utils.vuejs.org/api/), [versioned declarations](https://unpkg.com/@vue/test-utils@2.5.1/dist/src/index.d.ts).

The examples below are complete proposed regression fixtures, not reported passing runs. A package release or documentation lookup proves an API contract, not browser behavior, compatibility of every transitive dependency, or a green application build.

## Choose the cheapest boundary that can expose the failure

| Question | Boundary | Assert | Does not establish |
| --- | --- | --- | --- |
| Does a pure transformation preserve a domain invariant? | Vitest, Node environment | Returned value and meaningful errors | Component wiring |
| Does the user input produce the right content/event? | VTU `mount`, jsdom | Visible text, form values, public emitted payloads | Layout, native constraint validation, actual pointer/keyboard sequences |
| Does a composable require lifecycle or injection? | Mounted minimal consumer host | Consumer output before/after actions and unmount | A real browser's platform behavior |
| Does a form, store, route or query integration work together? | Mount with real relevant plugins and an isolated service boundary | Resulting UI/navigation, not implementation calls alone | Backend contract unless exercised separately |
| Do focus, tab order, positioning, scrolling, CSS transitions, IME or native dialogs work? | Real browser: Playwright E2E or existing Vitest Browser Mode setup | Accessible locators, focus, geometry, actual interaction | All browsers if only one engine ran |
| Does first-load SSR hydrate and become interactive? | Actual SSR server + browser; supplement with renderer tests | Initial HTML, hydration diagnostics and post-hydration action | SSR correctness from an SPA preview |

This division is an authoring recommendation, not a framework guarantee. Use a small number of critical browser journeys, many focused component regressions, and pure tests where Vue is irrelevant. A snapshot may supplement a behavior assertion; neither a snapshot-only test nor a source-string assertion proves a consumer contract. Do not read `.vue` text to assert that a watcher, method name, import, CSS class or library call exists.

## Minimal deterministic unit setup

For a new or deliberately aligned Vue/Vite project, install these exact releases. For an incumbent app, inspect its Vite/Vue/Node compatibility first; do not overwrite its versions just to add a test.

```sh
bun add --exact vue@3.5.44
bun add --dev --exact vite@8.3.4 @vitejs/plugin-vue@6.0.10 vitest@5.0.5 @vue/test-utils@2.5.1 jsdom@30.1.3
```

Use ESM project configuration (`"type": "module"` in the existing package manifest). `vitest.config.ts` below is complete for these component fixtures; merge aliases, transforms and relevant plugins from the real app when they affect the tested feature. A separate Vitest config does not automatically merge a Vite config.

```ts
// vitest.config.ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./src/test-setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
})
```

```ts
// src/test-setup.ts
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, vi } from 'vitest'

enableAutoUnmount(afterEach)
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
```

VTU 2.5.1 auto-unmount calls every tracked root's `unmount()` even if a test already called it. For tests that assert teardown or must remove attached hosts immediately, choose one owner: the explicit-cleanup files below call `disableAutoUnmount()` once and unmount every wrapper in `finally`. This file-local choice relies on Vitest's default `isolate: true`; preserve that isolation rather than combining it with a shared `isolate: false` environment. Other fixtures retain the setup's auto-unmount. [Exact tracking/cleanup](https://github.com/vuejs/test-utils/blob/v2.5.1/src/utils/autoUnmount.ts), [file isolation](https://vitest.dev/config/isolate.html).

Consumer commands, not a record of executed verification:

```sh
bunx --no-install vitest run
bunx --no-install vitest src/SaveTitle.spec.ts
```

Here Bun is the package manager/launcher, **not the test runner**: the installed `vitest` executable retains its Node shebang and the Node engine requirements above. `bun test` selects Bun's different runner; `bunx --bun vitest` forces a different runtime. Neither is an equivalent execution of these fixtures. Preserve an incumbent runner and its locked launcher rather than changing runtimes to make a failure disappear. [Bun executable/shebang policy](https://bun.com/docs/pm/bunx).

Keep tests in explicit files and import `test`, `expect` and hooks rather than assuming globals. Set a Node environment per file/project for pure tests instead of imposing jsdom on every unit. Type checking is separate from successful test transpilation; use the application's `vue-tsc` check from [tooling](setup-tooling.md).

## Wait for the cause, not elapsed wall time

| Pending work | Correct synchronization | Common false fix |
| --- | --- | --- |
| Vue DOM patch caused by input/props | `await wrapper.get(...).setValue(...)`, `await trigger(...)`, `await setProps(...)` | Reading DOM immediately |
| A direct change through a public reactive input | `await nextTick()` | Inspecting private `wrapper.vm` state to bypass UI |
| A service promise controlled by the test | Resolve/reject that promise, then `await flushPromises()`; use `nextTick()` if a later reactive patch is still pending | Assuming `trigger()` awaits its async event handler |
| Debounce, expiry or scheduled retry | Fake timers, advance the specific duration with `await vi.advanceTimersByTimeAsync(ms)`, then settle Vue work | `flushPromises()` as a timer or network completion primitive |
| A browser-visible eventual result | Await a Playwright locator assertion | `waitForTimeout(1000)` or repeated arbitrary ticks |
| Async setup/async component | Mount a `Suspense` consumer host, settle its actual dependency, assert resolved UI | Stubbing the feature that should fail |

`nextTick` waits for Vue's pending update flush, not an HTTP response. VTU `flushPromises` gives already-resolvable promise continuations an opportunity to run; it cannot resolve a deferred promise, finish a real request or advance an arbitrary timeout. Under fake timers its own scheduling can interact with the mocked scheduler: prefer explicitly advancing the application's timer and awaiting its known promise rather than blindly mixing global timer drains and promise flushes. Never use unbounded `runAllTimers` with a repeating interval. Restore real timers even when an assertion fails. [VTU asynchronous behavior](https://test-utils.vuejs.org/guide/advanced/async-suspense), [Vitest timers](https://vitest.dev/guide/mocking/timers).

## Complete regression: pending, success and failure through a public contract

`saveTitle` is an application-owned adapter supplied by the consumer. The fixture deliberately does not invent an HTTP endpoint or claim persistence. Its returned string is a receipt for the displayed result. In production the adapter's persistence and transport contract need their own integration coverage.

```vue
<!-- src/SaveTitle.vue -->
<script setup lang="ts">
import { ref, useId } from 'vue'

const props = defineProps<{
  saveTitle: (title: string) => Promise<string>
}>()
const emit = defineEmits<{ saved: [title: string] }>()
const inputId = useId()
const title = ref('')
const pending = ref(false)
const receipt = ref('')
const error = ref('')

async function submit() {
  if (pending.value) return
  const value = title.value.trim()
  receipt.value = ''
  error.value = ''
  if (!value) {
    error.value = 'Enter a title.'
    return
  }
  pending.value = true
  try {
    receipt.value = await props.saveTitle(value)
    emit('saved', value)
  } catch {
    error.value = 'Could not save. Your title is still here.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <label :for="inputId">Title</label>
    <input :id="inputId" v-model="title" :disabled="pending" />
    <button type="submit" :disabled="pending">
      {{ pending ? 'Saving…' : 'Save title' }}
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="receipt" role="status">{{ receipt }}</p>
  </form>
</template>
```

```ts
// src/SaveTitle.spec.ts
import { flushPromises, mount } from '@vue/test-utils'
import { expect, test, vi } from 'vitest'
import SaveTitle from './SaveTitle.vue'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

test('rejects empty input without invoking the adapter', async () => {
  const saveTitle = vi.fn<(title: string) => Promise<string>>()
  const wrapper = mount(SaveTitle, { props: { saveTitle } })
  await wrapper.get('input').setValue('   ')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.get('[role="alert"]').text()).toBe('Enter a title.')
  expect(saveTitle).not.toHaveBeenCalled()
  expect(wrapper.emitted('saved')).toBeUndefined()
})

test('blocks duplicate submissions and reports the saved title', async () => {
  const request = deferred<string>()
  const saveTitle = vi.fn<(title: string) => Promise<string>>()
    .mockReturnValue(request.promise)
  const wrapper = mount(SaveTitle, { props: { saveTitle } })
  await wrapper.get('input').setValue('  Release notes  ')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  expect(wrapper.get('button').text()).toBe('Saving…')
  await wrapper.get('form').trigger('submit')
  expect(saveTitle).toHaveBeenCalledTimes(1)
  expect(saveTitle).toHaveBeenCalledWith('Release notes')
  expect(wrapper.find('[role="status"]').exists()).toBe(false)

  request.resolve('Saved: Release notes')
  await flushPromises()
  expect(wrapper.get('[role="status"]').text()).toBe('Saved: Release notes')
  expect(wrapper.emitted('saved')).toEqual([['Release notes']])
  expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
})

test('preserves the entered value on rejection and permits another attempt', async () => {
  const request = deferred<string>()
  const saveTitle = vi.fn<(title: string) => Promise<string>>()
    .mockReturnValueOnce(request.promise)
    .mockResolvedValueOnce('Saved: Draft')
  const wrapper = mount(SaveTitle, { props: { saveTitle } })
  await wrapper.get('input').setValue('Draft')
  await wrapper.get('form').trigger('submit')
  request.reject(new Error('adapter unavailable'))
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text())
    .toBe('Could not save. Your title is still here.')
  expect(wrapper.get('input').element.value).toBe('Draft')
  expect(wrapper.emitted('saved')).toBeUndefined()
  expect(wrapper.get('button').attributes('disabled')).toBeUndefined()

  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.get('[role="status"]').text()).toBe('Saved: Draft')
  expect(wrapper.emitted('saved')).toEqual([['Draft']])
})
```

The public adapter call count is useful here because duplicate submission is a requirement; the UI and emitted result are also asserted. This is not permission to assert private method calls, computed caches or watcher execution counts. A form `trigger('submit')` tests the component submit contract, not Enter-key dispatch or browser constraint validation; cover those separately in a browser when required.

## VTU decisions that preserve the real contract

- Prefer `mount` and only stub an unrelated expensive boundary. A broad `shallowMount` replaces child behavior, including validation and slot rendering. State which behavior the stub excludes. Stubbed default-slot rendering is opt-in with `global.renderStubDefaultSlot`; it does not restore every named/scoped slot contract.
- Use `get` for required DOM, `find(...).exists()` for legitimate absence. Use `findComponent(Component)` for component boundaries, not as a substitute for a user-facing assertion. CSS selectors in VTU are not accessible-name queries; browser role/label locators catch a different class of regression.
- Use `props`, `slots`, `global.provide`, `global.plugins` and narrowly scoped `global.stubs`. Drive a controlled `v-model` through a consumer host that handles `update:modelValue`; otherwise the test may observe an emission without exercising parent synchronization.
- Test slot scope by supplying a consumer slot and asserting its output. Test attrs forwarding through the final input/button, including label, disabled and click behavior. Component-local registration is not registration for every descendant.
- VTU 2 migration: `propsData` → `props`, `destroy()` → `unmount()`, `createLocalVue` → mount-local `global.plugins`, `mocks/provide/stubs` → `global.*`; `findAll()` returns an array. In **2.5.1**, `setData` also has setup-state branches, including `<script setup>`; the older Options-only limitation is not this release's implementation. That access is still private-state mutation: drive public inputs/actions instead. Mount-time `data` overrides remain an Options API contract. [Migration](https://test-utils.vuejs.org/migration/), [exact `setData` implementation](https://github.com/vuejs/test-utils/blob/v2.5.1/src/vueWrapper.ts).

VTU 2.5.0 removed class-component support; 2.5.1 is not a compatibility bridge for an incumbent class-component suite. Migrate the component definition under a separate authorized migration, or preserve the existing compatible test toolchain while diagnosing a narrow failure. In 2.5.x a child's emitted history is cleared when it unmounts, so inspect required public emissions before teardown. Although `defineExpose` bindings are accessible on wrapper instances, that access is not a reason to test private state. [VTU 2.5.0 release](https://github.com/vuejs/test-utils/releases/tag/v2.5.0).

### Mounting and wrapper API contracts for incumbent suites

| Need | VTU 2.5.1 contract and boundary |
| --- | --- |
| Initial component inputs | `props` for declared props; `attrs` for undeclared attributes; `data: () => ({ … })` for Options API data overrides, not setup refs. Slots accept strings, vnodes, functions or component definitions. For scoped string slots use `params`, for example `'<p>{{ params.item.title }}</p>'`; use a function when its lexical dependencies matter. |
| Application environment | `global.plugins` accepts plugins or `[plugin, ...options]`; `global.components`, `directives`, `mixins` reproduce relevant registrations. `global.provide` supplies actual injection keys; `global.mocks` supplies plugin instance properties such as `$t`, not Vue internals or arbitrary Composition API injections. `global.config` sets app config, not VTU config. |
| Required/optional queries | `get`/`getComponent` throw on absence; `find`/`findComponent` return an error wrapper with `exists() === false`. `findAll` returns a plain array. Prefer imported component selectors; name/CSS selectors can select an unexpected owner when roots are shared. Functional components can produce a `DOMWrapper`, not a stateful `vm`. `{ ref: 'child' }` component queries target direct children; `findAllComponents` does not accept ref selectors. |
| Public assertions | `props(key)` inspects a passed input; `emitted(name)` is an array of argument arrays. `attributes(key)` is a string or undefined; `classes(name)` is boolean. `text()` trims each root's text and ignores comment roots; it does not promise to collapse interior whitespace. Assert native `.element.value` for form values. `html({ raw: true })` avoids VTU formatting, not browser normalization. |
| Input action | `await setValue(value)` handles text/textarea, checkbox/radio and select; an array selects multiple values in a multiselect. `trigger('keydown', { key: 'Enter', code: 'Enter', ctrlKey: true })` dispatches the specified event, not a whole native typing sequence. `trigger` cannot set readonly `target`; set the element value or use `setValue` instead. |
| Visibility/focus | `exists()` distinguishes removal; `isVisible()` distinguishes supported hidden/display cases, not viewport clipping or real layout. Attach focus/connected-element fixtures to a document-owned host. A programmatic focus assertion in jsdom does not establish keyboard navigation. |
| Controlled component model | A child `setValue`/emission is not a parent-controlled feedback loop. Mount a host, or supply `onUpdate:modelValue` that calls root `wrapper.setProps({ modelValue: value })`, then await settlement; assert both consumer output and child input. `setProps` belongs to the root mounted wrapper, not an arbitrary child. |
| Server rendering | VTU `renderToString(Component, options)` returns `Promise<string>` and accepts the common mounting inputs but **not `attachTo`**; install matching `@vue/server-renderer@3.5.44`. It establishes server output only, not hydration; use [the renderer/hydration fixture](debugging-ssr.md#complete-renderer-and-hydration-regression-fixture). |

Configure shared `config.global` once in test setup; prefer mount-local overrides for scenario-specific state and restore any temporary global config. VTU **2.5.1** shares config across CJS/ESM entry points; mixing imports does not isolate defaults. A wrapper extension belongs in `config.plugins.VueWrapper.install(extension)` or `config.plugins.DOMWrapper.install(extension)` **once before mounts**, not in `global.plugins` (which installs Vue plugins). An extension receives the wrapper and returns additional methods; type custom public methods with a module augmentation of `@vue/test-utils`. Use public wrapper APIs, not internal instances.

For custom shallow semantics, `config.plugins.createStubs = ({ name, component, registerStub }) => CustomComponent` replaces automatically generated stubs, not explicit component replacements. Preserve only the props/events/slots your test declares as its boundary; a stub that recreates production validation cannot prove production validation. `global.stubs` accepts a record or names array; `vTooltip: true` stubs a directive and `{ transition: false, 'transition-group': false }` restores those built-ins when deliberately testing their behavior. Reset a temporary stub factory; do not let tests order-depend on it. [Versioned options](https://unpkg.com/@vue/test-utils@2.5.1/dist/src/types.d.ts), [wrapper contracts](https://unpkg.com/@vue/test-utils@2.5.1/dist/src/baseWrapper.d.ts), [extensions](https://test-utils.vuejs.org/guide/extending-vtu/plugins).

For a Vue 2 suite migration, also map `attachToDocument` → `attachTo`, `scopedSlots` → `slots`, `setChecked`/`setSelected` → `setValue`, `contains` → `find(...).exists()`, `createWrapper(el)` → `new DOMWrapper(el)`, `enableAutoDestroy` → `enableAutoUnmount(afterEach)`, and `.findAll(...).at(i)` → `.findAll(...)[i]`. Removed `context`, `listeners`, `parentComponent`, `setMethods`, `isVueInstance`, `isEmpty` and `name()` are not shim targets: assert the consumer outcome instead. Generated stub tags are kebab-case; avoid snapshots depending on old spelling. Deprecated top-level `config.renderStubDefaultSlot` becomes `config.global.renderStubDefaultSlot`; it still restores **only default slots**. `emittedByOrder` becomes explicit public-event assertions rather than relying on a global cross-component order. [Migration](https://test-utils.vuejs.org/migration/), [2.5.1 release](https://github.com/vuejs/test-utils/releases/tag/v2.5.1).

### Plugin and wrapper ownership

Build fresh test-owned plugin instances; never import the production singleton app merely to obtain its plugins. A universal giant mount helper can hide which contract is under test. Start with the smallest explicit wrapper and extract only genuinely shared setup.

| Dependency | Test-owned boundary | Settlement and cleanup |
| --- | --- | --- |
| Pinia | Fresh Pinia per integration test; real actions when asserting action effects. A testing Pinia may intentionally stub actions; make that choice explicit. Do not expect stubbed actions to update UI. | Dispose test-owned store/Pinia resources after unmount; reset persisted storage if persistence is part of the scenario. See [state](state.md). |
| Vue Router | Fresh memory-history router, real route table for guard/navigation behavior; mount through plugin installation. For a leaf unrelated to navigation, a link/router stub may be sufficient. | Push the initial route and await readiness before assertions; await subsequent navigation and relevant promise/DOM work. Use a browser for history, direct-link and scroll behavior. See [routing](routing.md). |
| TanStack Query | Fresh query client/provider per test; seed exact public keys only when the scenario begins cached. Intentionally configure retry policy for the tested scenario. | Cancel pending work, unmount consumers and clear the test client; no shared cache, polling or focus listeners across tests. Do not mistake disabled retries for retry coverage. See [TanStack Query](tanstack-query.md). |
| Pinia Colada | Fresh Pinia and Colada installation/cache per integration test; preserve the actual query consumer. | Stop consumers and reset test-owned cache/listeners according to the installed APIs. See [Colada](pinia-colada.md). |
| Injected composable | Minimal host that provides the typed dependency, calls the composable in setup and renders its public state/actions. | Unmount and verify the externally owned event/observer no longer affects a remounted consumer. See [composables](composables.md). |
| Vuetify | Fresh installed Vuetify instance and application layout wrapper when testing its components, not empty component-name stubs. | Remove attached hosts/overlays after unmount; use browser coverage for actual focus/layout. See [Vuetify setup](vuetify-setup.md). |

Keep app installation in production and fixture plugin installation aligned, but do not share mutable instances. API mocks replace an external contract, not Vue's reactivity or the feature's implementation. Reset mock handlers between tests; fail unexpected requests instead of returning generic success. Do not replace `fetch` globally without restoring it.

### Complete lifecycle/injection consumer test

Pure ref/computed-only functions can be exercised directly; lifecycle/injection consumers need setup context. This complete `src/subscription.spec.ts` fixture owns an explicit application-like subscription interface and asserts rendered behavior plus teardown. It does not require a private `wrapper.vm` escape or a global helper that obscures providers.

```ts
import { disableAutoUnmount, mount } from '@vue/test-utils'
import {
  defineComponent, h, inject, nextTick, onMounted, onUnmounted, ref,
  type InjectionKey,
} from 'vue'
import { expect, test } from 'vitest'

disableAutoUnmount()

interface Messages {
  subscribe: (receive: (value: string) => void) => () => void
}
const messagesKey: InjectionKey<Messages> = Symbol('test messages')

function useLatestMessage() {
  const source = inject(messagesKey)
  if (!source) throw new Error('Message consumer requires a provider')
  const latest = ref('Waiting')
  let stop: (() => void) | undefined
  onMounted(() => {
    stop = source.subscribe(value => { latest.value = value })
  })
  onUnmounted(() => { stop?.() })
  return { latest }
}

const Consumer = defineComponent({
  setup() {
    const { latest } = useLatestMessage()
    return () => h('p', { role: 'status' }, latest.value)
  },
})

test('receives messages and releases each consumer subscription', async () => {
  const listeners = new Set<(value: string) => void>()
  const source: Messages = {
    subscribe(receive) {
      listeners.add(receive)
      return () => { listeners.delete(receive) }
    },
  }
  const first = mount(Consumer, {
    global: { provide: { [messagesKey as symbol]: source } },
  })
  try {
    expect(first.get('[role="status"]').text()).toBe('Waiting')
    for (const receive of listeners) receive('First update')
    await nextTick()
    expect(first.get('[role="status"]').text()).toBe('First update')
  } finally {
    first.unmount()
  }
  expect(listeners.size).toBe(0)

  const second = mount(Consumer, {
    global: { provide: { [messagesKey as symbol]: source } },
  })
  try {
    expect(listeners.size).toBe(1)
    expect(second.get('[role="status"]').text()).toBe('Waiting')
    for (const receive of listeners) receive('Second update')
    await nextTick()
    expect(second.get('[role="status"]').text()).toBe('Second update')
  } finally {
    second.unmount()
  }
  expect(listeners.size).toBe(0)
})
```

For Pinia store-unit tests, create fresh `createPinia()` and `setActivePinia(pinia)` before creating the store, or pass that instance explicitly. Install it in an app when store plugins must run; merely marking it active does not install plugins. For component isolation with the versions documented in [state](state.md), install `createTestingPinia({ createSpy: vi.fn })` from `@pinia/testing`; this reference's Vitest setup does **not** enable globals, so the explicit spy factory matters. Actions are stubbed by default; use `stubActions: false` for real action effects and seed `initialState` by the actual store ID. Test an action's public result/state, not only its spy count; assert subscription effects after the relevant Vue flush, then stop subscriptions/dispose test-owned resources. Do not rewrite a setup store's closed-over action calls solely to make an internal call mockable. [Pinia testing contract](https://pinia.vuejs.org/cookbook/testing.html).

For an incumbent Vuex 4 consumer, pass a fresh test-owned store in `global.plugins`; with a typed `useStore(key)` contract install it as `[store, key]` using the **same exported key** as production. Seed state in the test's store factory, trigger the consumer action and assert rendered state after the relevant promise/patch. Pure mutation/action contracts can be exercised without mounting Vue. A leaf-only Options API test may deliberately provide a narrow `$store` through `global.mocks`, but that does not install Composition API injection or verify real modules/actions. Do not migrate Vuex merely to repair a test. [VTU's real/mocked/keyed Vuex workflows](https://test-utils.vuejs.org/guide/advanced/vuex).

### Teleport, focus, transitions and async setup

1. Create a real test-owned Teleport target **before** mounting. Attach the wrapper to a test-owned element in `document.body` for focus and connected-element behavior. Query the target DOM with `DOMWrapper` or normal DOM queries; `wrapper.find` follows local DOM, while `findComponent` can traverse the logical component tree.
2. Unmount the wrapper **before** removing its attached host and Teleport target. Auto-unmount does not remove every test-created node or third-party global listener. Use `try/finally` or scoped teardown; do not wipe unrelated fixtures with `document.body.innerHTML = ''`.
3. `global.stubs: { teleport: true }` is acceptable only when placement/target behavior is explicitly out of scope. It cannot prove that a production target exists, content escapes clipping, or focus returns correctly.
4. VTU stubs `Transition`/`TransitionGroup` by default. A passing visibility assertion under stubs does not prove enter/leave hooks, delayed removal, reduced motion or cancellation. Test real transitions in a browser; if disabling the stubs in a DOM test, account for animation-frame/event scheduling and state that CSS was not verified.
5. For async setup, wrap the real child in a `Suspense` host, control its dependency and assert both fallback and resolved content. `Suspense` is **experimental in Vue 3.5**, not an error boundary. Use a parent error boundary for failure coverage. Stubbing an async component by its registration name can prevent its loader from ever running; do not use that approach to test loader rejection. [VTU Teleport](https://test-utils.vuejs.org/guide/advanced/teleport), [VTU transitions](https://test-utils.vuejs.org/guide/advanced/transitions), [Vue Suspense](https://vuejs.org/guide/built-ins/suspense).

### Complete controlled Suspense fixture

This complete `src/async-panel.spec.ts` fixture deliberately controls setup's dependency; repeated `flushPromises()` cannot finish a promise the test has not resolved. Add rejection coverage through the real parent error boundary from [debugging](debugging-ssr.md#d2-preserve-diagnostics-while-offering-usable-recovery), not a fictional Suspense error slot.

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import { expect, test } from 'vitest'

test('renders fallback until the actual async dependency resolves', async () => {
  let resolve!: (value: string) => void
  const pending = new Promise<string>(done => { resolve = done })
  const AsyncPanel = defineComponent({
    async setup() {
      const title = await pending
      return () => h('h2', title)
    },
  })
  const Host = defineComponent({
    setup() {
      return () => h(Suspense, null, {
        default: () => h(AsyncPanel),
        fallback: () => h('p', { role: 'status' }, 'Loading panel'),
      })
    },
  })
  const wrapper = mount(Host)
  expect(wrapper.get('[role="status"]').text()).toBe('Loading panel')
  expect(wrapper.find('h2').exists()).toBe(false)
  resolve('Account panel')
  await flushPromises()
  expect(wrapper.get('h2').text()).toBe('Account panel')
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
})
```

For `defineAsyncComponent`, use a deferred loader and `delay: 0` when asserting immediate loading; resolve/reject it explicitly and flush before asserting resolved/error output. A registered-name stub can stop loading entirely; stubbing by the resolved component's name may require awaiting resolution first. Neither tests loader behavior. `vi.dynamicImportSettled()` can settle tracked dynamic imports, not arbitrary deferred work or all rendering. Test wrapper timeout/delay with controlled timers separately from Suspense (which owns pending UI for suspensible wrappers). No single unconditional `flushPromises` establishes loading, error, cache/reactivation and hydration contracts.

## Browser regression against the bundled workbench

The following complete config/test files belong in a copy of [the example app](../assets/example-app/package.json), not in a unit-test fixture. They exercise the local in-memory example only; they do not prove backend persistence. Use the existing Playwright setup if present instead of adding a second runner.

```sh
bun add --dev --exact @playwright/test@1.64.1
bunx --no-install playwright install chromium
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium' },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
})
```

```ts
// e2e/tasks.spec.ts
import { expect, test } from '@playwright/test'

test('Enter adds a task; cancel preserves it and reset restores focus', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
  await page.getByLabel('Task title', { exact: true }).fill('Review regression')
  await page.getByLabel('Task title', { exact: true }).press('Enter')
  const addedTask = page.getByText('Review regression', { exact: true })
  await expect(addedTask).toBeVisible()

  const reset = page.getByRole('button', { name: 'Reset tasks', exact: true })
  await reset.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(addedTask).toBeVisible()
  await expect(reset).toBeFocused()

  await reset.click()
  await dialog.getByRole('button', { name: 'Confirm reset', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(addedTask).toHaveCount(0)
  await expect(reset).toBeFocused()
})
```

```sh
bunx --no-install playwright test
```

Playwright's locator assertions retry until their condition or timeout; awaiting them is meaningful synchronization, not arbitrary sleeping. This fixture uses real focus/Teleport behavior but only Chromium unless more projects are configured. Add browser regressions for invalid submission preserving input, pending-state duplicate prevention, keyboard-only modal operation, responsive layout and reduced-motion behavior when those are acceptance criteria. A passing focus-return test is not a complete focus-trap audit. [Playwright assertions](https://playwright.dev/docs/test-assertions).

### Browser matrix, CI and failure evidence

The config above deliberately exercises one engine. For Chromium/Firefox/WebKit coverage, remove its single `use.browserName` and add `projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'firefox', use: { browserName: 'firefox' } }, { name: 'webkit', use: { browserName: 'webkit' } }]`. Install those browsers using the project's locked Playwright version. This is an explicit config modification, not a claim that Chromium proves WebKit behavior or that WebKit emulation is an iOS-device test.

For a Bun-managed CI job, require the committed `bun.lock` to exist before `bun install --frozen-lockfile` (the flag alone does not require a missing lockfile), install matching browser binaries/system dependencies with `bunx --no-install playwright install --with-deps`, start the actual required server via `webServer`, then run `bunx --no-install playwright test`. Preserve an incumbent project's pinned manager and corresponding frozen-install command instead of creating a competing lockfile. Set `workers` to match available resources (one is the documented conservative CI default); parallel workers/shards require isolated users/data/services, not shared mutable fixtures. In an incumbent suite, shard with `--shard=1/2` and `--shard=2/2` in separate jobs and retain/merge reports deliberately. Never increase retries to hide an unexplained failure.

Merge `use.trace: 'retain-on-failure'`, `use.screenshot: 'only-on-failure'` and an HTML reporter into the config when collecting failure evidence. Inspect traces with the installed Playwright trace viewer; retain artifacts under the application's privacy policy because DOM/network/screenshots can contain secrets. Use `await expect(locator).toHaveScreenshot()` only for intentionally stable visual contracts with pinned browser/platform/fonts/data and reviewed baselines; pair it with behavior assertions. Small reviewed HTML/inline snapshots can protect stable markup/SVG output, but blindly updating them cannot establish correctness. A page object is useful only when it names user operations; do not hide waits or assertions behind a giant selector helper.

Existing Vitest Browser Mode suites are also suitable for browser-dependent component contracts; keep the installed browser provider and its matching Vitest release/config rather than copying obsolete `browser.name` examples. jsdom can model some focus/events/cookies, but has no real layout/rendering engine: geometry, trusted input sequences and cross-browser behavior require a browser. Browser Mode component tests still do not establish server redirects, deployment asset delivery or true first-load SSR; use the actual application journey for those. [Playwright CI](https://playwright.dev/docs/ci), [trace viewer](https://playwright.dev/docs/trace-viewer-intro), [visual assertions](https://playwright.dev/docs/test-snapshots), [Vitest Browser Mode](https://vitest.dev/guide/browser/).

## Failure-to-test workflow

1. Preserve the user's reported failure as evidence; do not rerun solely to confirm it. Record the exact consumer action, environment, result and expected result.
2. Localize the earliest divergent boundary using [diagnostic trees](debugging-ssr.md). Write a regression that would fail for the reported behavior, not a test for your preferred implementation.
3. Control time, promises, data and plugin lifetime. Exercise pending, success and error states as relevant; include teardown/remount when the defect involves stale resources.
4. Run only authorized checks. Report exact commands, environment and observed results; mark unexecuted examples and remaining browser/server coverage as proposed, not passed. A test passing after a change is not evidence that it previously failed unless that failure was actually observed.

## Sources

- [Vue testing guide](https://vuejs.org/guide/scaling-up/testing) — behavioral assertions and runner boundaries.
- [VTU 2.5.1 published declarations](https://unpkg.com/@vue/test-utils@2.5.1/dist/src/index.d.ts), [cleanup declaration](https://unpkg.com/@vue/test-utils@2.5.1/dist/src/utils/autoUnmount.d.ts), [VTU API](https://test-utils.vuejs.org/api/) — exports, options and wrapper contracts.
- [VTU asynchronous behavior](https://test-utils.vuejs.org/guide/advanced/async-suspense), [Teleport](https://test-utils.vuejs.org/guide/advanced/teleport), [transitions](https://test-utils.vuejs.org/guide/advanced/transitions), [stubs](https://test-utils.vuejs.org/guide/advanced/stubs-shallow-mount).
- [Vitest configuration](https://vitest.dev/config/), [timers](https://vitest.dev/guide/mocking/timers), [Playwright assertions](https://playwright.dev/docs/test-assertions).
- Exact-release metadata: [VTU 2.5.1](https://registry.npmjs.org/@vue%2ftest-utils/2.5.1), [Vitest 5.0.5](https://registry.npmjs.org/vitest/5.0.5), [jsdom 30.1.3](https://registry.npmjs.org/jsdom/30.1.3), [Playwright Test 1.64.1](https://registry.npmjs.org/@playwright%2ftest/1.64.1), [Vite 8.3.4](https://registry.npmjs.org/vite/8.3.4), [Vue plugin 6.0.10](https://registry.npmjs.org/@vitejs%2fplugin-vue/6.0.10).
