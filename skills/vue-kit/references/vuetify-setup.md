# Vuetify 4 setup, imports, adapters, and SSR

Read when installing Vuetify, diagnosing missing components/styles/icons, choosing import strategy, or integrating SSR. Use [vuetify-components.md](vuetify-components.md) for interactions and [vuetify-theme.md](vuetify-theme.md) for design tokens and migration. Inspect an existing app's plugin, lockfile, bundler, CSS entry points, and framework module before changing its setup; do not reinstall a second Vuetify instance.

For new or existing Nuxt applications, start with [Nuxt](nuxt.md) and use [Nuxt integrations](nuxt-integrations.md) for the explicit Vuetify plugin/Vite configuration. The `main.ts`, standalone Vite config and custom-renderer factories here are not pasteable Nuxt bootstrap recipes; reusable component/icon/adapter contracts remain applicable under the selected host.

## Version and compatibility contract

This reference targets **Vuetify 4.3.0 + Vue 3.5.44**, not Vuetify 2 or an assumption that every Vuetify 3 example remains compatible. Registry metadata confirms Vuetify's Vue peer `^3.5.0 || ^3.6.0-0`; TypeScript `>=4.7`, `vite-plugin-vuetify >=2.1.0`, and `webpack-plugin-vuetify >=3.1.0` are optional peers. An optional peer is not installed automatically merely because a feature needs it. Use normal Vue SFC compilation, not Vue 3.6 prerelease-only APIs. [Exact metadata](https://registry.npmjs.org/vuetify/4.3.0).

Prefer the **4.3.x** line for new applications when no UI framework is prescribed; the exact reproducible baseline here is 4.3.0. This preference does not authorize replacing an incumbent UI library, upgrading an existing Vuetify major, or changing its package manager/lockfile. Keep those choices unless the task explicitly calls for migration.

The Vite path below pins `vite-plugin-vuetify 2.1.3`, Vite `8.3.4`, and `@vitejs/plugin-vue 6.0.10`. Their declared peers cover this combination; this is metadata evidence, not an executed build. Vite and the Vue plugin require Node `^20.19.0 || >=22.12.0`. Keep an incumbent supported toolchain unless its task requires upgrading. See [setup-tooling.md](setup-tooling.md).

## Choose one import strategy

| Situation | Choose | Contract |
| --- | --- | --- |
| Vite SFC templates | `vite-plugin-vuetify` auto imports | Place after the Vue plugin; still import global styles explicitly. |
| Explicit dependencies, render functions, dynamic component objects | Named imports from `vuetify/components/<Group>` | Import in SFC setup or register only the components needed globally. |
| Existing Webpack app | `webpack-plugin-vuetify` | Use that bundler's integration, not a Vite plugin in parallel. |
| Prototype that deliberately accepts all components | Wildcard registration | Includes all registered exports; do not present it as tree-shaken production setup. |
| Labs feature | Exact `vuetify/labs/<Name>` export | Verify the installed version and experimental status before adopting. |

Auto-imports resolve statically visible template components/directives. They cannot infer arbitrary strings passed to `<component :is>` or runtime-generated render functions. Import the component object explicitly for these cases. Named group imports also avoid loading every component's styles during development. [Tagged treeshaking guide](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/features/treeshaking.md).

## Vite setup: complete minimal files

In an existing Vite project, retain its entry HTML, TypeScript configuration, and existing dependency versions when compatible. For the exact package set used here:

```sh
bun add --exact vue@3.5.44 vuetify@4.3.0 @fontsource/roboto@5.3.0
bun add --dev --exact vite@8.3.4 @vitejs/plugin-vue@6.0.10 vite-plugin-vuetify@2.1.3
```

For a new app without an existing layer-order policy, create `public/layers.css`. Component CSS and generated theme CSS can otherwise establish layers before the global stylesheet:

```css
@layer vuetify-core {
  @layer reset, base;
}
@layer vuetify-components;
@layer vuetify-overrides;
@layer vuetify-utilities {
  @layer theme-base, typography, helpers, theme-background, theme-foreground;
}
@layer vuetify-final {
  @layer transitions, trumps;
}
```

Link it first in the existing `index.html` head, before module scripts or other stylesheets; adjust the public URL for the app's deployment base:

```html
<link rel="stylesheet" href="/layers.css">
```

Keep this file unbundled: a JavaScript CSS import does not guarantee first delivery in production. It declares ordering only and does **not** replace `vuetify/styles`. Preserve an incumbent custom order if it already establishes these framework layers and sublayers correctly. [4.3 layer-order integration](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/styles/layers.md), [exact layer-only entry](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/styles/layers.scss).

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    vuetify({ autoImport: true }),
  ],
})
```

The order is enforced by the plugin, not a formatting preference. `transformAssetUrls` enables relative assets on supported Vuetify props, such as a local `VImg` source. It does not make arbitrary runtime URLs into imported assets. [Plugin 2.1.3](https://www.npmjs.com/package/vite-plugin-vuetify/v/2.1.3).

`src/plugins/vuetify.ts`:

```ts
import 'vuetify/styles'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  theme: { defaultTheme: 'light' },
})
```

`src/main.ts`:

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { vuetify } from './plugins/vuetify'

createApp(App).use(vuetify).mount('#app')
```

`src/App.vue`:

```vue
<script setup lang="ts">
import { VApp } from 'vuetify/components/VApp'
import { VMain } from 'vuetify/components/VMain'
import { VContainer } from 'vuetify/components/VGrid'
import { VBtn } from 'vuetify/components/VBtn'
import { shallowRef } from 'vue'

const count = shallowRef(0)
</script>

<template>
  <VApp>
    <VMain>
      <VContainer>
        <h1 class="text-headline-large">Vuetify example</h1>
        <VBtn class="mt-4" @click="count++">Count: {{ count }}</VBtn>
      </VContainer>
    </VMain>
  </VApp>
</template>
```

The SFC explicitly imports its components for portability; with auto-imports, those imports may be omitted. `VApp` supplies application layout, theme, and direction classes; `VMain` receives insets from registered app bars/drawers. Install `createVuetify()` with `app.use()` even when every component is locally imported: composables still require its injections. A `#app` element and normal Vite HTML module entry are prerequisites, not generated by this plugin.

### Explicit registration instead

Without auto-imports, keep `vuetify/styles` and the icon configuration. Import every component used by that app, locally as above or globally. This is a complete alternative plugin module for the minimal SFC:

```ts
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { VApp } from 'vuetify/components/VApp'
import { VMain } from 'vuetify/components/VMain'
import { VContainer } from 'vuetify/components/VGrid'
import { VBtn } from 'vuetify/components/VBtn'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export const vuetify = createVuetify({
  components: { VApp, VMain, VContainer, VBtn },
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  theme: { defaultTheme: 'light' },
})
```

Use `vuetify({ autoImport: false })` if retaining the build plugin only for Sass customization. Import a directive from its public export when applying it manually; internal components already import their own internal dependencies. Do not register the entire directives namespace merely to render one button.

### Public exports and experimental boundaries

Resolve imports from the **installed 4.3.0 export map**, not a v3 or 4.0 labs inventory. `vuetify` exports the framework, public composables, and public types; `vuetify/framework` is the explicit framework entry. Component groups, directives, blueprints, locales, iconsets, date adapters, color constants, and transition factories have separate public subpaths. Do not import `lib/...` internals in application code. `vuetify/dist/vuetify.js` and `vuetify/dist/vuetify-labs.js` are full-bundle alternatives for deliberate non-bundler integrations, not an optimization for Vite.

In 4.3.0 labs exports are `VAudio`, `VCommandPalette`, `VDateRangePicker`, `VMonthPicker`, `VHeatmap`, `VInfiniteCarousel`, `VLoadingIndicator`, `VMaskInput`, `VMediaProgressBar`, `VMediaVolume`, `VPie`, `VSplitBtn`, `VTimeInput`, and `VVideo`. Import only the selected `vuetify/labs/<Name>` group, pin the release, and review changes before updates: labs can break between patch releases. `VCalendar`, `VHotkey`, `VDateInput`, `VFileUpload`, `VAvatarGroup`, `VIconBtn`, `VPicker`, `VColorInput`, `VStepperVertical`, and `VPullToRefresh` are stable 4.3 exports. A directory found in a package is not proof of a public stable export.

Labs is not the preferred production path: the [4.3 Labs policy](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/labs/introduction.md#what-is-labs) calls these unfinished alpha components test-only and not production ready, with patch-breaking changes and no support. Stable exports and labs exports are separate adoption decisions.

Directives are DOM behaviors, not component registration: `ClickOutside`, `Intersect`, `Mutate`, `Resize`, `Ripple`, `Scroll`, `Touch`, `TouchHold`, and `Tooltip` export through `vuetify/directives` or their named subpaths. Directive subpaths use lowercase/kebab-case package directories, unlike PascalCase component groups. In an explicitly imported SFC, `import { Intersect as vIntersect } from 'vuetify/directives/intersect'` makes `v-intersect` available; implement the documented callback and observer options for that directive rather than copying another directive's signature. Built-in component dependencies need no redundant global registration. Theme/default aliases, blueprint selection, color utilities, and style exports are covered in [vuetify-theme.md](vuetify-theme.md). [Published directive entry](https://unpkg.com/vuetify@4.3.0/lib/directives/index.js).

Sources: [4.3 export map](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/package.json), [stable exports](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/index.ts), [labs exports](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/labs/components.ts), [directive exports](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/directives/index.ts).

### Strict template checking and native fallthrough

Ordinary `VBtn @click`/`type` and `VTextField required` syntax is runtime-valid: VBtn's native root receives fallthrough attributes/listeners, and VTextField splits native input attributes onto its real input. However, 4.3's published VBtn props omit native `type` and its emits declare only `group:selected`; a `strictTemplates` profile that checks unknown props/events can reject native surface absent from component declarations. This is a declaration boundary, not proof of a runtime failure. Do not disable those checks or augment every Vuetify component with invented props.

For such a strict fixture, use a locally checked native attribute bag. Complete descendant SFC:

```vue
<script setup lang="ts">
import { shallowRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VTextField } from 'vuetify/components/VTextField'

const name = shallowRef('')
const pressed = shallowRef(false)
const buttonAttrs: Pick<ButtonHTMLAttributes, 'type' | 'onClick' | 'class' | 'style'> = {
  type: 'button',
  onClick: () => { pressed.value = !pressed.value },
}
const inputAttrs: Pick<InputHTMLAttributes, 'required' | 'class' | 'style'> = {
  required: true,
}
</script>

<template>
  <VTextField v-model="name" v-bind="inputAttrs" label="Name" />
  <VBtn v-bind="buttonAttrs">{{ pressed ? 'Pressed' : 'Press' }}</VBtn>
</template>
```

Keep Vuetify's component props (`label`, `loading`, etc.) as component props, not in a native bag. Native `required` is not a substitute for awaited `VForm`/server validation. Report standard SFC compilation and strict-fixture checking as separate proof profiles; the other examples retain readable runtime-native syntax. [Tagged VBtn root/emits](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VBtn/VBtn.tsx), [VTextField input forwarding](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VTextField/VTextField.tsx), [Vue fallthrough attributes](https://vuejs.org/guide/components/attrs.html).

Keep stored bags narrow. A whole `ButtonHTMLAttributes` annotation widens overlapping `disabled` to `Booleanish`, incompatible with Vuetify's boolean prop. The narrow `Pick` above retains optional shared `class`/`style` in the type without adding runtime attributes; this avoids a no-common-properties weak-type error. `satisfies` checks an object without adding those optional keys to its inferred type. [TypeScript weak types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-4.html#weak-type-detection), [satisfies semantics](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator).

## Styles and icon contracts

- `vuetify/styles` supplies global styles, **not every component stylesheet**. Component modules bring their component CSS. Auto-importing components does not replace the global style import.
- With precompiled CSS, `vuetify/styles/core` can replace the full global entry when color-pack and utility classes are not wanted; add `vuetify/styles/colors` and/or `vuetify/styles/utilities` only as needed. Load core before these modular entries, rather than loading full and modular entries together.
- Sass `styles.configFile` recompiles framework styles. Keep the JavaScript global style import; the plugin redirects it to Sass. Detailed layers, typography, runtime font variables, and Sass settings belong in [vuetify-theme.md](vuetify-theme.md).
- Vuetify does not bundle Roboto font files. Either load the weights actually used or intentionally configure a different font. A fallback font is not an installation failure.
- The SVG configuration above includes Vuetify's built-in icon aliases without `@mdi/font` or `@mdi/js`. For application-specific SVG paths, install `@mdi/js@7.4.47`, import the individual path, and pass it as `:icon="mdiAccount"` or add an alias. A string such as `mdi-account` is a font class, not an SVG path.
- Font icons are a distinct alternative: install `@mdi/font@7.4.47`, import `@mdi/font/css/materialdesignicons.css`, and use the `mdi` adapter from `vuetify/iconsets/mdi`. Do not mix an SVG default set with unregistered font icon strings. Give icon-only controls an accessible name.

Sources: [4.3 icon guide](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/features/icon-fonts.md), [style exports](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/package.json).

## Locale, RTL, and date adapters

Component translations, direction, and date representation are related but different settings. This complete replacement plugin module uses the built-in native `Date` adapter and English/Arabic component messages:

```ts
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { en, ar } from 'vuetify/locale'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  locale: {
    locale: 'en',
    fallback: 'en',
    messages: { en, ar },
    rtl: { en: false, ar: true },
  },
  date: { locale: { en: 'en-GB', ar: 'ar-EG' } },
  theme: { defaultTheme: 'light' },
})
```

`useLocale().current.value = 'ar'` changes Vuetify's locale; the configured date mapping updates adapter locale. It does not translate application prose or set the document's `lang`/`dir`. Manage those in the app's localization owner. Use logical `start`/`end`, `ms-*`/`me-*`, and `ps-*`/`pe-*` styling. [Locale source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/locale.ts).

| Requirement | Adapter choice |
| --- | --- |
| Native `Date` values with `Intl` formatting | Default `VuetifyDateAdapter`; BCP 47 strings in `date.locale`. |
| String-based picker values | `StringDateAdapter` from `vuetify/date/adapters/string`; change the application's date model contract deliberately. |
| Existing date-fns domain model | `@date-io/date-fns 3.2.1` with `date-fns 4.4.0`; use date-fns locale objects, not native-adapter locale strings. |
| Existing Day.js, Luxon, or Moment model | Select the matching date-io adapter and verify its exact release/peers; do not silently change the domain model. |
| Existing Vue I18n application | `createVueI18nAdapter` from `vuetify/locale/adapters/vue-i18n`; use a Composition API `createI18n({ legacy: false })` instance and put component messages under `$vuetify`. See [i18n-head.md](i18n-head.md). |

Date-fns replacement module, after installing `@date-io/date-fns@3.2.1 date-fns@4.4.0`:

```ts
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import DateFnsAdapter from '@date-io/date-fns'
import { enGB } from 'date-fns/locale'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  date: { adapter: DateFnsAdapter, locale: { en: enGB } },
})

declare module 'vuetify' {
  namespace DateModule {
    interface Adapter extends DateFnsAdapter {}
  }
}
```

The augmentation makes `useDate()` reflect this app's adapter. Do not declare two incompatible adapters in the same TypeScript program. `useDate()` must run within Vuetify setup injection context. Invalid input can produce `null`; distinguish a calendar date from a timestamp before converting to ISO or crossing a timezone boundary. [Date options and adapters](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/features/dates.md).

### Consume date and scoped locale services

Inside component setup, `useDate()` returns the configured adapter, not a universal string parser. Use `date.date(input)` to construct an adapter value, reject `null` **before** checking `date.isValid(value)`, and use `date.format(value, 'fullDate')`, `addDays`, `isSameDay`, `parseISO`, or `toISO` only according to that adapter's contract. This order matters for the native adapter: its `isValid(null)` coerces through `new Date(null)` and returns true, although `date(invalidInput)` can return null. Its `toISO` represents a calendar date, not a UTC timestamp serialization promise. Configure `date.formats` for named formats instead of hand-formatting picker internals. [Exact native construction and validity checks](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/date/adapters/vuetify.ts).

`useLocale()` provides reactive `current`/`fallback`, message translation/interpolation `t(key, ...params)`, and number formatting `n(value)`; there is no public `format` member in 4.3. `useRtl().isRtl` reflects direction. These are component-service APIs, not replacements for application translation ownership. A `VLocaleProvider locale="ar" rtl` scopes a region without changing the global locale; import `VLocaleProvider` from `vuetify/components/VLocaleProvider` when not auto-importing. Keep its descendants' logical spacing and date expectations consistent. Do not change document language from a local preview. [Date contract](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/date/DateAdapter.ts), [native serialization](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/date/adapters/vuetify.ts), [locale provider](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VLocaleProvider/VLocaleProvider.tsx).

## SSR is an integration, not a boolean-only solution

For raw Vue SSR, create a new Vue app **and a new Vuetify instance per request**. A module-level singleton can leak mutable defaults, locale, or theme across requests. Set `ssr: true` on server and hydration clients; its initial display size is zero unless a consistent `{ clientWidth, clientHeight }` SSR size is provided. It defers browser display updates until after hydration. Prefer CSS-responsive layout over producing different server/client trees from viewport guesses. [Display implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/display.ts), [framework installation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/framework.ts).

Contextual factory module for an existing SSR renderer, not a complete server:

```ts
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export function createRequestVuetify(theme: 'light' | 'dark') {
  return createVuetify({
    ssr: true,
    icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
    theme: { defaultTheme: theme },
  })
}
```

The renderer must also deliver generated theme CSS and stylesheet assets. Vuetify can register its theme stylesheet with an installed compatible head manager; without that, the renderer owns serialization of `vuetify.theme.styles.value` into an escaped/nonce-aware style element using the matching stylesheet ID. `ssr: true` does **not** inject HTML into the server document by itself. Use the same initial theme and locale on server/client; `system` follows a browser media query unavailable on the server. Deliver request-derived initial preferences before hydration rather than reading local storage during server rendering. Review CSP nonces and teleported overlay containers. See [debugging-ssr.md](debugging-ssr.md) and [i18n-head.md](i18n-head.md).

Nuxt owns app creation, SSR, and hydration. [Nuxt integrations](nuxt-integrations.md) provides the stable explicit plugin/Vite path and the separate prerelease module boundary, not this SPA `createApp()` entry or two concurrent integrations. Preserve an existing working integration; verify its exact release/options before changing it. A module peer range admitting Vuetify 4 is not stable-release certification or observed compatibility for every option. [Official installation boundary](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/getting-started/installation.md).

## Failure modes and evidence boundary

| Symptom | Inspect before changing code |
| --- | --- |
| Unknown `V*` component | SFC import/global registration/auto-import transformation; plugin presence is not component registration by itself. Vue can warn about unresolved components. |
| Components render but layout/typography is wrong | Global `vuetify/styles` import, actual component CSS, competing reset/layer order, and `VApp`/`VMain`. |
| Blank close/dropdown/selection icons | Default icon set, aliases, and matching font CSS or SVG paths. |
| Wrong local image URL | `transformAssetUrls`, asset existence, and whether the URL is build-time or runtime. |
| Injection error from a Vuetify composable | `app.use(vuetify)` and composable setup context; avoid calling it at module scope. |
| Labs import missing after upgrade | Check 4.3 exports: `VDateInput`, `VFileUpload`, `VPicker`, `VAvatarGroup`, and `VIconBtn` are stable; old labs inventories are not authority. |

The current **Vuetify 4.3.0 / Vue 3.5.44** consumer binding and theme/date/mask source-contract smoke passed. Keep that bounded consumer profile explicit: `strict: true`, `vueCompilerOptions.strictTemplates: true`, and `skipLibCheck: true` check retained source/template bindings without independently certifying dependency declaration internals. This is not a production build, browser rendering, hydration, or accessibility pass. [TypeScript's exact boundary](https://www.typescriptlang.org/tsconfig/skipLibCheck.html).

A **separate original full-declaration forms graph** (`skipLibCheck: false`, TypeScript **5.9.3**, resolved vue-tsc **3.1.8**) failed with **85 diagnostics in dependency declarations**, including optional adapter SDK imports and generated component declarations; no extracted consumer-file diagnostic was reported in that run. That is an observed negative scope, not a Vuetify consumer failure or a full-declaration pass. The corrected forms profiles retain a separately named full-declaration check with **vue-tsc 3.3.13**; the earlier failure does not establish that checker's outcome. Do not add unused Flagsmith, LaunchDarkly, PostHog, or other hosted SDKs, service accounts, or ambient shims to service-independent consumers merely to make that graph appear green. Install an adapter's real SDK only when the application actually uses that adapter.

Run bounded consumer typing and full-declaration checking as separately reported profiles over the same retained inputs; do not silently replace the latter with `skipLibCheck: true`. After integration, separately check component resolution, bundled CSS/icons, relative assets, a production build, and SSR hydration/focus paths using the owning project's tooling.

## Sources

- [Vuetify 4.3.0 registry](https://registry.npmjs.org/vuetify/4.3.0), [Vue 3.5.44 registry](https://registry.npmjs.org/vue/3.5.44), [release tag](https://github.com/vuetifyjs/vuetify/releases/tag/v4.3.0).
- [Vite 8.3.4](https://registry.npmjs.org/vite/8.3.4), [Vue plugin 6.0.10](https://registry.npmjs.org/@vitejs/plugin-vue/6.0.10), [Vuetify plugin 2.1.3](https://registry.npmjs.org/vite-plugin-vuetify/2.1.3).
- [Native date contract](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/date/DateAdapter.ts), [Vue I18n adapter](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/locale/adapters/vue-i18n.ts).
- [date-io 3.2.1 peers](https://registry.npmjs.org/@date-io/date-fns/3.2.1), [date-fns 4.4.0](https://registry.npmjs.org/date-fns/4.4.0), [Roboto 5.3.0](https://registry.npmjs.org/@fontsource/roboto/5.3.0), [MDI paths 7.4.47](https://registry.npmjs.org/@mdi/js/7.4.47), [MDI font 7.4.47](https://registry.npmjs.org/@mdi/font/7.4.47).
