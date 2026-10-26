# Virtualization

Read when profiling identifies excessive list/table DOM, not merely because the data array is large. Virtualization does not reduce fetching, sorting, filtering, or memory occupied by the source data. Prefer pagination or an existing Vuetify virtual component when it meets the requirement; use this headless adapter for custom layouts. Table composition belongs in [data-tables.md](data-tables.md), accessibility in [accessibility.md](accessibility.md), and hydration in [debugging-ssr.md](debugging-ssr.md).

## Version and adapter boundary

Verified stable releases: **`@tanstack/vue-virtual@3.13.47`**, depending exactly on **`@tanstack/virtual-core@3.19.6`**; Vue peer `^2.7.0 || ^3.0.0`. Examples target Vue **3.5.44**. Import `useVirtualizer`/`useWindowVirtualizer` from **`@tanstack/vue-virtual`**, never a React adapter. The Vue adapter returns a **`Ref<Virtualizer>`**: use `.value` in script; templates unwrap it. [Registry](https://registry.npmjs.org/@tanstack/vue-virtual/3.13.47), [pinned adapter declarations](https://unpkg.com/@tanstack/vue-virtual@3.13.47/dist/esm/index.d.ts).

`useVirtual`/`size`/`parentRef` belong to the old v2 interface, not v3. Core capabilities can advance independently of the Vue adapter minor version; inspect the installed core version before adopting newer options.

## Geometry contract

| Input/output | Invariant |
| --- | --- |
| `getScrollElement: () => scrollRef.value` | Return the actual overflowing element, not its content or a ref object. The getter can initially return `null`. |
| `count` | Length of the **displayed ordering** after processing; include a loader row only if you render that row. |
| `estimateSize(index)` | Return pixels along the scroll axis. Use realistic, preferably conservative estimates for variable heights. |
| `getItemKey(index)` | Stable record ID when rows reorder/filter/prepend; index is only suitable for immutable positional data. |
| `overscan` | Extra items outside the visible range; start small and profile blanking versus DOM cost. It is an item count for one lane; core 3.19.6 counts rows of `lanes` items for multi-lane ranges, not pixels. |
| `getTotalSize()` | Size the inner scroll spacer; otherwise the browser has no full scroll range. |
| `getVirtualItems()` | Each item supplies `key`, `index`, `start`, `end`, and `size`; render its corresponding record only. |
| `measureElement(element)` | Register actual DOM nodes for dynamic sizes; include `data-index` (or configured `indexAttribute`). |
| `gap` | Let the virtualizer account for inter-item spacing; unrelated CSS margins invalidate estimates. |

The viewport needs a bounded size and `overflow: auto`; the spacer is `position: relative`. For per-item positioning, use `position: absolute; top: 0; left: 0` and `transform: translateY(start)` (or X for horizontal lists). For flowing variable-height rows, position **one block** at the first virtual item's `start`, then let its children flow normally. Do not apply both translations.

A single flowing block requires **contiguous indexes**. A custom `rangeExtractor` that retains a distant focused row or sticky header can create gaps: position those items independently at their own starts, or split the output into separately positioned contiguous blocks. Otherwise normal flow collapses the omitted space and moves visible rows away from their virtual coordinates. The read-only example below uses the default contiguous range. [Official retained-header layout](https://github.com/TanStack/virtual/blob/main/examples/react/sticky/src/main.tsx) illustrates the framework-independent positioning contract; use the Vue adapter, not its React imports.

Reactive counts/options require `computed(() => ({ … }))` or a ref of the **whole options object**. A one-time `{ count: rows.value.length }` does not update when rows change. `getScrollElement` is watched by the adapter; its ref becoming available after mount is expected. Adapter-owned observers are disposed with the Vue scope. [Official API](https://tanstack.com/virtual/latest/docs/api/virtualizer), [Vue adapter](https://tanstack.com/virtual/latest/docs/framework/vue/vue-virtual).

The virtualizer's `Key` type includes `bigint`, which Vue 3.5 does not accept as a VNode key. Keep source IDs unique strings and normalize the exposed key at the Vue boundary. Match the measurement guard to the item-element generic; this example measures `HTMLDivElement`, not arbitrary `HTMLElement`. Vue's closed `HTMLAttributes` does not declare `data-index`; the local `MeasuredRowAttributes` contract requires that numeric native attribute and binds it with `v-bind`, without weakening native attribute types or augmenting all components.

## Complete example: dynamic read-only rows

Install `@tanstack/vue-virtual@3.13.47`. This SFC generates local illustrative records, preserves stable keys under filtering, measures wrapping text, and offers an external jump control whose focus is never recycled. The viewport itself is focusable for native keyboard scrolling. It is deliberately a read-only list, not an incompletely implemented ARIA listbox/grid.

```vue
<script setup lang="ts">
import { computed, onMounted, ref, type ComponentPublicInstance, type HTMLAttributes } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

type RecordRow = { id: string; text: string }
const records: RecordRow[] = Array.from({ length: 10000 }, (_, index) => ({
  id: `record-${index + 1}`,
  text: `Record ${index + 1}. ${'Variable-length content. '.repeat(index % 4 + 1)}`,
}))
const filter = ref('')
const rows = computed(() => {
  const text = filter.value.trim().toLowerCase()
  return text ? records.filter(row => row.text.toLowerCase().includes(text)) : records
})
const scroll = ref<HTMLDivElement | null>(null)
const mounted = ref(false)
const jump = ref(1)
const options = computed(() => ({
  enabled: mounted.value,
  count: rows.value.length,
  getScrollElement: () => scroll.value,
  estimateSize: () => 96,
  getItemKey: (index: number) => rows.value[index]!.id,
  overscan: 5,
}))
const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>(options)
const items = computed(() => virtualizer.value.getVirtualItems())
const total = computed(() => virtualizer.value.getTotalSize())
type MeasuredRowAttributes = HTMLAttributes & { 'data-index': number }
function measurementAttributes(index: number): MeasuredRowAttributes {
  return { 'data-index': index }
}
function measure(element: Element | ComponentPublicInstance | null) {
  // This DOM ref callback runs on the client, not during server rendering.
  if (element instanceof HTMLDivElement) virtualizer.value.measureElement(element)
  else if (element === null) virtualizer.value.measureElement(null)
}
function goToRow() {
  if (!Number.isFinite(jump.value) || rows.value.length === 0) return
  const index = Math.min(rows.value.length - 1, Math.max(0, Math.trunc(jump.value) - 1))
  virtualizer.value.scrollToIndex(index, { align: 'start', behavior: 'auto' })
}
function resetScroll() {
  virtualizer.value.scrollToOffset(0)
}
onMounted(() => { mounted.value = true })
</script>

<template>
  <section aria-label="Record browser">
    <label>
      Filter records
      <input v-model="filter" @input="resetScroll" />
    </label>
    <p role="status">{{ rows.length }} matching records</p>
    <form @submit.prevent="goToRow">
      <label>
        Row number
        <input v-model.number="jump" type="number" min="1" :max="Math.max(1, rows.length)" />
      </label>
      <button type="submit" :disabled="rows.length === 0 || !mounted">Go to row</button>
    </form>
    <p v-if="!mounted">The interactive list becomes available after hydration.</p>
    <p v-else-if="rows.length === 0">No matching records.</p>
    <div
      ref="scroll" class="viewport" tabindex="0" role="region"
      aria-label="Scrollable matching records"
    >
      <div :style="{ height: `${total}px`, position: 'relative' }">
        <div
          role="list" aria-label="Matching records" class="block"
          :style="{ transform: `translateY(${items[0]?.start ?? 0}px)` }"
        >
          <div
            v-for="item in items" :key="String(item.key)" :ref="measure"
            role="listitem" v-bind="measurementAttributes(item.index)"
            :aria-posinset="item.index + 1" :aria-setsize="rows.length"
            class="row"
          >
            {{ rows[item.index]!.text }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.viewport { height: 24rem; overflow: auto; border: 1px solid currentColor; }
.block { position: absolute; top: 0; left: 0; width: 100%; }
.row { box-sizing: border-box; padding: 1rem; border-bottom: 1px solid #888; overflow-wrap: anywhere; }
</style>
```

`measureElement` uses ResizeObserver for subsequent item-size changes. Do not repeatedly call `measure()` every render: it clears measurement caches and can cause jumps. Call `measure()` intentionally after a global geometry change that cannot be detected adequately, then let item observers rebuild measurements. Never apply both `resizeItem` and `measureElement` to the same item. Avoid smooth scrolling with dynamically measured items; changing positions undermine the target. Test images, web-font loading, zoom, and narrow widths, not just initial text dimensions.

## Window scrolling, grids, and tables

- `useWindowVirtualizer` supplies window scroll observation and an SSR-safe scroll-element getter. Do not override them as though it were an element virtualizer.
- Content above a window-scrolled list needs a measured **`scrollMargin`**. For absolute positioning relative to the list, subtract `options.scrollMargin` from each item's `start`; recalculate the margin when preceding layout changes, not just on the first mount. Do not confuse it with `paddingStart`, which adds virtual content space.
- Horizontal lists set `horizontal: true`, size the spacer width, and translate X. Two-dimensional grids require row and column virtualizers plus explicit cell geometry. Variable-height rows and columns are not interchangeable with fixed-size grid formulas.
- With TanStack Table, derive `rows` from `table.getRowModel().rows`; set virtual count to that length and keys to `rows[index].id`. Sorting/filtering must change the virtualizer's ordering and key mapping together.
- Absolute `<tr>` positioning can break native table layout. Choose a documented table-layout strategy and preserve headers, column widths, row/column counts, and screen-reader associations. A `<div>` collection is not a table merely because it looks tabular.

## Focus, interaction, and assistive technology

These are application design requirements, not automatic TanStack guarantees:

1. Keep persistent edit/selection state outside recycled row components and key it by record ID. Do not store drafts only inside a row that can unmount.
2. Never unmount the focused item silently. For interactive rows, track focused record ID and use a custom `rangeExtractor` (extending `defaultRangeExtractor`, imported from the Vue adapter) to retain its current index, or implement deliberate focus transfer before removal. Remap the ID after reordering/filtering; if it disappears, transfer focus deliberately instead of clamping to an unrelated record. A retained distant index needs the noncontiguous positioning strategy in the geometry contract, not the example's single flowing block.
3. To focus an offscreen target, call `scrollToIndex`, wait for Vue's render and the target's DOM registration, then focus by stable ID. `nextTick` alone does not prove an asynchronously measured item is present. Cancel stale focus requests when the data changes.
4. Do not add `role="grid"`/`listbox` without their full keyboard and selection patterns. Native controls and a labeled scroll region are preferable to a partial custom widget.
5. `aria-posinset`/`aria-setsize` describe list positions; ARIA grids instead need coherent row/column indexing and counts. Overscan does not make missing rows readable to all assistive technology.
6. Browser Find, printing, and copy-all do not see unmounted rows. Provide a real paginated table, text view, or export for those workflows. Do not promise complete screen-reader access based only on ARIA counts.

## SSR, hidden lists, and restoration

DOM dimensions do not exist on the server. The example keeps `enabled: false` until mount so server and first client output agree; the initial noninteractive boundary is intentional. If records are essential server-rendered content, render a useful paginated/nonvirtual view instead of an empty spacer. Alternatively, use deterministic `initialRect` and `initialOffset` only when the server/client can share those assumptions. Never read `window` during universal setup. Nuxt's `<ClientOnly>` is a Nuxt boundary, not a Vue SPA primitive.

Hidden/zero-sized containers must be reobserved/recomputed when shown. `enabled: false` pauses work; it is not proof of preserved measurements across every lifecycle. Core **3.19.6** includes newer capabilities such as end anchoring and `takeSnapshot`; do not copy these into older installed core releases. For restoration, preserve both measurement data and offset under stable IDs and the same layout assumptions. For chat, follow appends only if the reader is already at the end; do not pull a reader away from history. [Core changelog](https://github.com/TanStack/virtual/blob/main/packages/virtual-core/CHANGELOG.md), [chat guide](https://tanstack.com/virtual/latest/docs/chat).

### End-anchored chat and streaming

Core **3.19.6** supports this directly. Reuse the complete dynamic-row example's scroll container, measuring refs, spacer, and block layout; replace its data with the application-owned message sequence. Spread this complete option fragment into the existing computed options (`...chatOptions`); it is not a transport implementation:

```ts
const chatOptions = {
  anchorTo: 'end',
  followOnAppend: true,
  scrollEndThreshold: 80,
} as const
```

1. Keep ordinary oldest-to-newest array order and stable message IDs in `getItemKey`. Prepend older records with array replacement; do **not** reverse CSS flow, invert transforms, or also adjust `scrollTop`.
2. After the scroll element is mounted and the initial messages are available, call `virtualizer.value.scrollToEnd({ behavior: 'auto' })` for a new conversation. Do not repeat that initialization on every update or override a restored history position.
3. `anchorTo: 'end'` preserves the keyed visible record through prepends and compensates dynamically measured growth of the last streaming item while pinned. `followOnAppend` follows only readers already within `scrollEndThreshold`; it does not follow prepends or drag readers away from history. It also accepts `'auto'`, `'smooth'`, or `'instant'`; prefer nonanimated movement for continuous streaming/reduced motion.
4. Compute jump-button visibility from `!virtualizer.value.isAtEnd()` in a Vue tracking scope; call `scrollToEnd()` on activation. `getDistanceFromEnd()` gives the distance in pixels. `cancelScroll()` cancels an outstanding programmatic command when navigation/user intent supersedes it.
5. Own loading/error/cursor state outside the virtualizer. Fetch older history once per cursor while no request is pending; deduplicate IDs and preserve order before prepending. An appended loader row counts only while it exists; changing its identity to a message must not conflate their measurements.

The default core scroll compensation includes iOS WebKit touch/momentum/overscroll deferral. Do not layer a second compensation loop on top. Platform behavior remains a proposed browser check, not an exercised result. [Official chat workflow](https://tanstack.com/virtual/latest/docs/chat), [pinned core API](https://unpkg.com/@tanstack/virtual-core@3.19.6/dist/esm/index.d.ts).

### Restoration, hidden panels, and geometry controls

| Need | Concrete contract |
| --- | --- |
| Route restoration | Capture `{ measurements: instance.takeSnapshot(), offset: instance.scrollOffset ?? 0 }` **before** destroying the owner. Restore through `initialMeasurementsCache` and `initialOffset` when creating the new instance, not by reconstructing every row DOM node. Only actually measured items appear in the snapshot; others use estimates. |
| Safe saved state | Keep an application schema/version, record ordering/query key, and layout fingerprint (width, font, density, lane count) with the snapshot. Reject stale/mismatched geometry; untrusted persisted JSON needs shape checking. Read browser storage after a client boundary, never in universal setup. Keep SSR and first-client assumptions identical. |
| Inactive tabs | Set `useCachedMeasurements: !visible` reactively to avoid default DOM measurement overwriting sizes with zero while hidden. This option affects the default measurement implementation, not every custom `measureElement`. Restore normal measurement when visible. |
| Pause observers | `enabled: false` disables observers and resets virtualizer state while retaining the instance. It is **not** a cache-preservation guarantee; use the cache option/snapshot for that separate requirement. |
| Real spacing versus scroll targets | `paddingStart`/`paddingEnd` add content space; `scrollPaddingStart`/`scrollPaddingEnd` reserve clearance for `scrollToIndex` under sticky overlays. Neither replaces a real `scrollMargin`. |
| Known item sizes | Fixed rows need no measuring refs. For externally determined sizes call `resizeItem(index, pixels)`; do not also observe that index with `measureElement`. `measure()` clears caches globally, so reserve it for invalidated layout assumptions. |
| Size-change compensation | `shouldAdjustScrollPositionOnItemSizeChange` is an **instance property**, not an option. Override only with a defined anchoring policy and nullable-offset handling; defaults already avoid problematic backward-scroll remeasurement compensation. |
| Scroll notifications | `onChange(instance, sync)` runs after the Vue adapter triggers its ref; `sync` indicates scrolling. Read `isScrolling`/`scrollDirection` in computed values for presentation; do not fetch on every notification without deduplication. Leave `isScrollingResetDelay`, `useScrollendEvent`, and `useAnimationFrameWithResizeObserver` at defaults unless a measured platform issue justifies changing them. |

For infinite append, derive the last rendered index from `getVirtualItems()` and request the next cursor only while more results exist and no request is active. A table's local sort cannot globally reorder pages fetched in another order; reset the server cursor/query when sort semantics change. See [data-tables.md](data-tables.md).

### Masonry, sticky ranges, and RTL

`lanes` splits a vertical list into columns (horizontal list into rows). Position each item in its `VirtualItem.lane`, with explicit cross-axis lane width and `translateY(item.start)`; a single flowing block cannot lay out noncontiguous masonry lanes. `gap` controls scroll-axis spacing; define cross-axis gutters in your layout. `laneAssignmentMode: 'estimate'` caches assignment from estimates; `'measured'` uses measured sizes. Changing lane count clears/reassigns measurements, so expect a remeasurement boundary and invalidate incompatible restoration snapshots. Masonry is not the same as independently windowing both axes of a fixed grid.

Sticky group headers require both a retained index and actual sticky positioning. Extend `defaultRangeExtractor(range)` with the current preceding group-header index, deduplicate, sort, and keep indexes within `0 <= index < count`; retaining index zero indiscriminately is not a group-header algorithm. Add retained keyboard-focus indexes through the same extractor. For horizontal RTL use `horizontal: true`, `isRtl: true`, X-axis sizes/transforms, and coherent DOM direction; translating X alone does not establish RTL scrolling semantics.

The Vue hooks prefill scroll/rect/offset observer functions. Override them only for an intentional custom scroll platform with its cleanup contract; ordinary element/window lists should not replace them. [Advanced options and methods](https://tanstack.com/virtual/latest/docs/api/virtualizer), [exact 3.19.6 declarations](https://unpkg.com/@tanstack/virtual-core@3.19.6/dist/esm/index.d.ts).

## Evidence and proposed verification

Pinned registry/declaration research establishes the documented adapter and core boundary. The SFC is a complete example, not an exercised browser result. A strict source-consumer check is distinct from checking every third-party declaration: keep strict TypeScript/template/unknown-prop checks enabled; if upstream published declarations fail, report the full-declaration failure separately from any bounded `skipLibCheck: true` consumer result. Neither profile proves DOM measurement or GPU behavior. Parent verification should cover scroll-to-last-item, resize and image growth, filtering while scrolled, data prepend/reorder, zero rows, keyboard scrolling, focus retention, SSR hydration, print/export alternatives, and remount cleanup. Profile rendered node count and main-thread processing separately.

## Sources

- [Vue adapter 3.13.47 metadata](https://registry.npmjs.org/@tanstack/vue-virtual/3.13.47), [core 3.19.6 metadata](https://registry.npmjs.org/@tanstack/virtual-core/3.19.6).
- [Pinned Vue declarations](https://unpkg.com/@tanstack/vue-virtual@3.13.47/dist/esm/index.d.ts), [Vue API guide](https://tanstack.com/virtual/latest/docs/framework/vue/vue-virtual).
- [Virtualizer API: options, measurements, range extraction, scrolling](https://tanstack.com/virtual/latest/docs/api/virtualizer).
- [Official dynamic Vue example](https://github.com/TanStack/virtual/blob/main/examples/vue/dynamic/src/components/RowVirtualizerDynamic.vue), [official window example](https://github.com/TanStack/virtual/blob/main/examples/vue/dynamic/src/components/RowVirtualizerDynamicWindow.vue).
- [Vue 3.5.44 native attribute declarations](https://unpkg.com/@vue/runtime-dom@3.5.44/dist/runtime-dom.d.ts), [Vue object attribute binding](https://vuejs.org/guide/essentials/template-syntax#dynamically-binding-multiple-attributes).
