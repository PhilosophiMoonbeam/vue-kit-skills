# FormKit: node graphs, Vue forms, and schema

Read for `@formkit/core`, `FormKitNode`, node/plugin lifecycle, schema-generated forms, or an incumbent FormKit app. Read [form ownership](forms.md) before connecting server state or another UI library. Core is not a validation/UI component library, and it does not provide a built-in Vuetify adapter.

## Exact packages and boundaries

Verified current stable **`@formkit/core@2.1.2`** and **`@formkit/vue@2.1.2`**. Core depends on `@formkit/utils ^2.1.2`; it is framework-independent, not literally dependency-free. The Vue adapter declares Vue `^3.4.0` and depends on the matching FormKit 2.1.2 package family. Vue 3.5.44 satisfies that Vue peer. [Core manifest](https://unpkg.com/@formkit/core@2.1.2/package.json), [Vue manifest](https://unpkg.com/@formkit/vue@2.1.2/package.json).

| Need | Package and responsibility |
| --- | --- |
| Graph, committed values, events/hooks, messages, ledger, registry | `@formkit/core` |
| `<FormKit>`, `<FormKitSchema>`, `plugin`, `defaultConfig`, `createInput` | `@formkit/vue` |
| Input definitions such as text/email/form/list | `@formkit/inputs` |
| Validation execution/custom rule types | `@formkit/validation`; predefined rules in `@formkit/rules` |
| Localized messages and theme facilities | `@formkit/i18n`, `@formkit/themes` |

A core node type is only **`input`**, **`group`**, or **`list`**. An input/UI type is a definition such as `email` or `form`; a FormKit form is structurally a group plus form behavior supplied by the input library. Calling `createNode({ type: 'group' })` alone does not install validation, DOM rendering, or an async submit pipeline.

## Core graph and value flow

1. Create a node once per owned lifetime. Inputs are leaves; groups aggregate named properties; lists aggregate child values by current numeric index.
2. Read resolved inherited configuration through `node.props`. Explicit props override inherited `config`. Prefer unique sibling names.
3. Write with `node.input(value)`, never `node.value = value`. Input is normally debounced; await its promise before reading that node's committed value.
4. Await `root.settled` for the entire subtree's pending **value commits**. This is not a generic promise that all network/validation work is complete.
5. Use `node.at('profile.email')` or `node.at('people.0.name')` to traverse; it may return `undefined`. Core addresses use the configured delimiter (default dot), not vee-validate bracket-path semantics.
6. Release listeners and owned nodes on teardown. Do not retain a module-global node graph across users, requests, or component instances.

Complete TypeScript function using only core. It creates a real nested object/list graph, demonstrates middleware, captures committed events, returns a detached snapshot, and destroys every node it manually owns. Run it in an environment with `@formkit/core@2.1.2`; no Vue plugin or backend is implied.

```ts
import { createNode } from '@formkit/core'
import type { FormKitMiddleware, FormKitPlugin } from '@formkit/core'

const trimStrings: FormKitPlugin = node => {
  if (node.type !== 'input') return
  const trim: FormKitMiddleware = (value, next) =>
    next(typeof value === 'string' ? value.trim() : value)
  node.hook.commit(trim)
  node.on('destroying', () => node.hook.commit.remove(trim))
}

export async function collectProfile() {
  const email = createNode({ name: 'email', value: '' })
  const profile = createNode({ name: 'profile', type: 'group', children: [email] })
  const firstTag = createNode({ value: 'vue' })
  const secondTag = createNode({ value: 'forms' })
  const tags = createNode({ name: 'tags', type: 'list', children: [firstTag, secondTag] })
  const root = createNode({
    type: 'group',
    children: [profile, tags],
    plugins: [trimStrings],
  })
  const commits: Array<{ name: string; value: unknown }> = []
  const receipt = root.on('commit.deep', event => {
    commits.push({ name: String(event.origin.name), value: event.payload })
  })
  try {
    await email.input(' reader@example.com ')
    await firstTag.input(' vue3 ')
    await root.settled
    return { value: structuredClone(root.value), commits }
  } finally {
    root.off(receipt)
    email.destroy()
    profile.destroy()
    firstTag.destroy()
    secondTag.destroy()
    tags.destroy()
    root.destroy()
  }
}
```

Group writes require objects and list writes require arrays; do not feed them arbitrary scalar data. `node.input(value, false)` commits synchronously, but use the ordinary async path unless implementing a deliberate adapter/internal operation. `_value` and `_c` are internal escape hatches, not application state APIs. [Architecture](https://formkit.com/essentials/architecture), [pinned node declarations](https://unpkg.com/@formkit/core@2.1.2/dist/index.d.mts).

## Events, middleware, plugins, and destruction

- `node.on(name, listener)` returns a receipt string; pass it to `node.off(receipt)`. Events carry `name`, `origin`, `payload`, and bubbling information. `commit.deep` also hears descendant-origin commits; `commit` hears the local node.
- `input` is pre-commit input; `commit` is committed value. `created` and `defined` mark construction/definition. `destroying` is the cleanup hook; `destroyed` follows cleanup. `node.destroy()` removes that node from its parent/registry, clears stores/listeners/plugins, and invalidates its value/context.
- **Destroying a manually created parent does not recursively destroy every child.** Explicitly dispose manually owned children. The Vue adapter owns/destroys nodes it creates with its component lifetime; do not separately destroy an adapter-owned input just because you captured `@node`.
- A plugin receives a node and is inherited by descendants. Normal successful registration is recorded per node; repeated `node.use(plugin)` does not duplicate it. Returning `false` stops inheritance **and does not record that plugin**, so later explicit `.use(plugin)` may run it again. Do not describe false-returning plugins as unconditionally “once per node.”
- `plugin.library` can inspect `node.props.type` and call `node.define(definition)` to supply an input type. `createInput` belongs to `@formkit/vue`, not core.
- Hooks are middleware, e.g. `node.hook.commit((value, next) => next(value))`. Register meaningful transformations once. Always continue the chain for middleware intended to transform/pass through; skipping `next` interrupts downstream work. Save functions do not belong in value hooks.
- Use inherited `config` for defaults, instance `props` for overrides. A config change can propagate through the graph. Do not walk the whole tree on every keystroke; `node.walk()` excludes the node itself and is a lifecycle-level operation.

These details are established by the [2.1.2 runtime](https://unpkg.com/@formkit/core@2.1.2/dist/index.mjs), including important cleanup and false-return behavior not obvious from the short API descriptions.

### Configuration, definitions, and core-only traversal

`createConfig({ locale: 'en' })` creates a shared root-config proxy; attach it through `config: { rootConfig }` when creating each independently owned tree, then set `rootConfig.locale` to notify inheriting nodes. A node's explicit prop wins over config; local config wins over parent/root defaults. `delay` defaults to 20 ms for input nodes. Change `delimiter` before creating addresses when field names contain dots. These are core configuration objects, not Vue's `defaultConfig()` installer.

For unavoidable same-name siblings, set the parent's `config: { mergeStrategy: { fieldName: 'synced' } }`; 2.1.2 supports only `'synced'`. Otherwise use unique names: two controls fighting over one object slot are not separate fields. `node.resetConfig()` reconnects inherited config after deliberate graph changes; do not mutate private `_add`/`_rm` bookkeeping.

For custom input libraries, `node.define({ type, family, props, schema, features })` supplies a structural definition; `component` is the alternative to schema rendering. `node.addProps(['currency'])` promotes a matching attribute from `node.props.attrs` into the pseudo-prop namespace. Definition-map entries can supply `default`, `boolean`, `getter`, and `setter`. Prefer a plugin feature for reusable behavior; reserve `node.extend(key, { get, set })` traps for a genuine core extension, never a duplicate writable `value`.

| Operation | Contract and boundary |
| --- | --- |
| `node.each(callback)` | Immediate children; use for local attachment/cleanup policy. |
| `node.walk(callback, stopOnFalse?, skipSubtreeOnFalse?)` | Descendants, not self; avoid repeated whole-tree scans during input. |
| `node.at('$root.profile.email')`, `$parent`, `$self` | Known address traversal; handle missing results. |
| `node.find('email', 'name')`, `bfs(root, 'email', 'name')` | Search when the address is not known; not a substitute for retaining an owned reference. |
| `isNode(candidate)`, `isList(context)`, `isPlaceholder(child)` | Narrow an extension/adapter value before treating it as a node/list. Placeholders are settled stand-ins for list synchronization, not inputs to validate or destroy. |
| `sync: true` on a core list | Synchronizes child structure with array values; use only when implementing a core list owner. Vue-rendered lists already have an adapter owner. |

`disturb`, `calm`, and `hydrate` are exposed machinery for adapters, not normal application writes; use `input` and settlement. `useIndex`/`valueInserted`/`valueMoved`/`valueRemoved` are internal sentinels despite being exported. `node.root` walks ancestors on every access; retain it outside hot loops. [Pinned core declarations and implementation](https://unpkg.com/@formkit/core@2.1.2/dist/index.d.mts).

### Event and hook selection

Use `node.emit('selection-changed', payload, false)` for a local custom event; omit `false` to bubble. Listener position `'unshift'` runs before existing listeners; a listener's explicit `receipt` can group registrations for one `off(receipt)`. Keep receipt ownership local to the plugin/component.

Choose the actual transition: `child`/`childRemoved` for structure; `prop` (`{ prop, value }`) or `prop:locale` for resolved property changes; `config:locale` for configuration; `message-added`/`message-updated`/`message-removed` for store changes; `settled` for value disturbance; `count:name`, `settled:name`, `unsettled:name` for ledger counters. `commitRaw` also fires for equal-value short-circuit input; it is an **event**, not a hook. `mounted`/`dom-input-event` require the surrounding renderer/input feature; core-only construction does not create DOM.

Hook payloads differ: `input`/`commit` carry values; `init` carries the node; `prop` carries `{ prop, value }`; `message` carries a message; `text` carries the user-facing fragment; `classes` carries `{ property, classes }`; `schema` carries schema; `setErrors` carries `{ localErrors, childErrors }`; `error` carries error text. The form input feature additionally dispatches `hook.submit` with cloned collected values. Transform only the matching payload and return `next(payload)`; use a dispatcher's `unshift` (for example `node.hook.commit.unshift(middleware)`) only for deliberate ordering and remove the same middleware function on teardown. Do not access private emitter pause/play to implement reset: public `reset` owns event buffering.

## Vue installation boundary

Declare `@formkit/vue@2.1.2`, `@formkit/core@2.1.2`, and `@formkit/inputs@2.1.2` as direct dependencies of the consuming Vue app. Both complete SFCs below import types directly from `@formkit/core` and `@formkit/inputs`; those imports need explicit package prerequisites even though the Vue adapter also depends on them. Do not rely on hoisted transitive visibility, including for type-only imports. Keep this package family aligned at the pinned **2.1.2** release. [Vue package manifest](https://unpkg.com/@formkit/vue@2.1.2/package.json), [core package manifest](https://unpkg.com/@formkit/core@2.1.2/package.json), [inputs package manifest](https://unpkg.com/@formkit/inputs@2.1.2/package.json).

The following is an **entry-point integration fragment**: `app` is the existing Vue app before `.mount()`, not a second app to create inside a component.

```ts
import { plugin, defaultConfig } from '@formkit/vue'

app.use(plugin, defaultConfig())
```

`defaultConfig()` supplies input, validation, and message behavior; importing the component alone is not equivalent to installing that configuration. Apply the application's theme separately; no Vuetify styling is inherited automatically. Use the Vue adapter's pinned exports when the public site displays React examples. [Vue declarations](https://unpkg.com/@formkit/vue@2.1.2/dist/index.d.mts).

## Complete Vue field, async validation, and async save

Complete embeddable SFC after the installation above. Required callbacks are explicit **application-owned contracts**. `isEmailAvailable` must return whether an advisory check succeeded; `save` must perform the authoritative write and return canonical values or expected rejection. No route, database, or implementation is assumed. An application can instead supply honest session-memory behavior, labeled as such.

```vue
<script setup lang="ts">
import { nextTick, ref, shallowRef, useTemplateRef, type FormHTMLAttributes, type InputHTMLAttributes } from 'vue'
import { FormKit, reset } from '@formkit/vue'
import type { FormKitNode, FormKitSectionsSchema } from '@formkit/core'
import type { FormKitInputs } from '@formkit/inputs'

interface Draft { email: string }
type SaveResult =
  | { ok: true; value: Draft }
  | { ok: false; message: string; fields: { email?: string } }
const props = defineProps<{
  isEmailAvailable: (email: string) => Promise<boolean>
  save: (draft: Draft) => Promise<SaveResult>
}>()
const errorSemantics: FormKitSectionsSchema = {
  input: { attrs: { 'aria-invalid': '$state.invalid || $state.errors || undefined' } },
}
const region = useTemplateRef<HTMLElement>('region')
const emailNode = shallowRef<FormKitNode | null>(null)
const saving = ref(false)
const status = ref('')
const initialValues: Draft = { email: '' }

function captureEmail(node: FormKitNode) {
  emailNode.value = node
}

async function emailAvailable(node: FormKitNode) {
  const value = String(node.value ?? '')
  try {
    return await props.isEmailAvailable(value)
  } catch {
    return false
  }
}
const validationRules = { email_available: emailAvailable }
const validationMessages = {
  email_available: 'Email availability could not be confirmed; check it and try again.',
}

async function focusEmail() {
  await nextTick()
  region.value?.querySelector<HTMLInputElement>('input[name="email"]')?.focus()
}

async function submit(data: Draft, node: FormKitNode) {
  if (saving.value) return
  saving.value = true
  status.value = ''
  let focusRejectedEmail = false
  node.clearErrors(true)
  try {
    const result = await props.save({ email: data.email })
    if (!result.ok) {
      node.setErrors(
        [result.message],
        result.fields.email ? { email: result.fields.email } : {},
      )
      focusRejectedEmail = Boolean(result.fields.email)
      return
    }
    reset(node, result.value)
    status.value = 'Changes accepted.'
  } catch (cause) {
    node.setErrors([
      cause instanceof Error ? cause.message : 'Could not save changes.',
    ])
  } finally {
    saving.value = false
    if (focusRejectedEmail) await focusEmail()
  }
}

type FormBindings = Extract<FormKitInputs<{ type: 'form' }>, { type: 'form' }>
  & { submitLabel?: string }
  & Pick<FormHTMLAttributes, 'novalidate'>
const formBindings = {
  type: 'form',
  novalidate: true,
  submitBehavior: 'live',
  submitLabel: 'Save',
  onSubmit: submit,
  onSubmitInvalid: focusEmail,
} satisfies FormBindings
const emailAttrs: Pick<InputHTMLAttributes, 'autocomplete' | 'class' | 'style'> = {
  autocomplete: 'email',
}
</script>

<template>
  <section ref="region" aria-label="Profile editor">
    <FormKit
      v-bind="formBindings"
      :value="initialValues"
      :disabled="saving"
    >
      <FormKit
        type="email"
        :sections-schema="errorSemantics"
        name="email"
        label="Email"
        v-bind="emailAttrs"
        validation="required|email|(300)email_available"
        :validation-rules="validationRules"
        :validation-messages="validationMessages"
        @node="captureEmail"
      />
      <p v-if="emailNode?.context?.state.validating" role="status">Checking email…</p>
    </FormKit>
    <p role="status">{{ status }}</p>
  </section>
</template>
```

The complete SFC uses narrow checked bindings for the **2.1.2 declaration boundary**, rather than weakening `strictTemplates`. The adapter exports a callable generic intersected with a runtime component whose props are a union; a literal `type="form"` does not reliably narrow direct form event bindings in strict template tooling. `FormBindings` selects the published `form` member, checking its `onSubmit`/`onSubmitInvalid` props while retaining the application's exact callback signatures. Its sole local extension, `submitLabel?: string`, describes a real runtime pseudo-prop: the pinned form definition registers `submitLabel` and renders it as the built-in submit button's label, but omits it from `FormKitInputProps['form']`. This is a local checked binding, not a global module augmentation or a claim that the package declares that property.

`autocomplete` is likewise a real native input attribute absent from that props union. `emailAttrs` checks it against Vue's native attribute type; optional shared `class`/`style` keys avoid an all-native weak-type mismatch without creating runtime values. Keep the form and input bags on their respective components exactly as shown; do not put callbacks in the native bag or replace the collected node value with a second model. [Published Vue component types](https://unpkg.com/@formkit/vue@2.1.2/dist/index.d.mts), [input/form/event declarations](https://unpkg.com/@formkit/inputs@2.1.2/dist/index.d.mts), [registered form pseudo-props and submit schema](https://unpkg.com/@formkit/inputs@2.1.2/dist/index.mjs), [Vue attribute routing](https://unpkg.com/@formkit/vue@2.1.2/dist/index.mjs).

`novalidate` is checked against Vue's native `FormHTMLAttributes` and forwarded to the actual form through `$attrs`. It prevents the browser's `type="email"` constraint gate from intercepting submission before FormKit can run its own validation and invalid-submit callback. The pinned form section does not add it automatically; keep it on both complete forms here. Labels, email input semantics, `aria-required`, and error descriptions remain intact. [Pinned form/input sections](https://unpkg.com/@formkit/inputs@2.1.2/dist/index.mjs), [native `novalidate`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#novalidate).

The 2.1.2 default input exposes required state and error descriptions but does not set native `aria-invalid`. The typed section extension projects existing visible-validation or explicit-error state onto that attribute; it adds no validator or submit gate and leaves pristine inputs unmarked. [Pinned Vue state bindings](https://unpkg.com/@formkit/vue@2.1.2/dist/index.mjs), [section overrides](https://formkit.com/essentials/inputs#sections-schema).

Custom rules return **boolean or Promise<boolean>**, not vee-validate's message-string convention. `required|email` runs before the debounced remote rule; rules normally bail and skip empty values. The generic remote-rule message deliberately does not mislabel a network outage as “email taken.” If the product needs distinct outage/unavailable messages, represent that distinction explicitly in application state and messages.

The form waits for committed input values **and its validating ledger**, marks fields submitted, rejects blocking failures, then calls `@submit` with an unbound copy of collected data plus the core node. Do not submit an independently bound `v-model` snapshot instead. Returning the save promise keeps loading active; an `async` handler is suitable. In 2.1.2 the disabled feature normalizes `false` to `undefined`, so `:disabled="saving"` alone does **not** opt out of automatic disabling. The example sets `submitBehavior: 'live'` to leave disabled state to `saving` and its synchronous write guard; this disables neither validation nor loading and is not a persistence guarantee. [2.1.2 form/disabled features](https://unpkg.com/@formkit/inputs@2.1.2/dist/index.mjs), [boolean normalization](https://unpkg.com/@formkit/utils@2.1.2/dist/index.mjs).

### Async race and failure boundaries

The 2.1.2 validation engine records a run token and ignores a stale promise result when a newer validation run supersedes it. It does **not** give a custom rule an AbortSignal or cancel an arbitrary request for you. Keep async rules free of side effects; return their result, do not manually set errors after awaiting an obsolete request. Debounce reduces calls but does not cancel one already sent. If cancellation is required, own controllers per field/node and dispose them with that node's lifecycle. Always catch expected request rejection: the validation engine consumes promise fulfillment, so an uncaught rejection can leave validation unresolved. [Pinned validation engine](https://unpkg.com/@formkit/validation@2.1.2/dist/index.mjs).

**Excluded rule contracts:** an unhandled rejected promise and a vee-validate-style message string are not supported alternatives. In the exact 2.1.2 engine, `run()` attaches only a fulfillment handler, and only its completion callback removes the `validating` message. A rejection therefore has no failure/cleanup continuation in that run; it must not be described as a normal validation failure. The supplied `emailAvailable` catches the application rejection and resolves `false`, allowing the ledger to settle and the configured failure message to appear. The same implementation uses `!!result` for passing state and `result === false` for a failed message, so a nonempty error string can be interpreted as success. Preserve boolean results and configure text through `validationMessages`; never port a vee-validate rule unchanged. These are published-source findings, not executed reproductions. [Exact validation continuation](https://unpkg.com/@formkit/validation@2.1.2/dist/index.mjs).

An availability result can become stale before save. Expected authoritative save rejection uses `node.setErrors(formErrors, childErrors)` with allowlisted child paths. By default manually assigned input errors clear when that input changes; `preserve-errors`/inherited `preserveErrors` changes that policy. `node.clearErrors(true)` clears descendant errors assigned by that form too. Do not erase a failed draft or reset on a rejected save. For the nonempty form object shown above, `reset(node, canonicalValue)` makes that accepted value the new initial/reset state; `reset(node)` restores the current initial state, not necessarily empty strings.

**Pinned reset limit:** 2.1.2 updates the baseline only when `Boolean(resetTo && !empty(resetTo))` is true. Direct scalar resets to `false`, `0`, `''`, `null`, or `undefined` restore the previous initial value instead; `{}`/`[]` do not establish a new baseline either. Reset the owning form with an explicit nonempty object such as `{ email: '' }` or `{ consent: false }` when those values must become the new baseline. Do not generalize this example into an unrestricted scalar/empty-container reset contract. [Pinned reset](https://unpkg.com/@formkit/core@2.1.2/dist/index.mjs), [empty-value predicate](https://unpkg.com/@formkit/utils@2.1.2/dist/index.mjs).

Returned field errors request focus only after `finally` clears `saving` and `focusEmail()` awaits the DOM flush. Calling it inside the save branch would focus a still-disabled input. The invalid-submit callback has no application save lock to release; it can use the helper directly. This sequencing requires both `submitBehavior: 'live'` and `:disabled="saving"` as shown, not a second automatic disabled owner. [Disabled control focus](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled), [Vue `nextTick`](https://vuejs.org/api/general.html#nexttick).

## Messages and ledgers in core

Core stores messages; plugins decide how validation/rendering interpret them. Messages are immutable after insertion. Replace with `store.set(createMessage(...))` or remove by key; do not mutate `store.someKey.value`.

Complete setup-only core example with a blocking-message counter. The counter's settlement means “zero matching messages,” not value settlement. The rejected promise/service is not being faked here; this demonstrates an actual message lifecycle.

```ts
import { createMessage, createNode } from '@formkit/core'

const node = createNode({ name: 'quota' })
node.ledger.count('blocking', message => message.blocking)
node.store.set(createMessage({
  key: 'quota', type: 'error', blocking: true, value: 'The quota is exceeded.',
}))
const blocked = node.ledger.value('blocking') > 0
node.store.remove('quota')
await node.ledger.settled('blocking')
node.destroy()
```

`setErrors`, `clearErrors`, and `reset` helpers can take registry IDs; IDs are not node paths. `getNode(id)` can return `undefined`, particularly before mount/after teardown. Avoid ID-global coupling when an existing node argument is available. `submitForm(id)`/`node.submit()` dispatch DOM submission to the nearest installed form; they are not an awaitable replacement for a core-only persistence function.

### Registry lifetime and diagnostics

In the **published 2.1.2 runtime**, an explicit creation-time `props.id` registers a node, including a non-root node; a generated ID alone is not registered by `nodeInit`. The declaration comment about “root nodes or alias” is not the runtime condition. `register(node)` explicitly registers its current ID; `deregister(node)` removes it and publishes `payload: null`. IDs are registry-wide, so keep them unique across mounted trees. A watcher observes future changes, not the already-present node: combine an initial `getNode(id)` with `watchRegistry`.

Complete setup-only core registry lifetime; the watcher is active before creation, observes the actual registration/removal, and is always removed:

```ts
import { createNode, getNode, stopWatch, watchRegistry } from '@formkit/core'
import type { FormKitNode } from '@formkit/core'

let current: FormKitNode | undefined = getNode('profile-editor')
const receipt = watchRegistry('profile-editor', event => {
  current = event.payload ?? undefined
})
const node = createNode({
  type: 'group',
  props: { id: 'profile-editor' },
  value: { email: '' },
})
try {
  await node.input({ email: 'reader@example.com' })
  if (current !== node) throw new Error('Profile editor ID is not owned by this node.')
} finally {
  node.destroy()
  stopWatch(receipt)
}
```

`resetRegistry()` is global test/isolated-runtime teardown, not a component unmount operation; it deregisters nodes and removes watchers belonging to other trees too. `resetCount()` resets generated-name/ID counters for deterministic isolated tests, not user-facing identity.

For debugging, core `error(code, data)` throws, while `warn(code, data)` reports through `warningHandler`. Register `errorHandler`/`warningHandler` middleware to enrich/report and continue with `next(payload)`; do not convert malformed values into success. Codes 107/108 mean wrong group/list value shape; 103/104 concern compiler syntax; 151 means `submitForm` did not find an HTML form. `submitForm(id, shadowRoot)` accepts an alternate document/shadow root; do not invoke its DOM contract during SSR. The published runtime exports `FORMKIT_VERSION = "2.1.2"`; a prepared-source `"__FKV__"` placeholder is not evidence about the distributed package.

### Bulk messages, counters, and class composition

`createMessage` defaults to `type: 'state'`, `blocking: false`, `visible: true`, generated key, and empty metadata. A display error is not necessarily blocking: set that policy explicitly. `meta.messageKey`/`i18nArgs` are localization hints. Store messages by stable source-owned keys so revalidation replaces its own error rather than accumulating duplicates.

- `store.apply(messageArray, clear?)` applies locally. An address → message-array map routes to descendants and buffers a missing child's messages until it attaches; use allowlisted addresses to avoid stale errors appearing on an unrelated later-mounted row.
- `clear` is a message type or predicate selecting **old** messages to replace, not a command to clear every producer. `store.filter(predicate, type?)` removes nonmatching messages of that type; `reduce(reducer, initial)` computes a summary.
- `message-added`/`message-updated`/`message-removed` bubble; ancestor `.deep` listeners can maintain summaries without scanning the tree.
- Register `ledger.count(name, predicate)` once on the owning ancestor; it aggregates matching subtree messages and follows child attachment/removal. Read `value(name)` or react to `count:name`; `settled(name)` waits for zero. An unknown counter name resolves immediately, so register the exact counter before waiting. Changing a counted message's matching properties requires deliberate counter policy; prefer remove/set when changing its classification.
- For a custom theme/renderer, `createClasses(section, node, classInput)` normalizes string/map/function class inputs to boolean maps; `generateClassList(node, section, ...maps)` combines them into a string or `null` through the classes hook. `rootClasses` supplies the base layer and `classes` supplies section overrides. Do not bypass this pipeline by mutating a cached generated string.

## Schema rendering and expressions

Core exports schema types, guards, sugar normalization, and an expression compiler. Vue renders with **`FormKitSchema` from `@formkit/vue`**. `$el` renders DOM, `$cmp` resolves a component, and `$formkit` is FormKit-component sugar. FormKit schema is a UI description, not Zod/Yup/Standard Schema validation; core has no universal schema-validation adapter.

Complete SFC after Vue plugin installation. It renders fields from a typed, local schema and applies only a session-memory snapshot. The schema does not contain hidden service functions or arbitrary remote component names.

```vue
<script setup lang="ts">
import { shallowRef, type FormHTMLAttributes } from 'vue'
import { FormKit, FormKitSchema } from '@formkit/vue'
import type { FormKitSchemaDefinition, FormKitSectionsSchema } from '@formkit/core'
import type { FormKitInputs } from '@formkit/inputs'

const applied = shallowRef<{ email: string } | null>(null)
const errorSemantics: FormKitSectionsSchema = {
  input: { attrs: { 'aria-invalid': '$state.invalid || $state.errors || undefined' } },
}
const schema: FormKitSchemaDefinition = [
  {
    $formkit: 'email', name: 'email', label: 'Email',
    __raw__sectionsSchema: errorSemantics,
    validation: 'required|email', autocomplete: 'email',
  },
]
function applyForSession(data: { email: string }) {
  applied.value = { email: data.email }
}
type FormBindings = Extract<FormKitInputs<{ type: 'form' }>, { type: 'form' }>
  & { submitLabel?: string }
  & Pick<FormHTMLAttributes, 'novalidate'>
const formBindings = {
  type: 'form',
  novalidate: true,
  submitLabel: 'Apply for this session',
  onSubmit: applyForSession,
} satisfies FormBindings
</script>

<template>
  <FormKit v-bind="formBindings">
    <FormKitSchema :schema="schema" />
  </FormKit>
  <p role="status">Session-only email: {{ applied?.email ?? 'None applied' }}</p>
</template>
```

Use `__raw__sectionsSchema` here: the outer renderer must pass the section object unparsed so its `$state` expressions run in the email input's context, not the outer schema's data scope. The prefix is removed before passing `sectionsSchema` to `FormKit`. [Raw schema values](https://formkit.com/essentials/schema#raw-values).

The raw prefix is a **scope boundary**, not an escape from trust policy: allow it only on known local props such as this `sectionsSchema`. Removing the prefix makes `parseAttrs` recursively interpret nested `$state` strings in the outer schema context. Likewise, a false-returning core plugin is neither inherited nor recorded; a repeated explicit registration can repeat its side effects. Keep such plugins side-effect-free/idempotent or use a normal recorded plugin with explicit node-type guards. Neither schema raw values nor plugin return values are validation-schema adapters. [Exact Vue `parseAttrs`](https://unpkg.com/@formkit/vue@2.1.2/dist/index.mjs), [exact core `use`](https://unpkg.com/@formkit/core@2.1.2/dist/index.mjs).

Expressions begin with `$` (or `$:` when the first token is not a reference) and use FormKit's limited expression language, not arbitrary JavaScript. Supply data/functions deliberately. Complete compiler example:

```ts
import { compile } from '@formkit/core'

let count = 1
const positive = compile('$count > 0').provide(() => ({ count: () => count }))
const before = positive()
count = -1
const after = positive()
```

The provider receives required token names and returns a **map of token → getter function**. Returning one getter directly, despite a misleading declaration comment, does not match the 2.1.2 provider type. Getters allow subsequent evaluations to observe current values. Conditional/loop schema nodes need explicit stable `key` values. For external schemas, allowlist `$cmp`, exposed functions, and permitted attributes; do not treat a serializable UI schema as an authorization or sanitization boundary.

For a schema-processing tool, narrow nodes with `isDOM`/`isComponent`/`isConditional`/`isSugar`; `sugar(node)` converts `$formkit` into a FormKit component node rather than validating data. String nodes are text. `{ if, then, else }` selects a schema branch (also usable as an attribute value); `if` on a DOM/component node controls that node's presence. A `for: [valueName, keyName, '$items']` tuple provides loop aliases; `bind: '$attrs'` binds a data-supplied attribute map. Pass the corresponding data to `FormKitSchema`, keep stable `key` values on conditional/repeated nodes, and allowlist bound attributes too.

`FormKitSectionsSchema` extends named input sections with partial schema nodes; `null` removes a section. Use it for a deliberate structural override rather than copying an input's entire upstream schema. Within custom input schema, `$_value` is immediate editing state, `$value` is committed state, `$handlers` and `$attrs` are renderer-provided; they do not exist in a bare compiler invocation. Compiler tokens allow nested access and calls to explicitly supplied functions, comparisons, boolean operators, and arithmetic—not arbitrary JavaScript statements. Invalid leading/trailing operators throw 103/104. Inspect supplied function receivers when upgrading: 2.1.0 corrected prototype-method tail binding.

## Nested/list operations and Vuetify integration

Nest `type="group" name="profile"` around its child controls; nest `type="list" name="people"` around group rows for an array of objects. Input names map to the **node tree**, regardless of intervening layout DOM. List children use their current indices; stable render keys must remain separate from those addresses. Core list mutations use `parent.add(child, index)`, `parent.remove(child)`, and `child.index` for reordering; await settlement after structural/value changes before reading the aggregate. `remove` detaches; explicitly destroy a manually owned node that will not be reused. Dynamic Vue lists should follow the Vue adapter/list API rather than mounting a second core tree behind it.

A raw `VTextField` inside a FormKit form is not collected or validated automatically. There is no core `vuetify` input type/plugin to assume exists. For an actual adapter, use `createInput` from `@formkit/vue` with an owned Vue component/definition. That component must bridge `context._value` for immediate input display, `context.node.input(nextValue)` for updates, blur/touch handlers, disabled state, label/help/error IDs, and visible messages. `_value` belongs only inside that documented adapter context; application code reads committed `node.value`. Leave Vuetify `rules` unset when FormKit owns validation. Verify keyboard, focus, clear/null conversion, and error association for the real wrapped input; CSS similarity is not an adapter contract. See [Vuetify setup](vuetify-setup.md) and [accessibility](accessibility.md).

## Upgrading incumbent core integrations

Keep the FormKit package family compatible; the pinned core requires `@formkit/utils ^2.1.2`, while the Vue adapter brings its matching input/validation packages. The 2.0 release added React without listing core API removals; that is **not** a guarantee that every 1.x application compiles unchanged. Inspect the installed peer/dependency manifests and custom input definitions before upgrading.

The [2.1.0 release](https://github.com/formkit/formkit/releases/tag/v2.1.0) fixed buffered reset-event loss, repeated reset input hooks, invalid-state preservation, explicit reset values for all node types, and prototype-member compiler tail access. Remove application workarounds that depended on those bugs only after exercising explicit input/group/list resets and listener ordering. The [2.1.1 release](https://github.com/formkit/formkit/releases/tag/v2.1.1) changed Vue SSR node cleanup, not the core API; [2.1.2](https://github.com/formkit/formkit/releases/tag/v2.1.2) fixed parentless registry cleanup and repeated config removal. Preserve teardown and request isolation even on the fixed release; a patch is not permission to retain a graph across requests.

## Verification boundary and sources

No execution/typecheck/browser verification is claimed. The graph function and compiler/message fences are core-only; the two SFCs require installed Vue adapter configuration; the async SFC has explicit required application callbacks; installation is contextual. Both complete SFCs include the locally checked form bindings described above; their suitability for strict template checking is based on the inspected declarations/runtime, not an executed pass. Assemble each complete `vue` fence verbatim as its own SFC, with no omitted bags or direct `submit-label`/submit-event substitutions. Exercise rapid edit/submit before debounce, out-of-order checks, rejected check promises, authoritative save errors, reset baseline, list detach/reorder, repeated plugin registration, and teardown/unmount in the consuming app.

- [Architecture, nodes, settlement, configuration](https://formkit.com/essentials/architecture).
- [Form submission, errors, reset](https://formkit.com/inputs/form).
- [Custom validation and rule hints](https://formkit.com/essentials/validation).
- [Schema and renderer](https://formkit.com/essentials/schema).
- [2.1.2 core declarations](https://unpkg.com/@formkit/core@2.1.2/dist/index.d.mts), [runtime](https://unpkg.com/@formkit/core@2.1.2/dist/index.mjs), [Vue exports](https://unpkg.com/@formkit/vue@2.1.2/dist/index.d.mts).
- [2.1.2 input form state machine](https://unpkg.com/@formkit/inputs@2.1.2/dist/index.mjs), [validation engine](https://unpkg.com/@formkit/validation@2.1.2/dist/index.mjs).
