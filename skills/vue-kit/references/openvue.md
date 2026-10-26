# OpenVue: capability ownership and progressive discovery

Use for an existing OpenVue application or an explicitly selected rich-widget alternative. **Vuetify 4.3.x remains the default for new general-purpose UI.** Preserve an incumbent framework during a narrow fix; OpenVue is not a reason to add a second application-wide reset, token system, form owner or overlay manager.

## Release and evidence boundary

**OpenVue 1.0.0, a fork of PrimeVue 4.5.5**, is the evidenced alternative route. Recheck installed exports and the intended consumer before adopting a later release or major; this snapshot does not certify future versions.

The authoring snapshot is **Vue 3.5.44 / OpenVue 1.0.0**, with matching `@openvue/core`, `@openvue/themes`, optional `@openvue/forms` and official Nuxt module **1.0.0**. Packages are MIT licensed; no application license key, hosted account or commercial service is required. The `openvue` package depends on both `@openvue/core` and the component SVG icon package `@openvue/icons`; `@openvue/core` alone does not bring those icons. Icon fonts, Chart/Quill runtime features, utility CSS and form integration are separate choices; the selected full-declaration profile also needs the explicit Chart.js **development-only type prerequisite** in [setup](openvue-setup.md). [Exact component dependencies](https://registry.npmjs.org/openvue/1.0.0), [exact core dependencies](https://registry.npmjs.org/@openvue/core/1.0.0).

The official Context7 library now resolves as **`/openvi-foundation/openvue`**. Its indexed Markdown comes from `apps/showcase/server/assets/llms/{pages,components}` in the upstream repository. Use Context7 for targeted discovery, then reconcile the locked release's exported declarations and runtime: repository `master` and generated documentation can lead the published package or contain stale examples. A snippet's presence is not compatibility or accessibility evidence.

Source roles: **showcase** supplies component/guide documentation and examples; **volt** supplies a separate source-owned, unstyled/Tailwind showcase; **announcement** is a static landing surface. Do not install the whole monorepo, copy its sample customers/assets, or treat showcase services as an application's backend. The upstream's blanket accessibility claim does not certify your composed screen.

## Read only the owner needed

| Responsibility | Owner | Material boundary |
| --- | --- | --- |
| Vite/Nuxt installation, exact dependencies, SSR styles, registration and migration setup | [Setup](openvue-setup.md) | Host owns bootstrap and request lifetime; a Nuxt module is not a SPA plugin |
| Styled/unstyled modes, token presets, PT, CSS layers, icons, RTL and theme changes | [Theming](openvue-theming.md) | One theme owner; document-root scope includes body portals |
| Inputs/selectors, native labels, optional Form/FormField/resolvers and file/editor boundaries | [Forms](openvue-forms.md) | One draft/validation/submit owner; formatting and invalid styling are not validation |
| DataTable/TreeTable, trees, lists, pagination, virtualization and optional Chart | [Data](openvue-data.md) | Stable identity and one data pipeline; UI state is not server data or authorization |
| Dialog/Drawer/Popover, confirmations, dynamic dialogs, toast and focus/busy utilities | [Overlays](openvue-overlays.md) | Distinguish plugin, rendered host and caller; cancellation must not perform the action |
| Buttons, menus, tabs, accordion, stepper and navigation composition | [Navigation](openvue-navigation.md) | Native links navigate; in-place selection is not router state or access control |
| Layout, media, feedback, progress, scroll/animation utilities and local terminal | [Components](openvue-components.md) | Preserve semantic content, measurable geometry and component-owned effects |

All eight references are directly indexed by the master skill. These links are conditional owners, not a reading checklist. For cross-feature ownership add [UI architecture](architecture-ui.md); for validation/submit policy add [forms](forms.md); for focus/keyboard obligations add [accessibility](accessibility.md). Keep Quasar in its [separate incumbent reference](alternative-ui.md).

## Architectural contracts

1. **One host and UI owner.** Standalone Vue installs the plugin once before mount; Nuxt uses its official module and generated styles. Do not put a second `createApp`, router, client-only stylesheet workaround or provider behind an integration wrapper.
2. **Use concrete component semantics.** Select is single-valued; MultiSelect is separate. Dialog models `visible`; tabs/accordion/stepper use their declared `value` composition. Carousel is data plus an item slot, not compound carousel imports. Similar names in another library do not establish compatibility.
3. **Separate data from presentation.** Keep application records, stable IDs and canonical server state outside transient table/overlay state. Put local sorting/filtering/paging in one pipeline. A lazy table delegates processing to the application; it does not fetch, cache or secure records for you.
4. **Give drafts one owner.** Plain `v-model`, the optional OpenVue form package, native/Vuetify validation or an existing form library are alternatives for one draft. Do not let two owners reset, validate or submit it. Service errors remain authoritative even when a client resolver accepts the input.
5. **Treat PT as a contract, not a bypass.** Use declared native/internal sections for attributes and compose generated handlers/ARIA rather than replacing them. A public prop typo is not repaired by spreading an arbitrary object; do not add casts to hide mismatched models or events.
6. **Keep lifecycle and security explicit.** A Toast is local UI, not success from a service; ConfirmDialog does not authorize deletion; Terminal does not execute shell commands. Stop listeners and cancel stale publication with their owner. Upload and rich-text controls do not sanitize or secure stored content.
7. **Preserve adaptive behavior.** Use real names/help/errors on the actual focus target. Test keyboard, focus restoration, long text, empty/error/pending states, touch width, live reduced motion and body-portaled theme scope. Avoid replacing business components merely to restyle or animate them.

## Authorized cutover, not compatibility aliases

Inventory dependencies, imports, component names, models, events, slots, styles, directives, services, auto-imports, Nuxt configuration and tests before a requested migration. The optional `@openvue/migrate` tool can produce a preview/reviewable diff; inspect its current published command contract rather than running an unbounded rewrite in an incumbent application. A codemod cannot establish semantic parity, keyboard behavior, server isolation or accepted values.

Migrate all callers in the selected slice, remove obsolete packages/configuration, and keep unrelated frameworks unchanged. Do not ship namespace aliases, re-exports, patched dependencies, mixed-major services or a second form/theme manager as a migration strategy. The owning references record exact-release discrepancies and supported alternatives; they are not instructions to restore retired integrations.

## Verification and primary sources

[OpenVue coverage](../assets/openvue-coverage.json) records the complete pinned official-document population, native routing hypotheses, final dispositions and release conflicts. [Scoped verification](../assets/verification.json) records only exercised consumers and exact compiler/runtime limits. Historical audits remain historical; source routing and successful bundles are not blanket runtime, accessibility, hydration or future-major certification.

Primary discovery: [official introduction](https://openvue.dev/introduction), [documentation index](https://openvue.dev/llms.txt), [source applications](https://github.com/openvi-foundation/openvue/tree/master/apps), [exact core release](https://registry.npmjs.org/openvue/1.0.0), [theme release](https://registry.npmjs.org/@openvue/themes/1.0.0), [form release](https://registry.npmjs.org/@openvue/forms/1.0.0), [official configuration](https://openvue.dev/configuration), [accessibility guide](https://openvue.dev/guides/accessibility).
