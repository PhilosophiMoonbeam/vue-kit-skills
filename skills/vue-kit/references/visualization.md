# Charts and data visualization

Read for Unovis TypeScript, Unovis Vue wrappers, or Vue Data UI charts. Keep business aggregation and remote-state ownership outside the renderer. Inspect the incumbent library and chart semantics before choosing another one. Charts supplement—not replace—text, tabular values, and usable keyboard actions. See [data-tables.md](data-tables.md), [accessibility.md](accessibility.md), and [debugging-ssr.md](debugging-ssr.md).

## Verified release and selection boundaries

| Package | Verified stable version | Choose it for |
| --- | --- | --- |
| `@unovis/ts` | **1.7.1** | Imperative DOM integration, framework-independent chart owners, custom lifecycle coordination. |
| `@unovis/vue` | **1.7.1**, exact peer `@unovis/ts: 1.7.1`, Vue `^3` | Declarative Vue composition around the same Unovis core. Install both matching versions. |
| `vue-data-ui` | **3.28.1**, Vue peer `>=3.3.0` | Higher-level chart components with component-specific configuration, legends, tables, and export controls. `jspdf >=3.0.1` is an optional peer for PDF features. |

Examples target Vue **3.5.44**. These are different APIs, not interchangeable schemas. Vuetify provides the surrounding interface; it does not require replacing a capable chart library. [Unovis registry](https://registry.npmjs.org/@unovis/vue/1.7.1), [Vue Data UI registry](https://registry.npmjs.org/vue-data-ui/3.28.1).

## Shared workflow and data rules

1. State the analytical question, unit, timezone, period, aggregation, denominator, and whether missing data is distinct from zero. Choose bars for category comparisons, lines for ordered trends, scatter for relationships, and part-to-whole only when the total is meaningful.
2. Validate finite values at the application boundary. Do not turn failed loads, `NaN`, missing values, or parse failures into zero. Sort temporal X values explicitly and define duplicate timestamps; accessors do not establish business semantics.
3. Keep raw numeric values for scales; format ticks/tooltips with `Intl.NumberFormat`/`Intl.DateTimeFormat`. Label large values with their units or explicit scaling. Preserve exact/raw values in the table; floating-point chart coordinates are not arbitrary-precision accounting.
4. Distinguish loading, request failure, empty data, and an all-zero series. Use a nondegenerate linear domain for constants/zero; do not feed zero/negative values to a logarithmic scale. A donut with total zero has no meaningful proportions.
5. Bound layout dimensions. Resize the chart through its owning API/observer; do not install competing resize loops. Hidden panels may initially measure zero: check their visible layout after activation.
6. Provide a caption/summary and a real text/table alternative, including trends and material anomalies. Color is not the sole encoding. Hover-only tooltips are not an accessible data interface. Bound animations and respect reduced motion; examples disable transitions.
7. Aggregate/window/downsample large series before rendering when justified by the question. State that visual downsampling does not change the raw/exported dataset; verify extrema and gaps survive the chosen strategy.

## Unovis TypeScript: containers own data and lifetime

Install **`@unovis/ts@1.7.1`**. Per the [official introduction](https://unovis.dev/docs/intro), enable `allowSyntheticDefaultImports`; when `compilerOptions.types` is explicitly restricted, TopoJSON use may require `topojson-client` types. Unovis injects styles from JavaScript; do **not** invent an `@unovis/ts/style.css` import. Strict CSP needs the documented nonce setup **before** module loading ([CSP guide](https://unovis.dev/docs/guides/csp)).

| Owner | Construction and updates |
| --- | --- |
| `XYContainer<Datum>` | `new XYContainer(host, { components: [line], xAxis, yAxis }, data)`; multiple XY marks share data and scales. |
| `SingleContainer` | `{ component: donutOrGraph }`, singular; graph/Sankey data is `{ nodes, links }`, not a flat XY array. |
| Components | `new Line<Datum>({ x: d => d.x, y: d => d.y })`; use accessors, not string field-name guesses. |
| XY updates | `setData(data)`, `updateContainer(config)`, `updateComponents(configs)` (index-aligned), or `update(containerConfig, componentConfigs?, data?)`. |
| Single updates | `updateComponent` is singular. |
| Teardown | `container.destroy()`; do not leave its ResizeObserver, DOM, or timers attached after route unmount. |

Container width/height accept pixels/CSS units **except `%`**. Set percentage width on the host element's CSS instead. The container observes host resize. Axis slots `xAxis` and `yAxis` determine axis type; a standalone `Axis` in a components array needs the appropriate type. Tooltip/crosshair belong in container slots, not the mark array. [Pinned XY declarations](https://unpkg.com/@unovis/ts@1.7.1/containers/xy-container/index.d.ts), [container configuration](https://unpkg.com/@unovis/ts@1.7.1/core/container/config.d.ts).

### Complete focused example: imperative core inside a Vue owner

This SFC uses only the TypeScript core. Browser initialization is deferred until mount; data replacement updates the existing chart; unmount destroys it. Local records are illustrative, not an API response.

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { XYContainer, XYContainerConfigInterface } from '@unovis/ts'

type Point = { day: number; revenue: number }
const data = ref<Point[]>([
  { day: 1, revenue: 0 }, { day: 2, revenue: 12 }, { day: 3, revenue: 8 },
])
const host = ref<HTMLDivElement | null>(null)
const failure = ref<string | null>(null)
const invalid = computed(() => data.value.some(d =>
  !Number.isFinite(d.day) || !Number.isFinite(d.revenue) || d.revenue < 0,
))
const yDomain = computed<[number, number]>(() => invalid.value ? [0, 1] : [
  0, data.value.reduce((max, d) => Math.max(max, d.revenue), 1),
])
let chart: XYContainer<Point> | undefined
let chartConfig: XYContainerConfigInterface<Point> | undefined
let alive = true
onMounted(async () => {
  try {
    const { Axis, Line, XYContainer } = await import('@unovis/ts')
    if (!alive || !host.value) return
    chartConfig = {
      height: 280, duration: 0, yDomain: yDomain.value,
      ariaLabel: 'Daily revenue, in US dollars',
      components: [new Line<Point>({ x: d => d.day, y: d => d.revenue })],
      xAxis: new Axis<Point>({ label: 'Day', tickValues: [1, 2, 3] }),
      yAxis: new Axis<Point>({ label: 'USD' }),
    }
    chart = new XYContainer<Point>(host.value, chartConfig, invalid.value ? [] : data.value)
  } catch (cause) {
    if (alive) failure.value = cause instanceof Error ? cause.message : String(cause)
  }
})
watch([data, yDomain, invalid], () => {
  if (!chart || !chartConfig) return
  chartConfig = { ...chartConfig, yDomain: yDomain.value }
  chart.update(chartConfig, undefined, invalid.value ? [] : data.value)
}, { flush: 'post' })
onBeforeUnmount(() => {
  alive = false
  chart?.destroy()
  chart = undefined
})
function useZeroValues() {
  data.value = data.value.map(d => ({ ...d, revenue: 0 }))
}
</script>

<template>
  <section aria-label="Daily revenue">
    <button type="button" @click="useZeroValues">Show all-zero values</button>
    <p v-if="failure" role="alert">Chart could not initialize: {{ failure }}</p>
    <p v-else-if="invalid" role="alert">Revenue must contain finite, nonnegative numbers.</p>
    <p v-else-if="data.length === 0">No revenue observations.</p>
    <div ref="host" v-show="!failure && !invalid && data.length > 0" class="chart" />
    <table>
      <caption>Daily revenue; US dollars</caption>
      <thead><tr><th scope="col">Day</th><th scope="col">Revenue (USD)</th></tr></thead>
      <tbody>
        <tr v-for="point in data" :key="point.day">
          <th scope="row">{{ point.day }}</th><td>{{ point.revenue }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.chart { width: 100%; min-width: 0; height: 280px; }
</style>
```

A plain TypeScript host follows the same construction/update/destroy lifecycle without Vue. **1.7.1 container config updates resolve against defaults, not the previous config**: retain and resupply the complete application-owned config, including component/axis instances, dimensions, duration, and accessible name. A domain-only `update({ yDomain })` drops those settings. Component `setConfig` likewise resolves against defaults; supply the complete owned component config when updating it. Do not mutate `chart.config` or `line.config` directly. For batching, methods with `preventRender` can defer work; finish with an actual render-producing update. Creating a new container on every data change leaks work and loses interaction state. [Pinned config resolution](https://unpkg.com/@unovis/ts@1.7.1/core/container/index.js), [XY update sequence](https://unpkg.com/@unovis/ts@1.7.1/containers/xy-container/index.js).

## Unovis Vue: declarative wrappers, not parallel imperative ownership

Install **`@unovis/ts@1.7.1 @unovis/vue@1.7.1`**. Import `VisXYContainer`, `VisLine`, `VisAxis`, and other `Vis*` components from **`@unovis/vue`**. Wrapper props correspond to core config; accessors remain typed functions. Give shared data to the container and put marks/axes in its default slot. Wrappers update existing instances when config/data change and own destruction on unmount; do not also manually destroy a live wrapper instance.

- `VisXYContainer`: line/area/scatter/grouped or stacked bars/timeline, axes, brush, crosshair, tooltip, annotations.
- `VisSingleContainer`: one donut, radial bar, treemap, graph, Sankey, chord, heatmap, or TopoJSON visualization, with appropriate component-specific data.
- Legends and Leaflet maps are standalone; do not put them into an XY container merely for convenience.
- `VisStackedBar` uses `:y="[accessorA, accessorB]"` for stacks; `baseline` supports floating bars. Grouped bars are a separate mark. Raw category strings are not numeric X coordinates: use an index accessor and format axis ticks back to category labels.
- Exposed `component` refs are escape hatches, not a second state owner. Keep config/data declarative unless a verified imperative method is required.

### Complete focused example: line with safe crosshair content

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'

type Point = { day: number; value: number }
const data = ref<Point[]>([
  { day: 1, value: 0 }, { day: 2, value: 5 }, { day: 3, value: 3 },
])
const x = (d: Point) => d.day
const y = (d: Point) => d.value
const invalid = computed(() => data.value.some(d =>
  !Number.isFinite(d.day) || !Number.isFinite(d.value) || d.value < 0,
))
const yDomain = computed<[number, number]>(() => [
  0, data.value.reduce((max, d) => Math.max(max, d.value), 1),
])
function tooltip(datum: Point) {
  const node = document.createElement('span')
  node.textContent = `Day ${datum.day}: ${datum.value} observations`
  return node
}
</script>

<template>
  <section aria-label="Observations by day">
    <p v-if="invalid" role="alert">Observation data contains invalid values.</p>
    <p v-else-if="data.length === 0">No observations.</p>
    <VisXYContainer
      v-else :data="data" :height="280" :duration="0" :y-domain="yDomain"
      aria-label="Observations by day; exact values in the following table"
    >
      <VisLine :x="x" :y="y" />
      <VisAxis type="x" label="Day" :tick-values="[1, 2, 3]" />
      <VisAxis type="y" label="Observations" />
      <VisCrosshair :template="tooltip" />
      <VisTooltip />
    </VisXYContainer>
    <table>
      <caption>Observations by day</caption>
      <thead><tr><th scope="col">Day</th><th scope="col">Count</th></tr></thead>
      <tbody>
        <tr v-for="point in data" :key="point.day">
          <th scope="row">{{ point.day }}</th><td>{{ point.value }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
```

`VisCrosshair.template` is **a function** `(datum, x, data, leftNearestDatumIndex?) => string | HTMLElement`; a selector-to-function map is **not** its schema. Selector maps belong to `VisTooltip.triggers`, keyed by the actual mark selector (for example, `VisStackedBarSelectors.bar`). Component events similarly use selector maps in the core `events` config, not an invented Vue `@point-click` API. Never interpolate untrusted labels into returned HTML; use DOM `textContent`, escaping, or audited sanitization. With `snapToData: false`, the crosshair may lack a datum: implement the documented alternate arguments rather than dereferencing it. [Pinned crosshair config](https://unpkg.com/@unovis/ts@1.7.1/components/crosshair/config.d.ts), [tooltip config](https://unpkg.com/@unovis/ts@1.7.1/components/tooltip/config.d.ts).

Use stable series color keys, labels, and patterns rather than assigning color by transient sort order. `colorKeys` names series; container `colorFunction` maps those keys to colors. Unovis supports CSS variables and `theme-dark`; integrate this deliberately with the surrounding theme rather than assuming a Vuetify dark class changes chart colors. [Theming](https://unovis.dev/docs/guides/theming).

### Unovis advanced marks, graph, and map contracts

The same **1.7.1** contracts apply to core classes and `Vis*` wrappers; the prefix changes composition, not the dataset. Choose the topology first:

| Analytical need | Configuration and failure boundary |
| --- | --- |
| Gaps and trends (`Line`, `Area`) | Keep ordered numeric X; `Line.fallbackValue: undefined` breaks missing segments, while `null` treats gaps as zero. `interpolateMissingData` draws dashed gap-fill rather than observing missing values. Area uses `baseline` and optional outline (`line`, `lineColor`, `lineWidth`); `minHeight`/`stackMinHeight` distort tiny values intentionally, so retain raw tooltip/table values. |
| Stacks, groups, waterfall | Stack/group `y` accessors align with stable series keys. Floating bars use `baseline: d => d.start`, `y: d => d.end - d.start`; set `dataStep` for gappy numeric X and constrain widths with `barMaxWidth`/`groupMaxWidth`. `barStyle` supports per-bar styling but component-managed fill/opacity/mask are not arbitrary CSS ownership. |
| Scatter and distributions | Scatter `size` is marker size in pixels (diameter for `SymbolType.Circle`), not a shape-independent area; use `sizeScale`/`sizeRange` for data encoding and provide a size legend. **Boxplot does not compute quartiles from raw samples**: provide `median`, `quartiles: d => [q1, q3]`, `whiskers: d => [min, max]` (any intended subset). Establish the statistical algorithm before rendering. |
| Timeline / labels | Timeline X is start; `lineDuration` is duration and `lineRow` identifies rows. Use `showRowLabels`, `rowLabelFormatter`, `rowHeight`/label width to keep rows readable. Migrate deprecated `type`, `length`, `cursor`, `showLabels`, `labelWidth`, `maxLabelWidth` to `lineRow`, `lineDuration`, `lineCursor`, `showRowLabels`, `rowLabelWidth`, `rowMaxLabelWidth`. `XYLabels` anchors text to data coordinates. |
| Reference/selection marks | `Plotline { axis, value, labelText }` and `Plotband { axis, from, to, labelText }` express thresholds/ranges; use `Annotations.items` for richer callouts, not to fake scale-bound thresholds. `labelText` supports styled text/newlines; use bleed/margins for clipping. Brush/FreeBrush own selection geometry, not remote filtering. |
| Circular values | `Donut.value` is an accessor; total must be meaningful. `minSegmentAngle`/`showEmptySegments` can make tiny/zero slices visible but do not change values. `RadialBar` encodes each record against `maxValue` on its own track, not a part-to-whole denominator. |
| Hierarchy (`NestedDonut`, `Treemap`) | Supply flat records and `layers: [d => d.region, d => d.team]` with a `value` accessor. Do not blindly copy a nested `children` schema into `NestedDonut`. Choose ring direction/layer settings or treemap tile layout/labels; preserve a text hierarchy for drill-down. |
| Calendar/matrix heatmap | `Heatmap` is a **SingleContainer** component with flat records and a `value` accessor, not XY marks. Specify `numRows`/`numColumns`, layout/offset and cell geometry; `null` means empty. Fix `colorDomain` across comparisons; a `color` accessor overrides `colorRange`. |
| Graph | `SingleContainer` data is `{ nodes, links }` with unique node IDs and existing source/target references. Choose `GraphLayoutType` (`Force`, `Dagre`, `Elk`, `Precalculated`, circular/parallel variants) for the graph semantics; each has different layout settings. Use `nodeFill`, `nodeLabel`, `nodeSize`, `linkStroke`, `linkWidth`; graph does not inherit an XY `color`/`x`/`y` contract. Bound zoom/drag and control selection IDs; `layoutAutofit` can otherwise reset a user's view on data/config updates. |
| Sankey / chord flows | Supply valid node/link topology and nonnegative quantitative `linkValue`. Sankey `nodeAdaptivePadding` compresses spacing when many nodes would squash heights; define alignment/zoom and avoid implying that arbitrary cyclic data is an ordinary acyclic Sankey. Chord is for relationship flows, not a substitute for network path layout. |
| TopoJSON choropleth / points | `TopoJSONMap` data is `{ areas?, points?, links? }`; `areaId` must match the selected topology object's feature IDs. Supply actual `topojson`, `mapFeatureName`, and projection; bundled map exports are data, not an automatic join. **Core 1.7.1 uses `longitude`/`latitude`**, not guessed `pointLongitude`/`pointLatitude`. Bound clustering/zoom; `zoomToLocation` is a config object `{ coordinates: [longitude, latitude], zoomLevel, expandCluster? }`. |
| Tile maps / flow legends | `LeafletMap` and `LeafletFlowMap` are standalone owners; use their own point/flow schema, renderer, application-owned or public no-token tile/style URL, and required attribution. Do not add provider-account or access-token collection; inspect and preserve any authorized incumbent integration separately. Leaflet/MapLibre dynamic dependencies still require browser/CSP/network permissions. RollingPinLegend/FlowLegend explain magnitudes; they do not filter data automatically. |

Use the named enum/accessor/config types from `@unovis/ts`, not magic strings guessed from another renderer. Core component subpaths can reduce imports in imperative hosts; **1.7.1 has no package `exports` map**, so verify the actual published subpath and bundler resolution rather than inventing an export-map guarantee. `Sizing.Fit`, `Extend`, and `FitWidth` choose fit behavior; they do not replace a bounded host. [Pinned package metadata](https://unpkg.com/@unovis/ts@1.7.1/package.json), [Scatter sizing](https://unpkg.com/@unovis/ts@1.7.1/components/scatter/config.d.ts), [Boxplot](https://unpkg.com/@unovis/ts@1.7.1/components/boxplot/config.d.ts), [NestedDonut](https://unpkg.com/@unovis/ts@1.7.1/components/nested-donut/config.d.ts), [Graph](https://unpkg.com/@unovis/ts@1.7.1/components/graph/config.d.ts), [TopoJSON config](https://unpkg.com/@unovis/ts@1.7.1/components/topojson-map/config.d.ts) and [data shape](https://unpkg.com/@unovis/ts@1.7.1/components/topojson-map/types.d.ts), [1.7 primary release](https://unovis.dev/releases/1.7).

### Linked interaction, styling, and incumbent upgrades

- **Brush/domain ownership:** `onBrush(selection, event, userDriven)` receives `[number, number] | undefined` in data coordinates. Store the range once, pass it back through `selection`, and update the linked chart/query deliberately; ignore non-user-driven echoes or compare before assigning to avoid feedback loops. `selectionMinLength` uses data units, `brushHeightExtend` pixels. FreeBrush is two-dimensional. `scaleByDomain` recalculates Y from the chosen X domain; domain constraints are not the same as setting a hard domain. [Brush types](https://unpkg.com/@unovis/ts@1.7.1/components/brush/config.d.ts).
- **Synchronized crosshairs:** store a common X value, feed other charts through `forceShowAt: x` (`number | Date`, **not `{ x }`**), and clear it to `undefined` on leave. In Vue bind that value with `:force-show-at="sharedX"`; use the current X scale's data units. Use `snapMode: CrosshairSnapMode.XY` for scatter, `yStacked` for stacks, and `onCrosshairMove` for coordination. `skipRangeCheck` is a deliberate diagnostic/test setting, not a default fix for invisible crosshairs. Provide the `Tooltip` slot/child when showing crosshair content. [Pinned crosshair contract](https://unpkg.com/@unovis/ts@1.7.1/components/crosshair/config.d.ts).
- **Events and stable hooks:** use `{ [Component.selectors.mark]: { click: (datum, event) => … } }` in core or `Vis…Selectors` with wrapper `:events`. Payloads can be transformed mark data (for example radial arcs), not always the input row. Add `attributes: { [selector]: { 'data-testid': accessorOrValue } }` instead of depending on generated CSS class names. Callbacks resolve at dispatch time in 1.7, but application closures still need current reactive values.
- **Aligned dashboards:** use shared domains and capture the widest-mark chart's `onRenderComplete(svg, margin, bleed, …)` horizontal bleed; pass `{ left, right }` to linked charts. Assign only when the values differ to avoid render feedback. Unspecified bleed sides retain automatic calculation; `0` explicitly removes that side. Increase margin or adjust `tickTextAdaptiveSets`, tick spacing/rotation/overlap settings for long labels rather than hiding data.
- **Colors/patterns:** a per-datum `color` override wins; otherwise `colorKeys` align one key per Y accessor and the shared `colorFunction` maps keys. A D3 ordinal scale assigns in first-seen order: set its domain or use an explicit map when repeatable category colors matter. Pass the same function to BulletLegend items with `colorKey`; implement `onLegendItemClick` by updating the application's visible-series state, not assuming legends filter marks. Fill patterns use `FillPatternType` (dots/stripes/crosshatch); line markers use `LinePatternType`. `theme-patterns` enables the automatic pattern palette, customizable through `--vis-pattern-fill{i}`, `--vis-pattern-marker{i}`, and `--vis-pattern-dasharray{i}`.
- **Theme/defs:** override supported `--vis-*`/`--vis-dark-*` variables on the chart ancestor; `theme-dark` on body activates the documented dark scheme. Scope font settings and account for font loading changing label measurement; `styleLargeSize`/`styleExtraLargeSize` are class helpers, not pixel sizes. Trusted `svgDefs` can declare gradients/patterns referenced with `color="url(#unique-id)"`; generate unique IDs per chart instance to avoid cross-chart collisions. Nonce/global palette/text defaults must be set **before import**, not in a late component hook. [Theming](https://unovis.dev/docs/guides/theming), [bleed](https://unovis.dev/docs/guides/bleed).
- **1.6 incumbent migration:** upgrade both Unovis packages together. 1.7 restores per-component `data` on Crosshair/Timeline/Boxplot, allows delayed/conditional child registration, and reconciles container children without a full teardown. Adaptive ticks, color synchronization, patterns, waterfall baseline, graph label wrapping (`nodeLabelFitMode: FitMode.Wrap` plus width), and map `preserveDrawingBuffer` are applicable current workflows. Text metrics/trimming and interrupted bar transitions changed: compare narrow/rapid-update rendering rather than restoring old generated SVG. Angular/Svelte peer changes do not apply to Vue. [Release evidence](https://unovis.dev/releases/1.7).

## Vue Data UI: component-specific typed contracts

Install **`vue-data-ui@3.28.1`**, import named components and their matching types, and import **`vue-data-ui/style.css`** once. Per-component subpaths also exist, but use the exact package export map. Config objects are partial and merged with component defaults; use `computed` when they depend on props/theme. The library does **not** have one universal dataset/config union that makes arbitrary chart switching type-safe. [Pinned public types](https://unpkg.com/vue-data-ui@3.28.1/dist/types/vue-data-ui.d.ts).

| Component | Data contract and useful boundary |
| --- | --- |
| `VueUiDonut` | `VueUiDonutDatasetItem[]`: `{ name, values: number[], color? }`; `values`, **not `value`**. Each array contributes to that slice's aggregated amount. |
| `VueUiXy` | `VueUiXyDatasetItem[]`: `{ name, type: 'bar' | 'line' | 'plot', series }`; series is numeric/null or coordinate records as declared. |
| `VueUiXyCanvas` | Canvas alternative for dense XY rendering; inspect its own dataset/config types. Provide text/table access because canvas marks are not DOM content. |
| Other components | Read that component's `…DatasetItem`, `…Config`, props, event payloads, and exposed-method types. Do not copy donut config nesting into XY. |

In `VueUiXy`, coordinate series `{ x, y }` are for **line/plot**, not bars; do not mix them with bars and expect a shared categorical model. Donut visual settings nest under **`style.chart`**; XY settings use **`chart`**. `getVueDataUiConfig('vue_ui_xy')` uses a snake_case key; `mergeConfigs({ defaultConfig, userConfig })` is an optional way to obtain full defaults, not required to pass a valid partial config.

### Complete focused example: honest part-to-whole with zero state

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { VueUiDonut, type VueUiDonutConfig, type VueUiDonutDatasetItem } from 'vue-data-ui'
import 'vue-data-ui/style.css'

const dataset = ref<VueUiDonutDatasetItem[]>([
  { name: 'Resolved', values: [12], color: '#2166ac' },
  { name: 'Open', values: [8], color: '#b35806' },
])
const totals = computed(() => dataset.value.map(item => ({
  name: item.name, value: item.values.reduce((sum, value) => sum + value, 0),
})))
const total = computed(() => totals.value.reduce((sum, item) => sum + item.value, 0))
const invalid = computed(() => !Number.isFinite(total.value) || dataset.value.some(item =>
  item.values.some(value => !Number.isFinite(value) || value < 0),
))
const config = {
  responsive: true, useCssAnimation: false,
  startAnimation: { show: false }, serieToggleAnimation: { show: false },
  style: { chart: { title: { text: 'Issue status' } } },
  userOptions: { show: false },
} satisfies VueUiDonutConfig
function clearValues() {
  dataset.value = dataset.value.map(item => ({ ...item, values: [0] }))
}
</script>

<template>
  <section aria-label="Issue status">
    <button type="button" @click="clearValues">Set all counts to zero</button>
    <p v-if="invalid" role="alert">Counts must be finite, nonnegative numbers.</p>
    <p v-else-if="dataset.length === 0">No issue categories.</p>
    <p v-else-if="total === 0">No issues; proportions are not applicable.</p>
    <div v-else class="chart" role="group" :aria-label="`Issue status: ${total} issues in total`">
      <VueUiDonut :dataset="dataset" :config="config" />
    </div>
    <table>
      <caption>Issue status; exact counts</caption>
      <thead><tr><th scope="col">Status</th><th scope="col">Count</th></tr></thead>
      <tbody>
        <tr v-for="item in totals" :key="item.name">
          <th scope="row">{{ item.name }}</th><td>{{ item.value }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.chart { width: 100%; height: 24rem; min-width: 0; }
</style>
```

`responsive: true` requires a bounded container; do not create an unbounded `height: 100%` resize feedback loop. Vue components own their lifecycle; do not invent a common `destroy()` exposed method. Use the real per-component ref type for imperative exports; for donut it is `VueUiDonutExpose` (`getData(): Promise<…>`, `getImage(options?)`, `toggleTable()`, `showSeries(name)`, etc.). Handle asynchronous export failures and loading states. Install/configure the optional PDF dependency only if PDF is actually offered. Events are component-specific: current donut `selectDatapoint` receives `{ index, datapoint }`, not a raw point.

Keep an interactive chart's wrapper as a labeled group/region, not `role="img"`: that role treats descendants as presentational and can hide the library's legend, keyboard-navigation hints, and accessible table semantics. The donut example preserves its internal controls and supplies an external exact-value table; it does not claim that a graphic label alone makes the chart accessible. [ARIA image role](https://www.w3.org/TR/wai-aria-1.2/#img), [3.28.1 donut keyboard/table implementation](https://github.com/graphieros/vue-data-ui/blob/v3.28.1/src/components/vue-ui-donut.vue).

For dense XY data, evaluate `VueUiXyCanvas` and the documented `downsample.threshold` (LTTB). Do not downsample discrete totals or compare sampled point counts as if they were raw counts. In this release, `VueUiXy`'s documented default threshold is 1095 and Canvas's is 10000; profile actual workloads rather than treating these as performance guarantees. Version **3.25.0** changed `showOnlyAtModulo` to true modulo behavior and default modulo to 2; use the declared `showFirstAndLast` option when edge labels must remain visible.

### Vue Data UI selection and incumbent workflows

Choose the analytical family, then use its **own** dataset/config/exposed/slot types. `VueDataUi component="VueUiXy"` forwards a named chart's props and slots, but is not a runtime schema converter; `Arrow`, `VueUiIcon`, and `VueUiPattern` require direct imports. Do not retain the old fixed “69 components” count as an API guarantee. [Pinned 3.28.1 catalog](https://github.com/graphieros/vue-data-ui/blob/v3.28.1/README.md), [public contracts](https://unpkg.com/vue-data-ui@3.28.1/dist/types/vue-data-ui.d.ts).

| Need | Choose / integrate |
| --- | --- |
| Trends / price / evolving composition | Xy/XyCanvas, Candlestick, DonutEvolution, Stackbar/Stackline. Preserve the chart's categorical versus continuous X contract; use zoom `keepState` for config changes and `autoFit` for width-fitting controls, not for changing data semantics. |
| Distribution / ranks / relationships | StripPlot (`classic`/`scatter`/`violin`), Scatter/Quadrant, Bump/Ridgeline, Radar/ParallelCoordinatePlot. Validate the distribution/statistical model; do not treat a radar area as a comparable total when axes differ. |
| Hierarchy / network / flows | Treemap/Chestnut/CirclePack, Dag/Molecule/Graph, Chord/Flow/RelationCircle. Use each topology type, stable IDs, and actual node/link references. CirclePack supports recursive children; this does not make every hierarchy chart accept that schema. Dag `focusOnNode(id, options)` is async and returns success; await it rather than claiming focus before layout. |
| Ratios / stages / magnitudes | Donut/NestedDonuts/Onion/Rings/Waffle, Funnel, Gauge/Thermometer/Bullet. Define denominators/ranges and avoid 3dBar/Wheel decoration obscuring exact comparisons; keep raw values available. |
| Compact / tabular / geographic | Sparkline/Sparkbar/SparkStackbar/SparkHistogram/SparkTrend/Sparkgauge/Gizmo for bounded summaries; Table/TableHeatmap/TableSparkline/CarouselTable for chart-rich tables, not a silent replacement for a server data-grid contract. Geo/World require their own geography schema and attribution. Pause carousel animation when required. |
| Text and workflow tools | WordCloud accepts its dataset or text; `createWordCloudDatasetFromPlainText` normalizes text explicitly. Hill supports an edit/save/cancel workflow; persist accepted emitted data in the application, do not treat dragging as an automatic server write. Label is an SVG-positioned annotation with drag events; Dashboard/Annotator compose layout/annotations, not fetch state. |
| Specialized comparisons | AgePyramid compares mirrored populations; Dumbbell compares paired endpoints; Heatmap/HistoryPlot encode matrix/history values; MoodRadar/Galaxy use their own radial/grouping contracts. Tiremarks represents progress with an explicit range. QuickChart's automatic line/bar/donut choice is useful for exploration, not a substitute for approving the analytical question and scale. |
| Rating and utility UI | Rating/Smiley emit `rate`; handle the actual payload in the form owner and provide a labeled keyboard-equivalent input when needed. Kpi/Digits/Timer are focused displays/timing tools, not chart datasets; Accordion, Cursor, MiniLoader/Skeleton, Icon and Arrow have their own props/lifecycles, so do not force `dataset`/`config` onto every export. |

#### Config, slots, exports, and accessibility

1. Resolve typed defaults with `getVueDataUiConfig<VueUiXyConfig>('vue_ui_xy')` and `mergeConfigs({ defaultConfig, userConfig })` only when a full derived object is needed. Themes (`dark`, `zen`, `minimal`, etc.) and `customPalette` are distinct; dataset colors override themes. Derive configs with `computed` for app theme/props; do not shallow-spread nested defaults and lose siblings.
2. `useTooltipPosition` from `vue-data-ui/composables` accepts a template/element ref or getter and returns computed `'left' | 'right' | 'center'`. Feed its **value** into the correct chart nesting: XY `chart.tooltip.position`, donut `style.chart.tooltip.position`. Keep tooltip HTML untrusted by default: `customFormat` returns HTML, so prefer Vue's escaped slot interpolation or sanitize. `#tooltip` replaces; `#tooltip-before`/`#tooltip-after` augment.
3. Match slot payloads to the chart: `#svg` overlays SVG, `#svg-underlayer` renders underneath using the same per-component coordinates, `#chart-background` is noninteractive background, `#watermark="{ isPrinting }"` can limit content to export. `#pattern="{ seriesIndex, patternId }"` must use the supplied ID on the pattern; `VueUiPattern`/`VueUiPatternSeed` or `createPatternDef` provide reusable patterns. Do not reuse one literal pattern ID across mounted charts.
4. Custom legends must preserve the chart's supplied visibility actions or call verified `showSeries(name)`/`hideSeries(name)` methods; changing datasets just to hide a series changes the data contract. `legend.selectAllToggle.show` is opt-in for more than two series, and `selectLegend` also fires for that toggle. Use typed `…Emits`/`…Event` payloads; XY `selectX` includes the visible dataset, index and label. Config callbacks are under **`events`**, not a guessed singular `event`.
5. The menu offers only component-supported actions. `userOptions.buttons` enables actions and `callbacks` replaces their behavior; `#custom-menu-before`/`after`, `#menuIcon`, `#option…` customize controls. A replacement callback must perform the real action and report failure; it does not automatically retain built-in export behavior. PDF uses the optional peer; `userOptions.print` controls scale/orientation.
6. Guard template refs until mount, import the component-specific `…Expose`, await async methods and catch failures. `getImage({ scale })` resolves an object with **`imageUri`**, not the source's `imgUri`; keep output dimensions/aspect ratio and inspect declared optional/undefined outcomes. Keep zoom/annotation/export state scoped to the chart owner. Do not invoke nonexistent methods through the universal wrapper's broad type.
7. Translate `a11y.translations.keyboardNavigation`, `tableAvailable`, and `tableCaption`; `#hint` can render the hint. Test the chart's supported arrow navigation rather than assuming every mini chart is a widget. Opt in to the relevant `useCursorPointer` setting only for actionable marks. `userOptions.buttons.altCopy` plus `callbacks.altCopy({ dataset, config })` supplies data for a **real** alt-text/copy workflow; it does not generate business interpretation automatically. Always retain the external summary/table.
8. `loading` can show skeletons; it must not conceal errors indefinitely. Gate `debug`/`devHints.enable` to development; some critical warnings remain. `transitions` is supported only on declared charts and honors reduced motion; donut's start/series animation has its own options. `zoom.autoFit` overrides the width constraint, not the data domain; `keepState` avoids unnecessary reset after config edits.

Utility contracts: `average`/`median` filter to finite numbers and return `null` when empty; cumulative variants have explicit `keepInvalid`/`convertInvalidToZero` policies. `applyDataCorrection` smooths `{ value }` series and must not silently rewrite raw analytics. `useObjectBindings(configRef, { delimiter, skipArrays })` creates refs for leaf paths for an editor; it does not validate arbitrary paths. `createStraightPath`/`createSmoothPath` generate path data; `createTSpans` returns markup needing the same trust boundary as other injected SVG. Color utilities (`lightenColor`, `darkenColor`, `shiftColorHue`, `createColorWheel`, `adaptColorToBackground`) help presentation, not an automatic contrast audit; use the `/utils` entry for the full utility surface. [Pinned utility signatures](https://unpkg.com/vue-data-ui@3.28.1/dist/types/utils.d.ts), [pinned composable types](https://unpkg.com/vue-data-ui@3.28.1/dist/types/composables.d.ts).

#### Migration audit: 3.19-era incumbents to 3.28.1

The 3.25 modulo change above affects XY including SSR, Stackbar, Stackline, Candlestick, Bump, and Ridgeline; `showFirstAndLast` is declared only on the applicable chart label config, not every chart. Keep the source's applicable capabilities, but verify current nesting/types rather than replaying old bugs:

| Existing customization | Current action |
| --- | --- |
| Continuous XY / reversed axes / crosshairs | Keep coordinates for line/plot only; use `chart.grid.labels.xAxis.reverse`/`yAxis.reverse` instead of negating data. Set continuous scale steps/min/max/formatter deliberately. `chart.highlighter.crosshairs` is the crosshair alternative. Review full-visible-dataset event payloads. |
| Label/tooltip tweaks | Keep tooltip `offsetX`, XY selected-dot radius, supported newline labels and `useTooltipPosition`; tooltip-only config updates no longer force the full chart rerender. `#reset-action` supplies `reset`; pinned types retain `useResetSlot` only as a legacy field, so inspect the installed component rather than inventing a new required reset toggle. |
| Distribution and missing values | Preserve Sparkline/TableSparkline `cutNullValues` under their own nesting; HistoryPlot temperature coloring and smoothing, StripPlot violin/scale bounds, and Heatmap `cells.scaleMin`/`scaleMax`. Distinguish null/gaps from zero; include single-cell/row/column cases after heatmap color fixes. |
| Hierarchy/text | Preserve Treemap pan/zoom, Dag `focusOnNode`, WordCloud per-word colors and quality (`fast`/`balanced`/`precise`); re-evaluate old `words.proximity` overrides after the default changed to zero. |
| Radar / Waffle / tiny charts | Preserve Radar `layout.scaleToAxisMax`, `targetReference`, grid rotation and label offsets; Waffle merged rectangles and selection wrap/opacity; Sparkbar/SparkStackbar border radius and AgePyramid bar-label config. These are chart-specific, not top-level universal properties. |
| Layout / annotation | Preserve right-side Y axes at each chart's declared path, zoom `keepState`/`autoFit`, Ridgeline label offsets/centering/last-label settings and its formatted `#svg` dataset. Hill save/cancel and Label drag payloads remain application-owned; Annotator supports editing/moving/deleting elements, grouped selection, `#toggle`/action slots, and `userOptions.annotatorPalette`. |
| Locale / v2 padding / exports | Use `Intl` rather than removed locale files. Recheck explicit v2 padding in v3; no blanket “all v3 configs unchanged” claim. Preserve custom menu slots, altCopy, and SSR exports with the **actual 3.28.1 subpaths** below, not the source's bare `/ssr` import or a per-chart tree-shaking promise. |

[Exact current declarations](https://unpkg.com/vue-data-ui@3.28.1/dist/types/vue-data-ui.d.ts), [3.28.1 README](https://github.com/graphieros/vue-data-ui/blob/v3.28.1/README.md), [3.25.0 primary breaking-change record](https://github.com/graphieros/vue-data-ui/releases/tag/v3.25.0).

## SSR and browser boundaries

- Unovis core has SSR-related support, but browser charts still depend on DOM measurement and runtime styling. The imperative example deliberately initializes after mount. The separate `@unovis/ssr` renderer is not the same API as a DOM `XYContainer`; do not claim a server has chart geometry without a server-rendering strategy.
- For Vue wrappers, use a client-only async boundary when the host SSR pipeline cannot safely import/render the library. In Nuxt use `<ClientOnly>` or a `.client.vue` component; these are Nuxt facilities, not ordinary Vue components. Preserve a server-rendered summary/table regardless.
- Vue Data UI **3.28.1** ships static renderers with **`vue-data-ui/ssr/vue-ui-xy`** and **`vue-data-ui/ssr/vue-ui-donut`** export paths. Do not assume bare `vue-data-ui/ssr` resolves: the inspected package map declares `./ssr/*`, not `./ssr`. These wildcard exports currently resolve to the shared `dist/ssr.js`; do not promise per-chart tree-shaking from the path spelling alone. **The donut's default label-marker path is not DOM-free:** it calls `document.createElementNS`, `getTotalLength`, and `getPointAtLength`. The observed no-DOM invocation throws `ReferenceError: document is not defined`; changing colors or hiding `userOptions` does not disable that geometry path. The example below explicitly disables external data labels through the supported config guard, while retaining the legend and exact values in its SVG title. This narrowly configured Node consumer awaits execution; it is not a blanket native-SSR guarantee for all donut configurations. Keep the original default-label failure as negative evidence. [Published marker implementation](https://unpkg.com/vue-data-ui@3.28.1/dist/lib-rPeBMZrn.js), [static donut implementation](https://unpkg.com/vue-data-ui@3.28.1/dist/vue-ui-donut-DHfOfLBF.js).
- Static SVG output is a separate artifact, not an already-hydrated interactive chart. Define whether it stays static or is replaced after mount. Only insert trusted renderer output; sanitize any user-supplied markup/callback HTML.

For **`@unovis/ssr@1.7.1`** (Node `>=20`, exact core dependency 1.7.1), use `renderToSvg` with constructors from **`ctx.unovis`**, not an eager `@unovis/ts` import: the environment shims must exist before core loads. Supply explicit dimensions, `duration: 0` on container/components, and `ctx.onRenderComplete` in container config. For asynchronous graph layouts call `ctx.requireComponentReady()` and wire the mark's `onRenderComplete: ctx.onComponentReady`; otherwise completion can precede the layout. `svgToPng` needs an explicit background when transparency is not desired. Static output is not interactive Vue hydration; use a fixed `idPrefix` for deterministic artifact IDs. [Exact SSR package](https://registry.npmjs.org/@unovis/ssr/1.7.1), [programmatic lifecycle](https://unovis.dev/docs/mcp/programmatic).

The related **`@unovis/mcp@1.7.1`** (Node `>=20`) is optional tooling, not a Vue runtime requirement. Configure an authorized MCP host with stdio command `bunx`, args `["--package", "@unovis/mcp@1.7.1", "unovis-mcp"]` when chart-generation tools are actually wanted. This uses the package's declared binary without npm's `-y` runner flag or a forced Bun runtime. For programmatic generation, `renderChart(spec)` returns SVG/dimensions/warnings; validate specs and inspect warnings. `/spec` and `/recipes` are dependency-light entries; the root brings headless rendering/jsdom. Generated Vue code still needs the matched wrapper/core packages, input validation, accessibility, and application review. Do not send sensitive datasets to an unauthorized host or assume renderer locality establishes the agent host's data policy. [Pinned MCP metadata](https://registry.npmjs.org/@unovis/mcp/1.7.1), [official programmatic tools](https://unovis.dev/docs/mcp/programmatic).

Complete static renderer invocation with external data-label geometry disabled (not interactive hydration). The caption/title states the exact values because the chart deliberately omits those external labels; retain the summary/table in the consuming page:

```ts
import { createStaticVueUiDonut } from 'vue-data-ui/ssr/vue-ui-donut'

export async function renderIssueStatusSvg(): Promise<string> {
  return createStaticVueUiDonut({
    dataset: [
      { name: 'Resolved', values: [12] },
      { name: 'Open', values: [8] },
    ],
    width: 640, height: 400,
    svgTitle: 'Issue status: 12 resolved, 8 open',
    config: {
      userOptions: { show: false },
      style: { chart: {
        title: { text: 'Issue status: 12 resolved, 8 open' },
        layout: { labels: { dataLabels: { show: false } } },
      } },
    },
  })
}
```

## Evidence and verification boundaries

The original **full-declaration visualization profile failed with 192 diagnostics in 40 files**. Its graph included missing VueUse Bluetooth/Temporal globals, generated `@unovis/vue@1.7.1` `__VLS_*` helper references, and Unovis, Three, and other dependency declaration defects. This remains negative evidence: no blanket full-declaration certification is claimed for this package tree.

The corrected **bounded consumer profile passed** with Vue **3.5.44**, TypeScript **5.9.3**, vue-tsc **3.3.13**, `@unovis/{ts,vue,ssr}` **1.7.1**, Vue Data UI **3.28.1**, `@tanstack/vue-table` **9.3.1**, `@tanstack/vue-virtual` **3.13.47**, `@tresjs/core` **5.9.3**, Three **0.186.1**, and `@types/three` **0.186.0**. It keeps `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `strictTemplates`, and unknown-prop checks enabled, but sets **`skipLibCheck: true`**. Referenced API types still constrain consumers; unchecked or defective dependency declarations can nevertheless lose precision. This pass is not an upstream declaration repair or a full-tree pass. Keep `vue-tsc --noEmit -p tsconfig.full-declarations.json` (`skipLibCheck: false`) and `vue-tsc --noEmit -p tsconfig.consumer.json` as distinct results. [TypeScript boundary](https://www.typescriptlang.org/tsconfig/skipLibCheck.html), [published Unovis Vue declarations](https://unpkg.com/@unovis/vue@1.7.1/components/line/index.d.ts).

For that authoring profile, install real **`@types/web-bluetooth@0.0.21`**, **`temporal-spec@1.0.1`**, and **`@types/jsdom@21.1.7`** (the retained JSDOM runtime is **26.1.0**). Explicitly include `"@types/web-bluetooth"` in `compilerOptions.types` when that array is restricted, and load `"temporal-spec/global"` there or from an included declaration-only `.d.ts` file. Preserve the app's other required type entries; `types: []` does not automatically load package globals. `@unovis/ssr` imports JSDOM's `DOMWindow` type, supplied by the published JSDOM types rather than a local shim. These packages supply authoring types, not Bluetooth capability/permission, a Temporal runtime polyfill, or complete JSDOM/browser equivalence. See [VueUse prerequisites](vueuse.md#authoring-globals-and-reproducible-typing-scope), [SSR declaration import](https://unpkg.com/@unovis/ssr@1.7.1/dist/env/canvas.d.ts), [JSDOM types](https://unpkg.com/@types/jsdom@21.1.7/index.d.ts).

**CPU/runtime proof is partial, not green.** The corrected consumer typecheck passed. The subsequent CPU invocation exercised table selection/filter/reset, virtual geometry/snapshot, Three clone/disposal, and utilities, then failed at the original default-label donut invocation with `ReferenceError: document is not defined` (`dist/lib-rPeBMZrn.js:1:16713`). Its later Unovis render was not reached. The retained fixture now preserves that default-label failure as a negative assertion, exercises the explicitly labels-off SVG example separately, and exposes the real `@unovis/ssr` invocation as an independent command; neither changed command has been executed yet. The three SFCs and static-renderer function remain complete focused examples. GPU/browser rendering remains a separate **manual target-browser/device boundary** (see [TresJS](tresjs.md)): establish the actual backend and visible output, initialization/failure paths, resize/DPR, picking and keyboard equivalents, and repeated resource retirement; ambient types and CPU assertions cannot establish those results. Separately verify empty/error/zero/constant series, negative/log constraints, invalid values, large magnitudes, many points/categories, narrow/hidden/resized containers, contrast, reduced motion, table alternatives, tooltip escaping, repeated mount/unmount cleanup, version alignment, and actual-host subpath resolution.

## Sources

- [Unovis TypeScript 1.7.1](https://registry.npmjs.org/@unovis/ts/1.7.1), [Vue 1.7.1 exact peer metadata](https://registry.npmjs.org/@unovis/vue/1.7.1), [official introduction](https://unovis.dev/docs/intro), [quick start](https://unovis.dev/docs/quick-start).
- [XY container](https://unovis.dev/docs/containers/XY_Container), [single container](https://unovis.dev/docs/containers/Single_Container), [line](https://unovis.dev/docs/components/Line), [crosshair](https://unovis.dev/docs/components/Crosshair), [tooltip](https://unovis.dev/docs/components/Tooltip).
- [Pinned Vue XY declarations](https://unpkg.com/@unovis/vue@1.7.1/containers/xy-container/index.d.ts), [core lifecycle declarations](https://unpkg.com/@unovis/ts@1.7.1/containers/xy-container/index.d.ts), [CSP](https://unovis.dev/docs/guides/csp), [theming](https://unovis.dev/docs/guides/theming).
- [Vue Data UI official documentation](https://vue-data-ui.graphieros.com/), [official repository](https://github.com/graphieros/vue-data-ui), [3.28.1 package metadata](https://registry.npmjs.org/vue-data-ui/3.28.1).
- [Pinned Vue Data UI public types](https://unpkg.com/vue-data-ui@3.28.1/dist/types/vue-data-ui.d.ts), [static-renderer types](https://unpkg.com/vue-data-ui@3.28.1/dist/types/ssr.d.ts), [exact package export map](https://unpkg.com/vue-data-ui@3.28.1/package.json).
