# Charts and data visualization

Read for Unovis TypeScript, Unovis Vue wrappers, or Vue Data UI charts. Keep business aggregation and remote-state ownership outside the renderer. Inspect the incumbent library and chart semantics before choosing another one. Charts supplement—not replace—text, tabular values, and usable keyboard actions. See [data-tables.md](data-tables.md), [accessibility.md](accessibility.md), and [debugging-ssr.md](debugging-ssr.md).

## Published releases and selection boundaries

| Package | Source-reviewed version | Choose it for |
| --- | --- | --- |
| `@unovis/ts` | **1.8.1** | Imperative DOM integration, framework-independent chart owners, custom lifecycle coordination. |
| `@unovis/vue` | **1.8.1**, exact peer `@unovis/ts: 1.8.1`, Vue `^3` | Declarative Vue composition around Unovis core. Install both matching versions. |
| `vue-data-ui` | **3.29.4**, Vue peer `>=3.3.0` | Higher-level chart components with component-specific config, legends, tables and export controls. `jspdf >=3.0.1` is optional for PDF. |

Examples target Vue **3.5.46** and use the exact published APIs below. They do not re-execute the [older verification profile](#evidence-and-verification-boundaries). The packages use different data/config schemas. Vuetify provides the surrounding interface; it does not require replacing an incumbent chart library. [Unovis Vue metadata](https://registry.npmjs.org/@unovis/vue/1.8.1), [Vue Data UI metadata](https://registry.npmjs.org/vue-data-ui/3.29.4).

## Shared workflow and data rules

1. State the analytical question, unit, timezone, period, aggregation, denominator, and whether missing data is distinct from zero. Choose bars for category comparisons, lines for ordered trends, scatter for relationships, and part-to-whole only when the total is meaningful.
2. Validate finite values at the application boundary. Do not turn failed loads, `NaN`, missing values, or parse failures into zero. Sort temporal X values explicitly and define duplicate timestamps; accessors do not establish business semantics.
3. Keep raw numeric values for scales; format ticks/tooltips with `Intl.NumberFormat`/`Intl.DateTimeFormat`. Label large values with their units or explicit scaling. Preserve exact/raw values in the table; floating-point chart coordinates are not arbitrary-precision accounting.
4. Distinguish loading, request failure, empty data, and an all-zero series. Use a nondegenerate linear domain for constants/zero; do not feed zero/negative values to a logarithmic scale. A donut with total zero has no meaningful proportions.
5. Bound layout dimensions. Resize the chart through its owning API/observer; do not install competing resize loops. Hidden panels may initially measure zero: check their visible layout after activation.
6. Provide a caption/summary and a real text/table alternative, including trends and material anomalies. Color is not the sole encoding. Hover-only tooltips are not an accessible data interface. Bound animations and respect reduced motion; examples disable transitions.
7. Aggregate/window/downsample large series before rendering when justified by the question. State that visual downsampling does not change the raw/exported dataset; verify extrema and gaps survive the chosen strategy.

## Unovis TypeScript: containers own data and lifetime

Install `bun add --exact @unovis/ts@1.8.1` for core only. Per the [official introduction](https://unovis.dev/docs/intro), enable `allowSyntheticDefaultImports`. [1.8.0](https://github.com/f5/unovis/releases/tag/1.8.0) imports TopoJSON types in core and replaces Emotion with a built-in CSS runtime; do not copy an old ambient workaround into a new consumer without a real compiler diagnostic. Unovis still injects styles from JavaScript, not a public `@unovis/ts/style.css` entry. For strict CSP, set `UNOVIS_NONCE` before module loading as documented. [1.8.1 style runtime](https://unpkg.com/@unovis/ts@1.8.1/styles/css.js), [CSP guide](https://unovis.dev/docs/guides/csp).

| Owner | Construction and updates |
| --- | --- |
| `XYContainer<Datum>` | `new XYContainer(host, { components: [line], xAxis, yAxis }, data)`; multiple XY marks share data and scales. |
| `SingleContainer` | `{ component: donutOrGraph }`, singular; graph/Sankey data is `{ nodes, links }`, not a flat XY array. |
| Components | `new Line<Datum>({ x: d => d.x, y: d => d.y })`; use accessors, not string field-name guesses. |
| XY updates | `setData(data)`, `updateContainer(config)`, `updateComponents(configs)` (index-aligned), or `update(containerConfig, componentConfigs?, data?)`. |
| Single updates | `updateComponent` is singular. |
| Teardown | `container.destroy()`; do not leave its ResizeObserver, DOM, or timers attached after route unmount. |

Container width/height accept pixels/CSS units **except `%`**; use percentage width on the host and let the container observe it. Axis slots `xAxis` and `yAxis` determine axis type; a standalone `Axis` in a components array needs the appropriate type. Tooltip and crosshair are container config, not XY marks. [XY declarations](https://unpkg.com/@unovis/ts@1.8.1/containers/xy-container/index.d.ts), [container configuration](https://unpkg.com/@unovis/ts@1.8.1/core/container/config.d.ts).

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

A plain TypeScript host follows the same construction/update/destroy lifecycle without Vue. Container updates resolve against defaults, not the previous config: retain and resupply the complete application-owned config with its component/axis instances, dimensions, duration and accessible name. A domain-only `update({ yDomain })` drops those settings. Component `setConfig` likewise resolves against defaults. Do not mutate `chart.config` or `line.config` directly. Methods with `preventRender` can defer work; finish with a render-producing update. Reuse the existing container to retain interaction state. [Base config resolution](https://unpkg.com/@unovis/ts@1.8.1/core/container/index.js), [XY update sequence](https://unpkg.com/@unovis/ts@1.8.1/containers/xy-container/index.js).

## Unovis Vue: declarative wrappers, not parallel imperative ownership

Install `bun add --exact @unovis/ts@1.8.1 @unovis/vue@1.8.1`. Import `VisXYContainer`, `VisLine`, `VisAxis`, and other `Vis*` components from **`@unovis/vue`**. Wrapper props correspond to core config; accessors remain typed functions. Give shared data to the container and marks/axes to its default slot. Wrappers update existing instances and own destruction on unmount; do not also manually destroy a live wrapper instance. [Component barrel](https://unpkg.com/@unovis/vue@1.8.1/components.d.ts), [container barrel](https://unpkg.com/@unovis/vue@1.8.1/containers.d.ts).

- `VisXYContainer`: line/area/scatter/grouped or stacked bars/timeline, axes, brush, crosshair, tooltip, annotations.
- `VisSingleContainer`: one donut, radial bar, circular bar, treemap, graph, Sankey, chord, heatmap, or TopoJSON visualization, with its own data schema.
- Legends and Leaflet maps are standalone; do not put them into an XY container merely for convenience.
- `VisStackedBar` uses `:y="[accessorA, accessorB]"` for stacks; `baseline` supports floating bars. Grouped bars are a separate mark. Raw category strings are not numeric X coordinates: use an index accessor and format axis ticks back to category labels.
- Exposed `component` refs are escape hatches, not a second state owner. Keep config/data declarative unless a verified imperative method is required.

### Complete focused example: line with safe crosshair content

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { VisAxis, VisCrosshair, VisLine, VisXYContainer } from '@unovis/vue'

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

`VisCrosshair.template` is **a function** `(datum, x, data, leftNearestDatumIndex?) => string | HTMLElement`, not a selector map. Since [1.8.0](https://github.com/f5/unovis/pull/964), `XYContainer` supplies a tooltip for a custom crosshair template when neither it nor the crosshair specifies one; this is why the example does not need `<VisTooltip />`. Pass an explicit tooltip for custom options or mark selector `triggers` (for example, with `VisStackedBarSelectors.bar`). Component event maps are keyed by selectors too, not an invented Vue `@point-click`. Never interpolate untrusted labels into returned HTML; use DOM `textContent`, escaping or audited sanitization. With `snapToData: false`, handle the no-datum case. [Crosshair config](https://unpkg.com/@unovis/ts@1.8.1/components/crosshair/config.d.ts), [tooltip config](https://unpkg.com/@unovis/ts@1.8.1/components/tooltip/config.d.ts), [automatic tooltip source](https://unpkg.com/@unovis/ts@1.8.1/containers/xy-container/index.js).

Use stable series color keys, labels, and patterns rather than assigning color by transient sort order. `colorKeys` names series; container `colorFunction` maps those keys to colors. Unovis supports CSS variables and `theme-dark`; integrate this deliberately with the surrounding theme rather than assuming a Vuetify dark class changes chart colors. [Theming](https://unovis.dev/docs/guides/theming).

### Unovis advanced marks, graph, and map contracts

The **1.8.1** core classes and `Vis*` wrappers share the chart contracts below; the prefix changes composition, not the dataset. Choose the topology first:

| Analytical need | Configuration and failure boundary |
| --- | --- |
| Gaps and trends (`Line`, `Area`) | Keep ordered numeric X; `Line.fallbackValue: undefined` breaks missing segments, while `null` treats gaps as zero. `interpolateMissingData` draws dashed gap-fill rather than observing missing values. Area uses `baseline` and optional outline (`line`, `lineColor`, `lineWidth`); `minHeight`/`stackMinHeight` distort tiny values intentionally, so retain raw tooltip/table values. |
| Stacks, groups, waterfall | Stack/group `y` accessors align with stable series keys. Floating bars use `baseline: d => d.start`, `y: d => d.end - d.start`; set `dataStep` for gappy numeric X and constrain widths with `barMaxWidth`/`groupMaxWidth`. `barStyle` supports per-bar styling but component-managed fill/opacity/mask are not arbitrary CSS ownership. |
| Scatter and distributions | Scatter `size` is marker size in pixels (diameter for `SymbolType.Circle`), not a shape-independent area; use `sizeScale`/`sizeRange` for data encoding and provide a size legend. **Boxplot does not compute quartiles from raw samples**: provide `median`, `quartiles: d => [q1, q3]`, `whiskers: d => [min, max]` (any intended subset). Establish the statistical algorithm before rendering. |
| Timeline / labels | Timeline X is start; `lineDuration` is duration and `lineRow` identifies rows. Use `showRowLabels`, `rowLabelFormatter`, `rowHeight`/label width to keep rows readable. Migrate deprecated `type`, `length`, `cursor`, `showLabels`, `labelWidth`, `maxLabelWidth` to `lineRow`, `lineDuration`, `lineCursor`, `showRowLabels`, `rowLabelWidth`, `rowMaxLabelWidth`. `XYLabels` anchors text to data coordinates. |
| Reference/selection marks | `Plotline { axis, value, labelText }` and `Plotband { axis, from, to, labelText }` express thresholds/ranges; use `Annotations.items` for richer callouts, not to fake scale-bound thresholds. `labelText` supports styled text/newlines; use bleed/margins for clipping. Brush/FreeBrush own selection geometry, not remote filtering. |
| Circular values | `Donut.value` is an accessor; total must be meaningful. `minSegmentAngle`/`showEmptySegments` can make tiny/zero slices visible without changing their values. `RadialBar` and new `CircularBar`/`VisCircularBar` encode each record against `maxValue`, not a part-to-whole denominator. Supply positive maxima for a quantitative scale; Circular Bar treats `null`/`undefined` as missing and can render positive values at full length with nonpositive maxima. [Circular Bar config](https://unpkg.com/@unovis/ts@1.8.1/components/circular-bar/config.d.ts) |
| Hierarchy (`NestedDonut`, `Treemap`) | Supply flat records and `layers: [d => d.region, d => d.team]` with a `value` accessor. Do not blindly copy a nested `children` schema into `NestedDonut`. Choose ring direction/layer settings or treemap tile layout/labels; preserve a text hierarchy for drill-down. |
| Calendar/matrix heatmap | `Heatmap` is a **SingleContainer** component with flat records and a `value` accessor, not XY marks. Specify `numRows`/`numColumns`, layout/offset and cell geometry; `null` means empty. Fix `colorDomain` across comparisons; a `color` accessor overrides `colorRange`. |
| Graph | `SingleContainer` data is `{ nodes, links }` with unique node IDs and valid source/target references. `GraphLayoutType` (`Force`, `Dagre`, `Elk`, `Precalculated`, circular/parallel variants) controls layout, not link shape. Use graph-specific node/link settings; 1.8.1 supports `linkCurve` with D3 curve factories or Unovis `curveSmoothStep`. Bound zoom/drag and control selection IDs; `layoutAutofit` can reset the view on data/config updates. [Graph config](https://unpkg.com/@unovis/ts@1.8.1/components/graph/config.d.ts) |
| Sankey / chord flows | Supply valid node/link topology and nonnegative quantitative `linkValue`. Sankey `nodeAdaptivePadding` compresses spacing when many nodes would squash heights; define alignment/zoom and avoid implying that arbitrary cyclic data is an ordinary acyclic Sankey. Chord is for relationship flows, not a substitute for network path layout. |
| TopoJSON choropleth / points | `TopoJSONMap` data is `{ areas?, points?, links? }`; `areaId` must match the selected topology object's feature IDs. Supply the topology, `mapFeatureName` and projection; bundled maps are not an automatic join. Use `longitude`/`latitude`, not `pointLongitude`/`pointLatitude`. Bound clustering/zoom; `zoomToLocation` is `{ coordinates: [longitude, latitude], zoomLevel, expandCluster? }`. [Map config](https://unpkg.com/@unovis/ts@1.8.1/components/topojson-map/config.d.ts) |
| Tile maps / flow legends | `LeafletMap` and `LeafletFlowMap` are standalone; use their own point/flow schema, renderer, authorized no-token tile/style URLs and required attribution. Leaflet's MapLibre renderer defaults to a Blob worker in 1.8.1; if CSP forbids `blob:` in `worker-src`, set `useMaplibreWorkerBlob: false` and emit/configure a same-origin worker before map initialization. This option does not affect the raster renderer. Preserve authorized incumbent integrations without collecting provider tokens; legends explain magnitudes, not application filtering. [Worker config](https://unpkg.com/@unovis/ts@1.8.1/components/leaflet-map/config.d.ts) |

Use named enum/accessor/config types from `@unovis/ts`. Unlike 1.7.1, 1.8.1 explicitly maps granular core subpaths, such as `@unovis/ts/components/line` and `@unovis/ts/containers/xy-container`. 1.8.0 made wrappers use granular imports; 1.8.1 fixes native ESM core imports and Vue wrapper style side effects/tree shaking. Prefer these published paths over deep internal file names; measure bundle results, rather than promising a bundle size or universal SSR compatibility. `Sizing.Fit`, `Extend`, and `FitWidth` do not replace a bounded host. [Core export map](https://registry.npmjs.org/@unovis/ts/1.8.1), [native ESM fix](https://github.com/f5/unovis/pull/993), [Vue style/tree-shaking fix](https://github.com/f5/unovis/pull/996).

### Linked interaction, styling, and incumbent upgrades

- **Brush/domain ownership:** `onBrush(selection, event, userDriven)` receives `[number, number] | undefined` in data coordinates. Store the range once and pass it back through `selection`; ignore non-user-driven echoes or compare values to avoid feedback. `selectionMinLength` uses data units, `brushHeightExtend` pixels. FreeBrush is two-dimensional. `scaleByDomain` recalculates Y from the chosen X domain; constraints are not a hard domain. [Brush types](https://unpkg.com/@unovis/ts@1.8.1/components/brush/config.d.ts).
- **Synchronized crosshairs:** store a common X value, bind `:force-show-at="sharedX"` (`number | Date`, **not `{ x }`**) and clear it to `undefined` on leave. Use `snapMode: CrosshairSnapMode.XY` for scatter, `yStacked` for stacks, and `onCrosshairMove` for coordination. `skipRangeCheck` is a deliberate diagnostic setting, not a default fix for invisible crosshairs. [Crosshair config](https://unpkg.com/@unovis/ts@1.8.1/components/crosshair/config.d.ts).
- **Events and stable hooks:** use `{ [Component.selectors.mark]: { click: (datum, event) => … } }` in core or `Vis…Selectors` with wrapper `:events`. Payloads can be transformed mark data (for example radial arcs), not always the input row. Add `attributes: { [selector]: { 'data-testid': accessorOrValue } }` instead of depending on generated CSS class names. Callbacks resolve at dispatch time in 1.7, but application closures still need current reactive values.
- **Aligned dashboards:** use shared domains and capture the widest-mark chart's `onRenderComplete(svg, margin, bleed, …)` horizontal bleed; pass `{ left, right }` to linked charts. Assign only when the values differ to avoid render feedback. Unspecified bleed sides retain automatic calculation; `0` explicitly removes that side. Increase margin or adjust `tickTextAdaptiveSets`, tick spacing/rotation/overlap settings for long labels rather than hiding data.
- **Colors/patterns:** a per-datum `color` override wins; otherwise `colorKeys` align one key per Y accessor and the shared `colorFunction` maps keys. A D3 ordinal scale assigns in first-seen order: set its domain or use an explicit map when repeatable category colors matter. Pass the same function to BulletLegend items with `colorKey`; implement `onLegendItemClick` by updating the application's visible-series state, not assuming legends filter marks. Fill patterns use `FillPatternType` (dots/stripes/crosshatch); line markers use `LinePatternType`. `theme-patterns` enables the automatic pattern palette, customizable through `--vis-pattern-fill{i}`, `--vis-pattern-marker{i}`, and `--vis-pattern-dasharray{i}`.
- **Theme/defs:** override supported `--vis-*`/`--vis-dark-*` variables on the chart ancestor; `theme-dark` on body activates the documented dark scheme. Scope font settings and account for font loading changing label measurement; `styleLargeSize`/`styleExtraLargeSize` are class helpers, not pixel sizes. Trusted `svgDefs` can declare gradients/patterns referenced with `color="url(#unique-id)"`; generate unique IDs per chart instance to avoid cross-chart collisions. Nonce/global palette/text defaults must be set **before import**, not in a late component hook. [Theming](https://unovis.dev/docs/guides/theming), [bleed](https://unovis.dev/docs/guides/bleed).
- **1.6 incumbent migration:** upgrade both Unovis packages together. 1.7 restores per-component `data` on Crosshair/Timeline/Boxplot, allows delayed/conditional child registration, and reconciles container children without a full teardown. Adaptive ticks, color synchronization, patterns, waterfall baseline, graph label wrapping (`nodeLabelFitMode: FitMode.Wrap` plus width), and map `preserveDrawingBuffer` are applicable current workflows. Text metrics/trimming and interrupted bar transitions changed: compare narrow/rapid-update rendering rather than restoring old generated SVG. Angular/Svelte peer changes do not apply to Vue. [Release evidence](https://unovis.dev/releases/1.7).
- **1.7.1 → 1.8.1:** [1.8.0](https://github.com/f5/unovis/releases/tag/1.8.0) fixes Safari clipping when `duration: 0`, a false initial crosshair warning, mixed stack/regular crosshair markers and custom baselines, and incorrect line interpolation across changed gaps. Recheck zero-duration and rapid data changes rather than adding old rendering workarounds. XY joins now key series by `colorKeys`; supply stable keys when toggling/reordering series. Dense scatter work is reduced, not eliminated; profile it. Donut `icon`/`iconSize`, XYLabels contrast, and NestedDonut label/layout fixes apply only to their relevant marks. [1.8.1](https://github.com/f5/unovis/releases/tag/1.8.1) clarifies annotation coordinates/percentages and adds graph curve support, in addition to the packaging fixes above.

## Vue Data UI: component-specific typed contracts

Install `bun add --exact vue-data-ui@3.29.4`. Import `VueUiDonut`, `VueUiXy`, and their matching types as named exports from **`vue-data-ui`**; import **`vue-data-ui/style.css`** once. [3.28.2](https://github.com/graphieros/vue-data-ui/releases/tag/v3.28.2) added CSS export conditions and emitted a stylesheet declaration. The wildcard component export does not guarantee that every component has its own built file; check the exact package before choosing a deep import. Configs are partial and merge with component defaults; derive reactive configs with `computed`. There is no one dataset/config union that makes arbitrary chart switching type-safe. [Public types](https://unpkg.com/vue-data-ui@3.29.4/dist/types/vue-data-ui.d.ts), [stylesheet declaration](https://unpkg.com/vue-data-ui@3.29.4/dist/style.css.d.ts), [export map](https://registry.npmjs.org/vue-data-ui/3.29.4).

| Component | Data contract and useful boundary |
| --- | --- |
| `VueUiDonut` | `VueUiDonutDatasetItem[]`: `{ name, values: number[], color? }`; `values`, **not `value`**. Slices aggregate their arrays. [3.28.12](https://github.com/graphieros/vue-data-ui/releases/tag/v3.28.12) adds `sorted: false` to preserve dataset order; the default is descending total. |
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
  sorted: false,
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

`responsive: true` requires a bounded container; do not create an unbounded `height: 100%` resize loop. Vue components own their lifecycle; do not invent a common `destroy()` exposed method. For exports use the chart's ref type, e.g. `VueUiDonutExpose` with `getData(): Promise<…>`, `getImage(options?)`, `toggleTable()` and `showSeries(name)`; handle async export failures. Donut `selectDatapoint` receives `{ index, datapoint }`, not a raw point; [3.29.0](https://github.com/graphieros/vue-data-ui/releases/tag/v3.29.0) fixes single-series polar clicks to report index `0` and corrects sorting/legend and rapid hide/restore behavior. Keep the caller's zero-total guard and do not use visual index as a business ID.

Keep an interactive chart's wrapper as a labeled group/region, not `role="img"`, which can hide descendant controls and semantics. Since [3.29.0](https://github.com/graphieros/vue-data-ui/releases/tag/v3.29.0), hidden data tables are opt-in via `a11y.includeTable: true` where supported; keyboard navigation and visible table controls remain available. The donut recipe supplies its own visible exact-value table, so it does not opt into a second hidden one. [ARIA image role](https://www.w3.org/TR/wai-aria-1.2/#img), [donut implementation](https://github.com/graphieros/vue-data-ui/blob/v3.29.4/src/components/vue-ui-donut.vue).

For dense XY data, evaluate `VueUiXyCanvas` and the documented `downsample.threshold` (LTTB). Do not downsample discrete totals or compare sampled point counts as if they were raw counts. In this release, `VueUiXy`'s documented default threshold is 1095 and Canvas's is 10000; profile actual workloads rather than treating these as performance guarantees. Version **3.25.0** changed `showOnlyAtModulo` to true modulo behavior and default modulo to 2; use the declared `showFirstAndLast` option when edge labels must remain visible.

### Vue Data UI selection and incumbent workflows

Choose the analytical family, then use its **own** dataset/config/exposed/slot types. `VueDataUi component="VueUiXy"` forwards a named chart's props and slots, but is not a runtime schema converter; `Arrow`, `VueUiIcon`, and `VueUiPattern` require direct imports. Do not retain the old fixed component count as an API guarantee. [Catalog](https://github.com/graphieros/vue-data-ui/blob/v3.29.4/README.md), [public contracts](https://unpkg.com/vue-data-ui@3.29.4/dist/types/vue-data-ui.d.ts).

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
9. [3.28.6](https://github.com/graphieros/vue-data-ui/releases/tag/v3.28.6) adds `useParentSize(target, options?)` from `vue-data-ui/composables`: use its computed `width`/`height` for explicit chart dimensions with `responsive: false`, not alongside a competing chart observer. Bound the parent and choose concrete fallbacks for undefined pre-mount sizes. Component scopes clean up automatically; use the returned `stop()` outside those scopes.

Utility contracts: `average`/`median` filter to finite numbers and return `null` when empty; cumulative variants have explicit `keepInvalid`/`convertInvalidToZero` policies. `applyDataCorrection` smooths `{ value }` series and must not silently rewrite raw analytics. `useObjectBindings(configRef, { delimiter, skipArrays })` creates refs for leaf paths, not arbitrary-path validation. `createStraightPath`/`createSmoothPath` generate path data; `createTSpans` returns markup needing the same trust boundary as other injected SVG. Color utilities help presentation, not an automatic contrast audit. [Utility signatures](https://unpkg.com/vue-data-ui@3.29.4/dist/types/utils.d.ts), [composables](https://unpkg.com/vue-data-ui@3.29.4/dist/types/composables.d.ts).

#### Migration audit: 3.19-era incumbents to 3.29.4

The 3.25 modulo change above affects XY including SSR, Stackbar, Stackline, Candlestick, Bump, and Ridgeline; `showFirstAndLast` is declared only on the applicable chart label config, not every chart. Keep the source's applicable capabilities, but verify current nesting/types rather than replaying old bugs:

| Existing customization | Current action |
| --- | --- |
| Continuous XY / reversed axes / crosshairs | Keep coordinates for line/plot only; use `chart.grid.labels.xAxis.reverse`/`yAxis.reverse` instead of negating data. [3.29.0](https://github.com/graphieros/vue-data-ui/releases/tag/v3.29.0) adds `chart.grid.labels.yAxis.scale`: `'linear'` (default), `'log'` for positive values only, or `'symlog'` for values on both sides of zero. `symlogConstant` sets the positive transition constant; do not coerce raw or missing values to fit the scale. Recheck bars, area baselines, and minimap under reversal/nonlinear scales. |
| Labels, tooltips and zoom | Keep tooltip `offsetX`, XY selected-dot radius, supported newline labels and `useTooltipPosition`; `#reset-action` supplies `reset`. [3.28.3](https://github.com/graphieros/vue-data-ui/releases/tag/v3.28.3) ignores empty time-label measurements, fixing collapsed plots without inventing label values. [3.29.1](https://github.com/graphieros/vue-data-ui/releases/tag/v3.29.1) adds optional Stackline `style.chart.timeTag.show` for hover/keyboard/external/minimap selection, independent of axis-label filtering. Treat a custom format callback's HTML as untrusted. |
| Distribution and missing values | Preserve Sparkline/TableSparkline `cutNullValues` under their own nesting; HistoryPlot temperature coloring and smoothing, StripPlot violin/scale bounds, and Heatmap `cells.scaleMin`/`scaleMax`. Distinguish null/gaps from zero; include single-cell/row/column cases after heatmap color fixes. |
| Hierarchy/text | Preserve Treemap pan/zoom and Dag `focusOnNode`. [3.29.0](https://github.com/graphieros/vue-data-ui/releases/tag/v3.29.0) honors Treemap root `style.chart.layout.sorted`. [3.29.3](https://github.com/graphieros/vue-data-ui/releases/tag/v3.29.3) deprecates WordCloud `quality` (no effect); use `style.chart.words.angles`, `randomizeAngles` and `seed` if needed. Repeatability also depends on data, dimensions and fonts. Words that do not fit at their assigned size/angle are omitted; enlarge the box or narrow the font range and retain the text/value list. |
| Radar / Waffle / tiny charts | Preserve Radar `layout.scaleToAxisMax`, `targetReference`, grid rotation and label offsets; Waffle merged rectangles and selection wrap/opacity; Sparkbar/SparkStackbar border radius and AgePyramid bar-label config. These are chart-specific, not top-level universal properties. |
| Layout / annotation | Preserve the chart-specific axis/zoom settings and application-owned Hill/Label events. [3.28.5](https://github.com/graphieros/vue-data-ui/releases/tag/v3.28.5) defaults built-in annotations to `followZoom` where supported (not XY Canvas) and adds group actions. In XY these settings live under `chart.userOptions.annotator`; QuickChart uses `userOptionsAnnotator`. [3.28.8](https://github.com/graphieros/vue-data-ui/releases/tag/v3.28.8) adds XY `chart.userOptions.buttons.analyze` with root `analysis` options. Analysis covers visible series/current zoom, not complete data; `chart.userOptions.callbacks.analyze(result)` replaces insertion on Apply. [3.29.0](https://github.com/graphieros/vue-data-ui/releases/tag/v3.29.0) fixes dashboard gesture emissions and annotation undo/snapshot behavior. |
| Locale / v2 padding / exports | Use `Intl` rather than removed locale files. Recheck explicit v2 padding, chart-specific exports and changed event indices rather than assuming v3 configs and payloads are unchanged. Use the exact static export paths below, not bare `/ssr`. |
| Geography / radial labels | [3.29.2](https://github.com/graphieros/vue-data-ui/releases/tag/v3.29.2) adds World `v-model:selectedCountries`, `selection.multiple`, `style.chart.colorScale`, and point overlays with `[longitude, latitude]`. Fix the domain for comparisons, and provide keyboard-equivalent selection rather than treating map hover as an action. [3.29.4](https://github.com/graphieros/vue-data-ui/releases/tag/v3.29.4) enables Galaxy data labels and legend animation by default: labels use the visible total, omit slices at or below 3%, and use compact callouts through 8%. Use `style.chart.layout.labels.dataLabels.show: false` or `useAnimation: false` for those independent behaviors. Neither replaces retaining exact values in text. |

[Current declarations](https://unpkg.com/vue-data-ui@3.29.4/dist/types/vue-data-ui.d.ts), [3.25.0 breaking-change record](https://github.com/graphieros/vue-data-ui/releases/tag/v3.25.0).

## SSR and browser boundaries

- Unovis core has SSR-related support, but browser charts still depend on DOM measurement and runtime styling. The imperative example deliberately initializes after mount. The separate `@unovis/ssr` renderer is not the same API as a DOM `XYContainer`; do not claim a server has chart geometry without a server-rendering strategy.
- For Vue wrappers, use a client-only async boundary when the host SSR pipeline cannot safely import/render the library. In Nuxt use `<ClientOnly>` or a `.client.vue` component; these are Nuxt facilities, not ordinary Vue components. Preserve a server-rendered summary/table regardless.
- Vue Data UI static renderers use **`vue-data-ui/ssr/vue-ui-xy`** and **`vue-data-ui/ssr/vue-ui-donut`**. The [3.29.4 export map](https://registry.npmjs.org/vue-data-ui/3.29.4) maps `./ssr/*` to a [shared entry](https://unpkg.com/vue-data-ui@3.29.4/dist/ssr.js), not bare `vue-data-ui/ssr` or a per-chart tree-shaking guarantee. [3.28.4](https://github.com/graphieros/vue-data-ui/releases/tag/v3.28.4) replaces the static Donut connectors' DOM geometry dependency and adds upstream Node coverage for default external labels and XY. The [current source](https://github.com/graphieros/vue-data-ui/blob/v3.29.4/src/svg/vue-ui-donut/render.js) retains the connector implementation without that DOM path. Do not carry the historical labels-off guard forward as a requirement or call this a local Bun/SSR pass.
- Static SVG output is a separate artifact, not an already-hydrated interactive chart. Define whether it stays static or is replaced after mount. Only insert trusted renderer output; sanitize any user-supplied markup/callback HTML.

**`@unovis/ssr@1.8.1`** is a separate, optional artifact renderer (Node `>=20`, exact `@unovis/ts@1.8.1`, JSDOM and native canvas/raster dependencies). Use `renderToSvg` with constructors from **`ctx.unovis`**, not an eager core import: the environment shims must exist before core loads. Supply explicit dimensions, `duration: 0`, and `ctx.onRenderComplete` in container config. For async graph layouts call `ctx.requireComponentReady()` and use `onRenderComplete: ctx.onComponentReady` on the mark. A fixed `idPrefix` makes artifact IDs deterministic; choose an explicit `svgToPng` background if transparency is unsuitable. Prefer static SVG without adding this dependency when it meets the need. The newer native ESM fix does not certify this renderer or its native addons on Bun; verify the actual platform/runtime if the renderer is selected. [Package](https://registry.npmjs.org/@unovis/ssr/1.8.1), [exact render contract](https://unpkg.com/@unovis/ssr@1.8.1/dist/headless.d.ts).

**`@unovis/mcp@1.8.1`** is optional agent tooling, not a Vue runtime requirement. It declares Node `>=20` and exact 1.8.1 core/SSR dependencies. If an authorized MCP host needs local stdio, the Bun command form is `bunx --bun --package @unovis/mcp@1.8.1 unovis-mcp`; validate initialization and generation on the host before depending on it. Only the equivalent **1.7.1** command was observed to initialize on Bun **1.4.5**, not to render a chart. [1.8.0's HTTP transport fix](https://github.com/f5/unovis/pull/987) does not require switching to HTTP. `renderChart(spec)` returns SVG/dimensions/warnings; validate specs and inspect warnings. `@unovis/mcp/spec` and `@unovis/mcp/recipes` avoid the root headless-renderer import. Review generated Vue for exact versions, input validation and accessibility; never send sensitive inputs to an unauthorized host. [MCP export map/engine/bin](https://registry.npmjs.org/@unovis/mcp/1.8.1), [programmatic render declarations](https://unpkg.com/@unovis/mcp@1.8.1/dist/render/renderer.d.ts).

Complete **3.29.4** static renderer invocation with default label geometry retained. It returns SVG, not interactive hydration. The consuming page still supplies the summary/table:

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
      } },
    },
  })
}
```

## Evidence and verification boundaries

The original **full-declaration visualization profile failed with 192 diagnostics in 40 files** on the older graph below. It included missing VueUse Bluetooth/Temporal globals, generated `@unovis/vue@1.7.1` `__VLS_*` helper references, and Unovis, Three, and other dependency declaration defects. Unovis 1.8 fixed specified **core** declaration issues, but the [1.8.1 Vue wrapper declaration](https://unpkg.com/@unovis/vue@1.8.1/components/line/index.d.ts) still references generated `__VLS_*` helpers without declaring them in that file. There is no current full-graph compiler result; do not weaken the incumbent gate.

The recorded **bounded consumer profile passed** with Vue **3.5.44**, TypeScript **5.9.3**, vue-tsc **3.3.13**, `@unovis/{ts,vue,ssr}` **1.7.1**, Vue Data UI **3.28.1**, `@tanstack/vue-table` **9.3.1**, `@tanstack/vue-virtual` **3.13.47**, `@tresjs/core` **5.9.3**, Three **0.186.1**, and `@types/three` **0.186.0**. It kept `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `strictTemplates`, and unknown-prop checks enabled but set **`skipLibCheck: true`**. That limits dependency declaration validation; it is not an upstream type repair. Keep `vue-tsc --noEmit -p tsconfig.full-declarations.json` (`skipLibCheck: false`) and `vue-tsc --noEmit -p tsconfig.consumer.json` as distinct results. [TypeScript boundary](https://www.typescriptlang.org/tsconfig/skipLibCheck.html).

That authoring profile used real **`@types/web-bluetooth@0.0.21`**, **`temporal-spec@1.0.1`**, and **`@types/jsdom@21.1.7`** with JSDOM **26.1.0**. Keep other required type entries when `compilerOptions.types` is restricted. See [VueUse prerequisites](vueuse.md#authoring-globals-and-reproducible-typing-scope) for loading its globals. The optional `@unovis/ssr@1.8.1` still imports JSDOM's `DOMWindow` type; use published JSDOM types, not a local shim. These types convey neither browser permission nor runtime/polyfill support. [Current SSR declaration](https://unpkg.com/@unovis/ssr@1.8.1/dist/env/canvas.d.ts).

**Historical CPU/runtime proof is partial.** The CPU invocation exercised table selection/filter/reset, virtual geometry/snapshot, Three clone/disposal, and utilities, then failed at the **3.28.1** default-label donut with `ReferenceError: document is not defined` (`dist/lib-rPeBMZrn.js:1:16713`). It did not reach Unovis SSR. The retained old fixture encodes that negative, a separate labels-off SVG invocation, and an independent Unovis render; the changed commands were not executed in the recorded run. The 1.8.1/3.29.4 recipes here are source-reviewed only. Verify actual target browser/runtime rendering, visibility/resize, input extremes (empty/zero/invalid data), reduced motion, table alternatives, escaping and teardown. See [TresJS](tresjs.md) separately for GPU/browser evidence.

## Sources

- [Unovis TypeScript 1.8.1](https://registry.npmjs.org/@unovis/ts/1.8.1), [Vue peer metadata](https://registry.npmjs.org/@unovis/vue/1.8.1), [Unovis docs](https://unovis.dev/docs/intro).
- [XY container](https://unovis.dev/docs/containers/XY_Container), [single container](https://unovis.dev/docs/containers/Single_Container), [line](https://unovis.dev/docs/components/Line), [crosshair](https://unovis.dev/docs/components/Crosshair), [tooltip](https://unovis.dev/docs/components/Tooltip).
- [Vue XY declarations](https://unpkg.com/@unovis/vue@1.8.1/containers/xy-container/index.d.ts), [core lifecycle declarations](https://unpkg.com/@unovis/ts@1.8.1/containers/xy-container/index.d.ts), [CSP](https://unovis.dev/docs/guides/csp), [theming](https://unovis.dev/docs/guides/theming).
- [Vue Data UI docs](https://vue-data-ui.graphieros.com/), [3.29.4 export map](https://registry.npmjs.org/vue-data-ui/3.29.4), [public types](https://unpkg.com/vue-data-ui@3.29.4/dist/types/vue-data-ui.d.ts), [static renderer types](https://unpkg.com/vue-data-ui@3.29.4/dist/types/ssr.d.ts).
