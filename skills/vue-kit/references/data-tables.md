# Data tables

Read for sortable/filterable records, selection, remote pagination, or custom cell rendering. This reference owns table state and row identity, not transport caching ([architecture-data.md](architecture-data.md)) or DOM windowing ([virtualization.md](virtualization.md)). Inspect the existing table, package lock, data volume, accessibility requirements, and client/server ownership before changing engines.

## Choose the smallest engine

| Requirement | Decision |
| --- | --- |
| Ordinary Material table in a Vuetify application | Prefer Vuetify **4.3.0** `VDataTable`; use `item-value="id"`, stable headers, and scoped cell slots. |
| Server supplies the current page | `VDataTableServer`: bind `items`, total `items-length`, loading, and controlled options; handle `update:options`. Its `page` is **one-based**. |
| Bounded-height Material table with many local rows | Consider `VDataTableVirtual`; do not stack a second virtualizer around it. |
| Existing or explicitly selected OpenVue rich-widget UI | Use [OpenVue data](openvue-data.md) for DataTable, TreeTable, hierarchy, collection and built-in virtual-scroller contracts; do not transplant Vuetify or TanStack models. |
| Bespoke layout, explicit processing pipeline, complex headless state | TanStack Vue Table; you own markup, styling, keyboard behavior, accessible names, loading/error/empty states, and pagination controls. |
| A small read-only dataset | Native `<table>` may need neither library. |

Vuetify components are the default, not an obligatory wrapper around TanStack. Do not run two sorting/pagination engines on the same rows. For Vuetify setup and component contracts see [vuetify-setup.md](vuetify-setup.md) and [vuetify-components.md](vuetify-components.md). [Primary Vuetify table documentation](https://vuetifyjs.com/en/components/data-tables/introduction/).

In **Vuetify 4.3.0**, selection is the unnamed `v-model`: with `item-value="id"` and no `return-object`, use an ID array; `return-object` changes selected values to raw records, not IDs. In cell/row slots, `item` is the raw record and `internalItem` is the table wrapper expected by selection/expansion helpers. Keep stable primitive IDs across page replacements; do not confuse a wrapper's index with record identity. `select-strategy` defaults to `'page'`; `'filtered'` and `'all'` still operate only on records supplied to that table. In `VDataTableServer`, even `'all'` cannot select unseen remote results. Keep a query-wide selection descriptor in the application when that is the product contract. [Pinned identity](https://unpkg.com/vuetify@4.3.0/lib/components/VDataTable/composables/items.js), [selection strategies](https://unpkg.com/vuetify@4.3.0/lib/components/VDataTable/composables/select.js), [slot values](https://unpkg.com/vuetify@4.3.0/lib/components/VDataTable/VDataTableRow.js).

Control server options through `v-model:page`, `v-model:items-per-page`, and `v-model:sort-by`; selection remains a separate `v-model`. `update:options` carries `{ page, itemsPerPage, sortBy, groupBy, search }` and fires immediately as well as on changes: use one fetch trigger, not that event plus a duplicate mounted fetch. Translate the one-based page at the service boundary, provide the filtered total as `items-length`, and define whether `itemsPerPage: -1` is supported before offering “all”. The component does not remotely sort/filter/fetch by itself. Keep transport errors visible and apply the cancellation/stale-response contract below. [Pinned options emission](https://unpkg.com/vuetify@4.3.0/lib/components/VDataTable/composables/options.js), [server implementation](https://unpkg.com/vuetify@4.3.0/lib/components/VDataTable/VDataTableServer.js).

Vuetify sort entries are `{ key, order: 'asc' | 'desc' }`; TanStack entries are `{ id, desc: boolean }`. Map allowed column keys and direction explicitly at the service boundary, rather than forwarding either library's state as the other's schema. Vuetify's runtime also accepts `order: false` to skip a sort entry; omit that entry from a backend sort request. [Pinned Vuetify sorting](https://unpkg.com/vuetify@4.3.0/lib/components/VDataTable/composables/sort.js).

## TanStack Vue Table: exact release boundary

The verified stable npm release is **`@tanstack/vue-table@9.3.1`**, with exact dependency **`@tanstack/table-core@9.3.1`**, Vue peer `>=3.2`, Node `>=20`, and modern ESM output. This is not a prerelease. Existing applications may still pin v8: inspect the lockfile rather than assuming the website's `latest` matches it. All examples below target **9.3.1**, Vue **3.5.44**, and the Vue adapter, never the React adapter. [Registry](https://registry.npmjs.org/@tanstack/vue-table/9.3.1), [Vue declarations](https://unpkg.com/@tanstack/vue-table@9.3.1/dist/useTable.d.ts).

| v8 incumbent API | v9.3.1 API |
| --- | --- |
| `useVueTable` | `useTable` |
| `getCoreRowModel()` option | Core model is automatic. |
| `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel` options | `sortedRowModel: createSortedRowModel()`, `filteredRowModel: createFilteredRowModel()`, `paginatedRowModel: createPaginatedRowModel()` inside `tableFeatures`. |
| Implicit feature availability | Register each feature and its processing-model slot together in `tableFeatures`; object-key order is not an inference requirement. |
| `createColumnHelper<Row>()` | `createColumnHelper<typeof features, Row>()`. |
| Whole-state callback/subscription conventions | Own slices with reactive `state` plus `on…Change`, or external atoms; read `table.atoms.<slice>.get()` in Vue tracking scopes. |
| Left/right column pinning | Logical `start`/`end`. |

`table.Subscribe` is **deprecated in 9.3.1**; native templates, computed getters, render functions, and watcher sources track atom reads. A bare setup-time atom read is only a snapshot. `stockFeatures` is a migration bridge, not a reason to ship unused processing. Pass `data` as a ref/computed, not a one-time `data.value`; replace shallow arrays when editing data. Keep feature and column definitions stable. Do not destructure row/cell/header/column methods: their prototype methods use `this`. [Official Vue migration guide](https://tanstack.com/table/latest/docs/framework/vue/guide/migrating).

The feature map is a typed contract, not a beta caveat: `globalFilteringFeature` requires `columnFilteringFeature`; `columnResizingFeature` requires `columnSizingFeature`; model/function slots require their declared feature in the **same object**, irrespective of property order. Core strips those slots before constructing feature APIs. `features`, external `atoms`, and `initialState` are construction-time options: `setOptions` preserves their original values. Changing a reactive feature ref does not hot-install methods/state; construct a new owned table when the feature contract genuinely changes. [Exact prerequisites](https://unpkg.com/@tanstack/table-core@9.3.1/dist/types/TableFeatures.d.ts), [construction](https://unpkg.com/@tanstack/table-core@9.3.1/dist/core/table/constructTable.js), [static-option preservation](https://unpkg.com/@tanstack/table-core@9.3.1/dist/core/table/coreTablesFeature.utils.js).

Own each state slice once. Internal state can start from `initialState`; controlled state needs both its reactive `state` value and matching `on…Change` handler. `state` without the handler keeps the displayed slice controlled at that value; a handler without publishing the new state replaces the default internal updater and does not make a controlled round trip. An external `atoms.pagination` takes precedence over `state.pagination`; do not configure both and mistake the ignored state for a second owner. Feature resets use their setter/callback and reset to resolved `initialState` (or feature default with `true`); broad `table.reset()` only resets base atoms and must not be advertised as clearing externally controlled state.

After replacing controlled state/data, consume the resulting table model after Vue's update boundary (`await nextTick()` in imperative assertions), not by assuming same-stack publication. Although `useTable.d.ts` describes synchronous flushing, the exact `useTable.js` option/state watchers specify only `{ immediate: true }`, not `flush: 'sync'`. Atom subscriptions themselves use synchronous watchers; that is a different boundary. Keep the owner scope alive while consuming the table and stop it when the table is retired. [Adapter watchers](https://unpkg.com/@tanstack/vue-table@9.3.1/dist/useTable.js), [atom subscriptions/cleanup](https://unpkg.com/@tanstack/vue-table@9.3.1/dist/reactivity.js), [controlled precedence](https://unpkg.com/@tanstack/table-core@9.3.1/dist/core/table/constructTable.js), [slice updater](https://unpkg.com/@tanstack/table-core@9.3.1/dist/utils.js), [reset implementation](https://unpkg.com/@tanstack/table-core@9.3.1/dist/core/table/coreTablesFeature.utils.js).

### Feature composition, metadata, and app-scoped tables

Register the behavior **and** its processing stage; state alone never creates a processed row model. Omit a processing slot when the server owns that stage. In **9.3.1**, use individual functions directly in column definitions (as in the example), or register the referenced keys in `filterFns`, `sortFns`, and `aggregationFns`. `'auto'` infers a registry key for filtering/aggregation and for specialized sorting; register those inferred functions too. Sorting alone has a built-in `sortFn_basic` fallback, so a missing specialized sort registration can silently change ordering rather than disable sorting. [Pinned sort resolution](https://unpkg.com/@tanstack/table-core@9.3.1/dist/features/row-sorting/rowSortingFeature.utils.js), [filter resolution](https://unpkg.com/@tanstack/table-core@9.3.1/dist/features/column-filtering/columnFilteringFeature.utils.js).

| Capability | Registration and rendering contract |
| --- | --- |
| Expand hierarchical records | `rowExpandingFeature`, `expandedRowModel: createExpandedRowModel()`, and `getSubRows` for actual children. Own expansion by stable IDs; lazy loading children is application transport, not automatic expansion behavior. |
| Group and aggregate | `rowAggregationFeature` enables `aggregationFn`/`aggregatedCell`; add `columnGroupingFeature` and `groupedRowModel: createGroupedRowModel()` only for grouped rows. Render grouped/aggregated/placeholder cells intentionally. |
| Faceted filters | `columnFacetingFeature` plus `facetedRowModel`, `facetedUniqueValues`, or `facetedMinMaxValues` factory slots as needed. Facets computed over a loaded remote page are not global result-set facets. |
| Hide/order/pin columns | Register `columnVisibilityFeature`, `columnOrderingFeature`, `columnPinningFeature` as used. Render `getVisibleCells()` or matching start/center/end regions; use the same visible leaf-column order for column virtualization. |
| Size versus drag-resize | `columnSizingFeature` provides dimensions; interactive dragging additionally requires `columnResizingFeature`. Apply `column.getSize()` consistently to headers and cells; the headless engine does not write CSS widths. |
| Row pinning / cell selection | Register `rowPinningFeature` / `cellSelectionFeature` only for the required interaction. Define pinning/filter semantics and implement the keyboard/focus model; registering state is not an accessible spreadsheet. |

For custom aggregation, **9.3.1** uses `constructAggregationFn({ aggregate: ({ rows, getValue }) => … })`, not a legacy `(columnId, leafRows, childRows)` function. `maxAggregationDepth: 0` aggregates the supplied root rows; `1` descends to their direct subrows, and `Infinity` selects terminal leaves. Grouped aggregation starts from the input rows assigned to that group, not generated subgroup nodes; a default whole-table total starts from pre-grouped roots. Call `column.getAggregationValue({ rows, maxDepth })`; `getAggregationFns()` is plural. Use `tableMeta`, `columnMeta`, and `filterMeta: metaHelper<YourMeta>()` slots for per-table types; global `TableMeta`/`ColumnMeta` augmentation remains possible with `TFeatures` first. Row types must be records or arrays. [Pinned depth contract](https://unpkg.com/@tanstack/table-core@9.3.1/dist/features/row-aggregation/rowAggregationFeature.types.d.ts), [group inputs](https://unpkg.com/@tanstack/table-core@9.3.1/dist/features/column-grouping/createGroupedRowModel.js), [current migration contracts](https://tanstack.com/table/latest/docs/framework/vue/guide/migrating).

Use `tableOptions()` for shared option fragments. Use `createTableHook()` when an incumbent design system needs pre-bound features/defaults and typed table/cell/header components; it is not required for one table. Complete reusable module:

```ts
import {
  createTableHook, rowSortingFeature, tableFeatures,
  type RowData, type VueTable,
} from '@tanstack/vue-table'

const features = tableFeatures({ rowSortingFeature })
const hook = createTableHook({ features, enableMultiSort: false })
export const useAppTable = hook.useAppTable
export const createAppColumnHelper = hook.createAppColumnHelper
export const useTableContext: <TData extends RowData = RowData>() =>
  VueTable<typeof features, TData> = hook.useTableContext
```

This module binds sort state, not local sorting: callers add the sorted-row-model slot to shared features when client-side processing is wanted. For registered component maps, supply `tableComponents`, `cellComponents`, and `headerComponents` to the hook. Context consumers must be descendants of the corresponding `table.AppTable`, `table.AppCell`, `table.AppHeader`/`AppFooter`; their context-bound `FlexRender` and registered components do not exist outside those providers. Export context hooks with explicit types when registered components import the factory module, avoiding circular inference. [Pinned hook declarations](https://unpkg.com/@tanstack/vue-table@9.3.1/dist/createTableHook.d.ts).

`table.atoms` is the derived read surface; `table.baseAtoms` is internal writable state, not a second application owner. Prefer feature setters and narrow computed reads to broad `table.store.get()` dependencies. Feature resets use the resolved `initialState`; passing `true` resets to the feature default. Store subscriptions outside the adapter-owned scope need their actual unsubscribe cleanup. Rendering-only modules can use `@tanstack/vue-table/flex-render`; static functions and the **experimental** worker plugin have separate `/static-functions` and `/experimental-worker-plugin` entries. Worker processing is not a drop-in fix for DOM cost: version its plugin protocol and serializable data/functions before adoption; keep windowing separate. [Pinned exports](https://unpkg.com/@tanstack/vue-table@9.3.1/package.json).

### Incumbent migration audit beyond the composable rename

Migrate one coherent table, not half a v8/v9 API mixture:

1. Move every processing factory and function registry into features; rename `sortingFn` → `sortFn`, `sortingFns` → `sortFns`, `getSortingFn` → `getSortFn`, `getAutoSortingFn` → `getAutoSortFn`, and `SortingFn`/`SortingFns` → `SortFn`/`SortFns`.
2. Replace `getState()` slice reads with tracked atoms; remove `onStateChange` in favor of per-slice ownership or an intentionally unsubscribed store subscription. Replace legacy renderer props with `FlexRender` shorthand, including `:footer`.
3. Rename **all** column-pinning left/right state, `pin()` arguments, pinned comparisons, header/footer/leaf-column/visible-cell/total-size region methods, `getStart`/`getAfter`/`getIndex` arguments to start/end. Apply logical CSS (`inset-inline-start`/`end`) yourself; `columnResizeDirection` is unchanged.
4. Split `enablePinning` into `enableColumnPinning`/`enableRowPinning`; rename `columnSizingInfo` → `columnResizing`, `setColumnSizingInfo` → `setColumnResizing`, and its change callback. Add the resizing feature for drag handles.
5. Replace `row._getAllCellsByColumnId()` with `row.getAllCellsByColumnId()`; remove other `_`-prefixed internal calls. Do not spread/serialize instances expecting prototype methods to survive.
6. `getIsSomeRowsSelected()` and its page variant mean **at least one**, including all. Indeterminate is `some && !all` for the same scope. `getToggleSelectedHandler()` now supports inclusive Shift-range selection by default; pass its event through, or set `enableRowRangeSelection: false`. Direct `toggleSelected()` does not gain that handler behavior.
7. Put `TFeatures` first in `ColumnDef`, `Column`, `Row`, `Table`, helpers, and metadata augmentation; move custom filter/sort/aggregation registries into typed slots. Remove the temporary `stockFeatures` bridge after identifying used behavior.

These are migration instructions, not a demand to upgrade a v8 table during unrelated work. [Official Vue migration](https://tanstack.com/table/latest/docs/framework/vue/guide/migrating).

## Complete local example: controlled processing and stable selection

Install `@tanstack/vue-table@9.3.1`. This standalone SFC uses local illustrative records; all filtering, sorting, and pagination are client-side. The custom numeric cell renderer formats a raw number without turning numeric sorting into string sorting. Selection survives filtering and page changes by record ID. The page-selection action is deliberately named; it does not silently select every matching record.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  columnFilteringFeature, createColumnHelper, createFilteredRowModel,
  createPaginatedRowModel, createSortedRowModel, filterFn_includesString,
  FlexRender, rowPaginationFeature, rowSelectionFeature, rowSortingFeature,
  sortFn_basic, sortFn_text, tableFeatures, useTable,
  type ColumnFiltersState, type PaginationState,
  type RowSelectionState, type SortingState,
} from '@tanstack/vue-table'

type Invoice = { id: string; customer: string; amount: number }
const data = ref<Invoice[]>([
  { id: 'inv-a', customer: 'Ada', amount: 1200 },
  { id: 'inv-b', customer: 'Grace', amount: 0 },
  { id: 'inv-c', customer: 'Lin', amount: 45.5 },
])
const features = tableFeatures({
  columnFilteringFeature, rowSortingFeature,
  rowPaginationFeature, rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})
const helper = createColumnHelper<typeof features, Invoice>()
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const columns = helper.columns([
  helper.accessor('customer', {
    header: 'Customer', filterFn: filterFn_includesString, sortFn: sortFn_text,
  }),
  helper.accessor('amount', {
    header: 'Amount (USD)', sortFn: sortFn_basic, enableColumnFilter: false,
    cell: info => usd.format(info.getValue()),
  }),
])
const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 2 })
const rowSelection = ref<RowSelectionState>({})
const state = computed(() => ({
  sorting: sorting.value, columnFilters: columnFilters.value,
  pagination: pagination.value, rowSelection: rowSelection.value,
}))
function firstPage() {
  pagination.value = { ...pagination.value, pageIndex: 0 }
}
const table = useTable({
  features, columns, data, state,
  getRowId: (row: Invoice) => row.id,
  enableMultiSort: false,
  onSortingChange: next => {
    sorting.value = typeof next === 'function' ? next(sorting.value) : next
    firstPage()
  },
  onColumnFiltersChange: next => {
    columnFilters.value = typeof next === 'function' ? next(columnFilters.value) : next
    firstPage()
  },
  onPaginationChange: next => {
    pagination.value = typeof next === 'function' ? next(pagination.value) : next
  },
  onRowSelectionChange: next => {
    rowSelection.value = typeof next === 'function' ? next(rowSelection.value) : next
  },
})
function filterCustomer(event: Event) {
  table.getColumn('customer')?.setFilterValue((event.target as HTMLInputElement).value)
}
const selectedCount = computed(() =>
  Object.values(rowSelection.value).filter(Boolean).length,
)
</script>

<template>
  <section aria-label="Invoices">
    <label>
      Filter customer
      <input
        :value="table.getColumn('customer')?.getFilterValue() ?? ''"
        @input="filterCustomer"
      />
    </label>
    <p role="status">{{ selectedCount }} selected across local pages and filters</p>
    <button type="button" @click="table.toggleAllPageRowsSelected(true)">
      Select current page
    </button>
    <button type="button" @click="table.resetRowSelection(true)">Clear selection</button>
    <table>
      <caption>Invoices; amounts in US dollars</caption>
      <thead>
        <tr v-for="group in table.getHeaderGroups()" :key="group.id">
          <th scope="col">Select</th>
          <th
            v-for="header in group.headers" :key="header.id" scope="col"
            :colspan="header.colSpan"
            :aria-sort="header.column.getIsSorted() === 'asc' ? 'ascending'
              : header.column.getIsSorted() === 'desc' ? 'descending' : 'none'"
          >
            <button
              v-if="!header.isPlaceholder" type="button"
              :disabled="!header.column.getCanSort()"
              @click="header.column.toggleSorting()"
            >
              <FlexRender :header="header" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in table.getRowModel().rows" :key="row.id">
          <td>
            <input
              type="checkbox" :aria-label="`Select invoice for ${row.original.customer}`"
              :checked="row.getIsSelected()" :disabled="!row.getCanSelect()"
              @change="row.toggleSelected()"
            />
          </td>
          <td v-for="cell in row.getAllCells()" :key="cell.id">
            <FlexRender :cell="cell" />
          </td>
        </tr>
        <tr v-if="table.getRowModel().rows.length === 0">
          <td :colspan="columns.length + 1">No matching invoices.</td>
        </tr>
      </tbody>
    </table>
    <nav aria-label="Invoice pages">
      <button type="button" :disabled="!table.getCanPreviousPage()" @click="table.previousPage()">
        Previous
      </button>
      <span>Page {{ pagination.pageIndex + 1 }} of {{ Math.max(1, table.getPageCount()) }}</span>
      <button type="button" :disabled="!table.getCanNextPage()" @click="table.nextPage()">
        Next
      </button>
    </nav>
  </section>
</template>
```

Do not convert custom HTML returned from data into `v-html`. A `cell` function may return text, a Vue VNode (`h`, imported from `vue`), or a component; `FlexRender` is the rendering boundary. For column visibility, register `columnVisibilityFeature` and render `row.getVisibleCells()` rather than all cells. For grouping/aggregation, render the appropriate aggregated-cell definition and placeholder state instead of assuming every cell is ordinary data.

## Remote sorting, filtering, and pagination

A server table must process the **whole query**, not just the loaded page. Register the state features, omit local filtering/sorting/pagination row models, and set `manualFiltering: true`, `manualSorting: true`, `manualPagination: true`. Supply `rowCount` as the **filtered total**, or a correct `pageCount`; page length is not total count. TanStack `pageIndex` is **zero-based**. [Vue pagination guide](https://tanstack.com/table/latest/docs/framework/vue/guide/pagination).

The application owns the transport contract. A suitable explicit contract is:

```ts
// Application-owned boundary, not a supplied endpoint or backend implementation.
export interface InvoicePageRequest {
  pageIndex: number
  pageSize: number
  sorting: Array<{ id: 'customer' | 'amount'; desc: boolean }>
  customerContains: string
}
export interface InvoicePageResult {
  rows: Array<{ id: string; customer: string; amount: number }>
  rowCount: number
}
export type LoadInvoicePage = (
  request: InvoicePageRequest,
  signal: AbortSignal,
) => Promise<InvoicePageResult>
```

1. Keep one controlled owner for sorting, filters, pagination, and selection; handle value-or-function updaters. Do not put the same slice in `initialState`, external `atoms`, and controlled `state` simultaneously.
2. Reset `pageIndex` to zero when sort/filter/page-size semantics change. Manual pagination disables automatic page-index resets; handle deletion or a shrinking total by clamping/refetching the last valid page. Do not disguise failed requests as empty results.
3. Include the normalized sort/filter/page parameters in the query key. Abort superseded loads and prevent stale responses replacing the current page. Display pending and error states while retaining or clearing previous data intentionally. See [tanstack-query.md](tanstack-query.md) for query ownership.
4. Validate allowable sort/filter columns at the service boundary; table column IDs are not safe SQL identifiers. Define backend tie-breaking (for example, stable ID after the requested sort), null ordering, collation, and timezone semantics.
5. Keep remote row IDs stable across requests. Do not use the page-relative array index for `getRowId`.

### Selected-row scope is a product contract

- In **9.3.1**, `rowSelection` is `Record<string, true>`: remove a key to deselect, rather than retaining a v8-style `false` entry. `getSelectedRowIds()` returns the map's keys, including IDs from unloaded pages; it does not filter false values from malformed or legacy persisted state. Normalize that state before supplying it. [Pinned selection type](https://unpkg.com/@tanstack/table-core@9.3.1/dist/features/row-selection/rowSelectionFeature.types.d.ts), [ID implementation](https://unpkg.com/@tanstack/table-core@9.3.1/dist/features/row-selection/rowSelectionFeature.utils.js).
- `getSelectedRowModel()` materializes selected rows from the current input data; it cannot fetch unloaded selected records. `getFilteredSelectedRowModel()` further restricts that materialized set to filtered rows.
- `toggleAllPageRowsSelected` means the rendered page; `toggleAllRowsSelected` means selectable rows known to the engine, not an unknown server result set.
- For **all matching remote results**, use an application-owned query-selection descriptor plus exclusions, confirmed by the server. An ID map of one loaded page cannot represent that promise.
- State whether filter changes retain selection, clear it, or invalidate a query-wide selection. Label bulk-action counts and confirm destructive scope. Reauthorize every selected ID server-side.

## Failure modes and proposed verification

Check stable IDs through sort/filter/page replacement; zero rows and zero amounts; long text and keyboard-only sorting; non-sortable headers; retained cross-page selection; filtered versus total counts; racing remote queries; deletion of the last row on the last page. Virtualize **`table.getRowModel().rows`**, never the unprocessed source array. A virtualizer saves DOM work, not sorting/filtering computation or network traffic.

The SFC is a complete local example; service types are an explicitly contextual contract. The [verification record](../assets/verification.json) records executed compiler/type scopes. Table browser interaction and accessibility still require verification in the consuming application.

## Sources

- [Vue Table 9.3.1 registry metadata](https://registry.npmjs.org/@tanstack/vue-table/9.3.1), [core 9.3.1 metadata](https://registry.npmjs.org/@tanstack/table-core/9.3.1).
- [Official Vue v9 migration](https://tanstack.com/table/latest/docs/framework/vue/guide/migrating), [Vue state guide](https://tanstack.com/table/latest/docs/framework/vue/guide/table-state).
- [Pinned Vue API declarations](https://unpkg.com/@tanstack/vue-table@9.3.1/dist/useTable.d.ts), [FlexRender declarations](https://unpkg.com/@tanstack/vue-table@9.3.1/dist/FlexRender.d.ts).
- [Vue pagination](https://tanstack.com/table/latest/docs/framework/vue/guide/pagination), [Vue row selection](https://tanstack.com/table/latest/docs/framework/vue/guide/row-selection), [column definitions](https://tanstack.com/table/latest/docs/guide/column-defs).
- [Vuetify data tables](https://vuetifyjs.com/en/components/data-tables/introduction/).
