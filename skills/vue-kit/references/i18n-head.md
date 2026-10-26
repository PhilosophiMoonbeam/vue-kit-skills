# Internationalization and document head

Read when localizing Vue content, switching locale, formatting values, owning page metadata, or integrating those concerns with SSR. Standalone baseline: Vue **3.5.44**, **vue-i18n 11.4.16**, **@unhead/vue 3.4.3**, with separate plugin ownership. For new or existing Nuxt applications, [Nuxt](nuxt.md#ssr-hydration-and-head) owns the built-in Unhead instance and native head APIs; do not install a second head plugin or copy the standalone app/request factories below. If locale-aware Nuxt routing is required, evaluate the official [`@nuxtjs/i18n` module](https://i18n.nuxtjs.org/docs/getting-started) against its installed release; this guide does not certify that module's compatibility or require it for a simple translated component. See [SSR diagnosis](debugging-ssr.md); [routing](routing.md) and [tooling](setup-tooling.md) own standalone setup.

## Choose the owner before editing

| Concern | Owner / decision |
| --- | --- |
| Application language | One global Composer per app; per request on the server |
| Feature-only message keys | Explicit local Composer; inherit global locale unless isolation is intentional |
| Language URL | Router policy; validate against supported locales before loading |
| Page title/description | Route component head entry; site-wide template in root layout |
| HTML language/direction | Root head entry derived from the committed global locale |
| Canonical/hreflang | Application-owned URL policy; do not accept arbitrary CMS URLs |
| Initial SSR state | Request factory, including locale, messages, head, route and data |

## Vue I18n: exact migration boundary

11.4.16 supports Vue `^3.0.0` and requires Node `>=22`. Composition mode is explicit: `legacy: false`. Legacy mode still exists and defaults to true when omitted; it and `v-t` are deprecated with removal annotated for **v12**, not already removed in v11. Do not teach an unreleased major's behavior as the installed API. [`11.4.16` metadata](https://unpkg.com/vue-i18n@11.4.16/package.json), [exact declarations](https://unpkg.com/vue-i18n@11.4.16/dist/vue-i18n.d.ts).

Restrict legacy guidance to an existing application's migration:

- `tc`/`$tc` are removed in v11. Use `t(key, count)` or `t(key, namedValues, { plural: count })`.
- Replace `v-t` with text interpolation or `i18n-t`. Replace `pluralizationRules` with Composition `pluralRules`.
- A Composer's `locale` is a ref (`locale.value` in script), unlike legacy `VueI18n.locale`.
- `this.$t` does **not** prove Legacy mode: Composition mode's `globalInjection: true` also exposes global helpers. Preserve incumbent template `$t` only deliberately; default new scripts/templates to explicit `useI18n` bindings. Options API can expose Composer functions through `setup()` without enabling Legacy mode.
- Removed `allowComposition` is not a migration bridge in v11. `%{name}` modulo interpolation was removed in v10; use `{name}`.
- Vue 2's `new VueI18n()` becomes `createI18n()` plus `app.use` on Vue 3; the dropped `vue-i18n-bridge` is not part of v11. Replace old custom formatter integrations with current message functions or named Intl formats. Vue 2 itself is outside this Vue 3.5 runtime target, not an excuse to copy incompatible constructors.

### Complete small application

Install `vue-i18n@11.4.16` in an existing Vue/Vite TypeScript app. These three files are a complete localization example; the normal Vite HTML entry supplies `<div id="app"></div>`.

```ts
// src/i18n.ts
import { createI18n } from 'vue-i18n'

export function createAppI18n() {
  return createI18n({
    legacy: false,
    globalInjection: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
      en: {
        greeting: 'Hello, {name}',
        apples: 'No apples | One apple | {count} apples',
        terms: 'Read the {link}.',
        link: 'terms',
      },
      fr: {
        greeting: 'Bonjour, {name}',
        apples: 'Aucune pomme | Une pomme | {count} pommes',
        terms: 'Lisez les {link}.',
        link: 'conditions',
      },
    },
    numberFormats: {
      en: { money: { style: 'currency', currency: 'EUR' } },
      fr: { money: { style: 'currency', currency: 'EUR' } },
    },
    datetimeFormats: {
      en: { short: { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' } },
      fr: { short: { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' } },
    },
  })
}
```

```ts
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { createAppI18n } from './i18n'

createApp(App).use(createAppI18n()).mount('#app')
```

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, n, d, locale } = useI18n({ useScope: 'global' })
const count = ref(2)
const date = new Date('2026-01-15T12:00:00Z')
</script>

<template>
  <label>Language
    <select v-model="locale">
      <option value="en">English</option>
      <option value="fr">Français</option>
    </select>
  </label>
  <h1>{{ t('greeting', { name: 'Ada' }) }}</h1>
  <label>Apples <input v-model.number="count" type="number" min="0" /></label>
  <p>{{ t('apples', count) }}</p>
  <p>{{ n(1234.5, 'money') }} — {{ d(date, 'short') }}</p>
  <i18n-t keypath="terms" tag="p" scope="global">
    <template #link><a href="#terms">{{ t('link') }}</a></template>
  </i18n-t>
  <section id="terms"><h2>{{ t('link') }}</h2></section>
</template>
```

The language control demonstrates eager messages; in a real shell also derive `htmlAttrs.lang` using Unhead below. Set `dir` explicitly for RTL locales rather than inferring it from arbitrary strings.

### Scope, messages, fallback and formatting

1. Call `useI18n()` synchronously in setup, not from arbitrary utilities, event handlers or after an untransformed asynchronous boundary. Pass the Composer into non-component code that needs translation.
2. Choose `useScope: 'global'` explicitly for app language controls. Options with messages or an SFC custom `<i18n>` block can choose local scope implicitly; explicit scope avoids surprises. Create one local Composer per component setup; do not call it repeatedly with conflicting local options.
3. Local locale normally inherits global locale. `inheritLocale: false` makes it independent; changing that local `locale` does not change the site. Local missing keys can fall back to root (`fallbackRoot`); disable this only when an isolated vocabulary is required.
4. `fallbackLocale` supports a locale, array or decision map with `default`. BCP 47 tags such as `fr-CA` implicitly fall back to `fr`; underscore tags are not equivalent. A trailing `!` disables implicit locale truncation. Load fallback resources too; fallback does not fetch them.
5. Keep missing/fallback diagnostics during development. `missingWarn` and `fallbackWarn` control warnings, not correctness. A key shown on screen is not a usable translation. Define a release policy for missing keys rather than hiding warnings globally.
6. Named interpolation is `{name}`, list interpolation is `{0}`, linked messages use `@:key` and modifiers such as `@.lower:key`. Built-ins are `upper`, `lower`, `capitalize`; custom `modifiers` entries transform linked values. Literal special characters can use literal interpolation, e.g. `{'@'}` or `{'|'}`. Message syntax is not arbitrary JavaScript.
7. Plural forms are language-specific; do not impose English's three alternatives everywhere. `count`/`n` are built-in plural placeholders. Use `pluralRules` for a deliberately specified custom rule, not a manual `count === 1` in every template.
8. Without a parts option, `n()` and `d()` return formatted text. Use `i18n-n`/`i18n-d` scoped slots to style parts, not string splitting on separators. In 11.4.16 programmatic parts use **`part: true` (singular)**, not `parts`; see the formatting example below. Define each locale's named formats; an explicitly requested missing format is not guaranteed to behave like an unnamed Intl call.
9. Preserve actual numeric/date values in state. Pick currency independently from language; define business time zone explicitly. Server/client Intl data, zone and input timestamp must agree for hydration.

[Scope](https://vue-i18n.intlify.dev/guide/essentials/scope.html), [fallback](https://vue-i18n.intlify.dev/guide/essentials/fallback.html), [pluralization](https://vue-i18n.intlify.dev/guide/essentials/pluralization.html), [components](https://vue-i18n.intlify.dev/guide/advanced/component.html).

`globalInjection` defaults to **true** in 11.4.16 Composition mode; the examples deliberately set it false to require explicit `useI18n` bindings. This disables injected `$t`/`$n`/`$d`/`$rt`/`$tm` and `$i18n` helpers, not the global Composer or `useI18n({ useScope: 'global' })`. Component registration is a separate `globalInstall` install option. [Exact installation/defaults](https://unpkg.com/vue-i18n@11.4.16/dist/vue-i18n.mjs).

### Composer interop, incumbent Legacy and resource contracts

- No-options `useI18n()` selects local scope when the SFC has an `<i18n>` block, otherwise global. Nonempty options without `useScope` select local. `useScope: 'parent'` explicitly searches ancestors; an SFC block does **not** implicitly select parent. `useScope: 'isolated'` is present in 11.4.16 and permits multiple independent Composers in one setup; it still receives a parent/root reference. Set `inheritLocale: false` and `fallbackRoot: false` when actual language/vocabulary isolation is required. Custom elements can provide the installed instance through `I18nInjectionKey`; do not assume app-level injection crosses a custom-element boundary. [Exact scope implementation](https://unpkg.com/vue-i18n@11.4.16/dist/vue-i18n.mjs).
- `te(key, explicitLocale)` tests that locale, not its fallback chain; without an explicit locale the current implementation can follow fallback. Do not use it as a catalog-completeness audit. `tm(key)` returns structured resources (including compiled nodes/functions), not guaranteed display strings; resolve each message leaf with `rt(leaf)`. `rt` resolves the supplied message, rather than doing `t`'s key lookup/fallback. Recompute a `tm`-derived list in a computed/render context to react to locale changes.
- `setLocaleMessage(locale, messages)` replaces a catalog; `mergeLocaleMessage` adds/overwrites keys. `get`/`set`/`mergeDateTimeFormat` and the corresponding `NumberFormat` methods manage named formats and invalidate formatter caches. A lazy message load does not install date/number formats automatically.
- Missing-handler policy uses `missing` at creation or `getMissingHandler`/`setMissingHandler`; post-translation uses its corresponding get/set methods. These are synchronous resolution hooks, not asynchronous catalog loaders. Keep product fallback text and formatting intentional; do not mask missing keys by universally returning empty strings. For direct `n`/`d` calls use Intl option objects or named formats with locale overrides; `d` also accepts a valid ISO 8601 string in 11.4.16, but invalid/ambiguous timestamps still need application validation.
- Existing `legacy: true` applications use `i18n.global.locale = 'fr'` and component `this.$i18n.locale`, not `.value`. Their `t`, `d`, `n`, `te`, `tm`, `rt`, message/format management methods remain usable in v11. Legacy local `i18n` component options and `sync: false` differ from Composition's `inheritLocale: false`; migrate the scope and options together, not just the import. Legacy `silentTranslationWarn`/`silentFallbackWarn`, `warnHtmlInMessage`, `escapeParameterHtml`, and `pluralizationRules` map to Composition's `missingWarn`/`fallbackWarn` (inverse warning intent), `warnHtmlMessage`, `escapeParameter`, and `pluralRules`. Do not disable `__VUE_I18N_LEGACY_API__` until all incumbent Legacy users are migrated.
- Third-party extensions can augment `ComposerCustom`; the exported `ComposerExtender` type models an extender returning an owned-effects disposer. The runtime's `__composerExtend` install option is internal and is absent from the public `I18nPluginOptions` interface: preserve a compatible incumbent adapter only under its own supported integration contract, not as a new application extension API. A type augmentation alone adds no runtime member; use an application wrapper composable for owned capabilities. `i18n.dispose()` belongs to application/plugin teardown, not to a page sharing the global Composer. [Exact extension/install declarations](https://unpkg.com/vue-i18n@11.4.16/dist/vue-i18n.d.ts), [Legacy API](https://vue-i18n.intlify.dev/api/legacy.html).

Message functions are useful when grammar cannot be expressed with ordinary placeholders. Public context provides `named`, `list`, `plural`, `linked`, and a `type` processor indicator; return a string for text translation and a VNode for component interpolation. This complete optional catalog factory demonstrates both paths without storing HTML:

```ts
import { Text, createVNode } from 'vue'
import { createI18n } from 'vue-i18n'
import type { MessageContext, VueMessageType } from 'vue-i18n'

export function createFunctionI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        greeting: (ctx: MessageContext<VueMessageType>) => {
          const text = `Hello, ${String(ctx.named('name'))}`
          return ctx.type === 'vnode'
            ? createVNode(Text, null, text)
            : text
        },
      },
    },
  })
}
```

Custom `messageResolver`/`messageCompiler` replace core lookup/compilation behavior: preserve their declared return/error contracts, cache by locale/key/source as appropriate, and do not combine a custom resolver with assumptions about default `flatJson` processing. Use the upstream [message-function](https://vue-i18n.intlify.dev/guide/advanced/function.html) and [custom-format](https://vue-i18n.intlify.dev/guide/advanced/format.html) contracts rather than executing arbitrary catalog JavaScript supplied by users. English three-branch `'No apples | One apple | {count} apples'` with `t('apples', 2)` selects **`2 apples`**, not the erroneous `one apple` sometimes found in old recipes.

### Formatting parts and typed catalogs

Complete optional SFC using the eager factory's `money` and `short` formats:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { n, d } = useI18n({ useScope: 'global' })
const date = new Date('2026-01-15T12:00:00Z')
const moneyParts = computed(() => n(1234.5, { key: 'money', part: true }))
const dateParts = computed(() => d(date, { key: 'short', part: true }))
</script>

<template>
  <p><span v-for="(part, index) in moneyParts" :key="index">{{ part.value }}</span></p>
  <p><span v-for="(part, index) in dateParts" :key="index">{{ part.value }}</span></p>
  <i18n-n :value="1234.5" format="money" scope="global" tag="p">
    <template #integer="{ integer }"><strong>{{ integer }}</strong></template>
  </i18n-n>
  <i18n-d :value="date" format="short" scope="global" tag="p">
    <template #year="{ year }"><strong>{{ year }}</strong></template>
  </i18n-d>
</template>
```

Part slots are named for the Intl part (`integer`, `currency`, `year`, etc.); their payload includes that named value, `index`, and `parts`. A single generic default slot receiving `{ parts }` is not this component contract. `i18n-t` supports named slots (`{link}`) or positional default children (`{0}`), `plural`, `locale`, and `scope`; unmatched placeholders render empty. All three components accept an explicit `i18n` Composer overriding `scope`, and omit their wrapper when `tag` is absent. `app.use(i18n, { globalInstall: false })` disables their global registration; import `Translation`, `NumberFormat`, and `DatetimeFormat` locally instead. [Number parts](https://vue-i18n.intlify.dev/guide/essentials/number.html), [exact `part` options](https://unpkg.com/@intlify/core-base@11.4.16/dist/core-base.d.ts).

For project-wide completion, this complete declaration file is a **module augmentation**, not a replacement ambient module. Include it in the TypeScript project:

```ts
// src/locale-schema.d.ts
import 'vue-i18n'
export {}
declare module 'vue-i18n' {
  interface DefineLocaleMessage {
    greeting: string
    apples: string
    terms: string
    link: string
  }
  interface DefineDateTimeFormat {
    short: { year: 'numeric'; month: 'short'; day: 'numeric'; timeZone: string }
  }
  interface DefineNumberFormat {
    money: { style: 'currency'; currency: string }
  }
}
```

For a separately typed feature, derive `type MessageSchema = typeof en` from its canonical JSON and use `createI18n<[MessageSchema], 'en' | 'fr', false>(...)` or `useI18n<{ message: MessageSchema }, 'en' | 'fr'>(...)` with actual resources/options. Check translated files with `satisfies MessageSchema`; key completion alone does not require every locale to have every key. Generated tooling can augment the exported `GeneratedTypeConfig` for locale/mode inference; do not hand-maintain conflicting generated and global schemas. No `@types/vue-i18n` is needed. [TypeScript resource contracts](https://vue-i18n.intlify.dev/guide/advanced/typescript.html).

### Race-safe lazy loading

This is a complete replacement `src/i18n.ts` for a text-only lazy-loading example. Supply the two JSON files shown below. The factory contains its caches and generation counter; SSR requests must not share mutable locale state. Vite sees a fixed import map, not arbitrary user-controlled paths. Declare the full supported locale union in `createI18n`'s schema generics, then install the eager English catalog synchronously; inferring from `messages: { en }` alone narrows the Composer to English, while supplying a French placeholder would misrepresent its unloaded state.

```ts
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'

type Locale = 'en' | 'fr'
type Messages = typeof en
const loaders = {
  en: async () => en,
  fr: async () => (await import('./locales/fr.json')).default,
} satisfies Record<Locale, () => Promise<Messages>>

export function createAppI18n() {
  const i18n = createI18n<[Messages], Locale, false>({
    legacy: false,
    globalInjection: false,
    locale: 'en',
    fallbackLocale: 'en',
  })
  i18n.global.setLocaleMessage('en', en)
  const loaded = new Set<Locale>(['en'])
  const pending = new Map<Locale, Promise<void>>()
  let generation = 0

  async function ensureLocale(locale: Locale): Promise<void> {
    if (loaded.has(locale)) return
    const existing = pending.get(locale)
    if (existing) return existing
    const task = loaders[locale]().then((messages) => {
      i18n.global.setLocaleMessage(locale, messages)
      loaded.add(locale)
    }).finally(() => { pending.delete(locale) })
    pending.set(locale, task)
    return task
  }

  async function setLocale(locale: Locale, signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) return false
    const ticket = ++generation
    const current = () => ticket === generation && !signal?.aborted
    try {
      await ensureLocale(locale)
    } catch (error) {
      if (!current()) return false
      throw error
    }
    if (!current()) return false
    i18n.global.locale.value = locale
    await nextTick()
    return current()
  }

  return { i18n, setLocale }
}
```

`src/locales/en.json`:

```json
{ "greeting": "Hello, {name}" }
```

`src/locales/fr.json`:

```json
{ "greeting": "Bonjour, {name}" }
```

Integration fragment: create `{ i18n, setLocale }` once at app creation, install `i18n`, and provide `setLocale` to the shell or router through the app's explicit service contract. Validate route/storage/cookie values against `en`/`fr` before calling. Await it before completing locale-dependent navigation; only persist the selection when it returns true. Catch import errors at that caller and show a real failure while retaining the last committed locale. A failed load is not marked loaded and can be retried by another explicit selection. The counter prevents late French from overwriting a newer English selection; it cannot cancel a dynamic import. Apply the same freshness policy to dependent API responses. [Upstream lazy-loading pattern](https://vue-i18n.intlify.dev/guide/advanced/lazy.html).

Pass an owner-controlled `AbortSignal` when navigation cancellation, component disposal, or app teardown can invalidate a pending selection; abort it in that owner's cleanup. Cancellation prevents a later locale commit but does not undo an already committed selection or unload cached messages. `false` means superseded/cancelled: publish neither success nor failure for that selection. Only a still-current failed load rejects; this also prevents a late failed import from replacing a newer successful selection's UI with a stale error. Keep imported resources cached per app/request; an aborted selection need not discard a safely loaded catalog.

For typed catalogs, use a canonical schema with `createI18n`/`useI18n` generics or augment `DefineLocaleMessage`; compare all translated catalogs against it. TypeScript cannot discover runtime CMS keys or prove translation quality. JSON modules require the project's JSON-module support. SFC `<i18n>` blocks require build integration; they are not native Vue syntax without a plugin.

### Security, compilation and SSR

- Prefer `{{ t(...) }}` and `i18n-t` slots. Never pass translated strings containing untrusted interpolation to `v-html`. `escapeParameter: true` escapes interpolation parameters; it is **not** a general HTML sanitizer, URL policy, or authorization boundary. Avoid double escaping text intended for normal Vue interpolation. Keep HTML out of catalogs wherever possible.
- JIT is default since v10; do not repeat historical advice that v11 invariably requires unsafe-eval. Precompile catalog resources with the Intlify build plugin when selecting a runtime-only build; every lazy resource must use the same pipeline. Do not drop the compiler while still fetching raw message strings. Read the installed plugin version's SSR/runtime options before adopting it. [Optimization and CSP history](https://vue-i18n.intlify.dev/guide/advanced/optimization.html).
- SSR must create a new i18n instance for every request. Negotiate a supported locale from route/cookie/header according to product policy; do not assign an arbitrary Accept-Language header string to `locale`.
- Resolve initial and fallback messages before `renderToString`. Send the same locale and resource version to the client before hydration; safely serialize any embedded state, not raw string concatenation inside a script.
- Render dates with identical locale/time zone on both sides; do not translate a random/current timestamp differently during hydration. Locale-specific content cached at a CDN needs a cache key varying on the selected locale policy.

### Explicit precompilation and build selection

Optional **`@intlify/unplugin-vue-i18n 11.2.7`** supports Vite `^6 || ^7 || ^8`, requires Node `>=22.13`, and compiles catalog imports and SFC blocks. This complete Vite config supports both standalone Composition-only factories above, not VitePress's Vite 5 graph. Compiler retention is explicit because the eager factory contains inline message strings:

```ts
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      include: [fileURLToPath(new URL('./src/locales/**', import.meta.url))],
      compositionOnly: true,
      fullInstall: true,
      runtimeOnly: true,
      dropMessageCompiler: false,
    }),
  ],
})
```

`fullInstall: true` retains the three components used above. For SSR select the plugin's `ssr: true` option in the host's shared build config. The **11.2.7 Vite implementation** aliases `vue-i18n` to its runtime distribution whenever `runtimeOnly: true`, not only in production as the README suggests. In **vue-i18n 11.4.16**, that distribution still registers the shared JIT `compile` function; with `dropMessageCompiler: false`, it compiles raw strings. Therefore `runtimeOnly: true` alone neither proves compiler removal nor requires every message to be precompiled. [Exact plugin](https://unpkg.com/@intlify/unplugin-vue-i18n@11.2.7/lib/index.mjs), [runtime entry](https://unpkg.com/vue-i18n@11.4.16/dist/vue-i18n.runtime.mjs), [compiler branch](https://unpkg.com/@intlify/core-base@11.4.16/dist/core-base.mjs).

Enable `dropMessageCompiler`/`__INTLIFY_DROP_MESSAGE_COMPILER__` only when every message uses a compatible precompiled resource or message function. **Compiler removal plus the eager inline-string factory or raw fetched catalogs is excluded.** Keep the config above for those consumers; for a compiler-free consumer move all string catalogs, including fallbacks and lazy imports, into the plugin's included resource pipeline before changing the flag. Merely importing a `.json` file is insufficient: a file outside `include`, or JSON fetched from `public`/an API, remains raw. [Exact transform filter and `jit: true` generation](https://unpkg.com/@intlify/unplugin-vue-i18n@11.2.7/lib/index.mjs).

The exact **11.2.7 + 11.4.16 production** boundary is:

| Message source | `runtimeOnly: true`, `dropMessageCompiler: false` | Same runtime alias, `dropMessageCompiler: true` |
| --- | --- | --- |
| Included JSON import, static or lazy | Plugin emits message AST; interpolation works | AST formatter remains; interpolation works |
| Inline string / excluded JSON import / fetched raw string | Retained string compiler produces AST; interpolation works | Non-AST fallback returns the original string; `{name}`/plural/link syntax is not resolved |
| Trusted application-owned message function | Executes as a message function | Executes as a message function |

For example, a raw `greeting: 'Hello, {name}'` resolves to **`Hello, {name}`**, not `Hello, Ada`, with compiler removal. In production the development warning is absent; a plain `'Hello'` smoke check can therefore miss this error. Included precompiled JSON still resolves to `Hello, Ada` in the same build. This matrix is a source-derived expectation, not an executed browser result. The runtime entry registers `compile`; its `!__INTLIFY_DROP_MESSAGE_COMPILER__ && isString(message)` branch parses strings, its AST branch formats compiled resources, and its non-AST fallback returns the message unchanged. [Exact compiler branches](https://unpkg.com/@intlify/core-base@11.4.16/dist/core-base.mjs), [message-function bypass](https://unpkg.com/@intlify/core-base@11.4.16/dist/core-base.mjs).

Plugin 11.2.7 hard-codes `jit: true` for its resource transforms and no longer declares a `jitCompilation` option. Do not copy an old `jitCompilation: false` recipe to force function generation in this release. Plugin-generated AST resources and trusted message functions are distinct valid inputs, not interchangeable serialized build artifacts. Re-evaluate the distribution and options together after upgrading; the installed [option declarations](https://unpkg.com/@intlify/unplugin-vue-i18n@11.2.7/lib/types.d.mts) and [published runtime](https://unpkg.com/vue-i18n@11.4.16/dist/vue-i18n.runtime.mjs) control this boundary.

Without that plugin, bundler feature flags are boolean literals in Vite `define`: `__VUE_I18N_FULL_INSTALL__` controls automatic component/directive installation; `__VUE_I18N_LEGACY_API__` controls Legacy support; `__INTLIFY_DROP_MESSAGE_COMPILER__` controls compiler removal. Keep root package imports so Node import/require and bundler conditions choose their correct build. A nonbundled CDN page instead uses the single global/browser distribution, matching Vue's runtime and production mode; do not mix multiple copies of its inlined Intlify runtime. The v11 plugin's virtual `@intlify/unplugin-vue-i18n/messages` eagerly bundles JSON/YAML only, not arbitrary JS/TS resources; direct fixed-map lazy imports retain code splitting. Optional message-key tree shaking defaults off; dynamic keys require keep-all or an explicit complete safelist. [Exact plugin metadata](https://registry.npmjs.org/@intlify/unplugin-vue-i18n/11.2.7), [Vue I18n export map](https://unpkg.com/vue-i18n@11.4.16/package.json).

## Unhead: install once per app, create once per request

3.4.3 is ESM-only and peers on Vue `>=3.5.18`, which includes the 3.5.44 baseline. Optional bundler peers are Vite `>=6.4.2` and webpack `>=5`; do not silently force its build plugin into an older toolchain. `createHead` is imported from `/client` or `/server`, not the root. Composables come from `@unhead/vue`. [Exact exports and peers](https://unpkg.com/@unhead/vue@3.4.3/package.json).

```ts
// src/main.ts — standalone SPA, using the eager i18n factory above
import { createApp } from 'vue'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import { createAppI18n } from './i18n'

const app = createApp(App)
app.use(createAppI18n())
app.use(createHead())
app.mount('#app')
```

Complete head-owning SFC, usable below that installation:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead, useHeadSafe, useSeoMeta } from '@unhead/vue'

const { locale, t } = useI18n({ useScope: 'global' })
const description = ref('A small internationalized application')
const profileName = ref('Ada')

useHead({
  htmlAttrs: { lang: () => locale.value, dir: 'ltr' },
  titleTemplate: title => title ? `${title} | Vue Kit` : 'Vue Kit',
})
useSeoMeta({
  description: () => description.value,
  ogDescription: () => description.value,
  ogType: 'website',
})
useHeadSafe({ title: () => t('greeting', { name: profileName.value }) })
</script>

<template>
  <label>Profile name <input v-model="profileName" /></label>
</template>
```

In a routed app, split these responsibilities: site template and language in the app shell; route-specific title and SEO fields in the route component. Getters keep translations reactive; `title: t('key')` captures only the current string. Functional `titleTemplate` receives the page title directly; do not wrap that function in `computed`.

### Lifetime, deduplication and safe input

- Declare one entry synchronously during setup and change refs/getters, or call its `patch()` method. Do not create entries repeatedly in watchers. Vue-owned entries are removed on unmount; VDOM KeepAlive deactivates/reactivates them with the component.
- `useHead` returns an entry with `patch`/`dispose`; manually created entries outside component scope require explicit disposal by their owner. Capturing `injectHead()` and passing `{ head }` resolves injection after async work but does not automatically restore a lost component cleanup scope. Prefer creating the entry before awaiting.
- Natural dedupe covers singleton tags and meta identity (`name`, `property`, etc.). Use stable `key` for intentional overrides, not old `hid`/`vmid`. Multiple different descriptions under invented keys do not improve SEO. Avoid multiple components competing for canonical/title ownership; explicit priorities and a documented owner are clearer than mount-order reliance.
- `useSeoMeta` maps typed flat keys to tags; it is not a sanitizer for arbitrary URLs or executable data. Use `useHeadSafe` for untrusted title/meta input; its allowlist may discard unsupported attributes/tags. Do not assume it removes every script: safe JSON script support is distinct from executable scripts. Application policy must still restrict metadata keys, sizes, URL origins and content.
- Never put user/API strings in executable script `innerHTML` or `textContent`; never trust arbitrary script `src`. Structured data needs safe serialization plus an intentional trusted schema. `useHeadSafe` is not a replacement for CSP or URL validation.
- `innerHTML` replaces old `children`; `tagPosition: 'bodyClose'` replaces old `body: true`. Ordinary scripts need a separate trust/consent/lifecycle decision. Head cleanup does not undo script execution or remove global SDK listeners.
- `useServerHead`/`useServerSeoMeta`/`useServerHeadSafe` and `/legacy` are deprecated in v3. Prefer current composables and supported client/server entries. v3 SSR/DOM rendering is synchronous; do not copy old asynchronous render-hook assumptions.

### Complete render-layer SSR example

This module is executable inside an existing Vue SSR build; it deliberately does not pretend to implement an HTTP server, route resolution, Vite asset-manifest injection or data fetching. `template` is the host's complete trusted HTML containing `<div id="app"><!--app-html--></div>`; its assets come from that host's existing SSR integration.

```ts
// src/entry-server.ts
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createHead, transformHtmlTemplate } from '@unhead/vue/server'
import App from './App.vue'
import { createAppI18n } from './i18n'

export async function render(template: string): Promise<string> {
  const app = createSSRApp(App)
  const head = createHead()
  const i18n = createAppI18n()
  app.use(i18n)
  app.use(head)
  const body = await renderToString(app)
  return transformHtmlTemplate(head, template.replace('<!--app-html-->', () => body))
}
```

Hydration entry uses `createSSRApp(App)`, the matching initialized i18n, and `createHead` from `/client`; then mounts `#app`. Do not use a shared exported server head singleton. Render head **after** Vue has resolved server-prefetch/data work. `transformHtmlTemplate` merges HTML/body attributes and tags; concatenating only `headTags` loses those outputs. Streaming requires the explicit streaming integration, not this buffered renderer. [Official setup](https://unhead.unjs.io/docs/vue/head/guides/get-started/installation).

### Advanced Unhead interop and migration

| Requirement | Current contract / failure diagnosis |
| --- | --- |
| Default SSR tags | Server creation supplies charset, viewport and default language; override through `init` entries or opt out with `disableDefaults`. Explicit locale ownership must override English. `init` **option** is not the removed `init` hook. |
| Extra title placeholders / alias ordering / Promise input | Register `TemplateParamsPlugin`, `AliasSortingPlugin`, or **`PromisesPlugin`** from `@unhead/vue/plugins` in `createHead({ plugins: [...] })`; they are opt-in. The v3 export is plural, not `PromisePlugin`. Pending Promise entries are omitted from the current synchronous render and become available later; await essential SSR data first. `%s` title substitution is distinct from custom template parameters. |
| Incumbent Options API `head()` | Install `app.mixin(VueHeadMixin)` from `@unhead/vue` in both entries, then `head() { return { title: this.title } }` tracks the component. Composition users do not need the mixin. |
| Declarative head | Import `Head` from `@unhead/vue/components` and place ordinary `<title>`/`<meta>` children inside it. It owns an entry, not rendered body metadata; prefer composables for full TS input support. Script children are executable raw content, not automatically safe. |
| Auto imports | `unheadVueComposablesImports` is the preset for `unplugin-auto-import`; covers `injectHead`, `useHead`, `useHeadSafe`, `useSeoMeta`, not every root export. Explicit imports need no auto-import plugin. |
| Tag types | `name`/`property`/`http-equiv` meta requires `content`; `content: null` removes it. Font preload needs `as: 'font'` and `crossorigin: 'anonymous'`. Inline script and external `src` branches are distinct; use `defineLink`/`defineScript` for typed reusable inputs instead of widening discriminants. |
| Low-level owner | `head.push()` creates an explicitly owned entry; `head.entries` is the map replacing removed `headEntries()`. Prefer Vue composables for automatic lifetime. `createUnhead` is the low-level core replacement for removed `createHeadCore`, not the normal Vue installation path. |
| Route-transition flicker | One owner can gate synchronous `dom:beforeRender` by setting `ctx.shouldRender`, then call `renderDOMHead(head)` from `/client` when navigation settles. Release the gate on abort/error as well as success; this delays DOM updates, not entry computation or SSR output. |

Other v3 migration boundaries: `DeprecationsPlugin` is **still exported but deprecated for v4 removal** in 3.4.3; migrate old props directly and remove it after callers are converted, rather than claiming it is already absent. `setHeadInjectionHandler` is removed; migrate `@unhead/addons` to the unified bundler entry; replace deprecated `resolveUnrefHeadInput` with `resolveTags` from `unhead/utils`. `MergeHead` is deprecated; use `VueHeadClient` generics. Removed entry `{ mode: 'server' }` does not select a server renderer: in standalone Vite use `if (import.meta.env.SSR)` around server-only entry creation, with the appropriate server installation. `dom:renderTag` remains declared but is deprecated and never called internally; `dom:rendered` is deprecated **but still emitted synchronously**. Neither is an awaited extension point. Prefer the documented entry `onRendered` contract or run owner-controlled post-render work directly after `renderDOMHead()`. [Exact hook declarations](https://unpkg.com/unhead@3.4.3/dist/shared/unhead.BCbtEyRi.d.ts), [3.4.3 DOM renderer](https://unpkg.com/unhead@3.4.3/dist/shared/unhead.DD4N5B4k.mjs), [migration guide](https://unhead.unjs.io/docs/vue/head/guides/get-started/migration), [deprecated plugin declaration](https://unpkg.com/unhead@3.4.3/dist/shared/unhead.Fj9s3zvE.d.ts).

### Bundler and external-script workflows

The optional bundler factory is **not** itself a Vite plugin: call `.vite()`. Complete standalone config:

```ts
import vue from '@vitejs/plugin-vue'
import { Unhead } from '@unhead/vue/bundler'
import { defineConfig } from 'vite'
export default defineConfig({
  plugins: [vue(), ...Unhead().vite()],
})
```

For webpack/rspack/rollup dispatch use `.webpack()`/`.rspack()`/`.rollup()` in that bundler's plugin array; `/vite` is a separate direct plugin-array entry. Vite 8 supplies the parser through Rolldown; older supported Vite/bundler graphs need the documented `oxc-parser` fallback dependency when using build transforms, not for runtime-only Unhead. The factory can transform SEO metadata, strip server-only calls, transpile static inline scripts to the configured browser target, optionally minify trusted static inline content, and inject development validation/devtools. `filter` and `sourcemap` govern transforms; `treeshake`, `transformSeoMeta`, `transformInlineScripts`, `minify`, `validate`, and `devtools` configure those features. This is build-time optimization/diagnostics, not installation of `app.use(head)`. Preserve development warnings for missing opt-in plugins/deprecated props. Nuxt owns this integration already. [Exact factory](https://unpkg.com/@unhead/vue@3.4.3/dist/bundler.d.ts), [build plugins](https://unhead.unjs.io/docs/head/guides/build-plugins/overview).

External SDK loading is a separate workflow: `useScript` from `@unhead/vue` returns a controller, **not a Promise**. Create it synchronously in setup with a trusted, application-approved `src`. Use `trigger: 'manual'` plus `load()` for an explicit action, a `Ref<boolean>`/getter for consent, or `'server'` only when SSR script injection is intentional. Default client triggering is mount-oriented; it is not consent. Same `key`/`src` shares a controller within one head instance. `status` is a Vue ref (`awaitingLoad`, `loading`, `loaded`, `error`, `removed`); subscribe through `onLoaded`/`onError` and unregister owned subscriptions.

When the SDK exposes a global API, provide `use: () => window.VendorApi` (actual vendor-owned global), then invoke **`controller.proxy.method(...)`**; calls queue until resolved and return void, so they cannot synchronously supply an SDK result. `onLoaded(api => ...)` receives the resolved API. An SDK whose load event precedes readiness instead needs `resolve` and its callback/abort contract. `{ scope: true }` binds a local scope controller; dropping it must not remove another consumer's shared script. Script removal cannot reverse vendor initialization, listeners, cookies or data already sent. Restrict origins/nonce/CSP and implement vendor-specific teardown/revocation at the owning integration; do not present a fabricated SDK as a runnable example. [Exact Vue script API](https://unpkg.com/@unhead/vue@3.4.3/dist/scripts.d.ts), [script lifecycle](https://unhead.unjs.io/docs/head/api/composables/use-script).

### Streaming SSR cutover

Use streaming only for a host already using Vue's Web Streams SSR and async content. Replace the buffered render module above with this complete render-layer module; host template/HTTP/assets responsibilities remain unchanged:

```ts
import { createSSRApp } from 'vue'
import { renderToWebStream } from 'vue/server-renderer'
import { createStreamableHead } from '@unhead/vue/stream/server'
import App from './App.vue'
import { createAppI18n } from './i18n'

export function renderStream(template: string, nonce: string) {
  const app = createSSRApp(App)
  const { head, wrapStream } = createStreamableHead({ nonce })
  app.use(createAppI18n())
  app.use(head)
  const stream = renderToWebStream(app)
  return wrapStream(stream, template)
}
```

Pair this with `...Unhead({ streaming: true }).vite()` in the bundler config and a client instance from `@unhead/vue/stream/client`. That client's `createStreamableHead()` returns **undefined** when bootstrap state is absent: throw a configuration error, do not silently create a fresh head that loses streamed state. Install it on the matching `createSSRApp` before hydration; resolve initial route/i18n data first. Add `VueHeadMixin` only for incumbent Options API `head()` users. Pass the same per-response CSP nonce to streaming creation, response policy and application scripts; late patches are inline scripts.

Create the Vue stream before wrapping: synchronous setup contributes to the shell; an async ancestor/first await defers descendant entries. Put canonical/robots/description/Open Graph in synchronous shell ownership because preview bots may never execute late patch scripts. JSON-LD/body-positioned late tags follow the streaming placement contract. `prepareTemplate`/`PreparedTemplate` are experimental optimizations: cache only a trusted immutable production template, never a request's head/output. Buffering and streaming are alternative end-to-end paths, not helpers to mix on the same response. [Streaming guide](https://unhead.unjs.io/docs/vue/head/guides/core-concepts/streaming), [exact server](https://unpkg.com/@unhead/vue@3.4.3/dist/stream/server.d.ts) and [client](https://unpkg.com/@unhead/vue@3.4.3/dist/stream/client.d.ts) contracts.

### Vue 3.5 caveats and proposed checks

Vue 3.5 does not preserve injection context after arbitrary `await` inside mounted hooks or callbacks. Compiler-transformed top-level `<script setup>` await is different and makes the component async (use an appropriate Suspense/SSR boundary). Prefer setup-time entries and reactive data. Unhead's current Vapor documentation targets Vue 3.6 prereleases; it is not a Vue 3.5 feature. [Reactivity/context](https://unhead.unjs.io/docs/vue/head/guides/core-concepts/reactivity-and-context).

Research verified release metadata, declaration contracts and primary examples; these examples were not executed here. Proposed application checks: rapidly switch locales with inverted import completion; fail a locale import; check fallback and plural boundaries; compare SSR/client date strings; render simultaneous requests with different locales; navigate/unmount and inspect one description/canonical; test escaped untrusted titles; inspect raw SSR HTML rather than only client DOM. Use [testing](testing.md) for implementation.

## Sources

- [Vue I18n 11.4.16 declarations](https://unpkg.com/vue-i18n@11.4.16/dist/vue-i18n.d.ts), [Composition API](https://vue-i18n.intlify.dev/guide/advanced/composition.html), [message syntax](https://vue-i18n.intlify.dev/guide/essentials/syntax.html), [TypeScript](https://vue-i18n.intlify.dev/guide/advanced/typescript.html).
- [Unhead 3.4.3 server declarations](https://unpkg.com/@unhead/vue@3.4.3/dist/server.d.ts), [safe head](https://unhead.unjs.io/docs/head/api/composables/use-head-safe), [deduplication](https://unhead.unjs.io/docs/head/guides/core-concepts/handling-duplicates).
