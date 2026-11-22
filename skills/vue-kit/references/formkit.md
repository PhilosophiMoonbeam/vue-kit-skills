# FormKit: node graphs, Vue forms, and schema

Read for `@formkit/core`, `FormKitNode`, node/plugin lifecycle, schema-generated forms, or an incumbent FormKit app. Read [form ownership](forms.md) before connecting server state or another UI library. Core is not a validation/UI component library, and it does not provide a built-in Vuetify adapter.

## Exact packages and boundaries

Current standalone examples use **`@formkit/core@2.9.0`**, **`@formkit/vue@2.9.0`**, and, where imported directly, **`@formkit/inputs@2.9.0`**. Core depends on `@formkit/utils ^2.9.0`; it is framework-independent, not dependency-free. The Vue adapter declares Vue `^3.4.0` (Vue **3.5.46** satisfies it) and `^2.9.0` for its FormKit family dependencies. Keep directly used family packages on **2.9.0**, including rules, validation, i18n, themes or addons when needed. [Core metadata](https://registry.npmjs.org/@formkit/core/2.9.0), [Vue metadata](https://registry.npmjs.org/@formkit/vue/2.9.0), [inputs metadata](https://registry.npmjs.org/@formkit/inputs/2.9.0).

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

Complete TypeScript function using only `@formkit/core@2.9.0`. It creates a nested object/list graph, demonstrates middleware, captures committed events, returns a detached snapshot, and destroys the manually owned nodes. No Vue plugin or backend is implied.

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

Group writes require objects and list writes require arrays. `node.input(value, false)` commits synchronously, but use the ordinary async path unless implementing a deliberate adapter/internal operation. `_value` and `_c` are internal escape hatches, not application state APIs. [Architecture](https://formkit.com/essentials/architecture), [pinned node declarations](https://unpkg.com/@formkit/core@2.9.0/dist/index.d.mts).

## Events, middleware, plugins, and destruction

- `node.on(name, listener)` returns a receipt string; pass it to `node.off(receipt)`. Events carry `name`, `origin`, `payload`, and bubbling information. `commit.deep` also hears descendant-origin commits; `commit` hears the local node.
- `input` is pre-commit input; `commit` is committed value. `created` and `defined` mark construction/definition. `destroying` is the cleanup hook; `destroyed` follows cleanup. `node.destroy()` removes that node from its parent/registry, clears stores/listeners/plugins, and invalidates its value/context.
- **Destroying a manually created parent does not recursively destroy every child.** Explicitly dispose manually owned children. The Vue adapter owns/destroys nodes it creates with its component lifetime; do not separately destroy an adapter-owned input just because you captured `@node`.
- A plugin receives a node and is inherited by descendants. Normal successful registration is recorded per node; repeated `node.use(plugin)` does not duplicate it. Returning `false` stops inheritance **and does not record that plugin**, so later explicit `.use(plugin)` may run it again. Do not describe false-returning plugins as unconditionally “once per node.”
- `plugin.library` can inspect `node.props.type` and call `node.define(definition)` to supply an input type. `createInput` belongs to `@formkit/vue`, not core.
- Hooks are middleware, e.g. `node.hook.commit((value, next) => next(value))`. Register meaningful transformations once. Always continue the chain for middleware intended to transform/pass through; skipping `next` interrupts downstream work. Save functions do not belong in value hooks.
- Use inherited `config` for defaults, instance `props` for overrides. A config change can propagate through the graph. Do not walk the whole tree on every keystroke; `node.walk()` excludes the node itself and is a lifecycle-level operation.

The [2.9.0 runtime](https://unpkg.com/@formkit/core@2.9.0/dist/index.mjs) retains the cleanup and false-return behavior. Recorded plugins are idempotent under repeated `.use()` with the **same function identity**; a fresh closure is a different plugin, and a plugin returning `false` must make repeated setup safe itself.

### Configuration, definitions, and core-only traversal

`createConfig({ locale: 'en' })` creates a shared root-config proxy; attach it through `config: { rootConfig }` when creating each independently owned tree, then set `rootConfig.locale` to notify inheriting nodes. A node's explicit prop wins over config; local config wins over parent/root defaults. `delay` defaults to 20 ms for input nodes. Change `delimiter` before creating addresses when field names contain dots. These are core configuration objects, not Vue's `defaultConfig()` installer.

For unavoidable same-name siblings, set the parent's `config: { mergeStrategy: { fieldName: 'synced' } }`; 2.9.0 supports only `'synced'`. Otherwise use unique names: two controls fighting over one object slot are not separate fields. `node.resetConfig()` reconnects inherited config after deliberate graph changes; do not mutate private `_add`/`_rm` bookkeeping.

For custom input libraries, `node.define({ type, family, props, schema, features })` supplies a structural definition; `component` is the alternative to schema rendering. `node.addProps(['currency'])` promotes a matching attribute from `node.props.attrs` into the pseudo-prop namespace. Definition-map entries can supply `default`, `boolean`, `getter`, and `setter`. Prefer a plugin feature for reusable behavior; reserve `node.extend(key, { get, set })` traps for a genuine core extension, never a duplicate writable `value`.

| Operation | Contract and boundary |
| --- | --- |
| `node.each(callback)` | Immediate children; use for local attachment/cleanup policy. |
| `node.walk(callback, stopOnFalse?, skipSubtreeOnFalse?)` | Descendants, not self; avoid repeated whole-tree scans during input. |
| `node.at('$root.profile.email')`, `$parent`, `$self` | Known address traversal; handle missing results. |
| `node.find('email', 'name')`, `bfs(root, 'email', 'name')` | Search when the address is not known; not a substitute for retaining an owned reference. |
| `node.closest('address')`, `node.closest('list', 'type')` | Search self then ancestors; returns `undefined` on no match. A custom searcher is the second argument. Address syntax also accepts `$self.closest(list, type).0.price`. [2.7.0 release](https://github.com/formkit/formkit/releases/tag/v2.7.0), [exact traversal](https://github.com/formkit/formkit/blob/v2.9.0/packages/core/src/node.ts#L3022-L3056). |
| `isNode(candidate)`, `isList(context)`, `isPlaceholder(child)` | Narrow an extension/adapter value before treating it as a node/list. Placeholders are settled stand-ins for list synchronization, not inputs to validate or destroy. |
| `sync: true` on a core list | Synchronizes child structure with array values; use only when implementing a core list owner. Vue-rendered lists already have an adapter owner. |

`disturb`, `calm`, and `hydrate` are adapter machinery, not normal application writes; use `input` and settlement. `useIndex`/`valueInserted`/`valueMoved`/`valueRemoved` are internal sentinels despite being exported. `node.root` walks ancestors on access; retain it outside hot loops. [Pinned core declarations](https://unpkg.com/@formkit/core@2.9.0/dist/index.d.mts).

### Event and hook selection

Use `node.emit('selection-changed', payload, false)` for a local custom event; omit `false` to bubble. Listener position `'unshift'` runs before existing listeners; a listener's explicit `receipt` can group registrations for one `off(receipt)`. Keep receipt ownership local to the plugin/component.

Choose the actual transition: `child`/`childRemoved` for structure; `prop` (`{ prop, value }`) or `prop:locale` for resolved property changes; `config:locale` for configuration; `message-added`/`message-updated`/`message-removed` for store changes; `settled` for value disturbance; `count:name`, `settled:name`, `unsettled:name` for ledger counters. `commitRaw` also fires for equal-value short-circuit input; it is an **event**, not a hook. `mounted`/`dom-input-event` require the surrounding renderer/input feature; core-only construction does not create DOM.

Hook payloads differ: `input`/`commit` carry values; `init` carries the node; `prop` carries `{ prop, value }`; `message` carries a message; `text` carries the user-facing fragment; `classes` carries `{ property, classes }`; `schema` carries schema; `setErrors` carries `{ localErrors, childErrors }`; `error` carries error text. The form input feature additionally dispatches `hook.submit` with cloned collected values. Transform only the matching payload and return `next(payload)`; use a dispatcher's `unshift` (for example `node.hook.commit.unshift(middleware)`) only for deliberate ordering and remove the same middleware function on teardown. Do not access private emitter pause/play to implement reset: public `reset` owns event buffering.

## Vue installation boundary

Declare `@formkit/vue@2.9.0`, `@formkit/core@2.9.0`, and `@formkit/inputs@2.9.0` as direct dependencies of the consuming app. Both complete SFCs import types directly from core and inputs; do not rely on transitive hoisting, including for type-only imports.

The following is an **entry-point integration fragment**: `app` is the existing Vue app before `.mount()`, not a second app to create inside a component.

```ts
import { plugin, defaultConfig } from '@formkit/vue'

app.use(plugin, defaultConfig())
```

`defaultConfig()` supplies input, validation, and message behavior; importing the component alone is not equivalent to installing that configuration. Apply the application's theme separately; no Vuetify styling is inherited automatically. Use the Vue adapter's pinned exports when the public site displays React examples. [Vue declarations](https://unpkg.com/@formkit/vue@2.9.0/dist/index.d.mts).

## Complete Vue field, async validation, and async save

Complete embeddable SFC after the installation above. Required callbacks are explicit **application-owned contracts**. `isEmailAvailable` must return whether an advisory check succeeded; `save` must perform the authoritative write and return canonical values or expected rejection. No route, database, or implementation is assumed. An application can instead supply honest session-memory behavior, labeled as such.

```vue
<script setup lang="ts">
import { nextTick, ref, shallowRef, type FormHTMLAttributes, type InputHTMLAttributes } from 'vue'
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
  const input = emailNode.value?.context?.refs?.input
  if (input instanceof HTMLInputElement) input.focus()
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
  <section aria-label="Profile editor">
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

The complete SFC uses narrow checked bindings without weakening `strictTemplates`. **2.9.0** exports `FormKit` as the generic callable only, unlike the **2.1.2** callable/`DefineComponent` intersection. Keep the typed `FormBindings` bag for the form callbacks and runtime `submitLabel`: the form registers and renders it but omits it from `FormKitInputProps['form']`. This local bag is not module augmentation. For incumbent `InstanceType`, `extends`, or dynamic `h()` requiring a constructor-style component, use **`FormKitRuntimeComponent`**. Do not substitute it in templates just to bypass stronger inference.

`autocomplete` is a native input attribute, not a declared FormKit input prop. `emailAttrs` checks it against Vue's native attribute type; optional shared `class`/`style` keys avoid an all-native weak-type mismatch without creating runtime values. Keep form and input bags on their respective components. [Vue types](https://unpkg.com/@formkit/vue@2.9.0/dist/index.d.mts), [input/form/event declarations](https://unpkg.com/@formkit/inputs@2.9.0/dist/index.d.mts), [form definition](https://unpkg.com/@formkit/inputs@2.9.0/dist/index.mjs), [Vue attribute routing](https://unpkg.com/@formkit/vue@2.9.0/dist/index.mjs).

`novalidate` is checked against Vue's native `FormHTMLAttributes` and forwarded to the form through `$attrs`. It prevents native email constraints from intercepting submission before FormKit can validate and call its invalid-submit callback. FormKit does not add it automatically; keep it on both forms here. Labels, email semantics, `aria-required`, and error descriptions remain intact. [Pinned form sections](https://unpkg.com/@formkit/inputs@2.9.0/dist/index.mjs), [native `novalidate`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#novalidate).

The default input still exposes required state and error descriptions without setting native `aria-invalid`. The typed section extension projects visible-validation or explicit-error state onto that attribute, without adding a validator or marking pristine inputs. [Pinned Vue bindings](https://unpkg.com/@formkit/vue@2.9.0/dist/index.mjs), [section overrides](https://formkit.com/essentials/inputs#sections-schema).

Custom rules return **boolean or Promise<boolean>**, not vee-validate's message-string convention. `required|email` runs before the debounced remote rule; rules normally bail and skip empty values. The generic remote-rule message deliberately does not mislabel a network outage as “email taken.” If the product needs distinct outage/unavailable messages, represent that distinction explicitly in application state and messages.

The form waits for committed values and its validating ledger, marks fields submitted, rejects blocking failures, then calls `onSubmit` with a copy of collected values plus the node. Return the save promise to keep loading active; do not submit a second `v-model` snapshot. The disabled feature normalizes `false` to `undefined`, so `:disabled="saving"` alone does not opt out of automatic disabling. `submitBehavior: 'live'` leaves disabled state to the `saving` guard without disabling validation/loading. That guard and FormKit's latest-submit tracking do not make a server write idempotent. [2.9.0 form/disabled features](https://unpkg.com/@formkit/inputs@2.9.0/dist/index.mjs).

### Async race and failure boundaries

The 2.9.0 validator records a run token and ignores a stale result when superseded. It does not give a custom rule an `AbortSignal` or cancel requests. Return a result rather than publishing errors after awaiting an obsolete request. Debounce reduces requests but does not cancel one already sent. When cancellation is needed, own and dispose controllers per field/node. [Pinned validation engine](https://unpkg.com/@formkit/validation@2.9.0/dist/index.mjs).

**Excluded rule contracts:** 2.9.0 `run()` attaches only a fulfillment handler, and only completion removes the `validating` message. Unhandled rejection can leave validation unresolved; `emailAvailable` catches application rejection and resolves `false`. The engine uses `!!result` for passing state and `result === false` for a failed message, so a nonempty error string can count as success. Return booleans and provide text through `validation-messages`. The branches are source-checked in 2.9.0; the earlier 2.1.2 engine was separately exercised.

An availability result can become stale before save. Expected authoritative save rejection uses `node.setErrors(formErrors, childErrors)` with allowlisted child paths. By default manually assigned input errors clear when that input changes; `preserve-errors`/inherited `preserveErrors` changes that policy. `node.clearErrors(true)` clears descendant errors assigned by that form too. Do not erase a failed draft or reset on a rejected save. For the nonempty form object shown above, `reset(node, canonicalValue)` makes that accepted value the new initial/reset state; `reset(node)` restores the current initial state, not necessarily empty strings.

**Pinned reset limit:** 2.9.0 still updates the baseline only when `Boolean(resetTo && !empty(resetTo))` is true. Scalar resets to `false`, `0`, `''`, `null`, or `undefined` restore the previous initial value; `{}`/`[]` do not establish a new baseline either. Reset the owning form with a nonempty object such as `{ email: '' }` or `{ consent: false }`. [Pinned reset](https://github.com/formkit/formkit/blob/v2.9.0/packages/core/src/reset.ts#L66-L114), [empty-value predicate](https://unpkg.com/@formkit/utils@2.9.0/dist/index.mjs).

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

An explicit creation-time `props.id` registers a node, including a non-root node; a generated ID alone is not registered by `nodeInit`. IDs are registry-wide; keep them unique. Since **2.2.1**, duplicate registration warns in development and replaces the lookup, and deregistering the old node does not remove the newer entry. Deregistering the registered owner publishes `payload: null`; it does not restore a displaced owner. Use `getNode(id)` for existing state and `watchRegistry` for future changes. [Exact registry](https://github.com/formkit/formkit/blob/v2.9.0/packages/core/src/registry.ts).

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

Core `error(code, data)` throws, while `warn(code, data)` reports through `warningHandler`. Use `errorHandler`/`warningHandler` middleware to enrich/report and continue with `next(payload)`; do not turn malformed values into success. Codes 107/108 indicate wrong group/list shape; 103/104 concern compiler syntax; 151 means `submitForm` did not find an HTML form. `submitForm(id, shadowRoot)` accepts an alternate document/shadow root; do not invoke its DOM contract during SSR. Read the published `FORMKIT_VERSION`, not the `"__FKV__"` source placeholder.

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

The raw prefix is a **scope boundary**, not an escape from trust policy: allow it only on known local props. Removing it makes `parseAttrs` interpret nested `$state` in the outer context. **`__deep__` is the opposite opt-in:** `__deep__options: [{ label: 'Banana', value: 'b', attrs: { disabled: '$outOfStock' } }]` evaluates expressions in nested objects and arrays. Ordinary option arrays keep literal strings such as `'$10'`. Neither prefix is a validation adapter. [2.8.0 release](https://github.com/formkit/formkit/releases/tag/v2.8.0), [exact parser](https://github.com/formkit/formkit/blob/v2.9.0/packages/vue/src/FormKitSchema.ts#L393-L462).

In 2.9.0 a `$cmp` node also accepts `slots: { header: [{ $el: 'h2', children: '$title' }] }` when the allowlisted component supplies a `header` slot with a `title` prop. Each slot sees its own scoped props. `children` supplies the default unless `slots.default` supplies a replacement. These are outgoing component slots, unlike `$slots.name`, which reads slots supplied to `FormKitSchema`. [2.9.0 release](https://github.com/formkit/formkit/releases/tag/v2.9.0), [exact renderer](https://github.com/formkit/formkit/blob/v2.9.0/packages/vue/src/FormKitSchema.ts#L594-L637).

Expressions begin with `$` (or `$:` when the first token is not a reference) and use FormKit's limited expression language, not arbitrary JavaScript. Supply data/functions deliberately. Complete compiler example:

```ts
import { compile } from '@formkit/core'

let count = 1
const positive = compile('$count > 0').provide(() => ({ count: () => count }))
const before = positive()
count = -1
const after = positive()
```

The provider receives required token names and returns a **map of token → getter function**. Returning one getter directly, despite a misleading declaration comment, does not match the published type. Getters track current values across evaluations. Conditional/loop nodes need stable keys. Allowlist `$cmp`, exposed functions and attributes for external schema; serializable UI is not authorization or sanitization.

For a schema-processing tool, narrow nodes with `isDOM`/`isComponent`/`isConditional`/`isSugar`; `sugar(node)` converts `$formkit` into a FormKit component node rather than validating data. String nodes are text. `{ if, then, else }` selects a schema branch (also usable as an attribute value); `if` on a DOM/component node controls that node's presence. A `for: [valueName, keyName, '$items']` tuple provides loop aliases; `bind: '$attrs'` binds a data-supplied attribute map. Pass the corresponding data to `FormKitSchema`, keep stable `key` values on conditional/repeated nodes, and allowlist bound attributes too.

`FormKitSectionsSchema` extends named input sections with partial schema nodes; `null` removes a section. Use it for a deliberate structural override rather than copying an input's entire upstream schema. Within custom input schema, `$_value` is immediate editing state, `$value` is committed state, `$handlers` and `$attrs` are renderer-provided; they do not exist in a bare compiler invocation. Compiler tokens allow nested access and calls to explicitly supplied functions, comparisons, boolean operators, and arithmetic—not arbitrary JavaScript statements. Invalid leading/trailing operators throw 103/104. Inspect supplied function receivers when upgrading: 2.1.0 corrected prototype-method tail binding.

## Nested/list operations and Vuetify integration

Nest `type="group" name="profile"` around its child controls; nest `type="list" name="people"` around group rows for an array of objects. Input names map to the **node tree**, regardless of intervening layout DOM. List children use their current indices; stable render keys must remain separate from those addresses. Core list mutations use `parent.add(child, index)`, `parent.remove(child)`, and `child.index` for reordering; await settlement after structural/value changes before reading the aggregate. `remove` detaches; explicitly destroy a manually owned node that will not be reused. Dynamic Vue lists should follow the Vue adapter/list API rather than mounting a second core tree behind it.

A raw `VTextField` inside a FormKit form is not collected or validated automatically. There is no core `vuetify` input type/plugin to assume exists. For an actual adapter, use `createInput` from `@formkit/vue` with an owned Vue component/definition. That component must bridge `context._value` for immediate input display, `context.node.input(nextValue)` for updates, blur/touch handlers, disabled state, label/help/error IDs, and visible messages. `_value` belongs only inside that documented adapter context; application code reads committed `node.value`. Leave Vuetify `rules` unset when FormKit owns validation. Verify keyboard, focus, clear/null conversion, and error association for the real wrapped input; CSS similarity is not an adapter contract. See [Vuetify setup](vuetify-setup.md) and [accessibility](accessibility.md).

## Upgrading incumbent core integrations

Keep the family aligned as above. The 2.0 release added React without listing core API removals; that does not guarantee every 1.x app compiles unchanged.

The [2.1.0 release](https://github.com/formkit/formkit/releases/tag/v2.1.0) fixed buffered reset-event loss, repeated reset input hooks, invalid-state preservation, explicit reset values for all node types, and prototype-member compiler tail access. Remove application workarounds that depended on those bugs only after exercising explicit input/group/list resets and listener ordering. The [2.1.1 release](https://github.com/formkit/formkit/releases/tag/v2.1.1) changed Vue SSR node cleanup, not the core API; [2.1.2](https://github.com/formkit/formkit/releases/tag/v2.1.2) fixed parentless registry cleanup and repeated config removal. Preserve teardown and request isolation even on the fixed release; a patch is not permission to retain a graph across requests.

| Release | What matters to incumbent Vue/Core apps |
| --- | --- |
| [2.2.0](https://github.com/formkit/formkit/releases/tag/v2.2.0) / [2.2.1](https://github.com/formkit/formkit/releases/tag/v2.2.1) | Vue ignores late DOM input on destroyed nodes; duplicate IDs preserve the newer registry owner; input normalization no longer mutates caller-provided options. Nynorsk (`nn`) is opt-in in FormKit i18n. |
| [2.3.0](https://github.com/formkit/formkit/releases/tag/v2.3.0) | Generic callable `FormKit` restores SFC inference; constructor consumers use `FormKitRuntimeComponent`. After mount, section DOM refs are on `node.context?.refs` and exposed as component `refs`. Group/list skip `input`/`inputRaw` when nothing listens; attach a listener when testing that event contract. |
| [2.4.0](https://github.com/formkit/formkit/releases/tag/v2.4.0) | `validation-visibility="blur dirty"` shows validation after blur or once dirty; it does not change whether submit validates. |
| [2.5.0](https://github.com/formkit/formkit/releases/tag/v2.5.0) | Empty Vue groups/forms start with `context.state.empty === true`; do not use the old false-until-first-commit behavior as readiness. Schema replacement cleans the old memo entry. The optional localStorage control suppresses saving/restoration when off, not necessarily purging storage. |
| [2.6.0](https://github.com/formkit/formkit/releases/tag/v2.6.0) | Literal input types enforce their own props; `onInput`, `onInputRaw`, and `onUpdate:modelValue` are typed with the input's value including `undefined`. Fix callers rather than widening them; some required-at-runtime props remain optional in the declarations. |
| [2.7.0](https://github.com/formkit/formkit/releases/tag/v2.7.0)–[2.9.0](https://github.com/formkit/formkit/releases/tag/v2.9.0) | `closest`, deep props and named schema slots are described above; 2.8.0 also fixes moved `FormKitMessages` IDs to match `aria-describedby`. Inspect actual DOM relationships when moving messages. |

CLI and addons are not prerequisites. For an incumbent Tailwind theme, 2.7.0 adds persisted prefixes (v4 `--prefix tw`, v3 `--prefix tw-`); use pinned `bunx formkit@2.9.0` only for an explicitly requested CLI task. The [2.8.1 installer change](https://github.com/formkit/formkit/releases/tag/v2.8.1) defaults to no project instruction-file edits. Optional `@formkit/addons@2.9.0` provides `describeForm` (opt-in values, never password/hidden values) and `fillForm` (can change values and optionally submit; no echoed filled values). Its manifest pulls `@formkit/auto-animate: latest` (currently **0.10.3**); review its actual lock resolution if adopting it. No experimental WebMCP/browser-agent registration is used. Nuxt setup is separate: [`@formkit/nuxt@2.9.0`](https://registry.npmjs.org/@formkit/nuxt/2.9.0) peers on `@nuxt/kit ^3.10.3 || ^4.0.0`, not a verified host combination. [Exact addon manifest](https://registry.npmjs.org/@formkit/addons/2.9.0), [addon declarations](https://unpkg.com/@formkit/addons@2.9.0/dist/index.d.mts).

## Verification boundary and sources

These 2.9.0 examples are source-checked, not newly typechecked or executed. The [historical record](../assets/verification.json) (`support-form-core-and-graphs`, `support-form-production-consumers`) used FormKit **2.1.2**. It witnessed the rejected-rule stall, boolean/message distinction, repeated false-return plugin setup, and separate production Vue **3.5.44** / Vite **8.3.5** scenarios for caught availability failure and native schema error semantics. The old intersection could reject direct form event and `submit-label` bindings under `strictTemplates`; the 2.3.0 type change does not establish a new strict or [full-declaration](forms.md#verification-boundary) pass. Keep the checked bags and explicit app-owned callbacks. Exercise rapid edits/submission, reversed async results, save rejection, reset baselines, list ownership and repeated plugin registration/teardown in the consuming app. No provider key or hosted service is assumed.

- [Architecture, nodes, settlement, configuration](https://formkit.com/essentials/architecture).
- [Form submission, errors, reset](https://formkit.com/inputs/form).
- [Custom validation and rule hints](https://formkit.com/essentials/validation).
- [Schema and renderer](https://formkit.com/essentials/schema).
- [2.9.0 core declarations](https://unpkg.com/@formkit/core@2.9.0/dist/index.d.mts), [runtime](https://unpkg.com/@formkit/core@2.9.0/dist/index.mjs), [Vue exports](https://unpkg.com/@formkit/vue@2.9.0/dist/index.d.mts).
- [2.9.0 form state machine](https://unpkg.com/@formkit/inputs@2.9.0/dist/index.mjs), [validation engine](https://unpkg.com/@formkit/validation@2.9.0/dist/index.mjs).
