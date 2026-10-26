# VitePress documentation sites

Read when building a VitePress documentation site. VitePress owns its Vue application, routing, build and hydration lifecycle; do not mount its theme inside a normal SPA or replace its entry with the application example's `createApp`. Inspect the existing docs package, lockfile, content root, theme, hosting base and scripts first. See [tooling](setup-tooling.md), [components](components.md), and [SSR debugging](debugging-ssr.md).

## Release and lifecycle boundaries

| Tool | Pinned release | Boundary |
| --- | --- | --- |
| `vitepress` | **1.6.4** | Stable documentation generator; Node build pre-renders Markdown as Vue pages, then hydrates/navigation runs in browser |
| Vue | **3.5.44** baseline | VitePress 1.6.4 depends on Vue `^3.5.13` |

VitePress 1.6.4 depends on Vite `^5.4.14`. Do not force the application's Vite 8 plugins into VitePress 1.x. A v2 prerelease is not the stable 1.6.4 API. Choose one package manager and preserve VitePress's dependency graph; a separate workspace package is often the clearest ownership boundary. The repository's Node 24 baseline is suitable for VitePress's Node 18+ requirement; dependency installation/build behavior still needs verification in the actual lockfile. [VitePress metadata](https://unpkg.com/vitepress@1.6.4/package.json).

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

- Relative Markdown image links and imported theme assets enter Vite's asset pipeline and receive rewritten URLs: emitted files are hashed, while sufficiently small assets may be inlined according to `vite.build.assetsInlineLimit`. Files in `docs/public/` are copied unchanged: reference them from root URL paths, never `/public/...`.
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

The link matches this example's `cleanUrls: false`; adjust for the host's actual route policy. In 1.6.4, a loader's `ContentData.url` excludes `base` and is derived from the **source path**, not `rewrites`. Map rewritten routes explicitly before applying `withBase` to generated links. `defineLoader({ watch, load })` handles non-Markdown data; `createContentLoader` handles Markdown globs relative to `srcDir`, with `includeSrc`, `render`, `excerpt`, and `transform` selecting shipped data. Avoid returning full source/HTML when only title/URL is needed; if customizing glob ignores, preserve exclusions for generated output and dependencies. [Exact client API](https://unpkg.com/vitepress@1.6.4/dist/client/index.d.ts), [exact Node API](https://unpkg.com/vitepress@1.6.4/dist/node/index.d.ts), [1.6.4 loader URL construction](https://github.com/vuejs/vitepress/blob/v1.6.4/src/node/contentLoader.ts).

### Default-theme navigation, search and localization

Use a path-keyed `sidebar` map for multiple sections; each item can set `base`, `items`, `link`, and `collapsed`. `collapsed: false` means collapsible but initially open; unset is noncollapsible. Nav `activeMatch` is a serialized regex **string**, not `RegExp`. Theme `logo` accepts light/dark variants with alt text, while `siteTitle: false` hides only the navbar title. `outline: { level: [2, 3], label: 'On this page' }`, `editLink`, `lastUpdated`, `docFooter`, `footer`, `socialLinks` and localized control labels belong to `themeConfig`; home `hero`/`features` belong to page frontmatter.

Local search (`provider: 'local'`) builds and ships its index without an external search account; it does not enforce access control. Keep search local in this skill's service-independent scope. Locale content paths and `locales` need corresponding translated navigation/search labels, not just a language selector. `i18nRouting` defaults to translating the URL prefix; disable it when content URLs do not share that structure. No implicit Vue I18n installation is involved.

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
          const html = md.render(src, env)
          return env.frontmatter?.search === false ? '' : html
        },
      },
    },
  },
})
```

A custom `_render` must render **before** reading `env.frontmatter`: Markdown rendering populates it; the hook initially receives only path metadata. Then preserve the `search: false` exclusion itself. `miniSearch.options`/`searchOptions` tune matching; per-locale options/translations must match indexed language content. Do not index secrets and expect an exclusion flag to protect published HTML. [Exact indexing order](https://github.com/vuejs/vitepress/blob/v1.6.4/src/node/plugins/localSearchPlugin.ts), [exact theme types](https://unpkg.com/vitepress@1.6.4/types/default-theme.d.ts), [search](https://vitepress.dev/reference/default-theme-search), [locales](https://vitepress.dev/guide/i18n).

### Markdown authoring and 0.x migration

Use the **VitePress** syntax below. These are contextual Markdown fragments, not complete additional pages:

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

On 0.x migration, rename sidebar `children` to `items` and `collapsible` to `collapsed`; migrate old group shapes rather than rejecting valid v1 `SidebarItem.link`. Replace `pathname://` links with explicit `target` policy, `Router.onAfterRouteChanged` with `onAfterRouteChange`, theme `outlineTitle` with `outline.label`, `lastUpdatedText` with `lastUpdated.text`, and local-search `disableDetailedView` with `detailedView: false`. `Theme.setup` becomes layout setup; `Theme.NotFound` becomes a `page.isNotFound` branch in Layout (or a supported default-layout slot). `appearance: 'force-auto'` follows system appearance without a normal user toggle. VitePress 1.6.4 reports `rolldown-vite` as incompatible after starting its dev server; a listening port is therefore not compatibility evidence. Changing that graph requires a separately planned VitePress 2 migration, not an override under 1.x. [Exact CLI diagnostic](https://github.com/vuejs/vitepress/blob/v1.6.4/src/node/cli.ts#L50-L59), [tagged Markdown guide](https://github.com/vuejs/vitepress/blob/v1.6.4/docs/en/guide/markdown.md), [0.x migration](https://vitepress.dev/guide/migration-from-vitepress-0).

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

## Verification boundary

The [verification record](../assets/verification.json) separates recorded checks from consuming-project obligations. The VitePress workflows below are verification requirements, not claims of newly exercised browser behavior.

1. VitePress: production build and preview at the real base; direct URL reload; no Node browser-global crash; no hydration warning; links, image paths, search, keyboard navigation and mobile sidebar work.
2. Verify the pre-rendered HTML includes meaningful headings/content without JavaScript. Check dynamic loaders contain no secrets and their links resolve under base/rewrites.
3. Pin reproducibility through the real package lock and CI runtime setup. A dependency range or upstream example is not observed execution evidence. See [testing](testing.md).

## Sources

- [VitePress 1.6.4 exact package](https://unpkg.com/vitepress@1.6.4/package.json), [site configuration](https://vitepress.dev/reference/site-config), [default theme configuration](https://vitepress.dev/reference/default-theme-config), [theme API](https://vitepress.dev/guide/custom-theme).
- [VitePress SSR compatibility](https://vitepress.dev/guide/ssr-compat), [asset handling](https://vitepress.dev/guide/asset-handling), [data loading](https://vitepress.dev/guide/data-loading), [routing](https://vitepress.dev/guide/routing).
