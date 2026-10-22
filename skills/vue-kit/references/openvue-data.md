# OpenVue data, hierarchy, and collection workflows

Use [OpenVue selection/architecture](openvue.md) first; use [setup](openvue-setup.md) for the app plugin and theme. This reference targets **openvue 1.0.0**, Vue 3.5, explicit component imports, and strict templates. Examples use real local data; none represents a remote service.

## Choose the data owner before the widget

| Need | Composition | State the application owns |
|---|---|---|
| Flat records, sortable/filterable cells, selection, editing | `DataTable` + `Column`; optional `ColumnGroup` + `Row` | Canonical records, stable keys, selection, expansion, edit commits, controlled page/filter/sort models |
| Hierarchical records with columns | `TreeTable` + `Column expander` | `TreeNode[]`, key-based expansion/selection; root pagination and child loading are separate |
| Hierarchical navigation/selection | `Tree` | Nodes, expansion/selection maps, lazy children, authorized drop decisions |
| Visual reporting hierarchy | `OrganizationChart` | **One root node**, children, selection/collapse maps; accessible equivalent content |
| Cards/list rather than cell semantics | `DataView` | Records, layout control, item markup/actions; component can sort/page locally |
| Standalone page navigation | `Paginator` | Zero-based `first`, positive `rows`, logical `totalRecords`, visible slice or remote query |
| Large viewport | `VirtualScroller`, or table `virtualScrollerOptions` | Full logical length, exact geometry, loaded windows, identity outside recycled DOM |
| User-defined order / two-list membership | `OrderList` / `PickList` | Ordered array / `[source, target]`, independent highlighted selections, commit policy |
| Statistical visualization | Optional `Chart` | Chart.js data/options, textual equivalent, client-side lifecycle; not table processing |

All imports use individual `openvue/<component>` paths. `Column`, `ColumnGroup`, and `Row` are table metadata/composition children, not standalone visual grids. Bind dynamic columns with stable `:key="column.field"` (or stable `columnKey` for non-field columns), not array positions. Body slots change presentation, not the underlying field used by sort/filter/export.

## DataTable contract: identity, processing, and models

**Identity:** choose immutable, unique primitive IDs before sorting, filtering, editing, replacing records, or paging. `dataKey="id"` enables key-based internal selection and expansion lookup; it does not turn the selection model into an ID array. Never use the displayed row index as a record identifier. IDs must be globally unique in the table's logical dataset, not merely unique on the current page. Reconcile selected objects against newly loaded canonical records after replacement; a highlighted row can still match by ID while an old selection object contains stale values.

| Model / event | Contract in 1.0.0 | Consequence |
|---|---|---|
| `value` | Array of records; `null`/`undefined` renders empty | Local mode receives the **whole** local dataset, not an already paged slice |
| `selection` | Single record or record array, according to `selectionMode` / selection column | Initialize multiple mode to `[]`; clear single mode with `undefined` for the declared prop type |
| `expandedRows` | With `dataKey`: `{ [id]: true }`; without it: record array | Prefer key map for large datasets. Expander column + `#expansion="{ data }"`; do not store DOM state as expansion state |
| `editingRows` | Use **record array** in row mode | Declaration also accepts a map, but release runtime iterates/spreads an array; map input is unsafe |
| `filters` | Field-keyed metadata, not a plain string per field | Two-way `v-model:filters`; slot draft and applied filters can differ in menu mode |
| `first`, `rows` | Zero-based first record offset and page size; both support model updates | Reset/clamp after query/dataset changes. `page` is zero-based, unlike a human page label |
| `sortField`, `sortOrder` | Field/getter and numeric direction; multiple mode uses ordered `multiSortMeta` | Use raw numbers/dates, format only in body slots; removable sort introduces unsorted state |
| `contextMenuSelection` | Separate context-menu record selection | Handle `row-contextmenu` and open the menu from its `originalEvent`; right-click is not an accessible replacement for a row action button |
| `row-reorder` | Emits reordered `value` | Assign only when that order is meaningful for canonical data; a filtered result is not the full dataset |

In local mode the runtime **filters, then sorts, then slices**. It copies for sorting, but row objects are still application records. A `Column sortable` header makes processing available; a controlled `sortField`/`sortOrder` makes its state explicit. Store amounts as `number` (`2`, `10`, `100`), not currency strings or mixed numeric strings; `dataType="numeric"` mainly configures filtering and does not parse your data. Multi-sort priority follows metadata order; provide an ID tie-breaker in application-owned queries for deterministic remote page boundaries. `compareSelectionBy="equals"` is object identity, whereas the default equality path can use `dataKey`.

Row selection and checkbox selection are distinct UI choices: table `selectionMode="single|multiple"` makes rows selectable; a `Column selectionMode="single|multiple"` provides radio/checkbox controls. `metaKeySelection=false` permits independent toggles (touch does not require modifier keys). Header select-all in local mode concerns available processed records, not an authorization-backed bulk operation. In lazy mode own `selectAll` + `select-all-change`; the table cannot know unseen records. Model a global remote selection as query fingerprint plus excluded IDs or explicit selected IDs in the application, never pretend a page's selected objects are all server records.

### Filter metadata and editors

Import `FilterMatchMode`, `FilterOperator`, and optional `FilterService` from **`@openvue/core/api`**; import `DataTableFilterMeta` from `openvue/datatable`. Include `@openvue/core@1.0.0` as a direct dependency when importing it directly. Row filters use `{ value: null, matchMode: FilterMatchMode.CONTAINS }`. Menu filters may use `{ operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] }`. `global` is a separate metadata entry; declare `globalFilterFields` explicitly rather than scanning confidential fields. `null` clears a constraint; use the match mode's value shape (number for comparisons, two values for between, array for in, real `Date` for date matching), not a formatted label.

`Column #filter` receives `filterModel` and `filterCallback`. Bind the input to `filterModel.value`; invoke the callback when the filter should apply. Calling it on every input is suitable for an immediate local row filter; menu Apply can batch constraints. `field`, `filterField`, and `sortField` may intentionally differ, but the filters object must use the actual filtering field. A custom `FilterService.register(name, predicate)` mutates a process-wide registry: register a pure uniquely named rule once during application setup, not on every component mount, and do not capture per-user secrets in it. For remote queries translate an allowlisted subset of fields/operators, not arbitrary metadata into SQL or document queries.

Cell mode uses `editMode="cell"`, a `Column #editor`, and `cell-edit-complete` (`data`, `newData`, `field`, `value`, `newValue`, `index`, completion `type`). Validate the draft and commit by ID. To reject completion, call **the wrapper event's `preventDefault()`**, not `originalEvent.preventDefault()`: the release runtime checks wrapper `defaultPrevented` before closing the editor. The declaration omits these wrapper members; narrow structurally before calling, as in the complete cell example below. Escape cancels; Enter, outside click and Tab can complete, so a click-only save test misses important behavior. Tab also invokes cell-navigation behavior after completion; rejection is not itself a promise of retained keyboard focus. Row mode uses `editingRows`, an editor column, and `row-edit-save`; `newData` is the draft, **not an automatic save to canonical records**. Do not do `records[event.index] = newData`: indices reflect a processed page. Nested drafts require application-aware cloning/validation; shallow copies do not isolate nested mutable objects. Keep key fields non-editable. Async saves need a real pending/error policy and authorization; no timeout should masquerade as persistence.

### Complete local inventory workflow — `InventoryTable.vue`

The table owns local processing; the component owns canonical records and commit validation. Selected objects are reconciled when records are replaced. Changing the filter resets the offset; selection remains across pages and filters until explicitly cleared. Invalid saves retain the old canonical value and announce an error; use Edit again to correct the rejected draft. There is no storage or network dependency.

```vue
<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { FilterMatchMode } from '@openvue/core/api'
import DataTable from 'openvue/datatable'
import type { DataTableEditingRows, DataTableExpandedRows, DataTableFilterMeta, DataTableRowEditSaveEvent } from 'openvue/datatable'
import Column from 'openvue/column'

interface Product { id: string; name: string; stock: number }
const products = ref<Product[]>([
  { id: 'p10', name: 'Cedar', stock: 10 },
  { id: 'p2', name: 'Birch', stock: 2 },
  { id: 'p100', name: 'Maple', stock: 100 },
  { id: 'p4', name: 'Pine', stock: 4 },
  { id: 'p20', name: 'Oak', stock: 20 },
  { id: 'p1', name: 'Ash', stock: 1 }
])
const selected = ref<Product[]>([])
const editing = ref<Product[]>([])
const expanded = ref<Record<string, boolean>>({})
const first = shallowRef(0)
const rows = shallowRef(2)
const sortField = shallowRef<keyof Product>('stock')
const sortOrder = shallowRef<number | undefined>(1)
const error = shallowRef('')
const notice = shallowRef('No changes saved.')
const filters = ref<DataTableFilterMeta>({
  name: { value: null, matchMode: FilterMatchMode.CONTAINS }
})
const selectedNames = computed(() => selected.value.map(p => `${p.name} (${p.stock})`).join(', ') || 'None')

function updateSelection(value: Product | Product[] | undefined) {
  selected.value = Array.isArray(value) ? value : value ? [value] : []
}
function updateExpansion(value: Product[] | DataTableExpandedRows) {
  if (Array.isArray(value)) throw new Error('Keyed expansion requires a key map.')
  expanded.value = value
}
function updateEditing(value: Product[] | DataTableEditingRows) {
  if (!Array.isArray(value)) throw new Error('Row editing requires a record array in this release.')
  editing.value = value
}
function updateSortField(value: string) {
  if (value === 'id' || value === 'name' || value === 'stock') sortField.value = value
}

function save(event: DataTableRowEditSaveEvent) {
  const draft: unknown = event.newData
  if (typeof draft !== 'object' || draft === null ||
      !('id' in draft) || typeof draft.id !== 'string' ||
      !('name' in draft) || typeof draft.name !== 'string' ||
      !('stock' in draft) || typeof draft.stock !== 'number' ||
      !Number.isSafeInteger(draft.stock) || draft.stock < 0) {
    error.value = 'Stock must be a nonnegative whole number. The record was not changed.'
    return
  }
  const current = products.value.find(p => p.id === draft.id)
  if (!current || current.name !== draft.name) {
    error.value = 'The record identity changed. The record was not changed.'
    return
  }
  const updated: Product = { id: current.id, name: current.name, stock: draft.stock }
  products.value = products.value.map(p => p.id === updated.id ? updated : p)
  const selectedIds = new Set(selected.value.map(p => p.id))
  selected.value = products.value.filter(p => selectedIds.has(p.id))
  error.value = ''
  notice.value = `Saved ${updated.name}: ${updated.stock}.`
}
function replaceRecords() {
  products.value = products.value.map(p => ({ ...p }))
  const selectedIds = new Set(selected.value.map(p => p.id))
  selected.value = products.value.filter(p => selectedIds.has(p.id))
  notice.value = 'Records replaced; selected identities retained.'
}
</script>

<template>
  <section aria-labelledby="inventory-title">
    <h2 id="inventory-title">Local inventory</h2>
    <p>Sort stock numerically, select records, and edit stock. Pages contain two records initially.</p>
    <button type="button" @click="replaceRecords">Replace record objects</button>
    <button type="button" @click="selected = []">Clear selection</button>
    <p role="status">{{ notice }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p id="inventory-selection">Selected: {{ selectedNames }}</p>
    <DataTable
      :value="products" dataKey="id" selectionMode="multiple" :metaKeySelection="false"
      :selection="selected" :expandedRows="expanded" :editingRows="editing"
      @update:selection="updateSelection" @update:expandedRows="updateExpansion" @update:editingRows="updateEditing"
      v-model:first="first" v-model:rows="rows" :sortField="sortField" @update:sortField="updateSortField"
      v-model:sortOrder="sortOrder"
      v-model:filters="filters" paginator :rowsPerPageOptions="[2, 3, 6]"
      paginatorTemplate="PrevPageLink PageLinks NextPageLink RowsPerPageDropdown CurrentPageReport"
      currentPageReportTemplate="{first}–{last} of {totalRecords}"
      filterDisplay="row" editMode="row"
      :tableProps="{ 'aria-label': 'Inventory records', 'aria-describedby': 'inventory-selection' }"
      :editButtonProps="{ init: { 'aria-label': 'Edit stock' }, save: { 'aria-label': 'Save stock' }, cancel: { 'aria-label': 'Cancel stock edit' } }"
      @row-edit-save="save"
    >
      <Column expander :exportable="false" />
      <Column field="name" header="Name" sortable :showFilterMenu="false">
        <template #filter="{ filterModel, filterCallback }">
          <input v-model="filterModel.value" aria-label="Filter names" @input="filterCallback()" />
        </template>
      </Column>
      <Column field="stock" header="Stock" sortable dataType="numeric">
        <template #editor="{ data }">
          <input v-model.number="data.stock" type="number" step="1" :aria-label="`Stock for ${data.name}`" />
        </template>
      </Column>
      <Column rowEditor :exportable="false" />
      <template #expansion="{ data }"><p>{{ data.name }} has stable ID {{ data.id }}.</p></template>
      <template #empty>No matching inventory records.</template>
    </DataTable>
  </section>
</template>
```

The fixture uses deliberately non-lexical numeric values. A useful test asserts row order `Ash, Birch`, next page `Pine, Cedar`, selects Cedar, edits its stock to `0`, then navigates back to find Cedar before Ash on the first page; selection must still identify **p10**, not whichever row occupies its old offset. The displayed selection uses canonical committed data rather than echoing an edit event.

**Filter-event ownership:** the release's built-in `onFilterApply` resets `first` and emits its model update when filters actually apply. Do not reset the offset unconditionally inside `@filter`: local `filter()` also emits that event while recomputing processed data, and its event metadata reads the page offset. An unconditional reset there can immediately undo navigation. Use the built-in filter callback/model path for this local example; application-owned remote query changes reset their query offset at that owner's change boundary.

### Complete validated cell workflow — `ValidatedCell.vue`

This is a separate cell-mode owner, not a second draft owner for the row-mode example. Invalid Enter completion retains the editor and canonical stock; correcting the value commits by immutable ID. The guard exposes a missing release cancellation hook as a real error rather than silently accepting invalid completion.

```vue
<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import DataTable from 'openvue/datatable'
import type { DataTableCellEditCompleteEvent } from 'openvue/datatable'
import Column from 'openvue/column'

interface StockItem { id: string; name: string; stock: number }
const records = ref<StockItem[]>([{ id: 'sku-7', name: 'Washer', stock: 5 }])
const error = shallowRef('')
const canonical = computed(() => records.value.map(item => `${item.id}: ${item.stock}`).join(', '))
function complete(event: DataTableCellEditCompleteEvent<StockItem>) {
  const stock: unknown = event.newValue
  if (event.field !== 'stock' || typeof stock !== 'number' || !Number.isSafeInteger(stock) || stock < 0) {
    if ('preventDefault' in event && typeof event.preventDefault === 'function') event.preventDefault()
    else throw new Error('The cell completion event does not expose the required cancellation hook.')
    error.value = 'Stock must be a nonnegative whole number. Correct the value or press Escape.'
    return
  }
  records.value = records.value.map(item => item.id === event.data.id ? { ...item, stock } : item)
  error.value = ''
}
function cancel() { error.value = '' }
</script>

<template>
  <section aria-labelledby="cell-title">
    <h2 id="cell-title">Validated cell inventory</h2>
    <p id="cell-canonical">Committed stock: {{ canonical }}</p>
    <p v-if="error" id="cell-error" role="alert">{{ error }}</p>
    <DataTable :value="records" dataKey="id" editMode="cell"
      :tableProps="{ 'aria-label': 'Cell inventory', 'aria-describedby': 'cell-canonical' }"
      @cell-edit-complete="complete" @cell-edit-cancel="cancel">
      <Column field="name" header="Name" />
      <Column field="stock" header="Stock">
        <template #editor="{ data }">
          <input v-model.number="data.stock" type="number" step="1" aria-label="Washer stock"
            :aria-invalid="!!error" :aria-describedby="error ? 'cell-error' : undefined" />
        </template>
      </Column>
    </DataTable>
  </section>
</template>
```

Regression boundary: preventing only the original DOM Enter event leaves the wrapper's `defaultPrevented=false`, so the editor closes. The prepared browser scenario asserts that an invalid draft's input remains **visible and focused**, its accessible error association is present, and committed stock stays 5; it then corrects to 8 and checks the rendered cell and canonical stock, followed by Escape cancellation of another invalid draft.


### Table composition beyond prop lists

- **Grouped columns:** import `ColumnGroup` from `openvue/columngroup` and `Row` from `openvue/row`. Place `<ColumnGroup type="header"><Row>…</Row></ColumnGroup>` alongside the leaf body Columns; the group does not replace body column definitions. Header/footer `colspan`/`rowspan` totals must match visible leaf columns, including selection/expander/action columns. Put field/sort metadata on meaningful leaf headers. Recompute groups when columns are toggled; a hidden column with an unchanged colspan produces a misleading grid.
- **Row groups:** `rowGroupMode="subheader|rowspan"` + `groupRowsBy`; sort by the group field so contiguous rendering has correct meaning. `groupheader`/`groupfooter` slots render group context. Group expansion is separate from row expansion. Aggregates must declare whether they cover all records, filtered records, current page, or the server's full query. Do not infer a grand total from a page.
- **Scrollable/frozen/resizable:** `scrollable` + a bounded `scrollHeight`; `frozenValue` pins records, `Column frozen`/`alignFrozen` pins columns. Fixed widths and sticky layers must still work at zoom. `resizableColumns`/`columnResizeMode="fit|expand"` change geometry, not data. Persist widths by stable column keys. Do not assume a frozen record is absent from the ordinary value array: avoid duplicate logical rows yourself.
- **Reorder/toggle:** column reordering uses `reorderableColumns` and stable `columnKey`; drag rows use a `Column rowReorder` and `row-reorder` assignment. Provide keyboard/button equivalents when reorder is an essential task. Do not combine a sorted/filter-restricted view with an unexplained permanent drag ordering. Toggling a Column is application state; decide whether a hidden field still participates in filters, exports, and totals.
- **Slots/presentation:** header/footer/empty/loading provide useful loading and recovery text; `Column #body` receives record data, field and index; `#editor` receives the draft. Use escaped interpolation for cell values. `rowClass`/`rowStyle` can communicate status visually but must not be its sole encoding. Button actions need record-specific accessible names.

### Lazy queries are not a transport

Set `lazy` only when the application owns processing. Supply the current page's records, logical filtered `totalRecords`, current offset/size, filter/sort models, and loading/error UI. `page`, `sort`, and `filter` events describe requested state; they do **not** fetch or persist anything. Never combine local manual filtering/slicing with the table's ordinary local processing. With `virtualScrollerOptions.lazy`, table local processing is also bypassed.

An application-owned remote interface can be `load({ offset, limit, sort, filters }, signal) -> Promise<{ records, total }>`; its implementation, wire schema, auth, error mapping, and authorization must come from the application. Allowlist field names/operators, define date/time-zone and null ordering, include stable tie-breaking IDs, reset offset on filter/sort changes, and clamp when totals shrink. One owner translates table events into that query. Abort superseded loads **and** guard stale responses by request generation; a late result must not overwrite newer records, loading/error, or selection. Abort/invalidate on owner disposal. Keep per-query errors and previously loaded data distinguishable. An offset API is not automatically a cursor API: a numbered paginator cannot truthfully jump to an arbitrary unknown cursor.

Lazy TreeTable queries page **root nodes**; `totalRecords` counts roots, not visible descendants. Loading a child's branch on `node-expand` is another owner/keyed request and must not replace unrelated nodes or duplicate children after repeated expansion. For unknown children use `leaf: false`; loaded empty children can become leaves. Loaded-node checkbox propagation does not authorize or enumerate unloaded descendants.

### Virtualization geometry and sparse data

`VirtualScroller` needs `items`, a finite viewport, an item slot, and an honest `itemSize`. In vertical mode this is the **outer row height in pixels**; horizontal uses width; `orientation="both"` uses `[height, width]` and a two-dimensional item array. Padding/border must fit inside that size (`box-sizing: border-box`); wrapping text, editor controls, expanded details, density changes and fonts can invalidate it. Table integration supports vertical orientation only. Do not combine variable-height expansion with a fixed-height assumption. Release 1.0.0 also declares `getItemSize(index)` for vertical variable sizes: supply known positive sizes; it is not automatic DOM measurement, and horizontal/both ignore that path.

`numToleratedItems` controls overscan; `delay` defers window rendering/loading; neither defines the true dataset size. `appendOnly` accumulates DOM and can defeat bounded memory. `showLoader`, `loading`, `loaderDisabled`, `#loader`, and table `Column #loading` are different loading/presentation responsibilities. A lazy event's `first` is inclusive, `last` **exclusive**. Preallocate an array of the logical total length, retain holes/`undefined` for unloaded records, and fill exact indices. Never `push` chunks into a compact array: the scrollbar and selected row indices would describe a different dataset. Guard hole content before reading fields. Reset sparse cache and scroll offset when query identity changes. Remote windows need query-generation + window-key ownership, deduplication, stale-result rejection, and cancellation on disposal. Do not claim an offscreen row is unmounted merely because it is outside the viewport; assert actual disconnectedness when testing lifecycle cleanup.

### Complete sparse local viewport — `SparseCatalog.vue`

This is genuinely local lazy **materialization**, not a simulated remote API. The source contains real records; only requested ranges are copied into the logical window. No timers, fetch stubs, or fake pending state are needed. Item actions retain logical identity outside recycled slots.

**Root identity:** in 1.0.0 the declared VirtualScroller `id` prop is not forwarded by the published root render. Put a needed DOM ID in declared `pt.root`, alongside the root accessible name, as below; a declared prop alone is not evidence that the resulting element has that ID.

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import VirtualScroller from 'openvue/virtualscroller'
import type { VirtualScrollerLazyEvent } from 'openvue/virtualscroller'
interface Entry { id: string; title: string }
const source: Entry[] = Array.from({ length: 200 }, (_, index) => ({ id: `record-${index}`, title: `Record ${index}` }))
const items = shallowRef<(Entry | undefined)[]>(new Array<Entry | undefined>(source.length).fill(undefined))
const chosen = shallowRef<Entry | null>(null)
function materialize({ first, last }: VirtualScrollerLazyEvent) {
  const next = items.value.slice()
  for (let index = first; index < Math.min(last, source.length); index++) next[index] = source[index]
  items.value = next
}
</script>

<template>
  <section aria-labelledby="catalog-title">
    <h2 id="catalog-title">Local virtual catalog</h2>
    <p role="status">{{ chosen ? `Chosen ${chosen.id}: ${chosen.title}` : 'No catalog record chosen.' }}</p>
    <VirtualScroller
      :items="items" :itemSize="48" scrollHeight="240px" lazy @lazy-load="materialize"
      :pt="{ root: { id: 'catalog-viewport', 'aria-label': 'Catalog viewport' } }"
    >
      <template #item="{ item, options }">
        <div :key="item?.id ?? options.index" :id="`catalog-record-${options.index}`" class="catalog-row">
          <button v-if="item" type="button" @click="chosen = item">Choose {{ item.title }}</button>
          <span v-else>Loading record {{ options.index }}</span>
        </div>
      </template>
    </VirtualScroller>
  </section>
</template>

<style scoped>
.catalog-row { height: 48px; box-sizing: border-box; display: flex; align-items: center; padding: 4px; white-space: nowrap; }
</style>
```

A virtual scroller supplies no complete listbox/tree keyboard interaction by itself. Preserve a meaningful semantic wrapper, focusable actions and accessible names. If a focused item scrolls out and is removed, implement a product-specific focus strategy rather than recycling focus onto a different ID. For screen-reader access to all records, pagination or a nonvirtual alternative may be preferable.

## Hierarchies: shared node shape, different widgets

Import type `TreeNode` from `openvue/treenode`. Nodes use stable `key`, optional `label`, `data`, `children`, `leaf`, `selectable`, icons, and `type` to choose a named slot. TreeTable fields refer to **`node.data`** (body slots also provide `node`), whereas Tree labels normally use `node.label`. Keep node keys independent of labels and sibling positions; filtering/reparenting must not change identity. Do not put cyclic parent objects into persisted node payloads.

| Widget | Value / model | Semantic and loading boundary |
|---|---|---|
| `Tree` | `TreeNode[]`; `expandedKeys={key:true}`; single/multiple `selectionKeys={key:true}`; checkbox `{key:{checked,partialChecked}}` | Tree/treeitem/group semantics with calculated hierarchy metadata; `node-expand/collapse/select/unselect` carry nodes. Strict vs lenient filtering changes descendant inclusion |
| `TreeTable` | `TreeNode[]` + Columns; same key-map selection shapes; `Column expander` | Treegrid; columns read `data`; root pagination is not flat visible-row pagination. Sorting/filtering maintain hierarchical boundaries |
| `OrganizationChart` | **One `OrganizationChartNode`**, children array; boolean-valued selection map; `collapsedKeys` presence means collapsed | Table-based diagram with explicitly limited screen-reader support. Supply an equivalent nested list/tree/table for essential information |

For Tree filter, `filterBy` is comma-separated node fields or a getter; default `label`. Lenient mode keeps all descendants of a matched node, strict mode continues testing descendants. This is not authorization filtering. Use labelled filter controls (`pt.pcFilterInput` as declared) and do not discard canonical nodes when a filtered projection changes. Tree drag/drop can cross widgets using compatible scopes; `validateDrop` requires handling the emitted acceptance contract (`accept` on the drop event). Reject cycles, invalid parent types and unauthorized moves in application policy; native drag capability is not proof of permission. Keep an accessible move action when reparenting is essential.

Expansion maps are plain objects, **not JavaScript `Map` instances**, despite some official prose calling them maps. Checkbox state is not interchangeable with boolean selection and partial checks represent descendants, not a third record permission. Lazy nodes need per-node loading/error/retry state, not a single indefinite global mask. In Tree, arrows navigate visible nodes; Right expands or enters a branch, Left collapses or goes to parent, Home/End target boundaries, Enter/Space handle selection where enabled. TreeTable has row navigation, expander controls and sort headers; test actual focus plus `aria-expanded`/`aria-selected`/`aria-checked`, not just emitted model values. Custom interactive slots must not hijack those keys.

**Tree 1.0.0 accessibility discrepancy:** the [published node runtime](https://unpkg.com/openvue@1.0.0/tree/index.mjs) reverses the documented attribute mapping: single/multiple selection is exposed as `aria-checked`, while checkbox mode supplies `aria-selected`. A selected node in single mode therefore has `aria-checked="true"` and no `aria-selected`. Test this actual release behavior without claiming it satisfies the documented semantics; the corresponding TreeTable row still exposes `aria-selected`. For an accessibility-critical tree workflow, resolve the upstream defect or choose a widget with the required supported semantics rather than adding contradictory ARIA attributes blindly.

OrganizationChart `type` selects named slots and `collapsible` enables togglers; nodes can opt out with `selectable:false`/`collapsible:false`. In 1.0.0 **`update:collapsedKeys` is incorrectly declared as boolean while runtime emits an object**. Leave collapse internally owned when using strict templates rather than casting a model, or fix the upstream declaration before implementing controlled collapse. Selection is correctly object-shaped. Its Enter/Space togglers do not turn the diagram into an accessible Tree widget.

### Complete hierarchy consumer — `HierarchyBrowser.vue`

The same node identity can coordinate Tree selection and a corresponding TreeTable row without converting selection into row objects. OrganizationChart demonstrates the separate single-root model and intentionally internal collapse owner. The explicit nested list preserves the reporting hierarchy as accessible text.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Tree from 'openvue/tree'
import TreeTable from 'openvue/treetable'
import Column from 'openvue/column'
import OrganizationChart from 'openvue/organizationchart'
import type { TreeNode } from 'openvue/treenode'
import type { OrganizationChartNode } from 'openvue/organizationchart'
const nodes = ref<TreeNode[]>([
  { key: 'hardware', label: 'Hardware', data: { name: 'Hardware', count: 12 }, children: [
    { key: 'bolts', label: 'Bolts', data: { name: 'Bolts', count: 10 } },
    { key: 'nuts', label: 'Nuts', data: { name: 'Nuts', count: 2 } }
  ] }
])
const expanded = ref<Record<string, boolean>>({})
const selected = ref<Record<string, boolean>>({})
const organization: OrganizationChartNode = {
  key: 'lead', label: 'Lead', children: [{ key: 'maker', label: 'Maker' }]
}
</script>

<template>
  <section aria-labelledby="hierarchy-title">
    <h2 id="hierarchy-title">Stock hierarchy</h2>
    <Tree :value="nodes" v-model:expandedKeys="expanded" v-model:selectionKeys="selected"
      selectionMode="single" ariaLabel="Stock categories" />
    <TreeTable :value="nodes" v-model:expandedKeys="expanded" v-model:selectionKeys="selected"
      selectionMode="single" :tableProps="{ 'aria-label': 'Hierarchical stock records' }">
      <Column field="name" header="Name" expander />
      <Column field="count" header="Count" />
    </TreeTable>
    <h3>Reporting structure</h3>
    <OrganizationChart :value="organization" collapsible>
      <template #default="{ node }">{{ node.label }}</template>
    </OrganizationChart>
    <ul aria-label="Reporting structure text"><li>Lead<ul><li>Maker</li></ul></li></ul>
  </section>
</template>
```

## DataView and standalone Paginator

Import `DataView` from `openvue/dataview`; `#list="{ items }"` and `#grid="{ items }"` receive **the processed page array**, not one item at a time. Render your own keyed loop. Bind `layout="list|grid"`, supply the matching slots and controls; a grid layout is application CSS (CSS Grid is sufficient, no utility framework dependency). There is no automatic selection/edit model: implement domain actions in each card. Include heading/list semantics and useful empty/loading content. A custom layout toggle needs button names and `aria-pressed`; do not assume copied examples contain a built-in layout selector.

Local DataView `sortField` and **`sortOrder`** sort, `paginator` + `rows` page; official prose repeats `sortField` but the second binding is `sortOrder`. It does not provide DataTable filtering. Bind `first`/`rows` and handle `page` or their update events; reset offset after sort/filter choices. Lazy mode supplies one page and a logical total; like the table it is not a service. `dataKey` does not key your manually written slot loop, so still use `:key="item.id"`. Skeleton markup should preserve card geometry and mark the region busy without presenting fake data as loaded records.

Import `Paginator` from `openvue/paginator`. It emits `PageState { first, rows, page, pageCount }`; `first` and `rows` are controlled via models, while `totalRecords` is the full filtered count, not visible page length. Slice locally **once**, e.g. `computed(() => filtered.value.slice(first.value, first.value + rows.value))`; the paginator never slices your data. A table/DataView already using its paginator must not also receive this slice. On filter/size/deletion changes reset or clamp offset to a valid page, including zero-record results. Default row-size dropdown needs `rowsPerPageOptions`. Report placeholders include `{currentPage}`, `{totalPages}`, `{rows}`, `{first}`, `{last}`, `{totalRecords}`; human report numbering is not an API offset.

`template` can order `FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown JumpToPageDropdown JumpToPageInput CurrentPageReport`; breakpoint template keys are **max-width** with a `default` fallback. `#start`/`#end` add content without replacing navigation. Headless `#container` exposes navigation and row-change callbacks plus state: if used, implement nav naming, disabled boundaries, `aria-current="page"`, actual buttons, focus and live reporting yourself; callback existence is not accessible UI. The standard control has labelled nav buttons, current-page state and polite reporting, so prefer it unless custom composition is necessary.

**Headless offset trap:** [published runtime](https://unpkg.com/openvue@1.0.0/paginator/index.mjs) supplies `#container`'s `first` as `d_first + 1`, a display ordinal, while `page` events and `#start`/`#end` state use the zero-based offset. Slice/query with the owned `first` model or `PageState.first`, not the container's reporting value; explicitly handle the empty dataset rather than reporting record 1 of 0.

## OrderList and PickList: ordering is data, highlighting is not

Import `OrderList` from `openvue/orderlist`; `v-model` is the **ordered records**, `v-model:selection` is the highlighted record array. Import `PickList` from `openvue/picklist`; `v-model` is `[sourceRecords, targetRecords]`, `selection` is `[sourceHighlights, targetHighlights]`, not the chosen target itself. Initialize both dimensions, even if empty. Supply `dataKey`, an `#option="{ option, index, selected }"` slot and the appropriate header/sourceheader/targetheader slots. A rendered option label does not change record identity.

The ordering/transfer buttons update the model and emit reorder/transfer events (`reorder`, `move-to-target`, `move-all-to-target`, `move-to-source`, `move-all-to-source`). Persist the final ordered membership through an application-owned save transaction; a move is not a server save. Maintain disjoint source/target membership and stable global IDs after external refresh; reconcile highlight state as records move/disappear. Do not independently sort the model after a user's reorder, or split the two dimensions into unsynchronized owners. For remote partial datasets, “move all” can only mean available records unless an application service explicitly supports query-wide membership.

The widgets use Listbox internally: arrow/Home/End navigation, Space selection, modifier/range selection and labelled movement buttons need to remain operable. Avoid nested buttons/links inside selectable option content unless deliberately designed with tested focus behavior. Essential reorder/transfer must remain available by buttons, not drag-only. Name both lists and movement directions; announce consequential saved outcomes and retain sensible focus after transfer.

**Release conflict:** official a11y prose mentions `listProps`, `sourceListProps`, `targetListProps` and differently named transfer props. These are not the 1.0.0 declared API. OrderList declares `ariaLabel`/`ariaLabelledby`, and both expose `pt.pcListbox` (its `list` target carries listbox attributes). PickList button props are `moveToTargetProps`, `moveAllToTargetProps`, `moveToSourceProps`, `moveAllToSourceProps`; use them or declared `pc…Button` PT targets. If two distinct list names require dynamic PT, derive them from the actual Listbox instance props supplied to the PT callback, not a guessed DOM root attribute. Test the resulting **listbox** accessible names. Do not force undeclared props through casts.

## Persistence, export, and trust boundaries

`stateKey` enables table state; `stateStorage="session|local"` chooses browser storage. Stored state includes paging, sort/filter, column geometry/order, expansion, **selection objects and selection keys**, not only harmless UI preferences. Do not opt in for sensitive records or cross-account shared browser data. Scope a versioned key by application/tenant/user/table, clear at logout/account switch/schema migration, validate restored state against allowed fields/columns, and reconcile persisted selection with current authorized records. Browser storage is user-controlled, synchronous and can fail; it is not durable business persistence. Do not read `window`/storage at module scope during SSR; coordinate restoration with client mount and initial query ownership to avoid duplicate or stale loads. Function-valued sort fields are not serializable; restored dates/filter values need their correct types. Prefer explicitly owned, allowlisted preference persistence when the full built-in state is inappropriate.

The table instance exposes `exportCSV(options?, data?)`; `selectionOnly` applies to current selected objects, otherwise export uses processed available records (and may include frozen records), **not just the visible page**. Lazy export cannot recover unseen rows. Set `Column exportable=false` for expander/selection/action columns and `exportHeader` for intentional headings; inspect how custom body formatting differs from raw field values. The 1.0.0 runtime exports columns with a `field`; do not assume a display-only slot is exported. `exportFunction` receives cell data and field; when supplied it bypasses default cell quote escaping, so perform proper quote doubling yourself. CSV quoting alone does **not** neutralize spreadsheet formulas (`=`, `+`, `-`, `@`, leading tab/CR); decide the target spreadsheet threat model, neutralize unsafe user-entered text, and never export unauthorized or hidden-sensitive fields by accident. Static export headers must also be safe. Full-query remote exports require an authorized application service, not a fake complete file made from one page.

DataTable is a semantic table, not automatically an editable ARIA grid. Label `tableProps`, preserve header/cell associations and `aria-sort`; built-in selection/expand/edit controls use locale labels and expansion links use `aria-expanded`/`aria-controls`. Custom editors/filters require their own labels, error messages and focus strategy. A stock editor must announce validation failure and retain a recoverable path. Sort headers support Enter/Space, row selection supports navigation/selection keys, and filter menus have focus/escape behavior. Test these effects after sorting/paging and object replacement. Decorative color must not substitute for text; keyboard shortcuts must not unexpectedly select data while typing into an editor.

## Optional Chart boundary

`openvue/chart` wraps Chart.js and dynamically imports its auto-registered client entry. The published package declares **optional** `chart.js:^4.0.0`: Chart runtime imports and a runtime Chart.js dependency belong only to chart consumers, not tables, Tree, DataView or VirtualScroller. **Exact 1.0.0 type-graph defect:** [`openvue/config`](https://unpkg.com/openvue@1.0.0/config/index.d.ts) imports Chart pass-through types, and [`openvue/chart`](https://unpkg.com/openvue@1.0.0/chart/index.d.ts) imports Chart.js declarations. Therefore a canonical plugin-config consumer with `skipLibCheck:false` requires Chart.js declarations even without rendering Chart. Use the setup's explicit **dev-only `chart.js@4.6.1` type prerequisite** for that graph; do not add a fake module, skip full checking, or import/register Chart at runtime to hide the problem. `ChartData<TType>`, `ChartOptions<TType>`, plugins and chart types come from `chart.js`; the OpenVue wrapper is not a separate chart grammar. Chart's `select` event gives a dataset/element interaction, not a DataTable selection model. Chart types include bar/line/pie/doughnut/radar/polarArea/bubble/scatter; horizontal bar is `indexAxis:'y'`, stacking is per-scale `stacked`, mixed charts use dataset type, multiaxis uses declared axis IDs, and bubble radius is pixels rather than a scaled measure. These choices must match data semantics, not decoration.

`themed` defaults true in **1.0.0**: theme-derived colors/fonts/grids track theme changes, explicit options take precedence, and `themed=false` leaves presentation to Chart.js/application options. Dataset order drives default palette assignment; keep series identities stable when filtering and provide legends/text, not color-only distinctions. The wrapper creates/destroys the chart on its component lifecycle and exposes instance methods such as `getChart`, `refresh`, `reinit`, and `toBase64Image`; do not retain a destroyed chart instance outside the owner's lifetime. SSR needs client rendering for actual canvas output; keep server-rendered textual data available. Give responsive charts an explicitly sized parent and use Chart.js responsive/aspect-ratio options deliberately.

Use `canvasProps` for canvas `role="img"`/accessible name, and render an adjacent textual summary/table with the same data. **Release conflict:** the official page recommends fallback children inside Chart, but `ChartSlots` is empty in the 1.0.0 declarations; use a sibling table under strict templates rather than asserting an undeclared slot. Chart.js keyboard/data accessibility is not supplied by a painted canvas. Do not expose untrusted Chart.js callbacks/plugins from JSON, nor export an image as the only accessible representation.

## Evidence and release-conflict ledger

The complete assigned corpus was read at commit `d064f02ac75c3aaeb60a676c70e5ee08e3e3042e`; generated example services, truncated/high-risk snippets and outdated prose are treated as evidence to reconcile, not runnable dependencies. Published 1.0.0 declarations **and runtime** determine the copyable contracts above.

| Assigned official page | Source and release evidence | Disposition / conflict |
|---|---|---|
| DataTable | [Pinned official page](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/components/datatable.md), [declarations](https://unpkg.com/openvue@1.0.0/datatable/index.d.ts), [runtime](https://unpkg.com/openvue@1.0.0/datatable/index.mjs), [Column](https://unpkg.com/openvue@1.0.0/column/index.d.ts), [ColumnGroup](https://unpkg.com/openvue@1.0.0/columngroup/index.d.ts), [Row](https://unpkg.com/openvue@1.0.0/row/index.d.ts), [filter exports](https://unpkg.com/@openvue/core@1.0.0/api/index.d.ts) | Deep coverage; use array editing model despite map union; real local workflow replaces unprovided demo services and fake remote delays |
| TreeTable | [Pinned page](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/components/treetable.md), [declarations](https://unpkg.com/openvue@1.0.0/treetable/index.d.ts), [runtime](https://unpkg.com/openvue@1.0.0/treetable/index.mjs) | Covered with hierarchical processing/root totals; a11y prose's contradictory flat-table wording does not erase treegrid semantics |
| Tree | [Pinned page](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/components/tree.md), [declarations](https://unpkg.com/openvue@1.0.0/tree/index.d.ts), [runtime](https://unpkg.com/openvue@1.0.0/tree/index.mjs), [node type](https://unpkg.com/openvue@1.0.0/treenode/index.d.ts) | Covered; “Map instance” prose means plain key object in runtime, not native Map |
| OrganizationChart | [Pinned page](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/components/organizationchart.md), [declarations](https://unpkg.com/openvue@1.0.0/organizationchart/index.d.ts), [runtime](https://unpkg.com/openvue@1.0.0/organizationchart/index.mjs) | Covered; one root not array; boolean collapse emit declaration conflicts with object runtime; accessible equivalent required |
| DataView | [Pinned page](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/components/dataview.md), [declarations](https://unpkg.com/openvue@1.0.0/dataview/index.d.ts), [runtime](https://unpkg.com/openvue@1.0.0/dataview/index.mjs) | Covered; `sortField` repeated in prose corrected to `sortOrder`; grid is consumer CSS, not mandatory utility library |
| Paginator | [Pinned page](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/components/paginator.md), [declarations](https://unpkg.com/openvue@1.0.0/paginator/index.d.ts) | Covered; no invented data processing/transport; zero-based offsets distinct from report labels |
| VirtualScroller | [Pinned page](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/components/virtualscroller.md), [declarations](https://unpkg.com/openvue@1.0.0/virtualscroller/index.d.ts), [runtime](https://unpkg.com/openvue@1.0.0/virtualscroller/index.mjs) | Covered; real local sparse materialization, half-open ranges, release variable-size path; no simulated remote transport |
| OrderList | [Pinned page](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/components/orderlist.md), [declarations](https://unpkg.com/openvue@1.0.0/orderlist/index.d.ts) | Covered; use declared aria/PT API rather than stale `listProps` prose |
| PickList | [Pinned page](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/components/picklist.md), [declarations](https://unpkg.com/openvue@1.0.0/picklist/index.d.ts) | Covered; two-array membership vs highlight model; declared transfer/PT names outrank stale prose |
| Chart | [Pinned page](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/components/chart.md), [declarations](https://unpkg.com/openvue@1.0.0/chart/index.d.ts), [runtime](https://unpkg.com/openvue@1.0.0/chart/index.mjs), [optional peer manifest](https://unpkg.com/openvue@1.0.0/package.json) | Covered as optional boundary; real themed API retained, empty slot declaration conflicts with fallback-child recommendation |
