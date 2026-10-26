# OpenVue navigation and commands

OpenVue **1.0.0**, Vue 3.5, explicit Composition API imports. Use [selection](openvue.md), [setup](openvue-setup.md), and [overlays/services](openvue-overlays.md). Choose a native navigation link for destinations and a button/command for actions; styling does not change those semantics. This reference covers all 14 navigation pages in the pinned official corpus, including their compound pieces, not just component names.

## Compound navigation: identity, mounting, and validation

| Component imports | Composition / model | Important boundary |
| --- | --- | --- |
| `openvue/tabs`, `tablist`, `tab`, `tabpanels`, `tabpanel` | `Tabs > TabList > Tab` and `Tabs > TabPanels > TabPanel`; root `v-model:value` is string/number, with matching unique header/panel `value` | Values are identities, not display indexes. `value="1"` and `:value="1"` differ; use one stable type. Pair by ID, not translated label or array position. `TabList` owns tablist semantics; headers have tab roles and `aria-controls`, panels the reciprocal ID/name. |
| `openvue/accordion`, `accordionpanel`, `accordionheader`, `accordioncontent` | `Accordion > AccordionPanel(value) > AccordionHeader + AccordionContent`; root `v-model:value` is string/number/null in single mode, an array in `multiple` mode | A collapsible section can have no active panel. Each panel identity is unique within its root. `disabled` belongs on a panel. Do not put another button/link inside its default button header. |
| `openvue/stepper`, `steplist`, `step`, `steppanels`, `steppanel` | Horizontal: `Stepper > StepList > Step(value)` plus `StepPanels > StepPanel(value)`; root `v-model:value` uses string/number | Header/panel values must match exactly. The panel slot's `activateCallback(value)` changes steps, not validates data. `linear` prevents arbitrary inactive-header activation; it is not a validation engine or permission check. |
| `openvue/stepitem` with Stepper/Step/StepPanel | Vertical: `Stepper > StepItem(value) > Step + StepPanel` | StepItem supplies inherited identity. Do not combine unrelated horizontal and vertical trees or mismatched child values. Validate before calling a panel callback and revalidate on final commit. |

Tabs `selectOnFocus` defaults false: arrows/Home/End move focus while Enter/Space activate; enable automatic activation only when switching is cheap and non-destructive. `scrollable` and navigator controls handle wide tab lists, not value identity. `lazy=false` leaves inactive panels mounted and CSS-hidden; `lazy=true` renders active content only. Child drafts/listeners may be destroyed and recreated; keep draft state above panels if it must survive. Accordion supports arrow navigation, Home/End, Enter/Space for expansion; `selectOnFocus` changes focus/activation coupling. Neither widget is a URL router. For route navigation derive active identity from the route rather than maintain a second inconsistent selection.

Stepper's default headers are native buttons. Use Tab to reach them and Enter/Space to activate permitted headers. Do not assume that its documentation's shared tab-header keyboard prose implies the full Tabs arrow-key implementation: published Step has no comparable arrow-key handler. In 1.0.0 Step's headless `a11yAttrs.header` even contains a misspelled `taindex` property; prefer the default native header rather than copy it into a custom non-native control. It also exposes `a11yAttrs.root` separately from `.header`, unlike Tab's flat object. This is a release-specific reason not to generalize every `asChild` component into one wrapper.

## Menu families: use the matching model shape

Import each component from its lowercase subpath, e.g. `import Menu from 'openvue/menu'`; `MenuItem` is a type import from `openvue/menuitem`. Most menu models are `MenuItem[]`: `label`, stable `key`, `icon`, `url`, `target`, `disabled`, `visible`, `separator`, nested `items`, and `command(event)` are common. Command receives `{ originalEvent, item }`; invocation comes from click **or keyboard**. Never attach a second handler to the same custom item that repeats the command. Treat model URL/route strings as application inputs: validate untrusted URLs and do not render model labels as HTML.

| Need | Component | Model / behavior, not interchangeable defaults |
| --- | --- | --- |
| Small vertical actions | `Menu` | Inline by default; `popup` plus `ref.toggle(event)` makes an anchored overlay. Single-level `items` groups are headings, not arbitrary cascading submenus. `item`, `submenulabel`, `start`, `end` slots. |
| Cascading actions | `TieredMenu` | Nested `items` opens flyout submenus, inline or `popup`/`toggle(event)`. Name the menu and retain submenu ARIA/keyboard bindings in item templates. |
| App horizontal menu | `Menubar` | Nested `items`, horizontal root and submenu navigation; responsive mobile toggle. `start`/`end` slots are for ancillary content, not extra unregistered menuitems. Label the toggle via its declared props/PT when needed. |
| Dense multi-column navigation | `MegaMenu` | A top item's `items` is **columns of groups**, e.g. `[[{ label: 'Guides', items: [...] }], [{ label: 'API', items: [...] }]]`, not TieredMenu's flat children. `orientation` is horizontal/vertical. It has item/start/end templates. |
| Persistent hierarchical navigation | `PanelMenu` | Accordion roots plus nested tree; `multiple` allows multiple roots. `v-model:expandedKeys` is a **plain key-to-boolean record** in 1.0.0 (`{ guides: true }`), despite prose calling it a Map. Stable `item.key` values are required for controlled expansion. Expansion is not route selection. |
| Page hierarchy | `Breadcrumb` | `home` plus `model`; ordinary nav/ordered-list semantics, normal Tab sequence, no application-menu arrow navigation. Final route link needs `aria-current="page"`; item/separator slots retain a real anchor for destinations. |
| Target-specific actions | `ContextMenu` | `ref.show(event)` from `@contextmenu`; `global` attaches document-wide. Capture selected record ID before opening; do not infer the current record from a later DOM event. Keep a visible keyboard-reachable alternative (e.g. Actions popup), and implement ContextMenu/Shift+F10 invocation if required by the host surface. |
| Icon launch shelf | `Dock` | `model` plus `itemicon` template; `position` chooses an edge. Name every item, give meaningful image alt text, avoid hover-only tooltips. Its menu keyboard model differs from breadcrumb. Do not import the unrelated terminal/media services used by the showcase's desktop demonstration. |

The Menu page promises automatic popup trigger ARIA, but its published 1.0.0 runtime does not write those trigger attributes. Own `aria-haspopup`, `aria-controls`, and expanded state explicitly, as below; do not assume every menu family shares an implementation. Name Menu's actual `ul[role=menu]` with its declared `ariaLabel`/`ariaLabelledby` props or `pt.list`, not `pt.root` on the outer div. Pass a real event whose `currentTarget` is the button, not a retained activator object. Close/hide before removing an anchor; body portals do not inherit app-only theme selectors. Menu keeps DOM focus on the list and tracks its active item with `aria-activedescendant`, not DOM focus on each menuitem. Arrows navigate, Home/End bound the list, Enter/Space activate; Escape closes a popup and focuses its trigger before clearing the target. Menubar's horizontal axis and PanelMenu's tree traversal differ; preserve each component's bindings rather than forcing one keydown handler onto all families. Test focus when commands remove their target.

### Button, SplitButton, SpeedDial

- **Button** (`openvue/button`) renders a native button, default type button. Set `type="submit"` for actual form submission and `type="button"` for cancel/navigation commands. `loading` communicates busy and contributes to disabled behavior on the native rendering; guard the operation as well. `variant="link"` changes appearance, not destination semantics. Use `as="a"` with a real `href` for external navigation and `rel="noopener"` for a new tab. Icon-only/custom content needs an accessible name. `ButtonGroup` (`openvue/buttongroup`) visually groups buttons but is not a radio model or toolbar keyboard implementation.
- **SplitButton** (`openvue/splitbutton`) has two independent controls: `@click` is the default command, `model` supplies alternate menu commands. Name the dropdown explicitly with `menuButtonProps: { 'aria-label': 'More project actions' }`; `buttonProps` affects the main button. A main-button click must not also run a menu-item handler. Nested alternatives use a hierarchical menu. Disable both paths consistently during work. Do not present irreversible deletion as a hidden default.
- **SpeedDial** (`openvue/speeddial`) reveals a small collection of primary actions from `model`. `direction`, `type` (linear/circle/semi-circle/quarter-circle), and `radius` control layout; reserve enough unclipped space and test narrow viewports. `mask` is presentation, not transaction locking. Name its opener through `buttonProps`, keep labels on actions, and do not make critical actions hover-only. Custom `button`/`item` slots expose `toggleCallback` but are not generic `props.action` bindings: a toggle alone is not proof the item's command ran. Prefer default action rendering until custom keyboard/name/command dispatch is explicitly implemented and tested.

## `as`, `asChild`, and real links

`as` changes a root tag; it cannot magically turn a div into a keyboard-complete button. `asChild` is a **Vue scoped-slot contract**, not React element cloning and not a universal activator slot. Button exposes class and `a11yAttrs`; Tab exposes additional `onClick`/active bindings at runtime, while the 1.0.0 Tab declaration types its default slot without a scope. A runtime snippet that destructures those undeclared fields is not strict-template-safe. Prefer normal Tab content/default headers. Step exposes nested root/header attributes and has the release defect described above. Never invent `onValueChange`, `open`, `DialogTrigger`, or React render props.

For router menus, install Vue Router as an explicit optional dependency, import `RouterLink` from `vue-router`, and provide a configured router at app creation (see setup). The **contextual template fragment** below replaces Menu's item slot inside an already configured router application; `items` is its application-owned menu model with `route` destinations. Enabled destinations retain an anchor with `href` and `props.action`. `navigate` respects modified clicks; do not blanket `.prevent` or replace links with `router.push` divs. Render disabled destinations without a live link or navigation listener: Menu's disabled styling/keyboard filtering is not a native anchor lock. The predicate below accepts both declared boolean and function-valued disabled models. Do not define both a navigation `command` and an `@click` router navigation for the same item. Use only vetted `item.url` values for the external branch.

```vue
<Menu :model="items" ariaLabel="Project destinations">
  <template #item="{ item, props }">
    <span v-if="typeof item.disabled === 'function' ? item.disabled() : item.disabled" v-bind="props.action" aria-disabled="true">{{ item.label }}</span>
    <RouterLink v-else-if="item.route" v-slot="{ href, navigate }" :to="item.route" custom>
      <a :href="href" v-bind="props.action" @click="navigate">{{ item.label }}</a>
    </RouterLink>
    <a v-else :href="item.url" :target="item.target" rel="noopener" v-bind="props.action">{{ item.label }}</a>
  </template>
</Menu>
```

Button's default slot **is** typed with `class`/`a11yAttrs`; for a standalone destination in a router-owned template, `<Button asChild v-slot="bindings"><RouterLink to="/projects" :class="bindings.class">Projects</RouterLink></Button>` preserves RouterLink's native anchor. This simple link deliberately does not copy button-role attributes onto an anchor. For a headless action use a native `<button type="button" v-bind="bindings.a11yAttrs">` and explicitly retain the actual action handler and class on that button; disabled/loading state must reach the native control. Do not nest an anchor or button inside a default Button/Tab/AccordionHeader.

## Complete typed tabs/stepper/menu workflow

`NavigationWorkflow.vue` owns its draft outside the tab panels, exact string identity for selection, validated progression, committed local list, and menu command state. The library emits string/number values; boundary setters narrow them without casts. A disabled menu item is presentation; handlers and final publish still enforce invariants. There is no Router dependency in this independent local workflow. The inline Menu is intentionally allowed to issue commands during editing; those commands cannot bypass validation or publish by merely switching a tab.

<!-- fixture: src/NavigationWorkflow.vue -->
```vue
<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'
import Accordion from 'openvue/accordion'
import AccordionPanel from 'openvue/accordionpanel'
import AccordionHeader from 'openvue/accordionheader'
import AccordionContent from 'openvue/accordioncontent'
import Button from 'openvue/button'
import Menu from 'openvue/menu'
import PanelMenu from 'openvue/panelmenu'
import SplitButton from 'openvue/splitbutton'
import Stepper from 'openvue/stepper'
import StepList from 'openvue/steplist'
import Step from 'openvue/step'
import StepPanels from 'openvue/steppanels'
import StepPanel from 'openvue/steppanel'
import Tabs from 'openvue/tabs'
import TabList from 'openvue/tablist'
import Tab from 'openvue/tab'
import TabPanels from 'openvue/tabpanels'
import TabPanel from 'openvue/tabpanel'
import type { MenuItem } from 'openvue/menuitem'

type WorkspaceTab = 'overview' | 'plan'
type PlanStep = 'details' | 'review'
interface PublishedPlan { id: string; title: string }
const activeTab = shallowRef<WorkspaceTab>('overview')
const activeStep = shallowRef<PlanStep>('details')
const title = shallowRef('')
const error = shallowRef('')
const plans = shallowRef<PublishedPlan[]>([])
const expandedKeys = shallowRef<Record<string, boolean>>({})
const menuOpen = shallowRef(false)
const menu = useTemplateRef('menu')
const titleInput = useTemplateRef<HTMLInputElement>('titleInput')
const overview = useTemplateRef<HTMLHeadingElement>('overview')
const canPublish = computed(() => activeStep.value === 'review' && !!title.value.trim())
const commands = computed<MenuItem[]>(() => [
  { key: 'new', label: 'New plan', command: startPlan },
  { key: 'overview', label: 'Show overview', command: () => { activeTab.value = 'overview' } },
  { key: 'publish', label: 'Publish plan', disabled: !canPublish.value, command: publish }
])
const sections: MenuItem[] = [{ key: 'planning', label: 'Planning', items: [
  { key: 'create', label: 'Create plan', command: startPlan }
] }]
function selectTab(value: unknown) {
  if (value === 'overview' || value === 'plan') activeTab.value = value
}
function selectStep(value: unknown) {
  if (value === 'details' || value === 'review') activeStep.value = value
}
function startPlan() {
  activeTab.value = 'plan'
  activeStep.value = 'details'
  title.value = ''
  error.value = ''
}
function next(activate: (value: string | number) => void) {
  if (!title.value.trim()) {
    error.value = 'Plan title is required.'
    titleInput.value?.focus()
    return
  }
  error.value = ''
  activate('review')
}
async function publish() {
  if (!canPublish.value) return
  const plan: PublishedPlan = { id: crypto.randomUUID(), title: title.value.trim() }
  plans.value = [...plans.value, plan]
  title.value = ''
  activeStep.value = 'details'
  activeTab.value = 'overview'
  await nextTick()
  overview.value?.focus()
}
</script>

<template>
  <section aria-labelledby="workflow-heading">
    <h2 id="workflow-heading">Planning workspace</h2>
    <Menu :model="commands" ariaLabel="Workspace commands" />
    <Button label="More workspace commands" aria-haspopup="menu" aria-controls="workspace-popup-list" :aria-expanded="menuOpen" @click="menu?.toggle($event)" />
    <Menu ref="menu" :model="commands" popup ariaLabel="More workspace commands" :pt="{ list: { id: 'workspace-popup-list' } }" @show="menuOpen = true" @hide="menuOpen = false" />
    <PanelMenu v-model:expandedKeys="expandedKeys" :model="sections" :pt="{ root: { 'aria-label': 'Planning sections' } }" />
    <p role="status" aria-label="Planning expansion">Planning expanded: {{ !!expandedKeys.planning }}</p>
    <SplitButton label="New plan" :model="commands" :menuButtonProps="{ 'aria-label': 'Alternate planning actions' }" @click="startPlan" />
    <Tabs :value="activeTab" @update:value="selectTab">
      <TabList>
        <Tab value="overview">Overview</Tab>
        <Tab value="plan">Plan editor</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="overview">
          <h3 ref="overview" tabindex="-1">Published plans</h3>
          <p v-if="!plans.length">No published plans.</p>
          <ul aria-label="Published plans">
            <li v-for="plan in plans" :key="plan.id" :id="`plan-${plan.id}`">{{ plan.title }}</li>
          </ul>
        </TabPanel>
        <TabPanel value="plan">
          <Stepper :value="activeStep" linear @update:value="selectStep">
            <StepList>
              <Step value="details" :pt="{ header: { 'aria-label': 'Details' } }">Details</Step>
              <Step value="review" :pt="{ header: { 'aria-label': 'Review' } }">Review</Step>
            </StepList>
            <StepPanels>
              <StepPanel v-slot="{ activateCallback }" value="details">
                <label for="plan-title">Plan title</label>
                <input id="plan-title" ref="titleInput" v-model="title" :aria-invalid="!!error" aria-describedby="plan-error" />
                <p id="plan-error" role="alert">{{ error }}</p>
                <Button label="Review plan" @click="next(activateCallback)" />
              </StepPanel>
              <StepPanel v-slot="{ activateCallback }" value="review">
                <p>Ready to publish: {{ title }}</p>
                <Button label="Back to details" severity="secondary" @click="activateCallback('details')" />
                <Button label="Publish now" :disabled="!canPublish" @click="publish" />
              </StepPanel>
            </StepPanels>
          </Stepper>
        </TabPanel>
      </TabPanels>
    </Tabs>
    <Accordion value="rules">
      <AccordionPanel value="rules">
        <AccordionHeader>Publishing rules</AccordionHeader>
        <AccordionContent>A title must be reviewed before publishing. Changing tabs does not publish.</AccordionContent>
      </AccordionPanel>
    </Accordion>
  </section>
</template>
```

The workflow keeps Tabs' default `lazy=false`, preserving draft inputs while hidden. Switching tabs preserves the draft; the explicit **New plan** command clears it and returns to Details, invalidating its prior review without touching published records. Wait for `nextTick()` before focusing the overview after switching: even an existing CSS-hidden heading must become visible before focus can move. Draft state remains in the parent if panels become lazy. Published records have application-owned UUIDs that remain stable when commands reset the separate draft. Hidden panels are excluded from the accessible tree; return to Overview to inspect retained records through their named list, rather than interpreting an inaccessible hidden list as deleted state. Never use display indexes for reorderable tab or record identity.

For an independent application, use this complete entry with the SFC above and a normal `index.html` containing `<div id="app"></div>` and a module script for `/src/navigation-main.ts`. No service host, Router, or additional application helper is required; installation/compiler profiles are in [setup](openvue-setup.md).

<!-- fixture: src/navigation-main.ts -->
```ts
import { createApp } from 'vue'
import OpenVue from 'openvue/config'
import Aura from '@openvue/themes/aura'
import NavigationWorkflow from './NavigationWorkflow.vue'

createApp(NavigationWorkflow).use(OpenVue, { theme: { preset: Aura } }).mount('#app')
```


## Evidence and release boundaries

Official pages: [Tabs](https://openvue.dev/tabs/), [Accordion](https://openvue.dev/accordion/), [Stepper](https://openvue.dev/stepper/), [Menu](https://openvue.dev/menu/), [TieredMenu](https://openvue.dev/tieredmenu/), [Menubar](https://openvue.dev/menubar/), [MegaMenu](https://openvue.dev/megamenu/), [PanelMenu](https://openvue.dev/panelmenu/), [Breadcrumb](https://openvue.dev/breadcrumb/), [ContextMenu](https://openvue.dev/contextmenu/), [Dock](https://openvue.dev/dock/), [Button](https://openvue.dev/button/), [SplitButton](https://openvue.dev/splitbutton/), [SpeedDial](https://openvue.dev/speeddial/). Source corpus snapshot `d064f02ac75c3aaeb60a676c70e5ee08e3e3042e`. Published [Tab declarations](https://unpkg.com/openvue@1.0.0/tab/index.d.ts), [Tabs declarations](https://unpkg.com/openvue@1.0.0/tabs/index.d.ts), [Accordion declarations](https://unpkg.com/openvue@1.0.0/accordion/index.d.ts), [Step runtime](https://unpkg.com/openvue@1.0.0/step/index.mjs), [StepPanel declarations](https://unpkg.com/openvue@1.0.0/steppanel/index.d.ts), [MenuItem model](https://unpkg.com/openvue@1.0.0/menuitem/index.d.ts), [PanelMenu declarations](https://unpkg.com/openvue@1.0.0/panelmenu/index.d.ts), [Button declarations](https://unpkg.com/openvue@1.0.0/button/index.d.ts), and [SpeedDial declarations](https://unpkg.com/openvue@1.0.0/speeddial/index.d.ts) determine copyable 1.0.0 APIs when indexed examples differ. In particular, do not cast around Tab's undeclared headless slot scope, use a JavaScript Map for PanelMenu expansion, or rely on Step's misspelled headless tabindex binding.

The Menu naming/active-descendant/trigger-ARIA caveats are grounded in the [published Menu runtime](https://unpkg.com/openvue@1.0.0/menu/index.mjs), rather than assuming the page's automatic-wiring claim applies to this release. For ordinary `MenuItem` models, the parent `itemClick` checks `disabled` before invoking `item.command(event)`; the child’s earlier `getItemProp` lookup expects a nested processed-item shape and does not dispatch an ordinary item's command. Do not mistake that unused branch for a disabled-command bypass. Default/custom anchors are still not natively disabled: remove live destination links for disabled models, and retain application command guards for domain invariants independently of UI state.
