# Vuetify 4 themes, defaults, typography, and CSS

Read when changing color modes, semantic tokens, component defaults, density, fonts, Sass settings, or Vuetify 3 styles. **Baseline: Vuetify 4.3.0 with Vue 3.5.44.** Setup/imports/adapters belong in [vuetify-setup.md](vuetify-setup.md); layout and interactions belong in [vuetify-components.md](vuetify-components.md). For product-level design and accessibility, use [design-system.md](design-system.md) and [accessibility.md](accessibility.md).

For an existing or explicitly selected OpenVue surface, use [OpenVue theming](openvue-theming.md) for presets/tokens, pass-through, dark selectors, portal scope and CSS layers. Vuetify theme variables and defaults are not OpenVue contracts; choose the owning UI system before changing application-wide styles.

## Put the change in the owning layer

| Change | Mechanism | Lifetime |
| --- | --- | --- |
| Light/dark mode, semantic palette, theme opacity variables | `createVuetify({ theme })`, `useTheme()` | Runtime; generated CSS custom properties |
| Repeated supported props, such as variant/density | `defaults` or `VDefaultsProvider` | Runtime, scoped component configuration |
| Local markup and content | Public slots/composition | Component rendering; preserve provided behavior props |
| Supported font CSS variables | `--v-font-body`, `--v-font-heading` | Runtime inheritance |
| Compiled typography scale, geometry, framework utility generation | `vuetify/settings` Sass configuration | Build time |
| App-specific layout or presentation not exposed above | App CSS in deliberate layers | CSS cascade |

These are tools with overlapping effects, not mutually exclusive property ownership laws. Props can select a compiled size; CSS can consume runtime tokens. Prefer the supported public API that expresses the design intent. A CSS layer does not replace a Sass variable or mixin. Vuetify 4 still ships Sass source. [4.3 settings](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/styles/settings/_variables.scss).

## Define semantic light and dark themes

Complete replacement plugin module for a Vite app using component auto-imports:

```ts
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#F7F9FC',
          surface: '#FFFFFF',
          primary: '#174EA6',
          'on-primary': '#FFFFFF',
          secondary: '#386A66',
          'on-secondary': '#FFFFFF',
          error: '#B3261E',
          'on-error': '#FFFFFF',
        },
      },
      dark: {
        dark: true,
        colors: {
          background: '#101318',
          surface: '#1A1E25',
          primary: '#AEC6FF',
          'on-primary': '#002F65',
          secondary: '#A0CFCA',
          'on-secondary': '#003733',
          error: '#F2B8B5',
          'on-error': '#601410',
        },
      },
    },
  },
  defaults: {
    VBtn: { rounded: 'lg', variant: 'flat' },
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
    VCard: { elevation: 1 },
  },
})
```

Unspecified keys merge with Vuetify's corresponding light/dark defaults. Add semantic roles to **both** modes rather than sprinkling raw colors throughout templates. `on-primary` is text/icon color **on** the primary background; it is not another shade of primary. Vuetify generates missing `on-*` colors, but automatic generation is not a substitute for checking contrast in real states. Status must not be communicated by color alone.

`color="primary"`, `class="bg-primary"`, and `class="text-primary"` consume the same role differently: component color behavior depends on variant; a background utility also sets its matching foreground. CSS uses `rgb(var(--v-theme-primary))`. The stored value is a channel list, possibly including alpha, **not** a hex color. Do not assign `--v-theme-primary: #174EA6` and then expect `rgb(var(...))` to work. Prefer theme configuration over directly replacing generated tokens. [Theme implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/theme.ts).

### Generated shades, variables, and TypeScript boundaries

`theme.variations: { colors: ['primary'], lighten: 2, darken: 2 }` generates `primary-lighten-1`/`-2` and `primary-darken-1`/`-2` for configured themes. These semantic shades are **not** the separate Material palette color pack (`bg-blue-darken-1`); a `bg-success-lighten-4` utility exists only if that role/shade is defined or generated. Import palette constants from `vuetify/util/colors` when intentionally using that palette in configuration. Inspect generated colors rather than assuming the generator preserves an explicitly supplied same-named shade.

Theme `variables` controls supported values such as `'border-color'` and `'border-opacity'`; use the framework's variable names and intended value types. Custom color keys already work: `ThemeDefinition` is a type alias and `Colors` has a string index signature in 4.3. **Do not redeclare `interface ThemeDefinition`** to narrow color names. For an application palette, define a local union/record and check its complete keys with `satisfies Record<AppColor, string>`, then pass that palette into theme configuration; this constrains app-owned tokens without claiming arbitrary component `color` strings become a closed union.

For CSP, set `theme.cspNonce` from the request nonce and keep it identical for server-delivered/generated theme styles. `stylesheetId` defaults to `vuetify-theme-stylesheet`; a custom ID must match SSR serialization. Independent embedded apps can deliberately use different `stylesheetId` values and a `scope` CSS selector; scope limits generated selectors with `:where(...)`, it does not rename the `--v-theme-*` tokens. `utilities: false` disables generated theme utility classes, not the theme variables or all compiled framework helpers. `theme: false` disables theme generation entirely; it requires an intentional external styling strategy, not a fix for a missing stylesheet. [Exact theme options and generation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/theme.ts).

### Switch mode through the 4.3 methods

Complete root SFC, mounted with the plugin above:

```vue
<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useTheme } from 'vuetify'
import { VApp } from 'vuetify/components/VApp'
import { VMain } from 'vuetify/components/VMain'
import { VContainer } from 'vuetify/components/VGrid'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard, VCardText } from 'vuetify/components/VCard'
import { VThemeProvider } from 'vuetify/components/VThemeProvider'

const theme = useTheme()
const changing = shallowRef(false)
const isDark = computed(() => theme.current.value.dark)
const nextAction = computed(() => isDark.value ? 'Use light theme' : 'Use dark theme')

async function toggleTheme() {
  if (changing.value) return
  changing.value = true
  try {
    await theme.toggle(['light', 'dark'])
  } finally {
    changing.value = false
  }
}
</script>

<template>
  <VApp>
    <VMain>
      <VContainer>
        <h1 class="text-headline-large">Theme preview</h1>
        <VBtn class="my-4" :disabled="changing" @click="toggleTheme">
          {{ nextAction }}
        </VBtn>
        <VCard title="Current mode">
          <VCardText>{{ isDark ? 'Dark' : 'Light' }} theme is active.</VCardText>
        </VCard>
        <VThemeProvider theme="dark" with-background>
          <section class="pa-4 mt-4" aria-label="Fixed dark preview">
            <VBtn color="primary">Dark preview action</VBtn>
          </section>
        </VThemeProvider>
      </VContainer>
    </VMain>
  </VApp>
</template>
```

In 4.3, `change(name, transition?)`, `toggle([first, second]?, transition?)`, and `cycle(names?, transition?)` return `Promise<void>`. Use `await theme.change('system')` to restore OS preference following, or a registered name to pin a mode. `name` and `current` are readonly public reads; `isSystem` distinguishes following the OS from merely resolving to light/dark. An unknown name warns and leaves the theme unchanged. Keep cycle lists nonempty.

**Do not teach** `theme.global.name.value = 'dark'` as the current write API: the 4.3 implementation explicitly deprecates that setter. A `dark` prop or `class="dark"` is not the Vuetify 4 theme API. For a local region, use the supported `theme="dark"` prop or `VThemeProvider`; `with-background` supplies a themed DOM wrapper, useful for non-Vuetify children. A local theme override does not change the app's chosen global mode. [Exact 4.3 methods and provider](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/theme.ts).

Vuetify 4 defaults to `defaultTheme: 'system'`; the examples pin light intentionally. With custom names, use an explicit pair in `toggle()`; `system` resolves built-in `light`/`dark`, not arbitrary brand theme names. For SSR, serialize the same initial preference to server and client; see [vuetify-setup.md](vuetify-setup.md).

Theme view transitions are optional. The 4.3 methods accept a transition boolean/options; `setTransitionOrigin(elementOrPointerEvent)` can anchor it. The implementation falls back to an immediate change without View Transitions support or with reduced motion. Keep essential state feedback independent of animation; the returned promise is not a guarantee that every visual animation has finished.

## Defaults, density, and scoped policy

Use component-specific defaults for differences between component families. A blanket `global.density` also reaches controls that may need larger touch targets. Supported density values are `default`, `comfortable`, and `compact`; they are not numeric and are not the same as a component's `size` prop. Do not assume compact density meets touch/accessibility requirements.

Contextual template fragment inside an installed Vuetify application; import `VDefaultsProvider`, `VCard`, and `VBtn` from their component groups when not using auto-imports:

```vue
<VDefaultsProvider :defaults="{ VBtn: { color: 'secondary', variant: 'tonal' } }">
  <VCard title="Secondary actions" class="pa-4">
    <VBtn>Inherited tonal action</VBtn>
    <VBtn color="primary" variant="outlined" class="ms-2">Explicit action</VBtn>
  </VCard>
</VDefaultsProvider>
```

Scoped defaults merge with ancestors; ordinary explicit instance props override defaults. `class`/`style` have merge semantics rather than replacing all inherited classes/styles. Put them on component keys, not `defaults.global`. Vuetify 4's merging skips `undefined`; use an appropriate explicit value or `null` when clearing an inherited setting is supported. Do not pass `null` indiscriminately to required component props. `reset`, `root`, and `disabled` on `VDefaultsProvider` change inheritance intentionally; use them only when the subtree is meant to break normal cascading. [Defaults guide](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/features/global-configuration.md).

### Blueprints, aliases, and defaults-aware wrappers

`md1`, `md2`, and `md3` from `vuetify/blueprints` are configuration presets, not a separate runtime or a complete v3 compatibility mode. `createVuetify` merges explicit options over the blueprint. Keep compiled utilities enabled when using a blueprint. Choose one deliberately for the incumbent design; do not add `md3` merely to imply every MD3 feature requires a blueprint.

Complete alternative plugin module creating a distinct application button policy without changing every `VBtn`:

```ts
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { md2 } from 'vuetify/blueprints'
import { VBtn } from 'vuetify/components/VBtn'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export const vuetify = createVuetify({
  blueprint: md2,
  aliases: { AppAction: VBtn },
  defaults: { AppAction: { color: 'primary', variant: 'tonal' } },
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  theme: { defaultTheme: 'light' },
})
```

`<AppAction>` is a globally registered virtual component; its defaults use **the alias key**, not only `VBtn`. Auto-importing arbitrary aliases needs the build plugin's matching alias configuration, or rely on this explicit registration rather than assuming its name is discoverable. A behavior-owning Vue wrapper remains preferable when a prop preset is insufficient.

For a custom component that should consume Vuetify defaults, call `useDefaults(declaredProps, 'AppPanel')` in setup and read **the returned proxy**, not the original props object. `useDefaults(['VBtn'])` is not a component-defaults lookup API. Explicit instance props win, then named defaults, then global defaults, then declared prop defaults. Calling `useDefaults()` also provides nested component defaults for descendants; avoid using it outside setup or before plugin installation. Keep the component name stable and declare actual supported props. [Defaults implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/defaults.ts), [alias installation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/framework.ts), [blueprint contract](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/features/blueprints.md).

## Typography and elevation are MD3 scales

Use semantic HTML headings independently of typography classes: an `h1` can have `text-headline-large`; a `div` with that class is not a heading. Vuetify 4's type roles are `display-*`, `headline-*`, `title-*`, `body-*`, and `label-*`, each with large/medium/small sizes. Typography classes do not load font files.

| Previous Vuetify 3 utility | Vuetify 4 role to inspect |
| --- | --- |
| `text-h1`, `text-h2`, `text-h3` | `text-display-large`, `-medium`, `-small` |
| `text-h4`, `text-h5`, `text-h6` | `text-headline-large`, `-medium`, `-small` |
| `text-subtitle-1`, `text-body-1` | `text-body-large` |
| `text-body-2`, `text-caption` | `text-body-medium`, `text-body-small` |
| `text-button`, `text-subtitle-2`, `text-overline` | `text-label-large`, `text-label-large`, `text-label-small` |

The table follows the tagged typography guide's **role-oriented quick reference**, not its conservative size mapping. For size-preserving migration inspect `text-h2` → `text-display-large`, `text-h3` → `text-display-medium`, `text-h5` → `text-headline-small`, `text-h6` → `text-title-large`, `text-subtitle-2` → `text-title-small`, and `text-overline` → `text-label-medium`; v3's 96px `text-h1` needs a custom variant. The same tagged docs contain both mappings, so do not apply the quick table as an automatic visual-equivalence codemod. [4.3 conservative mapping](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/getting-started/typography-migration.md#conservative-migration-mapping).

The mapping is a migration starting point, not a guarantee of identical metrics. Check wrapping, truncation, hierarchy, and translated copy. `--v-font-body` and `--v-font-heading` are supported runtime font-family hooks in the default Sass settings. To use platform fonts intentionally, this is complete app CSS:

```css
:root {
  --v-font-body: system-ui, sans-serif;
  --v-font-heading: system-ui, sans-serif;
}
```

A custom Sass `$body-font-family` can replace that hook, so inspect compiled settings before assuming the runtime variable still applies. [Typography and font source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/styles/settings/_variables.scss).

The default elevation CSS defines **0–5**, not Vuetify 3's 0–24. Choose semantic surface depth rather than carrying old numbers forward. The prop validator still accepts nonnegative numbers for legacy custom scales; acceptance by the prop is not proof that an `elevation-12` class has a default shadow. Elevation also affects surface overlays in dark mode. [Shadow scale](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/styles/settings/_elevations.scss), [prop implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/elevation.ts).

## Utility grammar and responsive presentation

Use generated helpers for repeated presentation rather than inventing plausible class names:

| Need | Current grammar and boundary |
| --- | --- |
| Space | `{m|p}{a|x|y|t|b|s|e}-{0..16}`; default step is 4px, so `pa-4` is 16px. `ms-*`/`me-*` follow RTL; `ml-*`/`mr-*` are physical. Margin also has `auto` and negative `n1`–`n16`. |
| Responsive visibility | `d-none d-md-flex` changes at the compiled md threshold; CSS hiding is not authorization. Do not hide the only copy of an essential action without an equivalent. |
| Flex arrangement | Add `d-flex` then `flex-column`, `flex-wrap`, `justify-space-between`, `align-center`, or `align-self-start`. Responsive examples: `flex-md-row`, `order-md-2`. Axis meaning depends on direction, not “left”/“top”. |
| Size/overflow | `w-25/33/50/66/75/100`, responsive forms such as `w-md-33`, `h-100`, `h-screen` (100dvh), `overflow-y-auto`; percentage height needs a sized containing block. `fill-height` is 100% of its containing block, not 100vh, and does not itself center content. Use grid props or explicit CSS for fractions outside the generated set. |
| Text | `text-start`/`text-end`, `text-md-center`, `text-uppercase`, `text-decoration-underline`, `text-medium-emphasis`; do not use opacity/emphasis to encode disabled behavior or remove contrast. |

These classes require the utilities stylesheet/build settings that generate them. Disable selected utility families with the Sass `$utilities` map; helpers such as elevation, hidden, sr-only, and pointer-events are controlled by `$misc`. If a helper does nothing, inspect loaded CSS and generated rules before adding specificity. MD3 typography and the 0–5 shadow scale above are separate from arbitrary CSS sizes. [Utility definitions](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/styles/settings/_utilities.scss), [spacing and misc settings](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/styles/settings/_variables.scss).

## Cascade layers: order before specificity

The 4.3 framework declares these layers in order:

1. `vuetify-core` (`reset`, `base`).
2. `vuetify-components`.
3. `vuetify-overrides` for contextual component overrides.
4. `vuetify-utilities` (theme base, typography, helpers, theme backgrounds, theme foregrounds).
5. `vuetify-final` (transitions and trumps).

For normal declarations, later layers beat earlier ones, and **unlayered** author CSS beats layered author CSS regardless of selector specificity. Important declarations reverse layer priority. Do not assume a class in a scoped SFC automatically belongs to the component's framework layer. [Exact layer declarations](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/styles/generic/_layers.scss).

Complete unbundled `public/layers.css` example defining intentional top-level **and nested** order:

```css
@layer vuetify-core, app-base, vuetify-components, vuetify-overrides,
  app-overrides, vuetify-utilities, vuetify-final;
@layer vuetify-core {
  @layer reset, base;
}
@layer vuetify-utilities {
  @layer theme-base, typography, helpers, theme-background, theme-foreground;
}
@layer vuetify-final {
  @layer transitions, trumps;
}

@layer app-base {
  .page-title { max-inline-size: 30ch; }
}

@layer app-overrides {
  .account-panel { border-inline-start: 3px solid rgb(var(--v-theme-primary)); }
}
```

Link this file first in `index.html`'s head, before other stylesheets or module scripts; use the app's public base path when not deployed at `/`:

```html
<link rel="stylesheet" href="/layers.css">
```

Do not rely on a JavaScript import or a bundled CSS `@import` to establish first delivery. Load the order declaration before framework/component styles first establish layer order. Later declarations cannot reorder already-created layers. The nested declarations also prevent early generated theme CSS from fixing `theme-background`/`theme-foreground` ahead of typography/helpers. In this example Vuetify utilities intentionally beat `app-overrides`; place an app layer later only if it should win. Inspect the winning rule and layer before adding `!important` or an internal-element selector. Utility precedence is not an excuse to remove focus styles. [4.3 custom layer loading](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/styles/layers.md#custom-layer-order).

For a translucent role, use `color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent)` rather than assuming the stored channel list contains exactly three channels. For Tailwind/UnoCSS coexistence, map the installed framework's reset and utility layers explicitly; do not paste legacy `@tailwind` syntax into a different major version. For OpenVue-specific layer/reset ownership see [OpenVue theming](openvue-theming.md#css-layers-resets-and-motion); [Quasar](alternative-ui.md) has its own incumbent styling route.

## Sass remains the compile-time path

Install `sass@1.106.0` for this pinned recipe. Vite uses the preprocessor directly; `sass-loader` is a Webpack requirement, not an extra Vite requirement. Configure one settings file through the Vuetify build plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    vuetify({ styles: { configFile: 'src/styles/settings.scss' } }),
  ],
})
```

```scss
// src/styles/settings.scss
@use 'vuetify/settings' with (
  $body-font-family: (system-ui, sans-serif),
  $heading-font-family: (system-ui, sans-serif),
  $button-border-radius: 12px,
  $button-text-transform: none,
);
```

Keep `import 'vuetify/styles'` in the JavaScript plugin/entry: `vite-plugin-vuetify` redirects global and component CSS imports to configured Sass. For a deliberately Sass-generated global entry prefer `@use 'vuetify'`; `vuetify/settings` configures variables without generating a second framework stylesheet. The 4.3 export map includes a Sass target for `vuetify/styles`, and the tagged style-entry guide permits that spelling, while the tagged Sass guide still warns about resolver-dependent precompiled CSS. Do not claim the Sass entry was removed; this recipe avoids that resolution ambiguity. [4.3 style entry points](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/styles/entry-points.md#from-sass), [plugin 2.1.3 implementation](https://unpkg.com/vite-plugin-vuetify@2.1.3/dist/index.mjs).

Settings are loaded before many component stylesheets, so put only configuration/functions/mixins there, **not emitted selectors** that would be duplicated. Use a separate app stylesheet for CSS rules. To consume configured values elsewhere, `@forward 'vuetify/settings' with (...)` from the settings module and `@use` that local module. Keep comma-separated Sass values parenthesized. Sass customization recompiles framework styles and increases build work; do not enable it merely to change a theme color available at runtime. [Tagged Sass guide](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/features/sass-variables.md).

## Material Vuetify 3-to-4 traps

- Default theme changed from light to system; theme writes should use `change()`/`toggle()`, not the deprecated legacy setter.
- Grid uses CSS gap rather than v3 negative margins/column padding. Remove compensating gutter hacks deliberately. `dense`, alignment/order props remain deprecated compatibility inputs in 4.3; use `density` and utility classes in new code.
- Breakpoints changed: `sm 600`, `md 840`, `lg 1145`, `xl 1545`, `xxl 2138`. If preserving old thresholds, configure both runtime `display.thresholds` **and** Sass `$grid-breakpoints`; changing only one makes JS and CSS disagree.
- The global reset is reduced: bare inputs/buttons and ordinary headings/lists may regain browser styling. Reset only the intended app surface, not every third-party widget.
- Buttons no longer uppercase labels by default. Express casing as a design decision, not assumed material behavior.
- `VForm` slot state is unwrapped in 4; do not append `.value` to slot `isValid`. `VSelect`'s `item` slot still exists, but `item` is the raw application item and `internalItem` is the normalized wrapper; do not claim the slot itself was renamed.
- `VSnackbar`'s old `multi-line` prop is not the 4.3 sizing API; use layout/minimum height as needed. Component interactions and current import status are in [vuetify-components.md](vuetify-components.md).

Do not copy a v3 compatibility stylesheet wholesale into a greenfield v4 app. For an authorized migration, inventory the incumbent uses and compare before/after behavior rather than claiming all old snippets work. [4.3 upgrade guide](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/getting-started/upgrade-guide.md).

### Incumbent legacy-style restoration

When a narrow task must preserve v3 presentation, use the corresponding **4.3 tagged migration recipe**, scoped to the migrating surface, instead of reproducing old internal selectors blindly:

- Restore old JS thresholds with `display.thresholds` and the same Sass `$grid-breakpoints`; preserve container widths separately with `$container-max-widths` if required. `VContainer fluid` removes the breakpoint max-width policy.
- For legacy gutters, disable gap on the affected `.v-row`, apply negative half-gaps as row margins and positive half-gaps as `.v-col` padding, then restore percentage flex sizing and offsets. Put these overrides in `vuetify-overrides`. Current classes are `.v-col--cols-*` and `.v-col--offset-*`; the runtime CSS variables are `--v-col-gap-x/y` and the column size/base variables. Prefer the supported gap layout unless actual migration requirements demand restoration.
- Restore legacy typography or 0–24 shadows through the respective Sass typography/elevation maps, not nonexistent default classes. Compare visual hierarchy, shadow overlays, and density before preserving old numeric values. [Typography migration](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/getting-started/typography-migration.md), [elevation migration](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/getting-started/elevation-migration.md).
- Restore reduced browser reset effects only inside the intended app surface with explicit margins/padding for headings/lists/native controls. Do not reset all third-party widgets globally.
- `VContainer`'s `fill-height` no longer centers content: add `d-flex align-center flex-wrap` plus horizontal alignment where required. `VSnackbarQueue` now uses its `item` slot for per-message content and supports simultaneous messages; do not carry over an old `default` slot contract.
- Audit Sass renames: `$button-stacked-icon-margin` → `$button-stacked-gap`; details padding for text/file/radio fields → `$input-details-padding-inline`; `$counter-color` is replaced by opacity; `$form-grid-gutter` → `$grid-density`, while `$grid-gutters` is removed. Inspect every retained override against current component settings rather than assuming compile success means visual equivalence.

Complete compatibility CSS for a region wrapped in an application-owned `.legacy-grid` element; it preserves the current column flag mechanism and offset denominator:

```css
@layer vuetify-overrides {
  .legacy-grid .v-row {
    gap: unset;
    margin: calc(var(--v-col-gap-y) * -.5) calc(var(--v-col-gap-x) * -.5);
  }
  .legacy-grid .v-row + .v-row {
    margin-top: calc(var(--v-col-gap-y) * .5);
  }
  .legacy-grid .v-col {
    padding: calc(var(--v-col-gap-y) * .5) calc(var(--v-col-gap-x) * .5);
    flex-basis: var(--v-col-is-size, calc(100% * var(--v-col-size) / var(--v-col-size-columns)))
      var(--v-col-is-auto, auto) var(--v-col-is-grow, 0);
  }
  .legacy-grid .v-col:where([class*='v-col--offset-']) {
    margin-inline-start: calc(100% * var(--v-col-offset) / var(--v-col-offset-columns));
  }
}
```

The flag variables deliberately substitute empty whitespace or activate one fallback; the resulting `flex-basis` is one value, not three ordinary CSS values. Do not simplify away that mechanism. This recipe relies on 4.3 internal grid CSS: review it again during upgrades and check sized/auto/growing/offset/nested columns. [Tagged recipe](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/getting-started/grid-legacy-mode.md), [actual grid flag implementation](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VGrid/VGrid.sass).

Migration tooling can help inventory incumbent uses, but neither a scanner nor this source-informed recipe establishes runtime equivalence. Keep behavioral/accessibility checks separate from mechanical renames.

## Evidence and checks to perform

Configuration and examples were authored against the 4.3 tagged source and exact package declarations. They have not been presented as executed visual, build, or accessibility tests. After integration, inspect both modes, focus/disabled/error states, contrast, text scaling, RTL, actual font loading, cascade winners, hydration, and reduced-motion behavior. Use the same persisted initial mode on server/client; do not let a visual-only preview mutate user preferences.

## Sources

- [Vuetify 4.3.0 metadata](https://registry.npmjs.org/vuetify/4.3.0), [Vue 3.5.44](https://registry.npmjs.org/vue/3.5.44), [Sass 1.106.0](https://registry.npmjs.org/sass/1.106.0).
- [4.3 theme source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/theme.ts), [theme guide](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/features/theme.md).
- [4.3 defaults](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/composables/defaults.ts), [layer source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/styles/generic/_layers.scss), [Sass settings](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/styles/settings/_variables.scss).
- [4.3 migration guide](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/getting-started/upgrade-guide.md), [MDN cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer).
