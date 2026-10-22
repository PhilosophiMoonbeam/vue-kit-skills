# OpenVue setup: Vite and Nuxt own different lifecycles

Read after [OpenVue selection](openvue.md) when installing or changing its host integration. Examples select OpenVue **1.0.0**, Vue **3.5.44**, Bun **1.4.3** for package management and Node **24.15.0** for Vite/Nuxt tooling. Preserve an incumbent manager, authoritative lockfile and compatible host; these separate application profiles are not an instruction to mix runtimes or replace an existing shell.

## Setup in a dedicated Vite app

Create the following files in an empty dedicated directory; do not overwrite an incumbent application's shell. Complete `package.json`:

```json
{
  "name": "openvue-office-preview",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.4.3",
  "scripts": {
    "dev": "vite",
    "typecheck": "vue-tsc --noEmit",
    "build": "vite build"
  },
  "dependencies": {
    "vue": "3.5.44",
    "openvue": "1.0.0",
    "@openvue/themes": "1.0.0"
  },
  "devDependencies": {
    "@types/node": "24.19.2",
    "@vitejs/plugin-vue": "6.0.10",
    "chart.js": "4.6.1",
    "typescript": "5.9.3",
    "vite": "8.3.4",
    "vue-tsc": "3.3.13"
  }
}
```

Complete `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": false,
    "noEmit": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"]
  },
  "vueCompilerOptions": { "strictTemplates": true },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

After all files exist, run `bun install`, `bun run typecheck`, `bun run build` and `bun run dev -- --host 127.0.0.1`. Preserve the resulting authoritative `bun.lock`; use `bun install --frozen-lockfile` for a replay. A Vite bundle does not replace typechecking.

`@openvue/core` and component SVG icons are transitive dependencies; this shell needs no icon font, utility CSS or remote assets. The plugin configures defaults; components still need imports/registration. `openvue/config` re-exports the plugin from `@openvue/core/config`. [Vite setup](https://openvue.dev/vite), [published entry](https://unpkg.com/openvue@1.0.0/config/index.mjs).

**Full-declaration prerequisite in 1.0.0:** `openvue/config` declares global PT options by importing the Chart component's types, which import `chart.js`. Consequently `skipLibCheck: false` needs that package even when no Chart is rendered; this shell declares it as a **development-only type provider**. Do not fake a module or weaken the gate. It does not require a Chart runtime import/registration; an actual Chart capability needs its peer as a runtime dependency. [Configuration declarations](https://unpkg.com/openvue@1.0.0/config/index.d.ts), [Chart declarations](https://unpkg.com/openvue@1.0.0/chart/index.d.ts), [type-provider release](https://registry.npmjs.org/chart.js/4.6.1).

Complete `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenVue office preview</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Complete `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({ plugins: [vue()] })
```

Complete `src/main.ts`:

```ts
import { createApp } from 'vue'
import OpenVue from 'openvue/config'
import { definePreset } from '@openvue/themes'
import Aura from '@openvue/themes/aura'
import App from './App.vue'

const preset = definePreset(Aura, {
  semantic: {
    focusRing: {
      width: '2px', style: 'solid', color: '{primary.color}', offset: '2px',
    },
  },
})

createApp(App).use(OpenVue, {
  theme: {
    preset,
    options: { darkModeSelector: '.app-dark', cssLayer: false },
  },
}).mount('#app')
```

Complete `src/App.vue`; selection and dialog state are local, with stable option values and honest feedback:

```vue
<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue'
import Button from 'openvue/button'
import Dialog from 'openvue/dialog'
import Select from 'openvue/select'

const fieldId = useId()
const dialogId = useId()
const office = shallowRef<string | null>(null)
const visible = shallowRef(false)
const dark = shallowRef(false)
const offices = [
  { code: 'lon', name: 'London' },
  { code: 'nyc', name: 'New York' },
]
const selectedOffice = computed(() => offices.find(item => item.code === office.value))

function toggleTheme() {
  dark.value = !dark.value
  document.documentElement.classList.toggle('app-dark', dark.value)
}
</script>

<template>
  <main class="office-preview">
    <h1>Office preview</h1>
    <label :id="`${fieldId}-label`" :for="fieldId">Office</label>
    <Select
      :label-id="fieldId" v-model="office" :options="offices"
      :ariaLabelledby="`${fieldId}-label`"
      option-label="name" option-value="code" placeholder="Choose an office"
    />
    <Button
      type="button" label="Preview office" :disabled="office === null"
      aria-haspopup="dialog" :aria-expanded="visible"
      :aria-controls="visible ? dialogId : undefined" @click="visible = true"
    />
    <Button
      type="button" :label="dark ? 'Use light theme' : 'Use dark theme'"
      @click="toggleTheme"
    />
    <p role="status">{{ selectedOffice ? `Selected ${selectedOffice.name}; nothing was saved.` : 'No office selected.' }}</p>
    <Dialog
      :pt="{ root: { id: dialogId } }" v-model:visible="visible" modal header="Office preview"
      :draggable="false" :style="{ width: 'min(28rem, calc(100vw - 2rem))' }"
    >
      <p>{{ selectedOffice?.name }} is a local preview; nothing was saved.</p>
      <template #footer>
        <Button type="button" label="Close preview" autofocus @click="visible = false" />
      </template>
    </Dialog>
  </main>
</template>

<style scoped>
.office-preview { display: grid; gap: .75rem; max-width: 28rem; margin: 2rem auto; padding: 1rem; }
:global(html) { color-scheme: light; background: var(--p-content-background); color: var(--p-text-color); }
:global(html.app-dark) { color-scheme: dark; }
</style>
```

The theme switch is a client-event operation, not SSR setup code. An incumbent app should initialize its theme from its existing preference owner rather than introducing this second local flag. See [theme architecture](design-system.md).

In **1.0.0**, noneditable Select renders its focusable combobox as a `span`, not a native labelable input. Use `labelId` for that element's ID and label-click handling; `inputId` is deprecated in the actual release. Bind the declared `ariaLabelledby` prop to the visible label ID; Select forwards it as DOM `aria-labelledby`. A `label[for]` alone does not name the span. This is a verified API detail, not an assumption based on ancestry. [Published Select implementation](https://unpkg.com/openvue@1.0.0/select/index.mjs), [Select declarations](https://unpkg.com/openvue@1.0.0/select/index.d.ts).

Dialog uses **`v-model:visible`**, is **nonmodal by default** (`modal: false`), and appends to `body` by default. The example explicitly enables modal focus containment, supplies its name with `header`, and keeps a keyboard-operable close action. Its trigger owns `aria-haspopup`, `aria-expanded` and `aria-controls`; there is no activator-slot prop bundle to copy. Verify initial focus and trigger restoration, including Escape and programmatic dismissal. Custom container/header slots must preserve or replace the dialog's accessible naming. [Dialog API](https://openvue.dev/dialog), [published declarations](https://unpkg.com/openvue@1.0.0/dialog/index.d.ts).

With `strictTemplates`, forward native root attributes through the declared `pt.root` contract: the example places the dialog's `id` there, and the carousel below supplies its accessible label the same way. Do not weaken template checking because the component's props omit native attributes.

**Browser acceptance plan, not an observed pass:** mount this shell at 320px and 1280px CSS width in both themes. Tab to the combobox and inspect its name: it must remain “Office” before and after selecting London/New York, not become the placeholder or city. Click its label to focus it; use Space/Arrow keys/Enter to select and Escape to dismiss. Open Preview office; inspect the dialog's name, initial focus, Tab/Shift+Tab containment, Escape dismissal and trigger-focus restoration. Confirm local-only feedback, visible focus and no clipped popup/dialog. Toggle the theme before opening overlays to check body-portal scope.

## Official Nuxt module: complete separate application

Use the **official `@openvue/nuxt-module@1.0.0`**, not the Vite bootstrap or a second manual plugin. The exact module declares Nuxt `>=3.0.0`; that range alone is not runtime evidence. This profile selects **Nuxt 4.6.2**, **Vue 3.5.44**, Node **24.15.0** and Bun **1.4.3**. Start in a dedicated empty directory, preserving an incumbent application's manager/lockfile:

```sh
bun add --exact nuxt@4.6.2 vue@3.5.44 openvue@1.0.0 @openvue/themes@1.0.0
bun add --dev --exact @openvue/nuxt-module@1.0.0 typescript@5.9.3 vue-tsc@3.3.2 @types/node@24.13.2
```

Complete `nuxt.config.ts`:

```ts
import { defineNuxtConfig } from 'nuxt/config'
import OpenVueModule from '@openvue/nuxt-module'
import Aura from '@openvue/themes/aura'

export default defineNuxtConfig({
  typescript: {
    strict: true,
    tsConfig: { vueCompilerOptions: { strictTemplates: true } },
  },
  modules: [[OpenVueModule, {
    autoImport: false,
    components: { include: ['Button', 'Select', 'Dialog'] },
    directives: { include: [] },
    composables: { include: [] },
    options: {
      theme: {
        preset: Aura,
        options: { darkModeSelector: '.app-dark', cssLayer: false },
      },
    },
  }]],
  nitro: { preset: 'node-server' },
})
```

The supported Nuxt **module/options tuple** passes options directly to the real exported module; no invented configuration key, renamed composable, resolver alias or manual installer is needed. `autoImport: false` selects the module's explicit include-list registration; its generated plugin still owns installation and its Nitro hook still emits structural/theme styles into server HTML. Add every used component to `include` so its SSR styles are included. The explicit imports in the SFC below remain valid. Do not disable `loadStyles`, duplicate installation or replace the module's SSR stylesheet hook with client-only CSS. [Nuxt modules](https://nuxt.com/docs/4.x/guide/going-further/modules), [exact module implementation](https://unpkg.com/@openvue/nuxt-module@1.0.0/dist/module.mjs), [exact server style hook](https://unpkg.com/@openvue/nuxt-module@1.0.0/dist/runtime/plugin.server.js).

Complete root `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

Complete `app/app.vue`:

```vue
<script setup lang="ts">
const theme = useCookie<'light' | 'dark'>('office-theme', {
  default: () => 'light',
  decode(value) {
    if (typeof value !== 'string') return 'light'
    try {
      return decodeURIComponent(value) === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  },
})
useHead({ htmlAttrs: { class: () => theme.value === 'dark' ? 'app-dark' : '' } })
</script>

<template><NuxtPage /></template>
```

Complete `app/pages/index.vue` by copying the **entire** `src/App.vue` office-preview SFC above, with these two exact replacements. Replace `const dark = shallowRef(false)` with:

```ts
const theme = useCookie<'light' | 'dark'>('office-theme', {
  default: () => 'light',
  decode(value) {
    if (typeof value !== 'string') return 'light'
    try {
      return decodeURIComponent(value) === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  },
})
const dark = computed(() => theme.value === 'dark')
```

Replace its entire `toggleTheme` function with:

```ts
function toggleTheme() {
  theme.value = dark.value ? 'light' : 'dark'
}
```

After the heading add `<NuxtLink to="/other">Other page</NuxtLink>`. Complete `app/pages/other.vue`:

```vue
<template>
  <main>
    <h1>Other page</h1>
    <NuxtLink to="/">Office preview</NuxtLink>
  </main>
</template>
```

Nuxt supplies `useCookie`, `useHead`, `NuxtLink` and `NuxtPage`; no separate Vue/router/bootstrap file belongs here. The non-sensitive theme cookie supplies deterministic request-owned initial markup; **the persistent app shell owns `useHead`**, keeping the selector on `html` across route changes and document refreshes, including body portals. The page edits the same named cookie through Nuxt's reactive cookie synchronization; it does not install a second head/theme owner. Preserve an incumbent preference owner rather than adding this one. Never choose initial SSR markup from browser-only storage/media. No Vuetify/Pinia/cache integration is required for this standalone UI recipe.

Both cookie readers deliberately use the same allowlisted decoder: only the canonical `dark` value selects dark; `light`, unknown values and malformed URI encoding resolve to light without changing the SSR/client tree. A TypeScript generic does not validate stored cookies. **Nuxt 4.6.2's default decoder calls `decodeURIComponent` without catching malformed encoding**, so an `office-theme=%` cookie otherwise throws during server setup rather than supplying the default. The local decoder catches that boundary; the next theme action writes a canonical value through Nuxt's normal encoder. This fallback does not claim malformed cookies are automatically rewritten. [Exact cookie implementation](https://unpkg.com/nuxt@4.6.2/dist/app/composables/cookie.js).

After all files exist:

```sh
bunx --no-install nuxt prepare
bunx --no-install nuxt typecheck
bunx --no-install nuxt build
HOST=127.0.0.1 PORT=3000 node .output/server/index.mjs
```

Open `/`, navigate to `/other` and back, then refresh both routes. Inspect the server HTML for component and theme styles before JavaScript executes; inspect clean hydration, light/dark computed colors and body-portal scope, then run the Select/Dialog keyboard/focus checks above. A successful build alone does not certify this integration. [Official setup](https://openvue.dev/nuxt), [exact package metadata](https://registry.npmjs.org/@openvue%2fnuxt-module/1.0.0).

**Observed 2026-10-21:** this exact module/options tuple passed generated strict Nuxt contexts (`strictTemplates: true`) and a production `node-server` build on the selected Nuxt/Vue versions. HTTP responses contained structural and Aura light/dark theme styles before hydration. Chromium at 320px and 1280px exercised named Select keyboard selection and Escape, named modal Dialog body portals, initial close-action focus, Tab/Shift+Tab containment and trigger restoration; both themes changed portal computed colors without clipping. Client navigation and document refresh worked with the theme cookie. This is a bounded local UI integration result, not blanket module/component/accessibility certification.


## Registration, alternatives and release-specific limits

- **Explicit imports are the baseline.** Import each component from `openvue/<name>` in its SFC. A `<name>/style` subpath is a style implementation, not a global preset stylesheet. Local directives can be imported as `vTooltip`/`vRipple` for the corresponding template binding; global registration belongs once at the app/module owner. Neither mechanism installs UI services.
- **Vite resolver boundary:** the published `@openvue/auto-import-resolver@1.0.0` does **not** export a named `OpenVueResolver`. Do not invent that rename or hide an inherited identifier behind an alias. This kit offers explicit imports and the official Nuxt module instead of an unverified resolver recipe. Reconsider a later published export only with real compilation/resolution evidence. [Exact runtime](https://unpkg.com/@openvue/auto-import-resolver@1.0.0/index.mjs), [declarations](https://unpkg.com/@openvue/auto-import-resolver@1.0.0/index.d.mts).
- **Nuxt module ownership:** automatic registration and explicit include lists are module facilities, separate from the Vite resolver package. Keep SSR `loadStyles` enabled and every rendered selected component in the actual include/registration plan. Do not install another plugin, emit a second app, or add a client-only theme workaround.
- **Local UI services:** ToastService, ConfirmationService and DialogService require their real plugin, rendered host and setup-time caller; importing a component alone is insufficient. Use [overlays](openvue-overlays.md) for cancellation, disposal, groups, portals and focus. These services are not hosted APIs or backend success.
- **Configuration and locale:** pass supported options through the plugin/module and coordinate visible labels, date metadata, RTL and library ARIA translations with the application's existing locale owner. Supply fresh request-owned configuration where it varies; do not mutate process-wide defaults for one SSR user or invent a renamed configuration composable from the package name.
- **Other hosts:** an existing Laravel/Inertia/Vite Vue host still owns its app factory and server authorization. Add the UI plugin to that factory rather than creating a parallel app. CDN/UMD pages are discovery material for deliberate incumbent integrations, not permission to guess global names, mix builds or add runtime template compilation to this TypeScript profile. [Host guide](https://openvue.dev/laravel), [CDN guide](https://openvue.dev/cdn).
- **Research tooling:** Context7's resolved `/openvi-foundation/openvue`, official LLM endpoints and optional local documentation tools are research transports, not app dependencies. Match primary docs to installed exports; the current docs' existence does not override a release conflict. [LLM endpoints](https://openvue.dev/llms), [upstream applications](https://github.com/openvi-foundation/openvue/tree/master/apps).

The complete upstream-document inventory and deliberate non-offering dispositions are in [coverage](../assets/openvue-coverage.json). Current execution belongs to [verification](../assets/verification.json); the dated earlier Nuxt result above is retained history, not an assertion every new optional component ran in Nuxt.

