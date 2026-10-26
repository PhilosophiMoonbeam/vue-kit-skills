# OpenVue theming, pass-through, icons, and presentation

Use with [OpenVue selection and architecture](openvue.md) and [Vite/Nuxt setup](openvue-setup.md). This reference targets `openvue` and `@openvue/themes` **1.0.0**, Vue 3.5, and the published styling engine **1.0.0** implementation. The theme package declares `@openuxkit/styled: ^1.0.0` and `@openuxkit/themes: ^1.1.0`, so preserve the lockfile: pinning the facade alone does not pin its engine or presets. Current documentation can describe later exports. Do not add another theme-engine package alongside `@openvue/themes` merely because a documentation example uses a different distribution. [Exact facade metadata](https://registry.npmjs.org/@openvue/themes/1.0.0).

## Choose the styling owner

| Requirement | Use | Ownership boundary |
| --- | --- | --- |
| Coherent styled suite | Aura, Material, Lara, or Nora preset; customize with `definePreset` | Application owns semantic decisions; base CSS stays library-owned. |
| One component instance differs | Its `dt` prop with component-relative tokens | Not a second application preset; no global mutation. |
| Add an internal attribute/class | Declared `pt` section | Read the exact component declaration; internal DOM and section names are not interchangeable. |
| Replace all presentation | Global `unstyled: true` or per-component `unstyled`, plus PT/CSS | Application owns every visual state, including focus, disabled, invalid, overlays and motion. Functionality/ARIA are not a complete visual design. |
| Utilities for layout around styled components | Optional Tailwind | Tailwind is not required by OpenVue. Align layers and dark selectors. |
| Own Tailwind-wrapped component source | Optional Volt source-owned wrappers | Wrappers belong in application source, not a second core component runtime. Review their props/events/slots and dependencies before adoption. |
| Produce a preset visually | Optional local designer export | Commit ordinary reviewed preset source. No hosted service, credentials, designer SDK or runtime designer dependency is needed. |

## Styled architecture: tokens before selectors

A theme pairs **base CSS** (rules consuming variables) with a **preset** (token values). Tokens have three tiers:

1. **Primitive**: context-free palettes and radii, such as `indigo.700` and `border.radius.md`.
2. **Semantic**: roles shared across components, such as `primary.color`, `form.field.border.color`, `text.color`, `content.background`, `overlay.modal.background`, and `focus.ring.width`.
3. **Component**: local roles such as `button.primary.background`; normally references semantic tokens. Global component overrides affect every instance; instance `dt` affects one instance.

Preset object keys use camelCase; token paths use dotted lowercase; generated variables use kebab case. `semantic.formField.hoverBorderColor` becomes `form.field.hover.border.color` and, with the default prefix, `--p-form-field-hover-border-color`. References are strings such as `'{primary.700}'`, not a JavaScript property lookup. Choose one `prefix` consistently; manually written `--p-*` CSS must change if the prefix changes. Do not use structural keys (`primitive`, `semantic`, `components`, `directives`, `colorScheme`, `light`, `dark`, `common`, `root`, `states`, `extend`, `css`) as arbitrary token names.

### Scheme precedence is structural

A preset can define a common token and scheme-specific values. Generated light/common declarations precede dark declarations; scheme-specific declarations override the corresponding common variable. Extending Aura with `semantic.primary.color` does **not** replace Aura's `semantic.colorScheme.light.primary.color` and `.dark.primary.color`. Mirror the original branch structure and review both schemes. Inside `semantic.colorScheme.light`, put `primary`, `highlight`, `formField`, etc. **directly**: do not add another nested `semantic`. Some authored documentation examples incorrectly add that extra level. Published Aura uses `contrastColor` / `primary.contrast.color`; do not copy examples that invent `inverseColor` for that role.

Prefer semantic overrides for cross-suite changes: `formField` propagates to input components, `overlay.modal` to modal surfaces, and `focusRing` to consumers that reference it. Per-component focus tokens may still override semantic defaults: inspecting one button does not prove input focus visibility. Noir is a preset variant, not a mode flag: map primary roles to appropriate surface shades in **both** schemes and set corresponding contrast/highlight roles.

### Complete preset module

`theme.ts` below customizes a built-in preset rather than copying a snapshot of all its components. It deliberately uses a darker light-mode primary shade with white text. Still measure the final foreground/background pair in every interactive state; palette names are not a contrast guarantee.

```ts
// theme.ts
import { definePreset, palette } from '@openvue/themes';
import Aura from '@openvue/themes/aura';

export const WorkbenchPreset = definePreset(Aura, {
    semantic: {
        primary: palette('{indigo}'),
        focusRing: { width: '2px', style: 'solid', offset: '3px' },
        colorScheme: {
            light: {
                primary: {
                    color: '{primary.700}', contrastColor: '#ffffff',
                    hoverColor: '{primary.800}', activeColor: '{primary.900}'
                },
                overlay: { modal: { background: '#ffffff', color: '{zinc.900}' } },
                highlight: { background: '{primary.50}', color: '{primary.900}' }
            },
            dark: {
                primary: {
                    color: '{primary.300}', contrastColor: '{zinc.950}',
                    hoverColor: '{primary.200}', activeColor: '{primary.100}'
                },
                overlay: { modal: { background: '{zinc.900}', color: '#ffffff' } },
                highlight: { background: '{primary.900}', color: '{primary.100}' }
            }
        }
    }
});

export const workbenchTheme = {
    preset: WorkbenchPreset,
    options: {
        prefix: 'p',
        darkModeSelector: '.app-dark',
        cssLayer: { name: 'openvue', order: 'reset, openvue, app' }
    }
};
```

**Release declaration limit:** the published `@openvue/themes@1.0.0/aura/index.d.ts` contains interfaces but no explicit default declaration, although the JavaScript exports the preset. Keep the supported default runtime import above; do not invent a named root preset export, patch node_modules, add an ambient shim, cast the import, or weaken strict checks. Validate the intended bundler/SSR TypeScript profile; absence of the declaration alone is not an observed compiler failure. The root package re-exports the styling API and `Preset` type, not named presets. Its dependency ranges also mean the lockfile, not just the direct package version, determines the engine/preset implementation.

## Runtime theme API: definition is not installation

Import these from `@openvue/themes`, not component config. The engine is **module-global**, not a separate Vue ref per component or app. A preset update changes every consumer sharing that module. Own runtime mutations at the application theme boundary; do not mutate global theme state from each field's setup/unmount.

| API in the released engine | Effect and safe use |
| --- | --- |
| `definePreset(...presets)` | Deep-composes token objects and returns a preset; does not install it. Later arguments override earlier values. |
| `usePreset(...presets)` | Composes/replaces the active **preset**, preserving the active theme options. Omitted tokens are not inherited from the previous preset; pass a complete built-in-based preset. |
| `updatePreset(...overrides)` | Deep-merges into the active preset and emits theme change. Use for exact branch updates rather than editing generated CSS variables. |
| `updatePrimaryPalette(palette)` | Updates `semantic.primary`. `palette('{blue}')` produces shades 50–950 as token references; a hex input produces a generated scale, not a contrast-validated design. |
| `updateSurfacePalette(palette)` | Updates surface palettes; a flat palette applies to both schemes. **1.0.0 source caveat:** the fluent helper falls back to the entire argument when a scheme key is absent. Avoid the docs' one-key `{ light: ... }` / `{ dark: ... }` shortcut. Update one branch with `updatePreset({ semantic: { colorScheme: { light: { surface: values } } } })`; or supply explicit light and dark palettes. |
| `useTheme({ preset, options })` | Replaces the preset through the fluent update path while merging supplied options with current options. Supply deliberate options, rather than assuming preset replacement resets selector/prefix/layer. |
| `$dt('primary.color')` | Returns `{ name, variable, value }`. `variable` is a CSS `var(...)` expression, not a resolved RGB color. `value` is declared `unknown`: it can be a literal or a light/dark structure with value/path metadata. It does not select a branch by reading the DOM or return a Vue ref. |
| `$t()` | Fluent builder: `.preset(...)`, `.options(...)`, `.primaryPalette(...)`, `.surfacePalette(...)`. `.define()` returns a theme without installing it; `.update()` merges with active theme by default; `.use({})` installs the built theme without those merge defaults. `define({ useDefaultPreset: true })` chooses the active preset instead of the builder's preset; it is not a promise to merge them. |

For actual painted color use `getComputedStyle(element).color` / `.backgroundColor`, or read the relevant inherited custom property and resolve it in CSS. Keep `$dt` diagnostic reads out of computed getters that assume theme changes are tracked by Vue. After your app-owned action updates the engine, explicitly refresh diagnostics if displayed. Do not parse unknown metadata with unchecked casts. `dt()` is a variable-expression utility; the component `dt` prop is a different API.

Contextual runtime fragment, after the plugin has installed the theme:

```ts
import { $dt, $t, palette, updatePreset, usePreset, useTheme } from '@openvue/themes';
import { WorkbenchPreset, workbenchTheme } from './theme';

const alternate = $t().preset(WorkbenchPreset).primaryPalette(palette('{blue}')).define();
// alternate has not changed the page.
useTheme({ ...alternate, options: workbenchTheme.options });
updatePreset({ semantic: { colorScheme: { light: { surface: { 0: '#ffffff' } } } } });
const primaryVariable = $dt('primary.color').variable;
usePreset(WorkbenchPreset); // resets tokens, retains configured selector/layer/prefix
```

`extend` can add application tokens and `css: ({ dt }) => ...` can emit rules consuming them. This is executable application source: never accept arbitrary theme CSS, selectors, token functions or PT objects from untrusted JSON. Validate any imported theme against a constrained schema and trusted base; URLs, CSS and function-shaped data are security boundaries. The optional designer exports ordinary `definePreset` source or JSON; review it against the **installed** token names and scheme structure. Its local storage, sharing and migration UI are tooling capabilities, not dependencies your app must adopt. Generated typography still belongs to application CSS, since components inherit fonts. `rem` follows the application's root font size; the documentation's density is not a library default to copy blindly.

## Application-owned dark preference, SSR, portals, and lifetime

`darkModeSelector` defaults to `system`, generating a media query. For a user preference use a selector such as `.app-dark`; the app resolves `light | dark | system` and toggles that selector. `false` / `'none'` disable dark generation at runtime; the engine's `ThemeOptions` declaration is narrower than the runtime support, so the complete example uses a declared string selector.

Put the class on **`html`**, not the app's content wrapper: Dialog/Select and other portals can render under `body`, outside that wrapper. Root direction, font and custom-property inheritance need the same review. Portaled content does not inherit arbitrary scoped ancestor CSS. `appendTo="self"` changes clipping/stacking behavior and is not a universal fix for theme scope. Instance `dt` generates an instance-selector stylesheet and cleans it up on unmount; it does not theme unrelated siblings or grant ancestor CSS access to detached portal roots.

The following controller is **client-only**, created once before mounting, disposed with the app. System changes are observed only while preference is `system`; explicit light/dark wins. It handles unavailable local storage without losing the current session preference. It is a plain application controller, not an OpenVue composable.

```ts
// theme-preference.ts
import { readonly, shallowRef } from 'vue';

export type ThemePreference = 'light' | 'dark' | 'system';

export function createThemePreference() {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const preference = shallowRef<ThemePreference>('system');
    const dark = shallowRef(false);
    const persistent = shallowRef(true);
    try {
        const saved = localStorage.getItem('workbench-theme');
        if (saved === 'light' || saved === 'dark' || saved === 'system') preference.value = saved;
    } catch {
        persistent.value = false;
    }
    function apply() {
        dark.value = preference.value === 'dark' || (preference.value === 'system' && media.matches);
        document.documentElement.classList.toggle('app-dark', dark.value);
        document.documentElement.dataset.themePreference = preference.value;
        document.documentElement.style.colorScheme = dark.value ? 'dark' : 'light';
    }
    function setPreference(value: ThemePreference) {
        preference.value = value;
        apply();
        try {
            localStorage.setItem('workbench-theme', value);
        } catch {
            persistent.value = false;
        }
    }
    function onSystemChange() {
        if (preference.value === 'system') apply();
    }
    media.addEventListener('change', onSystemChange);
    apply();
    return {
        preference: readonly(preference), dark: readonly(dark), persistent: readonly(persistent),
        setPreference,
        dispose: () => media.removeEventListener('change', onSystemChange)
    };
}

export type ThemePreferenceController = ReturnType<typeof createThemePreference>;
```

For SSR, do **not** run this browser controller during server setup. Read an application-owned validated cookie/request preference and render matching `html` class/`data-theme-preference`/`color-scheme`; hydrate using that serialized seed. With `system`, the server generally cannot know the client media query: choose a documented initial policy and resolve it in a CSP-authorized pre-paint bootstrap or accept a later scheme change. Do not render different content trees based on an uninitialized browser preference. Coordinate local storage versus cookie authority explicitly; this client-only example uses local storage, not an imaginary SSR-safe storage API.

Theme state, style-name caches, service listeners and config watchers live beyond an individual component. The released plugin installation clears shared config/theme-service listeners. Two independently installed apps are not isolated themed tenants merely because each uses `createApp`; installing the second can affect the first. Keep one plugin/theme owner per browser document. In a long-lived SSR worker, do not call runtime global theme mutators per concurrent request for tenant branding; use an immutable shared preset plus request-owned root scheme/attributes, or genuinely isolate rendering/module state. A per-request Vue app alone is not proof of isolation.

### CSP is a response contract

The server must generate a cryptographically random **new nonce per response**, include it in the response CSP and safely serialize the same value to the client. Set plugin `csp: { nonce }` before components/theme styles are loaded. This authorizes generated **style elements**, not arbitrary inline scripts, style attributes, external fonts, remote images or theme JSON. An example policy may separately permit same-origin scripts/styles and inline style attributes needed for overlay positioning; adapt to the application's actual threat model. Do not hardcode a nonce, derive it from user input, reuse a build-time value, or claim a nonce alone makes untrusted CSS safe. Verify dynamically injected styles after a runtime theme update, not only the initial HTML.

## Executable styled/PT workbench

This SFC owns only demonstration state: action counters, one controlled boolean Panel, one controlled modal Dialog and the active palette choice. The host supplies the single preference controller. It uses PT for meaningful test/description attributes without replacing library click/keydown handlers or generated `aria-expanded`, `aria-controls`, IDs and focus behavior. The scoped amber button keeps its token colors when the global palette changes.

```vue
<!-- ThemeWorkbench.vue -->
<script setup lang="ts">
import { shallowRef } from 'vue';
import { $dt, palette, updatePrimaryPalette, usePreset } from '@openvue/themes';
import CheckIcon from '@openvue/icons/check';
import Button from 'openvue/button';
import Dialog from 'openvue/dialog';
import Panel from 'openvue/panel';
import type { PanelPassThroughOptions } from 'openvue/panel';
import { WorkbenchPreset } from './theme';
import type { ThemePreferenceController } from './theme-preference';

const { preference } = defineProps<{ preference: ThemePreferenceController }>();
const visible = shallowRef(false);
const collapsed = shallowRef(false);
const actions = shallowRef(0);
const localActions = shallowRef(0);
const unstyledActions = shallowRef(0);
const activePalette = shallowRef('indigo');
const tokenVariable = shallowRef($dt('primary.color').variable);

function changePalette() {
    updatePrimaryPalette(palette('{blue}'));
    activePalette.value = 'blue';
    tokenVariable.value = $dt('primary.color').variable;
}
function resetPreset() {
    usePreset(WorkbenchPreset);
    activePalette.value = 'indigo';
    tokenVariable.value = $dt('primary.color').variable;
}
const panelPT: PanelPassThroughOptions = {
    root: { 'data-testid': 'details-panel' },
    header: ({ state }) => ({ 'data-collapsed': String(state.d_collapsed) }),
    pcToggleButton: { root: { 'data-testid': 'details-toggle', 'aria-describedby': 'panel-help' } },
    content: { 'data-testid': 'details-content' }
};
const localTokens = {
    colorScheme: {
        light: { root: { primary: {
            background: '{amber.700}', hoverBackground: '{amber.800}', activeBackground: '{amber.900}',
            borderColor: '{amber.700}', hoverBorderColor: '{amber.800}', activeBorderColor: '{amber.900}',
            color: '#ffffff', hoverColor: '#ffffff', activeColor: '#ffffff',
            focusRing: { color: '{amber.700}', shadow: 'none' }
        } } },
        dark: { root: { primary: {
            background: '{amber.200}', hoverBackground: '{amber.100}', activeBackground: '{amber.50}',
            borderColor: '{amber.200}', hoverBorderColor: '{amber.100}', activeBorderColor: '{amber.50}',
            color: '{amber.950}', hoverColor: '{amber.950}', activeColor: '{amber.950}',
            focusRing: { color: '{amber.200}', shadow: 'none' }
        } } }
    }
};
</script>

<template>
    <main class="theme-workbench">
        <h1>Theme workbench</h1>
        <fieldset class="preference-controls">
            <legend>Color preference</legend>
            <button type="button" :aria-pressed="preference.preference.value === 'light'" @click="preference.setPreference('light')">Light</button>
            <button type="button" :aria-pressed="preference.preference.value === 'dark'" @click="preference.setPreference('dark')">Dark</button>
            <button type="button" :aria-pressed="preference.preference.value === 'system'" @click="preference.setPreference('system')">System</button>
        </fieldset>
        <p id="scheme-status" role="status">{{ preference.dark.value ? 'Dark scheme' : 'Light scheme' }}; preference {{ preference.preference.value }}</p>
        <p v-if="!preference.persistent.value" role="status">Preference applies for this session; browser storage is unavailable.</p>
        <p id="action-help">Global action follows the application palette. Local action uses instance tokens.</p>
        <div class="theme-actions">
            <Button label="Global action" badge="2" :pt="{ root: { 'data-testid': 'global-action', 'aria-describedby': 'action-help' }, pcBadge: { root: { 'data-testid': 'action-badge' } } }" :pt-options="{ mergeSections: true, mergeProps: true }" @click="actions++">
                <template #icon="{ class: iconClass }"><CheckIcon :class="iconClass" /></template>
            </Button>
            <Button label="Local action" :dt="localTokens" :pt="{ root: { 'data-testid': 'local-action' } }" @click="localActions++" />
            <Button label="Use blue palette" @click="changePalette" />
            <Button label="Reset preset" @click="resetPreset" />
            <Button label="Preview portal" :pt="{ root: { 'data-testid': 'open-preview' } }" @click="visible = true" />
            <Button label="Unstyled action" unstyled :pt="{ root: { class: 'owned-button', 'data-testid': 'unstyled-action' }, label: { class: 'owned-button-label' } }" @click="unstyledActions++" />
        </div>
        <p id="action-counts">Global {{ actions }}; local {{ localActions }}; unstyled {{ unstyledActions }}</p>
        <p id="palette-status">Palette: {{ activePalette }}. CSS token: <code>{{ tokenVariable }}</code></p>
        <p id="panel-help">Toggle token details with Enter or Space; the component owns expanded state and focus behavior.</p>
        <Panel v-model:collapsed="collapsed" header="Token details" toggleable :pt="panelPT">
            <template #header><strong>Token details</strong></template>
            <p>Token details remain controlled by the Panel model. Collapsed: {{ collapsed }}.</p>
        </Panel>
        <Dialog v-model:visible="visible" modal header="Portal preview" appendTo="body" :draggable="false" :pt="{ root: { 'data-testid': 'preview-dialog', 'aria-describedby': 'preview-help' } }">
            <p id="preview-help">This body portal inherits the html theme, not only the main content wrapper.</p>
            <p>Current scheme: {{ preference.dark.value ? 'dark' : 'light' }}.</p>
            <Button label="Toggle preview scheme" @click="preference.setPreference(preference.dark.value ? 'light' : 'dark')" />
            <Button label="Close preview" @click="visible = false" />
        </Dialog>
    </main>
</template>
```

The complete host entry below is a **theming-specific entry**, not a replacement for the full Vite/Nuxt setup guide. The document response includes `<meta name="csp-nonce" content="...">` from the same server response that generated the CSP. The SVG icon import is deliberately a built-in icon package, not a font stylesheet dependency.

```ts
// main.ts
import { createApp } from 'vue';
import OpenVue from 'openvue/config';
import { usePassThrough } from 'openvue/passthrough';
import ThemeWorkbench from './ThemeWorkbench.vue';
import { workbenchTheme } from './theme';
import { createThemePreference } from './theme-preference';
import './theme.css';

const preference = createThemePreference();
const nonce = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content;
export const app = createApp(ThemeWorkbench, { preference });
app.use(OpenVue, {
    theme: workbenchTheme,
    csp: { nonce },
    pt: usePassThrough(
        { button: { root: { class: 'theme-control', 'data-owner': 'theme-system' } }, panel: { root: { class: 'theme-panel' } } },
        { button: { root: { 'data-scope': 'application' } } },
        { mergeSections: true, mergeProps: true }
    )
});
app.onUnmount(preference.dispose);
app.mount('#app');
```

## CSS layers, resets, and motion

Declare layer order **before** importing reset/base/utility styles or before their first layer occurrence; later order declarations cannot undo earlier creation order. For normal declarations, later layers win; unlayered normal app CSS outranks layered normal library CSS. `!important` has different, reversed layer precedence: do not describe layers as globally overriding all specificity. With `cssLayer: false` (default), normal unlayered library rules compete by specificity/order. With `cssLayer: true`, inherited engine naming can differ from the documentation's label; explicitly set `{ name: 'openvue', order: 'reset, openvue, app' }` rather than depending on it. CSS Modules can then add classes through component/PT bindings without resorting to specificity escalation.

A reset outside a layer can still override layered components, even if imported first. Wrap reset styles in `@layer reset`, keep component theme in `openvue`, and application corrections in `app` (or deliberate unlayered app rules). Do not load an obsolete compiled theme CSS file alongside the token preset. Token updates regenerate variables; a custom unlayered color rule can mask them and make a working runtime update appear broken.

Complete application stylesheet for the workbench:

```css
/* theme.css */
@layer reset, openvue, app;
@layer reset {
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; }
    button, input, textarea, select { font: inherit; }
}
@layer app {
    html { font-family: system-ui, sans-serif; }
    body { background: var(--p-content-background); color: var(--p-text-color); }
    .theme-workbench { max-inline-size: 64rem; margin-inline: auto; padding: 1.5rem; }
    .theme-actions, .preference-controls { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .preference-controls { margin-block: 1rem; border: 1px solid var(--p-content-border-color); padding: 1rem; }
    .preference-controls button { padding: 0.5rem 0.75rem; }
    .theme-control { touch-action: manipulation; }
    .theme-panel { margin-block-start: 1rem; }
    .owned-button { border: 2px solid currentColor; border-radius: 0.5rem; background: var(--p-content-background); color: var(--p-text-color); padding: 0.5rem 0.75rem; cursor: pointer; }
    .owned-button:hover { background: var(--p-content-hover-background); }
    .owned-button:active { transform: translateY(1px); }
    .owned-button:disabled { cursor: not-allowed; opacity: 0.6; }
    .owned-button-label { font-weight: 600; }
    .owned-button:focus-visible, .preference-controls button:focus-visible { outline: 2px solid var(--p-primary-color); outline-offset: 3px; }
    [data-testid='preview-dialog'] { inline-size: min(32rem, calc(100vw - 2rem)); }
    @media (prefers-reduced-motion: reduce) {
        .theme-control, .owned-button,
        .p-anchored-overlay-enter-active, .p-anchored-overlay-leave-active,
        .p-collapsible-enter-active, .p-collapsible-leave-active,
        .p-dialog-enter-active, .p-dialog-leave-active,
        .p-drawer-enter-active, .p-drawer-leave-active,
        .p-overlay-mask-enter-active, .p-overlay-mask-leave-active {
            animation-duration: 0s !important;
            transition-duration: 0s !important;
        }
    }
    @media (forced-colors: active) {
        .owned-button:focus-visible, .preference-controls button:focus-visible { outline-color: Highlight; }
    }
}
```

Animation families: anchored overlays (Select, MultiSelect, AutoComplete, DatePicker, CascadeSelect, Password, Popover/menu overlays, ColorPicker, TreeSelect, ConfirmPopup); collapsibles (Accordion, Panel, Fieldset, Stepper, PanelMenu); Dialog and Drawer; modal mask; Galleria; Image original; Message; Toast message. Their transition classes follow `.p-<family>-enter-active` / `-leave-active`; Image uses `p-image-original`, Toast `p-toast-message`, mask `p-overlay-mask`. Check the release's component stylesheet/transition name before overriding a family. Reduce **both** animation and transition durations; include overlays rendered outside a scoped SFC and preserve final visibility/layout rather than hiding the content to stop motion. Animation utilities from an optional CSS plugin are not core OpenVue animation APIs. Avoid content-essential entrance animations, blinking state feedback, and unconditional large transforms.

## PT contracts: attributes without breaking behavior

Read `openvue/<component>/index.d.ts` for the exact section names and callback options. A section can be a class string, an attribute object or a function returning either (plus declared null/undefined). `class` and `style` use Vue binding forms. Typical callback options include `props`, `state`, `context`, `attrs`, `parent`, `instance`, and `global`, **but availability is component-specific**: Button exposes disabled context, Panel exposes `state.d_collapsed`; do not assume all components have the same `state` fields. Prefer a typed `PanelPassThroughOptions` object as above rather than destructuring an untyped argument.

| Boundary | Contract |
| --- | --- |
| DOM section, e.g. `header`, `content` | Attributes apply to that element. Add `data-*`, a nonconflicting description relationship, application classes, or an observational listener only where required. |
| Nested component section, e.g. `pcToggleButton`, `pcCloseButton`, `pcBadge` | Supply that child's PT object: `pcToggleButton: { root: {...}, icon: {...} }`, not root DOM attributes directly on `pcToggleButton`. Names beginning `pc` signal the component boundary. |
| Global `pt` | Keyed by lowercase component name, e.g. `button`, `panel`; local `pt` takes precedence. Global `pt.global.css` is trusted global CSS and has document lifetime, not component-local cleanup semantics. |
| `ptOptions.mergeSections` | Default `true`: retain unspecified sections from the base/global PT configuration. `false`: sections absent from the override are not automatically retained. |
| `ptOptions.mergeProps` | Default `false`: colliding section properties are replaced. `true` uses Vue merge semantics for classes/styles/listeners rather than ordinary object spread. It does not validate attributes or authorize replacing internal behavior. A custom merge function is supported, but must preserve library contracts. |
| `usePassThrough(base, overrides, options)` | Returns a lazy merge descriptor consumed by PT; not a DOM-prop merger or a reactive theme builder. Pass the result as global/local PT. Do not flatten it or assume nested objects were eagerly merged. |
| `pt.hooks` | `onBeforeCreate`, `onCreated`, `onBeforeMount`, `onMounted`, `onBeforeUpdate`, `onUpdated`, `onBeforeUnmount`, `onUnmounted`. These are component hooks, not hooks for a specific inner element. No element/event payload is promised. Own and remove any side effect you add. |

Prefer the declared prop/event/slot for values, disabled state, validation, expanded state and commands. Never overwrite generated IDs, roles, `tabindex`, `aria-controls`, `aria-expanded`, keyboard handlers or pointer handlers to force a screenshot. Test the actual interaction after PT decoration; a new attribute's existence does not prove generated behavior survived. If observing a click, do not call `preventDefault`/`stopPropagation` or substitute the component command accidentally. `mergeProps: true` can compose user listeners; it cannot make contradictory handlers correct. Do not spread arbitrary server/user JSON into PT, especially `on*`, `innerHTML`, `href`, `style`, `id`, or ARIA keys. Use an allowlist of attributes you own.

The workbench Panel uses its header slot without a duplicate ID and leaves generated control/content IDs intact. A custom toggle-button slot would instead have to forward **both** `toggleCallback` and `keydownCallback`, plus a correct button type, accessible name, relationships and visible focus. Prefer the built-in control unless replacing the UI is intentional. Declarative `pt:section:attribute` exists, but the typed programmatic form is easier to audit under strict templates.

## Optional Tailwind and unstyled/Volt boundaries

Styled mode plus Tailwind layout utilities needs no unstyled setting. For Tailwind v4, declare `@layer theme, base, openvue, components, utilities;` before imports and use that same order in `theme.options.cssLayer`. Put OpenVue after reset/base and before utilities. Align Tailwind's dark variant with `.app-dark`, for example the contextual CSS `@custom-variant dark (&:where(.app-dark, .app-dark *));`. With the system media-query default, use the corresponding system variant in both systems. Tailwind v3 integration uses that version's config/plugin and base/components/utilities conventions; do not paste v4 CSS syntax into it.

The official Tailwind integration page also describes an optional theme-token/animation utility plugin, with separate CSS (v4) and JavaScript (v3) entry paths. It is **not installed or required here**. Verify its current package metadata/version and API before adding it; ordinary Tailwind utilities and CSS custom properties are sufficient for the workbench. Semantic utilities require emitted token variables: in global unstyled mode they are not automatically supplied by the removed styled preset. Do not combine an unstyled suite with unexplained `bg-primary` utilities and expect missing tokens to materialize.

Per-component `unstyled` removes that component's library presentation, not neighboring components, your application reset, global CSS already loaded by styled siblings, or accessibility responsibilities. Build hover/active/focus-visible/disabled/invalid/loading/selected/expanded states, responsive hit areas, forced-colors behavior, and portals intentionally. The workbench's owned unstyled Button retains its real click behavior and adds its own focus/disabled styles. Volt wraps unstyled OpenVue components in application-owned Tailwind source; adopting it means maintaining those wrappers and their state/slot forwarding, not importing a hypothetical `openvue/volt` theme. No Volt assets, CLI, plugin or wrapper dependency is assumed by this reference.

## Icons: distinguish three delivery models

| Model | Import/use | Cost and accessibility |
| --- | --- | --- |
| Built-in functional SVG icons | `@openvue/icons/check`, `@openvue/icons/chevrondown`, etc., only verified subpaths | Core components already use these SVGs internally. Importing a built-in icon needs no webfont CSS. Preserve supplied slot classes; omitting `label` makes the built-in SVG decorative (`aria-hidden` is generated internally), while the control still needs a name. Do not add undeclared native attributes directly to an icon component under strict templates. |
| Current optional OpenIcons webfont | Install `@openvue/openicons`; import `@openvue/openicons/openicons.css`; classes `oi oi-check` | Separate package, not part of `openvue`'s required CSS. Font files/CSP must be permitted; a glyph is not an accessible control name. Use `aria-hidden="true"` on decorative glyphs. |
| Current optional OpenIcons Vue SVGs | `@openvue/openicons-vue/icons/OiCheck` | Separate tree-shakeable package. Current docs specify `size`, `title`, `currentColor` and decorative default behavior; do not assume these are props of `@openvue/icons`' built-in SVG components (whose declared props are `label`/`spin`). |

Both optional OpenIcons packages are separately published as **1.0.0** at this audit boundary; their availability is not inferred from the source snapshot or a core component import. [Webfont metadata](https://registry.npmjs.org/@openvue/openicons/1.0.0), [SVG package exports](https://registry.npmjs.org/@openvue/openicons-vue/1.0.0), [official icon delivery guide](https://openvue.dev/icons).

Use a component's declared icon slot (e.g. Select `dropdownicon`, Button `icon`/`loadingicon`) for a different icon library or trusted inline SVG. Pass slot classes as appropriate; do not replace the surrounding interactive element merely to change its icon. Decorative images use empty alt; informative images/SVGs need an accessible name, but avoid announcing a decorative dropdown arrow as duplicate content. An icon-only Button requires an explicit accessible name. Never inject untrusted SVG/HTML. A spinning icon needs a textual loading/status alternative and a reduced-motion policy. The official icon page also discusses a legacy-prefix stylesheet/constants migration; this is not a clean-cutover recommendation for new applications. Use current `oi` classes or SVG imports, not compatibility assets.

## RTL, contrast, focus, and acceptance boundaries

Set document `dir="rtl"` (and correct `lang`) for an RTL application; no OpenVue JavaScript RTL switch is needed. Use logical `margin-inline`, `padding-inline`, `inset-inline-start` and text alignment. Set direction on `html` for body portals. Do not mirror all icons: directional arrows may need contextual mirroring, while logos, checkmarks and media symbols generally do not. Official documentation explicitly excludes Carousel and Galleria from guaranteed RTL behavior; do not claim suite-wide support without testing those flows.

Validate light/dark foreground/background pairs, primary contrast, hover/active states, invalid/disabled legibility and focus against both the component surface and adjacent surface. Meet WCAG text contrast (normally 4.5:1, 3:1 for qualifying large text) and non-text UI/focus contrast requirements; color alone must not encode errors or selection. Keep keyboard-visible focus, ensure rings are not clipped by overflow, test browser zoom, and include forced-colors mode. Semantic focus settings are not a substitute for checking every consuming component. Confirm modal focus enters the overlay, Tab stays within it while modal, Escape/close restores the trigger, and PT has not changed these relationships.

Production-browser scenarios for this exact workbench: compare painted global/local button colors before/after a palette update and reset; switch light/dark while a real body portal remains open and compare its surface; verify global and local PT attributes/classes coexist; activate Panel with Enter/Space and assert `aria-expanded`, content visibility, generated ID target and retained focus; click/keyboard-activate the unstyled Button and assert the application counter; reload explicit preference and observe system changes under `system` but not explicit light; inspect nonce-bearing generated styles before and after token updates; assert no page errors/CSP violations. These are proposed checks, not claims of observed passes.

## Evidence and official-page dispositions

Published declarations/runtime outrank later examples: [theme package exports](https://unpkg.com/@openvue/themes@1.0.0/package.json), [theme root declaration](https://unpkg.com/@openvue/themes@1.0.0/index.d.ts), [Aura declaration](https://unpkg.com/@openvue/themes@1.0.0/aura/index.d.ts), [engine declarations](https://unpkg.com/@openuxkit/styled@1.0.0/dist/index.d.mts), [engine implementation](https://unpkg.com/@openuxkit/styled@1.0.0/dist/index.mjs), [published config runtime](https://unpkg.com/@openvue/core@1.0.0/config/index.mjs), [Button declaration](https://unpkg.com/openvue@1.0.0/button/index.d.ts), [Panel declaration](https://unpkg.com/openvue@1.0.0/panel/index.d.ts), [PT merge declaration](https://unpkg.com/openvue@1.0.0/passthrough/index.d.ts), [built-in SVG declaration](https://unpkg.com/@openvue/icons@1.0.0/baseicon/index.d.ts). Context7 library: `/openvi-foundation/openvue`.

All nine assigned official pages at pinned source `d064f02ac75c3aaeb60a676c70e5ee08e3e3042e` are covered, with tooling/optional boundaries deliberate:

| Official page | Coverage / disposition |
| --- | --- |
| [styled](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/pages/styled.md) | Token tiers, preset choices, reserved keys, schemes/precedence, runtime APIs, scoped `dt`, typography/density, CSS modules/layers/reset; one-branch surface shortcut corrected against release source. |
| [passthrough](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/pages/passthrough.md) | DOM versus `pc` sections, callback options, global/local precedence, merge strategy, hooks, declarative syntax, trusted custom CSS/attributes, executable preserved-control example. |
| [unstyled](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/pages/unstyled.md) | Global/per-instance ownership, removed token CSS, state/accessibility responsibilities, owned Button example; Volt remains an optional source-ownership boundary. |
| [tailwind](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/pages/tailwind.md) | Styled/unstyled decisions, v3/v4 distinction, layer/dark alignment, optional token/animation plugin boundary. No copied external assets or assumed dependency. |
| [designer](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/pages/designer.md) | Optional local visual editor/export/migration workflow, source review, installed-token compatibility and untrusted-import boundary; no hosted designer/runtime service introduced. |
| [icons](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/pages/icons.md) | Current OpenIcons font/SVG imports versus built-in functional SVGs, optional dependencies, current prefixes, naming/CSP; legacy compatibility migration deliberately not adopted. |
| [customicons](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/pages/customicons.md) | Verified slot extension pattern, external library/image/inline SVG delivery and accessible decorative/informative treatment. No extra icon library needed. |
| [rtl](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/pages/rtl.md) | Root direction/logical CSS/portal scope; Carousel/Galleria limitation retained. |
| [animations](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/pages/animations.md) | Transition families, release stylesheet checks, global versus scoped overrides, reduced animation/transition durations and retained content/focus. |
