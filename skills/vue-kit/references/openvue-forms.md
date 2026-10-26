# OpenVue forms and input contracts

Use with [OpenVue selection and architecture](openvue.md), [Vite/Nuxt setup](openvue-setup.md), and [theming](openvue-theming.md). This reference targets `openvue@1.0.0`, optional `@openvue/forms@1.0.0`, and Vue 3.5.44. Import components individually. Forms is a separate state/validation package, not an automatic backend submission layer.

## Choose the owner first

| Owner | Binding | Consequence |
|---|---|---|
| Application-controlled draft | `v-model` on each independent input | Application owns defaults, validation, dirty comparison, reset and submission. Useful with another form library. |
| OpenVue Form | `initialValues` on Form; `name` on inputs or FormField | Form owns the draft and field errors. Do **not** add a second reactive draft or `v-model` to the same field. Read slot state or submission values. |
| Uncontrolled input | `defaultValue`, observe `value-change` | A seed, not a synchronized application model. Do not treat DOM values as a durable draft. |
| Native/custom field in Form | FormField slot `props`, `value`, state | Explicitly forward value and input/change/blur events to the actual control. A wrapper does not magically adapt a third-party event contract. |

`name` is a registration path, not a DOM ID. Dot/bracket paths produce nested resolver values/states; use stable names, not visual row indices for reorderable records. Native form serialization and the Form resolver's object are different contracts. Disabled controls remain registered state in this release; filter them explicitly if the business payload excludes them. Do not nest forms.

### Form/FormField and resolver semantics

Primary: [Form declarations](https://unpkg.com/@openvue/forms@1.0.0/form/index.d.ts), [FormField declarations](https://unpkg.com/@openvue/forms@1.0.0/formfield/index.d.ts), [published useForm runtime](https://unpkg.com/@openvue/forms@1.0.0/useform/index.mjs), [official forms guide](https://github.com/openvi-foundation/openvue/blob/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e/apps/showcase/server/assets/llms/pages/forms.md).

- Form renders a native `<form>` and prevents native submit/reset navigation. It exposes `register`, `valid`, `reset`, and named field states through its default slot. **Only FormField** supports `as`/`asChild` in 1.0.0; the guide's generic “renders div” paragraph concerns FormField, not Form.
- A form resolver receives `{ values, names }`; `names` contains registered names, not necessarily only the requested field. Return `{ values, errors }`, with errors keyed by field path and each value an **array** of error objects. `{ message: string }` is an application convention read by the examples, not automatic text rendering. Always return `values` when a submit consumer needs them: a custom resolver returning only errors does not receive an automatic values fallback.
- A FormField resolver receives `{ value, name }` (runtime also supplies `values: value`); it may return an error array in `errors`, which is mapped to its field name. Global and field resolver results are merged. Keep cross-field validation in the global resolver; avoid conflicting transformations across owners.
- `@submit` receives `{ originalEvent, valid, states, reset, ...resolverResult }`. It fires for invalid submissions too. Runtime `errors` is a nested keyed object although `FormSubmitEvent.errors` is declared `any[]`. Treat it as the resolver result, not an iterable list. Disabling submit validation can leave `values`/`errors` absent despite the declaration. Do not disable it for a consumer relying on validated values.
- Resolver-transformed `values` are submitted but are **not written back** into the visible field states. A trim/coercion can therefore produce a canonical submission different from `states.name.value`. Parse/check the actual output before using it; `valid` is not a TypeScript refinement. An async resolver is awaited but there is no latest-request token in useForm; overlapping validations can publish older errors. Prefer synchronous local validation; put remote uniqueness checks in an explicitly cancellable application workflow, not an unguarded resolver.
- `dirty` means a value changed at least once since reset, not “currently different from initial”; changing it back does not restore pristine. `touched` is blur-driven. Initial `valid: true` means no validation failure recorded, not that the initial draft was checked. Defaults: value-update and submit validation on; blur and mount off. Form-level triggers accept booleans or name arrays; FormField/`formControl` can override per field.
- `reset()` restores initial field values, touched/dirty/pristine and errors, not an empty object and not the last submitted canonical result. Watchers resume after `nextTick`; do not immediately race reset with an edit. Initial object/array values are not a deep-cloned business snapshot: replace selected arrays rather than mutating initial references. For a different record, remount a keyed Form with that record's defaults; do not expect changing `initialValues` to reinitialize a dirty draft.
- Resolver errors belong to Form. External/server failures belong to the application and need their own lifetime/clear-on-edit rule. There is no declared `setErrors` Form API in 1.0.0. `setFieldValue`, `setValues`, `getFieldState`, `validate`, `reset`, `submit` are listed in `FormInstance`; use the slot for normal declarative work. `submit()` requests native submission; it is not a Promise for a network save. No field unregister/removal path appears in published useForm; remount the form for a changed schema rather than assuming a `v-if` removes old values/errors.
- Schema adapters are available at `@openvue/forms/resolvers/zod`, `/yup`, `/joi`, `/valibot`, `/superstruct`; the underlying schema library is an additional dependency. Select an adapter/schema version together and inspect its returned values; installing Forms does not define a domain schema. The `Dynamic*` components in the guide are application examples, not exported library components.

## Labels, messages and forwarding

| Control shape | Target the actual control |
|---|---|
| InputText, Textarea, InputMask | Native `id`, `<label for>`, `aria-describedby`; native attributes are declared. InputMask forwards through InputText. |
| Password, InputNumber, DatePicker, AutoComplete | `inputId` labels the inner input, not the wrapper. Password has `inputProps`; nested-input PT is `pcInputText.root` for these controls. Put `aria-describedby`/autocomplete on the native target, not only on the outer span. |
| Non-editable Select | Focus target is a **span combobox**, not a native select. Use a visible span's ID with `ariaLabelledby`; `labelId` identifies the focus target. `<label for>` alone does not label a span. |
| MultiSelect, CascadeSelect, TreeSelect, Listbox | Use visible text plus `ariaLabelledby` (and label/filter PT where needed). Label popup filter inputs separately; the combobox's name is not the filter input's name. |
| Checkbox, RadioButton, ToggleSwitch | `inputId` on the hidden native input; visible `<label for>`. Put a group of choices in a fieldset/legend. |
| Slider/Knob, Rating, SelectButton/ToggleButton | Label the slider handle, radio group or button group. A state-changing ToggleButton needs a stable accessible name even when on/off text changes. |

MultiSelect, TreeSelect and CascadeSelect expose the keyboard combobox on an input inside a visually hidden accessible container; their visible outer root handles pointer clicks. For keyboard interaction, focus the named native combobox and use ArrowDown to open. Do not force-click the hidden input or replace it with a second focusable wrapper. DatePicker current-month cells need not have `data-p-other-month="false"`; if inspecting calendar DOM, exclude `data-p-other-month="true"` rather than requiring a false attribute.

`invalid` is visual/ARIA state, not validation logic or an error message. In this release some templates read `invalid` instead of inherited `$invalid` (notably Select and Textarea); explicitly bind the slot's `invalid` when using Form if native `aria-invalid` matters. Give each error a stable ID, connect it with `aria-describedby`, and announce an error summary or the relevant message without duplicating every keystroke announcement. Use `pt.root` for native root attributes not present in a component's strict declaration; use the declared inner PT section for nested controls. Inspect the resulting **native node**, not just wrapper attributes. Placeholder text is not a label.

FloatLabel wraps input plus label; `variant="over"` (default), `in`, `on` change positioning, not name/error relationships. IftaLabel keeps the label top-aligned inside the field. IconField wraps InputIcon and an input; decorative icons need `aria-hidden`, and an actionable icon must be a real named button rather than a clickable span. InputGroup plus InputGroupAddon composes units, symbols or controls; it does not merge their models or provide labels. A currency/unit addon may be referenced as description, and group buttons need explicit `type="button"` unless they submit. Import subcomponents from `openvue/inputicon` and `openvue/inputgroupaddon`, not imaginary compound exports.

## Family decision table

The model shapes below are runtime contracts; several declarations use `any`, which is not permission to mix shapes. Every row's component name links to its published 1.0.0 declaration.

| Family | Model and consequential choices |
|---|---|
| [InputText](https://unpkg.com/openvue@1.0.0/inputtext/index.d.ts), [Textarea](https://unpkg.com/openvue@1.0.0/textarea/index.d.ts) | String/null/undefined; editing emits strings. Native `type`, autocomplete, maxlength and inputmode remain application choices. Textarea `autoResize` changes layout, not length validation; set rows and a readable maximum layout width. |
| [InputNumber](https://unpkg.com/openvue@1.0.0/inputnumber/index.d.ts) | `number | null | undefined`, never localized text. `locale`, grouping, decimal digits, decimal/currency mode, currency code, prefix/suffix affect presentation. `min`/`max` and `step` constrain UI, not server authority. `allowEmpty` distinguishes missing from zero. See commit boundary below. |
| [DatePicker](https://unpkg.com/openvue@1.0.0/datepicker/index.d.ts) | Default single Date/null; multiple Date[]; range `[Date, null]` while incomplete then two Dates. `view="month"`/`year`, timeOnly/showTime/hourFormat, minDate/maxDate and disabled dates are UI constraints. `numberOfMonths` changes view, not model shape. See date boundary below. |
| [Select](https://unpkg.com/openvue@1.0.0/select/index.d.ts) | Exactly one option object or `optionValue` scalar; clear emits null. `editable` additionally permits typed text: validate membership if only known IDs are legal. Built-in filter is local, not a request. `#option`, `#value`, group/header/footer slots customize presentation without changing option identity. |
| [MultiSelect](https://unpkg.com/openvue@1.0.0/multiselect/index.d.ts) | Array of options/scalars; clear can emit null, so validate/normalize intentionally. `display="chip"` is presentation. `selectionLimit`, select-all and filtered selections require a product decision; do not assume select-all spans unloaded pages. Option/chip/value slots must preserve removal and keyboard controls. |
| [Listbox](https://unpkg.com/openvue@1.0.0/listbox/index.d.ts) | Single value or array with `multiple`; `metaKeySelection` changes desktop selection gesture and is ignored on touch. Good for a visible finite list; filter and optionGroup slots do not change the model. |
| [SelectButton](https://unpkg.com/openvue@1.0.0/selectbutton/index.d.ts) | Single value or array with `multiple`. `allowEmpty` controls whether a selected item can be cleared; do not assume a required non-null value merely because there are options. `#option` receives the option; retain an accessible name. |
| [CascadeSelect](https://unpkg.com/openvue@1.0.0/cascadeselect/index.d.ts) | One leaf object or `optionValue` scalar. `optionGroupLabel` labels branches; ordered `optionGroupChildren` keys must match each hierarchy level. `group-change` is navigation, not a committed leaf. Use `#option`/`#optiongroup` without making groups accidental selections. |
| [TreeSelect](https://unpkg.com/openvue@1.0.0/treeselect/index.d.ts) | Single **node key**, multiple `{ [key]: true }`, checkbox `{ [key]: { checked, partialChecked } }`. Not TreeNode[] and not leaf object values. Options use TreeNode with unique stable keys. Expanded keys are a separate model. See hierarchical identity below. |
| [AutoComplete](https://unpkg.com/openvue@1.0.0/autocomplete/index.d.ts) | While typing: string; after selection: suggestion object (or primitive); clear: null; `multiple`: array. `optionLabel` changes display, **there is no optionValue** in 1.0.0. `complete` receives `{ originalEvent, query }`, application supplies `suggestions`. See races below. |
| [Checkbox](https://unpkg.com/openvue@1.0.0/checkbox/index.d.ts), CheckboxGroup | `binary`: boolean (or explicit trueValue/falseValue); nonbinary: array membership of `value`. Indeterminate is a visual third state, not an automatic nullable model. CheckboxGroup (`openvue/checkboxgroup`) owns the array once; children have individual values/IDs and no competing models. |
| [RadioButton](https://unpkg.com/openvue@1.0.0/radiobutton/index.d.ts), RadioButtonGroup | One selected scalar/object shared by named radios; unique inputId per choice. RadioButtonGroup (`openvue/radiobuttongroup`) owns one name/value; children own only option values. Binary radio mode is a separate boolean contract, not a substitute for a normal mutually exclusive choice. |
| [ToggleSwitch](https://unpkg.com/openvue@1.0.0/toggleswitch/index.d.ts), [ToggleButton](https://unpkg.com/openvue@1.0.0/togglebutton/index.d.ts) | Boolean by default; ToggleSwitch supports explicit trueValue/falseValue. Set initial model/default, not a fictitious authoritative `checked` prop. Switch has native checkbox/switch semantics; ToggleButton is a pressed button with on/off labels/icons and content slot. |
| [Slider](https://unpkg.com/openvue@1.0.0/slider/index.d.ts), [Knob](https://unpkg.com/openvue@1.0.0/knob/index.d.ts) | Numeric value, Slider range array with two handles. Set min/max/step and meaningful labels; **Slider's** `slideend` marks completed pointer movement, while model updates mark intermediate values. Knob has no `slideend` event; its numeric valueTemplate, readonly and visual size/stroke/colors do not make it a precision text editor. Pair with an input only under **one** owner. |
| [Rating](https://unpkg.com/openvue@1.0.0/rating/index.d.ts) | Numeric star choice; `stars` sets scale, readonly displays a value without editing. Selecting a selected star may clear the model to null at runtime, despite numeric event declarations; require/normalize it explicitly. On/off icon slots are decoration, not independent controls. |
| [ColorPicker](https://unpkg.com/openvue@1.0.0/colorpicker/index.d.ts) | `hex` string **without #**, `rgb` `{ r,g,b }`, `hsb` `{ h,s,b }`. Format is a data-shape switch. Popup/inline and defaultColor are display choices, not validated consent to a value. Official guide admits incomplete screen-reader support: prefer a labeled native color/text alternative for an accessible required workflow. |
| [InputMask](https://unpkg.com/openvue@1.0.0/inputmask/index.d.ts) | String; mask `a` letter, `9` digit, `*` alphanumeric, literals preserved unless `unmask`. `?` makes the suffix optional; slotChar is display only. Incomplete input clears on blur by default (`autoClear`); mask completion is not domain validation. |
| [InputOtp](https://unpkg.com/openvue@1.0.0/inputotp/index.d.ts) | Use string, retaining leading zeros. Default length 4; integerOnly filters input, mask obscures presentation. Declared boolean model is unsafe: runtime calls `.split`. The name-only Form integration does not synchronize the internal token array on initial/reset changes in 1.0.0; use the controlled model below or an explicit FormField model bridge, never a duplicate draft. |
| [Password](https://unpkg.com/openvue@1.0.0/password/index.d.ts) | String/null, strength meter and toggleMask are UI only. `:feedback="false"` disables meter, not validation; an unbound `feedback="false"` passes a string, not boolean false. inputId/inputProps target the real password input; meter header/content/footer slots and localized labels do not establish authentication policy. |
| [FileUpload](https://unpkg.com/openvue@1.0.0/fileupload/index.d.ts) | Internal selected File[] queue, **no v-model form value**. Basic/advanced, auto, accept, maxFileSize, fileLimit and customUpload govern selection/transport. Explicitly transfer a file/metadata to an application/FormField if it is part of a draft. See ownership/security below. |
| [Editor](https://unpkg.com/openvue@1.0.0/editor/index.d.ts) | HTML string, optional `quill@2.0.3`. `readonly`, formats and modules are editing choices, not sanitization. In 1.0.0 customize **`#toolbar`**, not guide snippets using `#header`. See rich-text boundary below. |

### Event payloads are not interchangeable

`update:modelValue` and inherited `value-change` carry the **raw model value**, not `{ value }` or a DOM event. Published BaseEditableHolder emits value-change on writes even when controlled; do not attach both as independent model owners. Use one update channel for state and separate semantic events only for the required side effect.

| Event family | Payload to consume |
|---|---|
| Select/MultiSelect/Listbox/SelectButton/CascadeSelect `change`; Rating/ColorPicker `change` | `{ originalEvent, value }`; value follows that component's configured model shape. |
| Checkbox/RadioButton/ToggleSwitch/ToggleButton `change` | A browser `Event`, **not** a value envelope. Obtain the next logical value from the model update, especially for arrays/custom true/false values. |
| Slider/Knob `change` | Raw numeric value (Slider may be a number array). Slider `slideend` is `{ originalEvent, value }`. |
| MultiSelect `selectall-change` | `{ originalEvent, checked }`; checked is not the selected-ID array and does not include an authoritative remote total. |
| Select/MultiSelect/Listbox `filter` | `{ originalEvent, value }` (Listbox also declares `filteredValue`). Filter text is not a selected option. |
| InputMask `complete` | DOM event; completion is a mask milestone, not an accepted business value. |
| InputOtp `change` | `{ originalEvent, value: string }`; completion is application-derived from the desired length. |
| Popup `show`/`hide`/`before-show`/`before-hide` | Lifecycle notification; not a new selection or a guaranteed DOM transition completion for focus measurements. |

TreeSelect's direct key/map `change`, number/date display events, Form submit and file/editor event contracts are detailed separately below; never infer their payloads from the table's choice-family convention.

### Selection identity, hierarchy and virtualization

For Select/MultiSelect/Listbox/SelectButton/CascadeSelect, prefer stable scalar `optionValue="id"` plus `optionLabel="label"` when the domain stores IDs. Without optionValue the model contains option objects; `dataKey` supplies object comparison identity but does not transform the model into an ID. Do not use array indices or labels as persistent identity; labels can be duplicated or translated. Replacing option objects after a refresh should not change selection when the same stable ID remains. Validate that submitted IDs still belong to the permitted option set; disabling an option is not authorization. `optionGroupLabel`/`optionGroupChildren` describe data, not a separate selection type.

CascadeSelect defaults `focusOnHover` to true. Hovering a branch activates/opens it; a subsequent click on that already-active branch can toggle it closed. For pointer navigation, hover branch levels and click the intended leaf. Keyboard navigation belongs to the combobox: ArrowDown opens/moves focus, ArrowRight activates or enters a branch, Enter selects the focused leaf. Do not infer a committed leaf from expanded group state.

TreeSelect's checkbox map includes partial parents; derive a leaf-only payload by traversing the same permitted tree and selecting checked leaves, not by accepting every truthy map value. Filter `lenient` includes descendants of a matching parent; `strict` continues filtering descendants. Filtering is not permission pruning. Lazy `node-expand` loading must replace the correct keyed node's children and preserve unrelated expanded/selected keys; cancel or discard stale loads on owner disposal. `change` is declared `string[]`, but published runtime emits the current key/map/null directly; consume `update:modelValue` and narrow against the configured mode rather than typing an invented event envelope.

VirtualScroller options on Select/MultiSelect/Listbox/AutoComplete require an accurate `itemSize` and stable item geometry. A template with variable heights breaks that assumption. Lazy loading does not authorize select-all over absent data, and filtered option indices are not record IDs. Give popup filters their own names and keep native keyboard/focus behavior when customizing templates.

### Date/number boundaries

DatePicker uses local calendar Dates by default; `dateFormat="yy-mm-dd"` is display/parsing syntax (`yy` means four-digit year), **not** ISO serialization or a timezone policy. A date-only value should be serialized with explicit local year/month/day fields; `toISOString()` converts to UTC and may change the calendar day. Time-only controls still hold Date objects; decide separately whether the domain stores a wall-clock time or an instant. Validate invalid Dates, incomplete ranges, ordering and permitted boundaries before submission. The `date` slot receives date metadata (day/month/year), not an ordinary Date despite the prose guide. `date-select` emits a selected Date; blur carries `{ originalEvent, value: displayedString }`; neither is the complete range payload.

`updateModelType="string"` exists at runtime but 1.0.0 model/update declarations exclude string/string[]; keep date mode in strict consumers, serialize at the domain boundary, and do not cast the mismatch away. Invalid manually typed text can leave the previous model intact and is restored on blur. If that interaction is unsuitable, `:manualInput="false"` constrains entry to the picker, with explicit clear support and accessible labeling.

A completed DatePicker range need not close the overlay (`hideOnRangeSelection` is a separate behavior). Use Escape on the date input to close and assert the actual `aria-expanded` transition before continuing to another control; clicking arbitrary content behind a still-open overlay is not a reliable dismissal contract.

InputNumber's `input` event contains `{ originalEvent, value, formattedValue }`; blur contains the displayed **string**. Key editing can change display before the numeric model is committed; blur parses, validates bounds and writes the model. Do not copy `formattedValue` into a numeric draft or add a parallel `@input` owner. Model clear emits null although `update:modelValue` declares number. Use a nullable model and test empty, zero, negative, fraction, out-of-range and blur/submit ordering. Locale formatting is not decimal arithmetic; represent money in your domain's exact unit/decimal scheme rather than assuming binary floating-point totals are exact.

### Completion races and secret inputs

AutoComplete delay limits requests, not response ordering. `forceSelection` checks current visible suggestions on change and can clear unmatched text; it does not authorize an object or guarantee that each transient model is an object. `item-select`/`item-unselect` carry `{ originalEvent, value }`; the legacy `option-*` event names are not needed. `change` carries `{ originalEvent, value }`. Dropdown `blank` queries empty text; `current` uses current text. Multiple mode adds/removes objects; group headers and chip templates must retain list semantics/removal affordances.

For remote completion, clear suggestions immediately when a new query arrives, abort the previous request, and use a monotonically increasing request token before publishing results, errors **or loading state**. Clearing and choosing an item must invalidate pending work too. Guard the complete callback after owner disposal: published AutoComplete does not clear its pending debounce timeout in beforeUnmount. Aborting fetch alone cannot prevent an already-resolved Promise or a service ignoring AbortSignal from publishing old data. The complete consumer below uses an application-owned search capability, not a fabricated public endpoint.

InputMask is formatting, not a phone/identifier authenticity check; validate the chosen masked/unmasked representation once. OTP length/integerOnly/mask do not verify a code, expire it, throttle attempts or protect replay. Preserve leading zeros and never log/display real secrets in diagnostics. Custom OTP templates must forward **all** provided `attrs` and `events` to native inputs and supply per-position labels, one-time-code autocomplete, focus and paste behavior. Password feedback is a heuristic, not a server password policy; use `autocomplete="new-password"` or `current-password` on the inner native input. Do not persist password/OTP values to URL, storage, analytics or rich debug dumps. The workbench below is explicitly a local input-shape demonstration, not an authentication flow.

## Complete Form-owned preferences consumer

`PreferencesForm.vue` uses one Form owner, a scalar choice ID, a multi-value group, a numeric/null boundary, and a native FormField. It produces a local validated preview, **not a pretend save**. The resolver deliberately trims the preview while leaving the visible draft unchanged. Native browser validation is disabled so the resolver owns the error lifecycle.

<!-- example:PreferencesForm.vue -->
```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import { Form, FormField } from '@openvue/forms'
import type { FormResolverOptions, FormSubmitEvent } from '@openvue/forms/form'
import InputText from 'openvue/inputtext'
import InputNumber from 'openvue/inputnumber'
import Select from 'openvue/select'
import Checkbox from 'openvue/checkbox'
import CheckboxGroup from 'openvue/checkboxgroup'
import RadioButton from 'openvue/radiobutton'
import RadioButtonGroup from 'openvue/radiobuttongroup'

const cities = [{ id: 'oslo', label: 'Oslo' }, { id: 'rome', label: 'Rome' }]
const initialValues = { displayName: '', city: null, seats: null, channels: [], delivery: 'email', note: '' }
const result = shallowRef('Not submitted')
function resolver({ values }: FormResolverOptions) {
  const errors: Record<string, { message: string }[]> = {}
  const displayName = typeof values.displayName === 'string' ? values.displayName.trim() : ''
  if (displayName.length < 2) errors.displayName = [{ message: 'Enter at least two characters.' }]
  if (!cities.some(city => city.id === values.city)) errors.city = [{ message: 'Choose a city.' }]
  if (typeof values.seats !== 'number' || !Number.isInteger(values.seats) || values.seats < 1 || values.seats > 8) {
    errors.seats = [{ message: 'Choose one to eight seats.' }]
  }
  if (!Array.isArray(values.channels) || values.channels.length === 0 || values.channels.some(value => value !== 'news' && value !== 'events')) {
    errors.channels = [{ message: 'Choose at least one update channel.' }]
  }
  if (values.delivery !== 'email' && values.delivery !== 'post') errors.delivery = [{ message: 'Choose a delivery method.' }]
  if (typeof values.note !== 'string' || values.note.length > 80) errors.note = [{ message: 'Use at most 80 characters.' }]
  return { values: { ...values, displayName }, errors }
}
function submitted(event: FormSubmitEvent) {
  result.value = event.valid ? JSON.stringify(event.values) : 'Invalid form'
}
</script>

<template>
  <section aria-labelledby="preferences-heading">
    <h2 id="preferences-heading">Local preferences preview</h2>
    <Form v-slot="$form" :initialValues="initialValues" :resolver="resolver"
      :pt="{ root: { novalidate: true, class: 'fields' } }"
      @submit="submitted" @reset="result = 'Not submitted'">
      <div>
        <label for="display-name">Display name</label>
        <InputText id="display-name" name="displayName" autocomplete="nickname"
          aria-describedby="name-help name-error" :invalid="$form.displayName?.invalid" />
        <small id="name-help">The preview trims surrounding whitespace.</small>
        <p id="name-error">{{ $form.displayName?.error?.message }}</p>
      </div>
      <div>
        <span id="city-label">City</span>
        <Select name="city" labelId="city-control" ariaLabelledby="city-label"
          :options="cities" optionLabel="label" optionValue="id" showClear
          :invalid="$form.city?.invalid" :pt="{ label: { 'aria-describedby': 'city-error' } }" />
        <p id="city-error">{{ $form.city?.error?.message }}</p>
      </div>
      <div>
        <label for="seat-count">Seats</label>
        <InputNumber name="seats" inputId="seat-count" :min="1" :max="8" :useGrouping="false"
          :invalid="$form.seats?.invalid" :pt="{ pcInputText: { root: { 'aria-describedby': 'seats-error' } } }" />
        <p id="seats-error">{{ $form.seats?.error?.message }}</p>
      </div>
      <fieldset>
        <legend>Update channels</legend>
        <CheckboxGroup name="channels" :invalid="$form.channels?.invalid">
          <Checkbox inputId="channel-news" value="news" :pt="{ input: { 'aria-describedby': 'channels-error' } }" />
          <label for="channel-news">News</label>
          <Checkbox inputId="channel-events" value="events" :pt="{ input: { 'aria-describedby': 'channels-error' } }" />
          <label for="channel-events">Events</label>
        </CheckboxGroup>
        <p id="channels-error">{{ $form.channels?.error?.message }}</p>
      </fieldset>
      <fieldset>
        <legend>Delivery method</legend>
        <RadioButtonGroup name="delivery" :invalid="$form.delivery?.invalid">
          <RadioButton inputId="delivery-email" value="email" /><label for="delivery-email">Email</label>
          <RadioButton inputId="delivery-post" value="post" /><label for="delivery-post">Post</label>
        </RadioButtonGroup>
      </fieldset>
      <FormField v-slot="$field" name="note">
        <label for="preference-note">Optional note</label>
        <input id="preference-note" v-bind="$field.props" :value="$field.value" maxlength="80"
          :aria-invalid="$field.invalid || undefined" aria-describedby="note-error" />
        <p id="note-error">{{ $field.error?.message }}</p>
      </FormField>
      <output id="draft-state">{{ JSON.stringify({ value: $form.displayName?.value, dirty: $form.displayName?.dirty,
        touched: $form.displayName?.touched, pristine: $form.displayName?.pristine, valid: $form.valid }) }}</output>
      <div><button type="submit">Validate preview</button> <button type="reset">Reset preferences</button></div>
    </Form>
    <output id="form-result" aria-live="polite">{{ result }}</output>
  </section>
</template>
```

For a third-party component whose model event is a raw value, bind `:modelValue="$field.value"` and forward `@update:modelValue="$field.props.onChange({ value: $event })"` plus blur; do not blindly bind a DOM `onInput` adapter to a value-only emitter. For a Form-owned OTP, this explicit bridge must also set `:formControl="{ novalidate: true }"` on the input so only FormField registers/owns it.

## Controlled complex-input consumer

This independent workbench owns its own models and has no Form above it. Tree checkbox selection preserves partial parent state; CascadeSelect stores a leaf ID; a DatePicker range can be incomplete. Secrets are not echoed. A reset button changes these controlled models directly.

<!-- example:InputWorkbench.vue -->
```vue
<script setup lang="ts">
import { ref, shallowRef, computed } from 'vue'
import DatePicker from 'openvue/datepicker'
import TreeSelect from 'openvue/treeselect'
import CascadeSelect from 'openvue/cascadeselect'
import MultiSelect from 'openvue/multiselect'
import InputMask from 'openvue/inputmask'
import InputOtp from 'openvue/inputotp'
import Password from 'openvue/password'

const range = ref<Date | Date[] | (Date | null)[] | null | undefined>(null)
const checked = ref<Record<string, { checked: boolean; partialChecked: boolean }> | null>({})
const city = shallowRef<string | null>(null)
const topics = ref<string[] | null>([])
const phone = shallowRef<string | null | undefined>('')
const code = shallowRef('')
const password = shallowRef<string | null | undefined>('')
const nodes = [{ key: 'work', label: 'Work', children: [
  { key: 'design', label: 'Design' }, { key: 'research', label: 'Research' }
] }]
const regions = [{ label: 'Europe', countries: [{ label: 'Norway', cities: [
  { id: 'oslo', label: 'Oslo' }, { id: 'bergen', label: 'Bergen' }
] }] }]
const topicOptions = ref([{ id: 'vue', label: 'Vue' }, { id: 'a11y', label: 'Accessibility' }])
const selectedLeaves = computed(() => ['design', 'research'].filter(key => checked.value?.[key]?.checked))
const rangeComplete = computed(() => Array.isArray(range.value) && range.value.length === 2 &&
  range.value.every(date => date instanceof Date && Number.isFinite(date.getTime())))
function refreshOptions() {
  topicOptions.value = topicOptions.value.map(option => ({ ...option }))
}
function reset() {
  range.value = null
  checked.value = {}
  city.value = null
  topics.value = []
  phone.value = ''
  code.value = ''
  password.value = ''
}
</script>

<template>
  <section aria-labelledby="workbench-heading" class="fields">
    <h2 id="workbench-heading">Controlled input boundaries</h2>
    <label for="travel-dates">Travel dates</label>
    <DatePicker v-model="range" inputId="travel-dates" selectionMode="range" dateFormat="yy-mm-dd"
      :manualInput="false" showButtonBar showClear :pt="{ pcInputText: { root: { 'aria-describedby': 'range-state' } } }" />
    <output id="range-state">{{ rangeComplete ? 'Complete range' : 'Incomplete range' }}</output>
    <span id="work-label">Work areas</span>
    <TreeSelect v-model="checked" :options="nodes" selectionMode="checkbox" ariaLabelledby="work-label" />
    <output id="tree-state">{{ JSON.stringify({ checked, selectedLeaves }) }}</output>
    <span id="region-label">Destination</span>
    <CascadeSelect v-model="city" :options="regions" optionLabel="label" optionValue="id"
      optionGroupLabel="label" :optionGroupChildren="['countries', 'cities']" ariaLabelledby="region-label" showClear />
    <output id="cascade-state">{{ city ?? 'No city' }}</output>
    <span id="topics-label">Topics</span>
    <MultiSelect v-model="topics" :options="topicOptions" optionLabel="label" optionValue="id"
      ariaLabelledby="topics-label" display="chip" />
    <button type="button" @click="refreshOptions">Replace topic objects</button>
    <output id="topic-state">{{ JSON.stringify(topics) }}</output>
    <label for="local-phone">Local phone pattern (not a verification)</label>
    <InputMask id="local-phone" v-model="phone" mask="999-999" unmask />
    <output id="mask-state">{{ phone }}</output>
    <fieldset>
      <legend>Demonstration code (never enter a real code)</legend>
      <InputOtp v-model="code" :length="4" integerOnly>
        <template #default="{ attrs, events, index }">
          <input v-bind="attrs" v-on="events" :aria-label="`Code digit ${index}`" inputmode="numeric"
            autocomplete="one-time-code" maxlength="1" class="otp-cell" />
        </template>
      </InputOtp>
      <output id="code-state">{{ code.length === 4 ? 'Four code characters' : 'Code incomplete' }}</output>
    </fieldset>
    <label for="demo-password">Demonstration password</label>
    <Password v-model="password" inputId="demo-password" :feedback="false" toggleMask
      :inputProps="{ autocomplete: 'new-password', 'aria-describedby': 'password-help' }" />
    <small id="password-help">Kept only in this component; never submitted or logged.</small>
    <button type="button" @click="reset">Reset controlled inputs</button>
  </section>
</template>
```

## Race-safe completion consumer

The host supplies a real `search(query, signal)` capability returning the declared objects. No transport is invented here. The component emits a selected ID while retaining the object/string union that AutoComplete actually writes. `:delay="0"` removes the internal waiting window; the alive guard also protects a queued callback after unmount.

<!-- example:CatalogPicker.vue -->
```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import AutoComplete from 'openvue/autocomplete'
import type { AutoCompleteCompleteEvent } from 'openvue/autocomplete'

export interface CatalogItem { id: string; label: string }
const props = defineProps<{ search: (query: string, signal: AbortSignal) => Promise<CatalogItem[]> }>()
const emit = defineEmits<{ select: [id: string | null] }>()
const model = ref<CatalogItem | string | null>(null)
const suggestions = ref<CatalogItem[]>([])
const pending = shallowRef(false)
const error = shallowRef('')
let controller: AbortController | undefined
let generation = 0
let alive = true
const selectedId = computed(() => typeof model.value === 'object' && model.value !== null ? model.value.id : null)
function invalidate() {
  generation++
  controller?.abort()
  suggestions.value = []
  pending.value = false
}
function changed(value: CatalogItem | string | null) {
  invalidate()
  error.value = ''
  model.value = value
  emit('select', typeof value === 'object' && value !== null ? value.id : null)
}
async function complete(event: AutoCompleteCompleteEvent) {
  if (!alive) return
  invalidate()
  const ticket = generation
  const current = new AbortController()
  controller = current
  pending.value = true
  error.value = ''
  try {
    const items = await props.search(event.query, current.signal)
    if (alive && ticket === generation) suggestions.value = items
  } catch (cause) {
    if (alive && ticket === generation && !current.signal.aborted) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  } finally {
    if (alive && ticket === generation) pending.value = false
  }
}
onBeforeUnmount(() => { alive = false; invalidate() })
</script>

<template>
  <section aria-labelledby="catalog-heading" class="fields">
    <h2 id="catalog-heading">Catalog completion</h2>
    <label for="catalog-query">Catalog item</label>
    <AutoComplete :modelValue="model" @update:modelValue="changed" inputId="catalog-query"
      :suggestions="suggestions" optionLabel="label" dataKey="id" :delay="0" :loading="pending"
      :pt="{ pcInputText: { root: { 'aria-describedby': 'catalog-error' } } }" @complete="complete" />
    <p id="catalog-error" role="status">{{ error }}</p>
    <output id="catalog-state">{{ pending ? 'Searching' : selectedId ?? 'No selected item' }}</output>
  </section>
</template>
```

## File ownership and rich text security

FileUpload does not save anything unless a real transport is configured. Default transport creates multipart FormData under `name`, POSTs to `url`, and exposes `{ xhr, formData }` in before-upload/before-send. `upload`/`error` carry `{ xhr, files }`, `progress` carries `{ originalEvent, progress }`; selected queue is cleared after either XHR outcome. `customUpload` emits `uploader({ files })` instead; **your application** owns request completion, errors, retries/cancellation and clearing. Auto invokes the upload path immediately after accepted selection: configured default transport or the custom uploader callback. Do not enable it for a “choose now, submit later” draft. Do not label a custom local operation “uploaded”. The header/content/file/empty slots expose choose/upload/clear/remove callbacks; invoke them, not private queue mutations. `select({ originalEvent, files })` is the full current queue, not necessarily only newly added files.

`accept`, size and count checks are browser UX, not security enforcement. A real service must authenticate/authorize, enforce byte limits/content inspection, choose safe filenames/storage, and reject dangerous active content regardless of extension/MIME. Do not inline arbitrary SVG/HTML or expose credentials in url. Default image preview creates object URLs on File objects and this release has no revokeObjectURL call in its uploader lifecycle: own cleanup of preview URLs you retain. Avoid default image previews if you cannot manage their lifetime. The example accepts plain text and parses it **locally**, explicitly without a network upload or image preview.

In basic mode a new selection replaces the old queue **before** validation, and `select` still fires with `files: []` when every new file is rejected. Invalidate any pending read and replace the previous report in that branch; otherwise a rejected replacement leaves a stale success (or permanent “Reading local text”) even though no file is selected.

<!-- example:LocalTextFile.vue -->
```vue
<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import FileUpload from 'openvue/fileupload'
import type { FileUploadSelectEvent } from 'openvue/fileupload'
const report = shallowRef('No local file read')
let generation = 0
let alive = true
async function selected(event: FileUploadSelectEvent) {
  const ticket = ++generation
  const file = event.files[0]
  if (!file) {
    report.value = 'No accepted local file. Choose a .txt file of at most 4096 bytes.'
    return
  }
  if (file.size > 4096 || !file.name.toLowerCase().endsWith('.txt')) {
    report.value = 'Choose a .txt file of at most 4096 bytes.'
    return
  }
  report.value = 'Reading local text'
  try {
    const text = await file.text()
    if (alive && ticket === generation) report.value = `${file.name}: ${text.trim().split(/\s+/u).filter(Boolean).length} words`
  } catch (cause) {
    if (alive && ticket === generation) report.value = cause instanceof Error ? cause.message : String(cause)
  }
}
function clear() { generation++; report.value = 'No local file read' }
onBeforeUnmount(() => { alive = false; generation++ })
</script>

<template>
  <section aria-labelledby="file-heading">
    <h2 id="file-heading">Local text inspection (not an upload)</h2>
    <FileUpload mode="basic" accept="text/plain,.txt" :maxFileSize="4096" chooseLabel="Read local text"
      :auto="false" customUpload @select="selected" @clear="clear" />
    <output id="file-state" aria-live="polite">{{ report }}</output>
    <button type="button" @click="clear">Clear local report</button>
  </section>
</template>
```

Editor dynamically imports Quill on mount; install `quill@2.0.3` only when using Editor and keep initialization client-owned in SSR (Nuxt client-only boundary). The published runtime calls Quill `getSemanticHTML()` and clipboard `convert({ html })`; do not assume older Quill APIs. `text-change` includes `{ htmlValue, textValue, delta, source, instance }`; selection-change includes ranges/source/instance. These are not DOM input events. The Editor value is HTML, not plain text or a Delta object. Application formats/modules/toolbar restrict editing, **not untrusted content**. Persisted HTML needs a reviewed sanitizer/allowlist at the trust boundary; render untrusted content as text until that exists. `readonly` is not sanitization. Never use arbitrary `v-html` for previews. External updates while Quill has focus are deliberately skipped by the value watcher; coordinate reset/record switching with focus or remount the editor owner, rather than assuming a focused editor immediately reflects a changed prop. Default toolbar dropdowns have an acknowledged keyboard limitation; name all custom toolbar buttons and test focus behavior.

<!-- example:RichTextDraft.vue -->
```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import Editor from 'openvue/editor'
import type { EditorLoadEvent } from 'openvue/editor'
import type Quill from 'quill'
const html = shallowRef('')
const owner = shallowRef(0)
function labelEditor(event: EditorLoadEvent) {
  const editor: Quill = event.instance
  editor.root.setAttribute('role', 'textbox')
  editor.root.setAttribute('aria-label', 'Draft editor')
  editor.root.setAttribute('aria-multiline', 'true')
}
function reset() { html.value = ''; owner.value++ }
</script>

<template>
  <section aria-labelledby="editor-heading" class="fields">
    <h2 id="editor-heading">Local rich-text draft</h2>
    <Editor :key="owner" v-model="html" :formats="['bold', 'italic']" @load="labelEditor">
      <template #toolbar>
        <button type="button" class="ql-bold" aria-label="Bold">Bold</button>
        <button type="button" class="ql-italic" aria-label="Italic">Italic</button>
      </template>
    </Editor>
    <p>Escaped HTML for inspection, not a rendered preview:</p>
    <pre id="editor-state">{{ html }}</pre>
    <button type="button" @click="reset">Reset rich-text owner</button>
  </section>
</template>
```

### Primary discovery links

The tables and sections above cover all assigned official form/input pages, including composition-only wrappers. For wrapper contracts: [FloatLabel](https://unpkg.com/openvue@1.0.0/floatlabel/index.d.ts), [IftaLabel](https://unpkg.com/openvue@1.0.0/iftalabel/index.d.ts), [IconField](https://unpkg.com/openvue@1.0.0/iconfield/index.d.ts), [InputIcon](https://unpkg.com/openvue@1.0.0/inputicon/index.d.ts), [InputGroup](https://unpkg.com/openvue@1.0.0/inputgroup/index.d.ts), [InputGroupAddon](https://unpkg.com/openvue@1.0.0/inputgroupaddon/index.d.ts), [CheckboxGroup](https://unpkg.com/openvue@1.0.0/checkboxgroup/index.d.ts), [RadioButtonGroup](https://unpkg.com/openvue@1.0.0/radiobuttongroup/index.d.ts). High-risk runtime evidence: [input inheritance/registration](https://unpkg.com/@openvue/core@1.0.0/baseeditableholder/index.mjs), [OTP token synchronization](https://unpkg.com/openvue@1.0.0/inputotp/index.mjs), [completion lifecycle](https://unpkg.com/openvue@1.0.0/autocomplete/index.mjs), [date conversion](https://unpkg.com/openvue@1.0.0/datepicker/index.mjs), [FileUpload queue/transport](https://unpkg.com/openvue@1.0.0/fileupload/index.mjs), [Editor initialization/toolbar](https://unpkg.com/openvue@1.0.0/editor/index.mjs), [Quill 2.0.3 package](https://registry.npmjs.org/quill/2.0.3). Master documentation is discovery evidence; the versioned declarations/runtime above govern copyable APIs.
