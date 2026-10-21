# Documentation sites and presentation decks

Read when building a VitePress documentation site or a Slidev deck. These tools own their Vue application, routing, build and hydration/presentation lifecycle; do not mount their theme inside a normal SPA or replace their entry with the application example's `createApp`. Inspect the existing docs/deck package, lockfile, content root, theme, hosting base and scripts first. See [tooling](setup-tooling.md), [components](components.md), and [SSR debugging](debugging-ssr.md).

## Release and lifecycle boundaries

| Tool | Verified release | Boundary |
| --- | --- | --- |
| `vitepress` | **1.6.4** | Stable documentation generator; Node build pre-renders Markdown as Vue pages, then hydrates/navigation runs in browser |
| `@slidev/cli` | **53.0.0** | ESM deck CLI; owns Vite/Vue/UnoCSS/Shiki; Node `>=22.12.0`; exports additionally need a browser |
| Vue | **3.5.44** baseline | VitePress 1.6.4 depends on Vue `^3.5.13`; Slidev 53 depends on Vue `^3.5.42` |

VitePress 1.6.4 depends on Vite `^5.4.14`; Slidev 53 depends on Vite `^8.3.0`. Do not force the application's Vite 8 plugins into VitePress 1.x. A v2 prerelease is not the stable 1.6.4 API. Choose one package manager and preserve each tool's dependency graph; a separate workspace package is often the clearest ownership boundary. The repository's Node 24 baseline is suitable for the stated engine requirements; dependency installation/build behavior still needs verification in the actual lockfile. [VitePress metadata](https://unpkg.com/vitepress@1.6.4/package.json), [Slidev metadata](https://unpkg.com/@slidev/cli@53.0.0/package.json).

## VitePress: complete minimal site

Create these files in a dedicated docs package. The root `package.json` is ESM; `docs/` is the VitePress content root. Commands are runnable instructions, not reports of execution.

```json
{
  "name": "vue-kit-docs-example",
  "private": true,
  "type": "module",
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs"
  },
  "devDependencies": {
    "vitepress": "1.6.4",
    "vue": "3.5.44"
  }
}
```

```ts
// docs/.vitepress/config.ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'Vue Kit Handbook',
  description: 'An interactive handbook example',
  base: '/handbook/',
  cleanUrls: false,
  themeConfig: {
    nav: [{ text: 'Guide', link: '/guide' }],
    sidebar: [
      { text: 'Handbook', items: [{ text: 'Guide', link: '/guide' }] },
    ],
    search: { provider: 'local' },
    outline: [2, 3],
  },
})
```

```ts
// docs/.vitepress/theme/index.ts
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Counter from './Counter.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Counter', Counter)
  },
} satisfies Theme
```

```vue
<!-- docs/.vitepress/theme/Counter.vue -->
<script setup lang="ts">
import { ref } from 'vue'
const count = ref(0)
</script>

<template>
  <button type="button" @click="count++">Count: {{ count }}</button>
</template>
```

```css
/* docs/.vitepress/theme/custom.css */
:root {
  --vp-c-brand-1: #3451b2;
  --vp-c-brand-2: #3a5ccc;
  --vp-c-brand-3: #5672cd;
}
```

`docs/index.md`:

```md
---
layout: home
hero:
  name: Vue Kit Handbook
  text: Documentation with focused Vue examples
  actions:
    - theme: brand
      text: Read the guide
      link: /guide
---
```

`docs/guide.md`:

```md
---
title: Interactive guide
description: A documentation page with a small Vue component
---

# Interactive guide

## Try the counter

<Counter />

## Continue

[Return home](./index.md).
```

```sh
bun install
bun run docs:dev
bun run docs:build
bun run docs:preview
```

Build output is `docs/.vitepress/dist`; publish that directory under `/handbook/`, not `docs/` itself. Change `base` to `/` for origin-root hosting. Preview is a local output check, not a production server. VitePress defaults to `.html` links; setting `cleanUrls: true` requires the host to map extensionless paths to generated HTML. Configure real 404 handling and test direct page reloads on the deployment host. [Getting started](https://vitepress.dev/guide/getting-started), [routing](https://vitepress.dev/guide/routing).

### Config, content and theme responsibilities

| Change | Correct location |
| --- | --- |
| Title, description, base, Markdown options, Vite configuration | `.vitepress/config.ts` via `defineConfig` |
| Default theme nav/sidebar/search/outline | `themeConfig`; sidebar children are `items`, collapsibility uses `collapsed` |
| Page title, layout, sidebar/outline overrides | Markdown YAML frontmatter |
| Shared components/plugins/styles | `.vitepress/theme/index.ts` `enhanceApp`, imports and `extends` |
| Custom layout with default navigation | Wrap `DefaultTheme.Layout` and fill documented slots |
| Entirely custom theme | Theme `Layout` containing `<Content />`; maintain accessibility/navigation yourself |
| Content-derived listing | Build-time `.data.ts`/`.data.js` loader, not a browser filesystem call |
| Localized documentation | VitePress `locales` and locale-specific theme config/content; Vue I18n is not automatically installed |

`enhanceApp` receives the tool's app/router/site data; do not create a second Vue app. `Theme.setup`/`Theme.NotFound` and old top-level theme labels have deprecated replacements; use the current theme interface and `not-found` layout slot rather than old source recipes. Preserve an incumbent custom theme instead of resetting it to the default.

Markdown is compiled as Vue: components can be registered globally as above or imported with a page's `<script setup>`. Do not use browser `document` at module evaluation. Keep block-level custom components separated from paragraphs, and use fenced code blocks for literal template syntax. Frontmatter is data; page scripts are code, so do not compile untrusted user Markdown into executable Vue templates. GitHub-style alerts/containers, code highlighting, snippets and includes are content authoring features, not a security sandbox. [Vue in Markdown](https://vitepress.dev/guide/using-vue), [Markdown extensions](https://vitepress.dev/guide/markdown).

Custom layout example, a complete optional `docs/.vitepress/theme/Layout.vue`:

```vue
<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-before><p>Maintained by the documentation team.</p></template>
  </Layout>
</template>
```

To select it, import `Layout` in the theme entry and add `Layout` to its exported object (contextual integration fragment). Do not copy private `VP*` components or override internal aliases unless accepting upgrade coupling. Prefer public CSS variables and slots. `vitepress/theme-without-fonts` omits bundled Inter when font ownership requires it. [Theme extension](https://vitepress.dev/guide/extending-default-theme).

### Assets and content loaders

- Relative Markdown image links and imported theme assets enter Vite's asset pipeline and receive rewritten/hashed URLs. Files in `docs/public/` are copied unchanged: reference them from root URL paths, never `/public/...`.
- In component-generated URLs, use `withBase('/image.svg')` for public assets; hard-coded `'/image.svg'` ignores a subdirectory deployment. Static Markdown asset references get VitePress's processing, but arbitrary dynamic strings do not.
- Navigation links use site paths such as `/guide`, not a manually duplicated `/handbook/guide` in every item. `base` owns the deployment prefix.
- Rewrites change public route structure; relative links must target the rewritten URLs. Dynamic `[parameter].md` routes require a corresponding paths loader. Keep large content in `content` instead of bloating route params.
- `.data.ts` loaders run in Node at build/dev time and expose serialized data to browser imports. Never put secrets in their returned object. Do not import private database credentials through a client-facing module.

A complete optional index loader for this example:

```ts
// docs/pages.data.ts
import { createContentLoader } from 'vitepress'
export default createContentLoader('*.md', {
  excerpt: true,
  transform(pages) {
    return pages.map(page => ({
      url: page.url,
      title: String(page.frontmatter.title ?? page.url),
    }))
  },
})
```

Import `data` from `./pages.data` in a root Markdown page's script; render its records as links. This is build-time content loading, not an API endpoint. [Assets](https://vitepress.dev/guide/asset-handling), [data loading](https://vitepress.dev/guide/data-loading).

### VitePress runtime, configuration and extension contracts

| Work | Contract / boundary |
| --- | --- |
| Read page state | `useData()` returns refs for `page`, `frontmatter`, `site`, `theme`, `params`, `lang`, `dir`, `localeIndex`, `title`, `description`, `isDark`, `hash`; retain refs rather than copying `.value` once. `useRoute()` returns the reactive route with `path`, `data`, `component`. These are VitePress APIs, not Vue Router. |
| Navigate / observe navigation | `useRouter().go(to)` returns a Promise. `onBeforeRouteChange` can cancel before history changes; `onBeforePageLoad` runs after history updates. `onAfterPageLoad` is before component update; `onAfterRouteChange` is after route change. Hook properties have one owner: compose an existing handler rather than overwriting another integration. Only before hooks support cancellation. |
| Enhance rendered Markdown DOM | `onContentUpdated(fn)` runs when content updates, including frontmatter-driven updates; make DOM enhancement idempotent and dispose resources. Do not rely only on component mount across page navigation. |
| Theme-specific state | `useSidebar` / `useLocalNav` come from `vitepress/theme`, not a second sidebar store. Use public `VPButton`, `VPLink`, `VPTeamMembers` and other exported theme building blocks deliberately; private `VP*` implementation paths are not that public export contract. |
| Custom config schema / reuse | `defineConfigWithTheme<YourThemeConfig>` types custom themes; `extends` inherits a config and `mergeConfig` merges when function-based composition needs it. Site config is not Vite config: put bundler options inside `vite`, Vue compiler options inside `vue`. |
| Separate input/output/cache | `srcDir` changes content root; `srcExclude` excludes input Markdown; `outDir`/`assetsDir`/`cacheDir` change generated locations. Never publish the source/cache tree. `lastUpdated: true` needs Git history; shallow CI history affects dates. |
| Production metadata | Page frontmatter owns page title/description/head; `transformPageData` changes page data during Markdown conversion. `transformHead` appends `HeadConfig[]` before writing HTML; `transformHtml` changes final HTML; `postRender` sees SSR context; awaited `buildEnd` is for final generated files. Do not leak build-only secrets into returned page data/head. |
| Routing/performance | `router.prefetchLinks` controls link prefetch. `shouldPreload` controls asset preload, not navigation authorization. `rewrites`, `sitemap`, `metaChunk`, `mpa`, and `buildConcurrency` are experimental in 1.6.4; sitemap needs the deployed hostname and matching clean-URL/locale policy. Lower build concurrency for memory pressure rather than suppressing content errors. |
| Programmatic automation | Node-only `build`, `createServer`, `serve`, `init`, `scaffold`, `resolveConfig` and `resolveSiteData` exist for tooling. Prefer existing CLI scripts for ordinary sites. `createMarkdownRenderer(srcDir, options)` is experimental and shares a cached renderer; `disposeMdItInstance()` releases it. Do not import Node APIs into a client theme. |

Complete optional theme component (register like `Counter` or import locally):

```vue
<script setup lang="ts">
import { useData, withBase } from 'vitepress'
const { page, lang, isDark } = useData()
</script>

<template>
  <p>{{ page.title }} — {{ lang }}</p>
  <button type="button" :aria-pressed="isDark" @click="isDark = !isDark">Dark mode</button>
  <a :href="withBase('/guide.html')">Guide</a>
</template>
```

The link matches this example's `cleanUrls: false`; adjust for the host's actual route policy. A loader's `ContentData.url` excludes `base`, so pass it through `withBase` in generated component links. `defineLoader({ watch, load })` handles non-Markdown data; `createContentLoader` handles Markdown globs relative to `srcDir`, with `includeSrc`, `render`, `excerpt`, and `transform` selecting shipped data. Avoid returning full source/HTML when only title/URL is needed; if customizing glob ignores, preserve exclusions for generated output and dependencies. [Exact client API](https://unpkg.com/vitepress@1.6.4/dist/client/index.d.ts), [exact Node API](https://unpkg.com/vitepress@1.6.4/dist/node/index.d.ts).

### Default-theme navigation, search and localization

Use a path-keyed `sidebar` map for multiple sections; each item can set `base`, `items`, `link`, and `collapsed`. `collapsed: false` means collapsible but initially open; unset is noncollapsible. Nav `activeMatch` is a serialized regex **string**, not `RegExp`. Theme `logo` accepts light/dark variants with alt text, while `siteTitle: false` hides only the navbar title. `outline: { level: [2, 3], label: 'On this page' }`, `editLink`, `lastUpdated`, `docFooter`, `footer`, `socialLinks` and localized control labels belong to `themeConfig`; home `hero`/`features` belong to page frontmatter.

Local search (`provider: 'local'`) ships its index to clients; it does not enforce access control. For Algolia set `provider: 'algolia'` with actual DocSearch application/index/search-only credentials and crawler configuration; never ship an admin key. Locale content paths and `locales` need corresponding translated navigation/search labels, not just a language selector. `i18nRouting` defaults to translating the URL prefix; disable it when content URLs do not share that structure. No implicit Vue I18n installation is involved.

A complete alternate config demonstrating selective local indexing (retain the minimal config's `base` if deploying there):

```ts
import { defineConfig } from 'vitepress'
export default defineConfig({
  themeConfig: {
    search: {
      provider: 'local',
      options: {
        detailedView: false,
        _render(src, env, md) {
          if (env.frontmatter?.search === false) return ''
          return md.render(src, env)
        },
      },
    },
  },
})
```

A custom `_render` must preserve the `search: false` exclusion itself. `miniSearch.options`/`searchOptions` tune matching; per-locale options/translations must match indexed language content. Do not index secrets and expect an exclusion flag to protect published HTML. [Exact theme types](https://unpkg.com/vitepress@1.6.4/types/default-theme.d.ts), [search](https://vitepress.dev/reference/default-theme-search), [locales](https://vitepress.dev/guide/i18n).

### Markdown authoring and 0.x migration

Use the **VitePress** syntax below, not similarly named Slidev/VuePress features. These are contextual Markdown fragments, not complete additional pages:

| Need | Syntax / configuration |
| --- | --- |
| Stable heading / inline TOC | `## Install {#install}`; `[[toc]]`. Tune `markdown.anchor` and `markdown.toc`; header extraction for programmatic `PageData.headers` uses `markdown.headers` (levels `[2, 3]`), distinct from default-theme visible outline. |
| Callout / disclosure | `::: tip Title` or `::: details Details` with content and closing `:::`; GitHub `> [!NOTE]` alerts are supported. Configure translated container labels with `markdown.container`. |
| Highlight/focus/diff | Fence info `ts{2-4}`; line comments `// [!code highlight]`, `// [!code focus]`, `// [!code ++]`, `// [!code --]`, `// [!code warning]`, `// [!code error]`. These annotate displayed code, not actual compiler diagnostics. |
| Line numbers | `markdown.lineNumbers: true` globally or fence language `ts:line-numbers` / `ts:no-line-numbers` locally. |
| Snippet | `<<< @/snippets/example.ts#demo{1,3 ts:line-numbers}` reads an existing source-root file/region; `@` follows `srcDir`, not always cwd. |
| File inclusion | `<!--@include: ./parts/install.md-->` inserts Markdown; ranges/regions are supported. Missing includes need manual content inspection because absence may not fail the build. |
| Code tabs | `::: code-group`, ordinary fences labeled `[npm]` / `[pnpm]` or `<<<` snippets, then `:::`. Not obsolete `@[code]`, `<code-group>` or invented `group` fences. |
| Literal Vue syntax / style isolation | Use inline/fenced code or `v-pre` for mustaches; `::: raw` / `.vp-raw` isolates documented component styles only when paired with configured `postcssIsolateStyles`. It is not an HTML sanitizer. |
| Syntax/parser extension | `markdown.preConfig(md)` runs before built-ins, `markdown.config(md)` after. Use `shikiSetup` (not `shikijiSetup`), `theme: { light, dark }`, `languages`, `languageAlias`, `codeTransformers`; install only actual plugins with their supported graph. Math is opt-in `markdown.math` plus `markdown-it-mathjax3`, not built-in KaTeX. |

On 0.x migration, rename sidebar `children` to `items` and `collapsible` to `collapsed`; migrate old group shapes rather than rejecting valid v1 `SidebarItem.link`. Replace `pathname://` links with explicit `target` policy, `Router.onAfterRouteChanged` with `onAfterRouteChange`, theme `outlineTitle` with `outline.label`, `lastUpdatedText` with `lastUpdated.text`, old top-level `algolia` with `search`, and local-search `disableDetailedView` with `detailedView: false`. `Theme.setup` becomes layout setup; `Theme.NotFound` becomes a `page.isNotFound` branch in Layout (or a supported default-layout slot). `appearance: 'force-auto'` follows system appearance without a normal user toggle. VitePress 1.6.4 rejects `rolldown-vite`; changing that requires a separately planned VitePress 2 migration, not an override under 1.x. [Tagged Markdown guide](https://github.com/vuejs/vitepress/blob/v1.6.4/docs/en/guide/markdown.md), [0.x migration](https://vitepress.dev/guide/migration-from-vitepress-0).

CLI diagnosis: `bun run docs:dev --port 5174 --strictPort --open` forwards real dev flags directly, without npm's extra `--` separator; `--force` invalidates optimized dependencies. Build accepts `--outDir`, `--base`, `--target`, `--minify`, `--assetsInlineLimit`; do not confuse output root with source root. Preview (`serve` alias) serves the build with matching `--base`/`--port`. For tooling failures use `DEBUG=vitepress:*` or Node's inspector in the existing dev script; TTY shortcuts `r/u/o/c/q/h` restart, show URL, open, clear, quit, help. These are diagnosis instructions, not checks exercised here. [CLI](https://vitepress.dev/reference/cli).

### SSG, hydration and browser-only code

Production build renders pages in Node first. A component that happens to work in the dev browser can still crash the build or mismatch hydration.

1. Keep initial server/client output deterministic: no random values, local-storage-dependent markup, current time, locale/time-zone differences or invalid HTML nesting during initial render.
2. Access `window`, `document`, observers and storage only after mount; dispose listeners on unmount. Preserve a stable initial shell to avoid layout shift.
3. `<ClientOnly>` defers rendering, **not module evaluation**. A statically imported package that accesses `window` immediately still fails. Use `defineClientComponent(() => import('./BrowserWidget.vue'))` to defer that import until mounted, or dynamic import within a client-only lifecycle.
4. Conditionally import browser-only plugins inside async `enhanceApp` using `if (!import.meta.env.SSR)`. Ensure components depending on them also have a client-only render boundary.
5. Do not wrap all content in ClientOnly to hide an error: that removes pre-rendered documentation and weakens indexing. Only isolate the incompatible widget and retain accessible textual content.
6. Plain SSR-compatible interactive examples, such as the counter above, should render normally. They do not need ClientOnly.

Complete optional browser-only widget and its Markdown consumer:

```vue
<!-- docs/.vitepress/theme/BrowserWidth.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
const width = ref<number | null>(null)
function update() { width.value = window.innerWidth }
onMounted(() => {
  update()
  window.addEventListener('resize', update)
})
onUnmounted(() => window.removeEventListener('resize', update))
</script>

<template><p>Viewport width: {{ width ?? 'Not measured' }}</p></template>
```

```md
<!-- docs/browser.md -->
<script setup lang="ts">
import { defineClientComponent } from 'vitepress'
const BrowserWidth = defineClientComponent(
  () => import('./.vitepress/theme/BrowserWidth.vue'),
)
</script>

# Browser measurement

This value is measured after mounting; it is not available in static HTML.

<ClientOnly><BrowserWidth /></ClientOnly>
```

`defineClientComponent` alone already defers import/render; ClientOnly here makes the content boundary explicit. Do not infer that every onMounted-based component must be lazy-imported. [SSR compatibility](https://vitepress.dev/guide/ssr-compat).

MPA mode (`mpa: true`) changes client behavior: ordinary Vue page scripts are server-side templating and interactive islands require its explicit `<script client>` mechanism. Do not turn it on as a transparent optimization for this interactive example. Use [MPA guidance](https://vitepress.dev/guide/mpa-mode) only when that different architecture is intended.

## Slidev: complete minimal deck

Use a separate deck package. A theme named `default` resolves to a theme package, not a Vue SPA component library. This package pins the CLI, default theme **0.25.0**, and Vue. Export instructions below use **playwright-chromium 1.64.1**, within the CLI's optional peer range `^1.10.0`; this is metadata compatibility, not an exercised export. Read the [observed Slidev 53 tooltip boundary](#observed-slidev-53-tooltip-boundary) before treating build success as clean browser initialization.

```json
{
  "name": "vue-kit-deck-example",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "slidev slides.md",
    "build": "slidev build slides.md",
    "export": "slidev export slides.md"
  },
  "devDependencies": {
    "@slidev/cli": "53.0.0",
    "@slidev/theme-default": "0.25.0",
    "vue": "3.5.44"
  }
}
```

```sh
bun install
bun run dev --open
```

Complete `slides.md` (the first YAML block is deck-wide headmatter; later blocks configure the next slide):

````md
---
theme: default
title: Vue Kit Workshop
info: |
  A small interactive deck about explicit state ownership.
transition: slide-left
mdc: true
---

# Vue Kit Workshop

Explicit state and predictable components

<!--
Welcome the audience. Explain the difference between a web deck and a PDF.
-->

---
layout: two-cols
---

# One owner

<v-clicks>

- Keep the state close to its owner.
- Send changes through an explicit contract.

</v-clicks>

::right::

```ts
import { ref } from 'vue'
const count = ref(0)
```

---
layout: center
---

# Try the example

<DeckCounter />

<!--
The counter is interactive in the browser, not in PDF output.
-->
````

Slidev automatically discovers the following component from `components/`:

```vue
<!-- components/DeckCounter.vue -->
<script setup lang="ts">
import { ref } from 'vue'
const count = ref(0)
</script>

<template>
  <button type="button" @click="count++">Workshop count: {{ count }}</button>
</template>
```

Do not add `createApp`, a custom RouterView or an independent Vite entry to render these slides. For a real Vue plugin use Slidev's `setup/main.ts` extension hook, not an application `main.ts`. Custom layouts live in `layouts/`; theme and local components follow Slidev's resolution rules. Keep custom code scoped and assess export behavior as well as presentation behavior. [Syntax](https://sli.dev/guide/syntax), [app setup](https://sli.dev/custom/config-vue), [themes](https://sli.dev/guide/theme-addon).

### Authoring decisions and export effects

| Need | Approach / caveat |
| --- | --- |
| Deck-wide title, theme, fonts, defaults | First headmatter block; do not repeat configuration on every slide |
| One slide's layout/class/background/transition | Slide frontmatter immediately before that slide |
| Speaker notes | Final HTML comment in the slide; treat as potentially distributable content |
| Progressive reveal | `v-click`, `v-after`, `v-clicks`; export with click steps intentionally |
| Two-column layout | `layout: two-cols` with `::right::`; named slots depend on the layout |
| Reuse content | `src` slide imports and snippets; keep relative paths correct for their owning files |
| Code focus | Fenced language plus line highlighting; static code is not a live execution environment |
| Code transition | `magic-move` uses an outer four-backtick fence around inner triple-backtick blocks |
| Editable runnable code | Monaco/runner integrations need deliberate runtime and security choices, not a plain code fence |
| Diagrams/math | Mermaid/KaTeX support; inspect export font/loading and accessibility alternatives |
| Animations | Click steps and transitions; ensure reduced-motion/readability and a static meaningful end state |

The first frontmatter is deck config and first-slide metadata; later `---` separators can open per-slide YAML. Do not insert horizontal-rule syntax blindly with generic Markdown transformations. Notes are not a private secret store: normal SPA builds can include them. Publish with `--without-notes` when intended, and inspect exported artifacts too; PPTX carries notes. The presenter UI is not an authentication system for content already shipped to clients.

Assets imported relatively participate in the Vite pipeline. `public/` files are served as static assets without `/public` in the URL; use Slidev/base-aware asset patterns when building under a subpath. Prefer local, licensed assets/fonts for reproducible offline presentation/export. A working remote image in your browser may be unavailable in an export worker. Do not rely on a workstation's absolute paths. [Assets](https://sli.dev/guide/syntax#static-assets), [animations](https://sli.dev/guide/animations), [code](https://sli.dev/guide/syntax#code-blocks).

### Advanced deck syntax, code and click contracts

`comark: true` enables current attribute/component syntax (formerly MDC); `mdc` is still accepted by 53.0.0's implementation, so the minimal deck is not broken, but prefer `comark` for new content. Imported `src: ./pages/intro.md#2,5-7` selects rendered slides; source paths and per-slide frontmatter stay with that file, while entry headmatter owns global config. A slide `<script setup>` and scoped `<style>` affect that slide; UnoCSS utilities are compiled by the tool. Install an actual Iconify collection to use its components, e.g. `<mdi-account-circle />` after adding `@iconify-json/mdi`; a component name alone does not install icons.

| Code task | Actionable syntax / boundary |
| --- | --- |
| Click highlighting | Fence `ts {2-3|5|all}` advances stages; `none`, `hide`, `all` have distinct meanings. Second options group `{at:3}` synchronizes blocks with an absolute click. |
| Lines / overflow | `ts {*}{lines:true,startLine:5,maxHeight:'200px'}`; `{*}` preserves the empty first group. Scrolling is presentation UI; verify export clipping separately. |
| Type hovers | Fence `ts twoslash` with self-contained imports/code; `// ^?` type queries require the actual dependency/type environment. Enable `twoslash` headmatter deliberately; this is analysis, not runtime execution. |
| Editable / diff | `ts {monaco}` or `{monaco-diff}` (original and modified code separated by `~~~`). Headmatter `monaco: 'dev'` avoids shipping an editor into the built presentation when unneeded. |
| Executable | `ts {monaco-run} {autorun:false}` gives an explicit run action; `showOutputAt:'+1'` delays output reveal. Default JS/TS runners do not execute arbitrary languages; other languages need `setup/code-runners.ts`. Treat editable code as executable input, not safe untrusted content. |
| Source snippets | `<<< @/snippets/example.ts#demo ts {2|all}{lines:true}` reads the project-root file/region. `{monaco-write}` can write edits back to disk in dev: grant source-write permission intentionally, not for an untrusted deck. |
| Code groups | With `comark: true`, use `::code-group`, labeled fences such as `sh [npm]`, then closing `::`. File icons require their Iconify data; do not confuse this with VitePress's `::: code-group`. |
| Magic Move | Outer **four** backticks with `md magic-move`, inner triple fences for successive code states; `magicMoveDuration` and `shiki.magicMove` tune duration/easing/stagger. Keep blocks semantically comparable; it animates text tokens, not program execution. |

Complete optional single-slide Markdown content for Magic Move (insert it as a slide body without copying this documentation's outer five-backtick fence):

`````md
# Derive instead of copying

````md magic-move
```ts
const count = 2
const doubled = 4
```
```ts
const count = 2
const doubled = count * 2
```
````
`````

Click positions must preserve **string** relative values: `v-click="'+1'"` means relative next, while `v-click="+1"` evaluates numeric `1` and is absolute. `v-after` means relative `'+0'`, not `'-1'`. `v-click="[2,5]"` is visible on clicks 2, 3, 4; end 5 is **exclusive**. `v-click.hide` reverses visibility; `<v-clicks depth="2" every="2">` reveals nested/groups of items. `<v-switch>` slots `#1`, `#2`, or `#5-7` select ranges. `clicks` fixes total steps and `clicksStart` changes the start: ensure neither truncates necessary reveals. [Click positioning](https://sli.dev/guide/animations), [snippets](https://sli.dev/features/import-snippet), [Monaco](https://sli.dev/features/monaco-run).

Slide `v-motion` supports `:initial`, `:enter` and click variants such as `:click-1`; it is Slidev's integration with VueUse Motion, not a Motion for Vue `motion-v` component contract. Use it for deliberate spatial changes; ordinary reveals need only clicks. `transition: slide-left | slide-right` chooses forward/backward transitions; custom names require Vue transition CSS classes. `.slidev-vclick-target`, `-hidden`, `-current`, `-prior` expose reveal state for styling. `v-mark.circle`, `v-mark.underline.red`, or `v-mark="{ at: 5, type: 'box', color: '#234' }"` adds Rough Notation annotations; do not make color alone carry meaning. Drawing mode uses `C`; headmatter `drawings: { enabled: true, persist: false, presenterOnly: true, syncAll: false }` chooses persistence/visibility/sync explicitly. Drawing/recording is not permission to distribute private annotations.

Math uses inline `$...$` and block `$$...$$` (optional highlight stages); Mermaid uses a `mermaid` fence with theme/scale options. PlantUML uses a `plantuml` fence and `plantUmlServer`: its default public renderer receives diagram text, so select an approved server or avoid sending confidential architecture. Provide text alternatives to diagrams and consider motion/reduced-motion via [accessibility](accessibility.md). [Syntax](https://sli.dev/guide/syntax), [animation integration](https://sli.dev/guide/animations).

### Layout extension and persistent slide lifetimes

Choose layout from its actual provider: default/cover/intro/end, center/section/statement/fact/quote, full/none, two-cols/two-cols-header, image/image-left/image-right (`image` prop), or iframe variants (`url` prop). Resolve default → theme → addons → local `layouts/`; later definitions override earlier names. This complete local `layouts/two-areas.vue` defines named/default regions:

```vue
<template>
  <div class="slidev-layout">
    <section><slot name="top" /></section>
    <section><slot /></section>
  </div>
</template>
```

Use `layout: two-areas`, then `::top::` and `::default::` markers in the slide. Theme/addon-specific props/slots are not portable across layouts. `slidev theme eject slides.md --dir theme` copies the current theme and rewrites headmatter to a local path; use only when public extension hooks cannot satisfy the requirement. It is source ownership, not an automatic upgrade mechanism; `none` and already-local themes cannot be ejected again.

Built-ins solve concrete presentation tasks: `<Link to="5">` or route-alias links avoid raw router coupling; `<SlideCurrentNo />`, `<SlidesTotal />`, `<Toc maxDepth="2" />`, and `<TitleRenderer no="3" />` expose navigation metadata. `<Transform>`, `<AutoFitText>`, `<Arrow>` and `<VDrag>`/`<VDragArrow>` help positioning; `VDrag pos="logo"` persists geometry through frontmatter `dragPos`. Fix overflow/readability before shrinking whole slides. `<SlidevVideo>` owns slide-aware playback; Youtube/Tweet embeds need network/privacy/export review. `<LightOrDark>` supplies theme variants; `<RenderWhen context="presenter">` is a render boundary, **not secrecy or authorization**. Print/overview/presenter/slide contexts can render different states.

Templates expose `$page`, `$clicks`, `$frontmatter`, `$nav`, `$slidev`, `$renderContext`; use `useNav`, `useDarkMode`, `useSlideContext`, `useIsSlideActive` from `@slidev/client` in components rather than importing internal virtual routes. Slide instances persist while inactive: `onMounted`/`onUnmounted` alone do not start/stop work on each visit. Complete optional `components/ActiveSeconds.vue`:

```vue
<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useIsSlideActive } from '@slidev/client'
const active = useIsSlideActive()
const seconds = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
function stop() {
  if (timer !== undefined) clearInterval(timer)
  timer = undefined
}
watch(active, (value) => {
  stop()
  if (value) timer = setInterval(() => { seconds.value++ }, 1000)
}, { immediate: true })
onUnmounted(stop)
</script>

<template><p>Active seconds: {{ seconds }}</p></template>
```

Use `onSlideEnter`/`onSlideLeave` when actual navigation callbacks (including `to`/`from`) are needed; keep final resource cleanup on unmount too. For export use a deterministic snapshot instead of this intentionally live timer. [Built-in components](https://sli.dev/builtin/components), [layouts](https://sli.dev/builtin/layouts), [53.0.0 hook contract](https://unpkg.com/@slidev/cli@53.0.0/skills/slidev/references/api-slide-hooks.md).

### Headmatter capabilities and source-editing MCP

| Concern | Configure deliberately |
| --- | --- |
| Geometry/color/fonts | `aspectRatio`, `canvasWidth`, `colorSchema`, `favicon`; `fonts.sans/serif/mono` and `fonts.provider: 'none'` for local ownership. Do not assume a web font is installed in PPTX recipients. |
| Metadata and defaults | `title`, `titleTemplate`, `author`, `keywords`, `info`, `seoMeta`, `htmlAttrs.lang/dir`; `defaults` supplies slide-level defaults, `themeConfig` has theme-owned keys and `addons` adds providers. |
| UI exposure | `presenter`, `browserExporter`, `record`, `monaco` can be mode-gated (`'dev'`/`'build'` where their types allow); `browserExporter: false` explicitly disables that page in 53.0.0 (contrary to older source notes). `selectable`, `contextMenu`, `wakeLock` affect interaction, not security. [Exact config types](https://unpkg.com/@slidev/types@53.0.0/dist/index.d.mts). |
| Export reproducibility | `exportFilename`, `export: { format, timeout, withClicks, withToc }`, `download`, `remoteAssets`; remote caching still needs license/privacy review and accessible sources at build time. |
| One-slide identity/visibility | `title`, `level`, `hideInToc`, `routeAlias`, `hide`/`disabled`, `preload`; hidden slides are excluded from rendered numbering, not a private storage location. `background`/`backgroundSize`, `class`, `zoom` affect layout, not content scale guarantees. |

MCP has two different transports: the running dev server exposes HTTP `http://localhost:<printed-port>/__mcp`; `bunx --no-install slidev mcp slides.md` uses the locally installed binary over stdio without a dev server or live navigation. Headmatter `mcp: false` disables it. It writes real source files and can control connected audiences; expose only to a trusted authoring client, never by publishing the development server.

1. Call `slidev-get-info`, then `slidev-list-slides`; rendered **1-based** numbers exclude hidden slides. Read `slidev-get-slide` with `{ "no": 2 }` before patching.
2. `slidev-update-slide` accepts `{ no, content?, note?, frontmatter? }`: omit untouched fields; `""` clears content/note; `frontmatter: { key: null }` deletes a key. Body content excludes headmatter/note separators. Do not replace unrelated fields from an old snapshot.
3. `slidev-insert-slide` accepts `{ after, content, frontmatter?, note? }`; `slidev-remove-slide` takes `{ no }`; `slidev-move-slide` takes `{ from, before }` **or** `{ from, after }`. The entry's first slide owns headmatter and cannot be removed/moved. Imported slides edit their owning Markdown file; moves cannot cross files.
4. Re-list after insert/remove/move because rendered numbers shift. Dev edits hot-reload; `slidev-goto-slide` with `{ no, clicks? }` controls live navigation only in HTTP mode. Stdio editing cannot visually verify a presentation.

Use the installed tool's returned input schema rather than inventing JSON-RPC wrappers for these payloads. [Exact 53.0.0 MCP implementation](https://unpkg.com/@slidev/cli@53.0.0/dist/serve-DzvJFv6v.mjs), [CLI](https://sli.dev/builtin/cli).

### CLI workflow, browsers and deployment

Use the locally installed binary through `bun run <script>` or `bunx --no-install slidev ...`. If deliberately fetching the CLI outside a deck package, name both the scoped package and its binary: `bunx --package @slidev/cli@53.0.0 slidev ...`; do not assume `bunx slidev` fetches `@slidev/cli`. Development defaults to port 3030 but may select another available port; use the printed URL. Pass script flags directly after `bun run <script>` without npm's extra `--` separator. Bun respects Node shebangs; these commands do not force the Slidev CLI onto Bun's runtime.

```sh
# Run in the dedicated deck package after writing slides.md and the component.
bun run dev
bun run build --base /workshop/ --without-notes
bun add --dev --exact playwright-chromium@1.64.1
bun run export --format pdf --output workshop.pdf --with-clicks
bun run export --format png --range 1-2
bun run export --format pptx --with-clicks false
bun run export --format pptx-editable --with-clicks false
bunx --no-install slidev export-notes slides.md
```

`build` creates a browser SPA in `dist/` and keeps interactivity. Publish it at `/workshop/` with a compatible base and host fallback for client-side routes; it is not VitePress-generated page HTML. `--download` additionally makes a downloadable PDF available and therefore introduces export/browser requirements; do not add it to a build that lacks them. A static PDF/PPTX is not an interactive SPA. [Hosting](https://sli.dev/guide/hosting), [CLI](https://sli.dev/builtin/cli).

PDF/PNG/PPTX/Markdown-image export uses Playwright rendering and requires the optional `playwright-chromium` peer plus its Chromium binary and operating-system dependencies. An npm package existing in node_modules does not prove the browser binary is installed. Provision the package's matching browser/dependencies in CI; do not point it at a random incompatible system browser. A managed compatible Chrome/Edge executable can be selected with `--executable-path` when codecs require it.

The browser exporter at the running server's `/export` provides an alternative UI; modern Chromium-based browsers are recommended. It is not proof of Firefox/WebKit export parity. Dev presentation and export use different execution paths, so verify both.

- PDF defaults to one page per slide without click steps; `--with-clicks` emits multiple pages for reveal steps.
- `pptx` uses slide images for fidelity; text is not selectable. Its click steps default on; explicitly disable when unwanted.
- `pptx-editable` rebuilds supported content as PowerPoint shapes. Unsupported SVG/canvas/iframe/video/formulas/effects become pictures; entire-slide fallback is possible and reported. Text wrapping and fonts can differ. Fonts are referenced, not embedded. `--per-slide` is not supported with this format.
- PNG is a set of images; `md` is Markdown referencing rendered slide images, not the original editable deck.
- `--timeout` controls the export timeout; `--wait` adds settling time; `--wait-until` changes browser readiness. Fix missing fonts/resources first; increasing a timeout cannot make an inaccessible asset load. Disabling network-idle waiting can hide missing content.
- A click animation is not necessarily settled when navigation completes; deterministic animation/data states are preferable to arbitrary delays. Browser-only widgets, videos and network calls need export-specific review.
- `--remote` exposes the dev presentation/control server; bind and credential options need an intentional trusted-network policy. Do not expose the source-editing/development server as the public static deployment.
- The strict CLI rejects unknown flags. `--tunnel` only enables a tunnel with `--remote`; an explicit `--port` is strict while the default port searches availability. Dev `--inspect` exposes Vite inspection and `--force` rebundles; use these locally. TTY `r/o/e/q/c` restart, open, edit source, quit, show remote QR respectively.
- `--router-mode hash` suits static hosts without route fallback; `history` needs rewrites, `memory` is for intentionally URL-less navigation. Multiple build entries produce per-entry subdirectories; publish the actual resulting structure and matching bases. `--out` changes the build destination.
- `--with-toc` adds PDF outline. `--dark`, PNG `--scale`/`--omit-background`, and `--range` select rendering output, not source edits. `--per-slide` can isolate global-layer state but breaks cross-slide links/TOC; prefer `slide-top.vue` over global layers when content depends on each printed slide. Emoji/font loss in CI requires real fonts, not just extra waiting. `export-notes --output ...` writes notes PDF; `format` rewrites Markdown in place, so preserve source changes intentionally.

[Exporting and format limitations](https://sli.dev/guide/exporting). `slidev mcp slides.md` is an optional stdio authoring integration, not needed for build or presentation; its ability to edit a deck requires the same source access/trust policy as an editor.

## Verification boundary

The [verification record](../assets/verification.json) separates compiler/type profiles, real framework builds and selected browser paths. Slidev rendering, counter activation and the active-slide timer were exercised; exports and VitePress browser workflows below remain consuming-project obligations.

1. VitePress: production build and preview at the real base; direct URL reload; no Node browser-global crash; no hydration warning; links, image paths, search, keyboard navigation and mobile sidebar work.
2. Verify the pre-rendered HTML includes meaningful headings/content without JavaScript. Check dynamic loaders contain no secrets and their links resolve under base/rewrites.
3. Slidev: present every layout/click sequence, inspect speaker notes distribution, build under the actual host base, and navigate a direct slide URL.
4. Export representative PDF/PNG/PPTX pages; inspect fonts, overflow, assets, code contrast, click count and notes. Assess editable PPTX with its intended recipient's software; do not promise browser-perfect editable output.
5. Pin reproducibility through the real package lock and CI browser setup. A dependency range or upstream example is not observed execution evidence. See [testing](testing.md).

### Observed Slidev 53 tooltip boundary

With CLI/client **53.0.0**, `@shikijs/vitepress-twoslash` **4.5.0** and `floating-vue` **5.4.0**, Chromium initialization logged `Failed to patch FloatingVue`: a caught `TypeError` reading `Popper`. The client installs this plugin unconditionally; its patch expects `VMenu.components.Popper.extends`, but the registered component has no `components` object. Deck rendering, the counter and the active-slide timer worked; this does **not** certify tooltip/drag interoperability or clean startup. Do not suppress the error, fabricate component options, or force an older FloatingVue outside the client's declared `^5.4.0` range. Inspect the installed artifacts and an upstream-compatible fix before claiming that boundary resolved. [Client setup](https://unpkg.com/@slidev/client@53.0.0/setup/main.ts), [patch implementation](https://unpkg.com/@shikijs/vitepress-twoslash@4.5.0/dist/client.mjs), [client dependency contract](https://unpkg.com/@slidev/client@53.0.0/package.json).


## Sources

- [VitePress 1.6.4 exact package](https://unpkg.com/vitepress@1.6.4/package.json), [site configuration](https://vitepress.dev/reference/site-config), [default theme configuration](https://vitepress.dev/reference/default-theme-config), [theme API](https://vitepress.dev/guide/custom-theme).
- [VitePress SSR compatibility](https://vitepress.dev/guide/ssr-compat), [asset handling](https://vitepress.dev/guide/asset-handling), [data loading](https://vitepress.dev/guide/data-loading), [routing](https://vitepress.dev/guide/routing).
- [Slidev 53.0.0 exact package](https://unpkg.com/@slidev/cli@53.0.0/package.json), [CLI](https://sli.dev/builtin/cli), [frontmatter configuration](https://sli.dev/custom/), [syntax](https://sli.dev/guide/syntax), [exporting](https://sli.dev/guide/exporting), [hosting](https://sli.dev/guide/hosting).
- Auxiliary example pins: [default theme 0.25.0 metadata](https://unpkg.com/@slidev/theme-default@0.25.0/package.json), [playwright-chromium 1.64.1 metadata](https://unpkg.com/playwright-chromium@1.64.1/package.json). Resolve browser binaries from that installed Playwright package rather than independently selecting a Chromium revision.
