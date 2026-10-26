# TanStack Vue Form

Read for `@tanstack/vue-form`, typed nested fields, event-specific/async validation, arrays, selectors, or form groups. Read [form ownership](forms.md) first. This reference uses the Vue adapter, not React render props, React hooks, or framework-specific server actions.

## Version and operating model

Verified stable **`@tanstack/vue-form@1.33.5`**, exact dependency **`@tanstack/form-core@1.33.5`**, dependency `@tanstack/vue-store ^0.11.0`, Vue peer `^3.4.0`. This fits the Vue 3.5.44 baseline. Root imports are the supported package interface. [Registry](https://registry.npmjs.org/@tanstack%2Fvue-form/1.33.5), [pinned manifest](https://unpkg.com/@tanstack/vue-form@1.33.5/package.json).

| Responsibility | Vue API |
| --- | --- |
| Create form once during setup | `useForm({ defaultValues, validators, onSubmit })` |
| Register/render a field | `<form.Field name="…" v-slot="{ field, state }">` |
| Push a control update | `field.handleChange(valueOrUpdater)` |
| Mark blur/touch | `field.handleBlur()` |
| Submit/validate | `await form.handleSubmit()` |
| Read reactive state in script | `form.useSelector(state => …)` → readonly ref |
| Read reactive state in template | `<form.Subscribe v-slot="selectedState">` |
| Accept canonical saved values | `form.reset(savedValues)` |

`field.state.value` is not a writable `v-model` target. Do not assign to the form snapshot, use React `useField` advice, or assume `form.state` reads in script are Vue-tracked. The bound `form.Field` supplies its parent automatically. `form.useStore` is deprecated; use `form.useSelector`. [Vue adapter source](https://unpkg.com/@tanstack/vue-form@1.33.5/src/useForm.tsx), [field slots/reactivity](https://unpkg.com/@tanstack/vue-form@1.33.5/src/useField.tsx).

Bind a selector as a function: `<form.Subscribe :selector="state => state.isSubmitting" v-slot="isSubmitting">`. Without the leading `:`, Vue passes a literal string, not a callable selector. The scoped slot receives the selected value itself, not always the whole form object. [Basic concepts and provider versions](https://tanstack.com/form/latest/docs/framework/vue/guides/basic-concepts).

## Complete async field and submit component

Complete embeddable SFC. The application must supply both callbacks: `isNameAvailable` performs an advisory read and honors the supplied `AbortSignal`; `save` performs the authoritative write and returns canonical data or expected field errors. These contracts do not claim a backend implementation exists. Do not replace them with artificial timers/no-op services.

```vue
<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { useForm } from '@tanstack/vue-form'

interface Draft { name: string }
type SaveResult =
  | { ok: true; value: Draft }
  | { ok: false; message: string; fields: { name?: string } }
const props = defineProps<{
  isNameAvailable: (name: string, signal: AbortSignal) => Promise<boolean>
  save: (draft: Draft) => Promise<SaveResult>
}>()
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')
const busy = ref(false)
const failure = ref('')
const status = ref('')
let focusName = false

const form = useForm({
  defaultValues: { name: '' },
  onSubmit: async ({ value, formApi }) => {
    const result = await props.save({ name: value.name })
    if (!result.ok) {
      failure.value = result.message
      if (result.fields.name) {
        formApi.setFieldMeta('name', previous => ({
          ...previous,
          errorMap: { ...previous.errorMap, onServer: result.fields.name },
        }))
        focusName = true
      }
      return
    }
    formApi.reset(result.value)
    status.value = 'Changes accepted.'
  },
  onSubmitInvalid: () => {
    failure.value = 'Correct the marked field.'
    focusName = true
  },
})
const validating = form.useSelector(state => state.isValidating)

async function availableName({ value, signal }: { value: string; signal: AbortSignal }) {
  try {
    return (await props.isNameAvailable(value, signal))
      ? undefined
      : 'This name is unavailable.'
  } catch {
    if (signal.aborted) return undefined
    return 'Availability could not be checked; try again.'
  }
}

async function submit() {
  if (busy.value) return
  if (validating.value) {
    failure.value = 'Wait for the current name check to finish.'
    return
  }
  busy.value = true
  focusName = false
  failure.value = ''
  status.value = ''
  try {
    await form.handleSubmit()
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : 'Could not save changes.'
  } finally {
    busy.value = false
    if (focusName) {
      focusName = false
      await nextTick()
      nameInput.value?.focus()
    }
  }
}

function discard() {
  if (busy.value || validating.value) return
  form.reset()
  failure.value = ''
  status.value = ''
}
</script>

<template>
  <form novalidate :aria-busy="busy || validating" @submit.prevent.stop="submit">
    <p v-if="failure" role="alert">{{ failure }}</p>
    <fieldset :disabled="busy">
      <legend>Public profile</legend>
      <form.Field
        name="name"
        :validators="{
          onChange: ({ value }) =>
            value.trim().length < 3 ? 'Use at least three characters.' : undefined,
          onChangeAsyncDebounceMs: 300,
          onChangeAsync: availableName,
        }"
        v-slot="{ field, state }"
      >
        <label for="public-name">Public name</label>
        <input
          id="public-name"
          ref="nameInput"
          :name="field.name"
          :value="state.value"
          :aria-invalid="state.meta.isTouched && !state.meta.isValid"
          aria-describedby="public-name-errors"
          autocomplete="nickname"
          required
          @blur="field.handleBlur"
          @input="field.handleChange(($event.target as HTMLInputElement).value)"
        />
        <p id="public-name-errors">
          {{ state.meta.isTouched ? state.meta.errors.join(' ') : '' }}
        </p>
        <p v-if="state.meta.isValidating" role="status">Checking name…</p>
      </form.Field>
      <form.Subscribe v-slot="{ isSubmitting, isDefaultValue }">
        <button type="submit" :disabled="busy || validating">
          {{ isSubmitting ? 'Saving…' : 'Save' }}
        </button>
        <button
          type="button"
          :disabled="busy || validating || isDefaultValue"
          @click="discard"
        >Discard</button>
      </form.Subscribe>
    </fieldset>
    <p role="status">{{ status }}</p>
  </form>
</template>
```

A local-only consumer can implement the same contracts with an explicitly session-owned collection; that is not a server availability check. For production, preserve transport failures as failures, apply authorization on the server, and map only known field names. Since expected save rejection above returns normally, `isSubmitSuccessful` alone is not the application's proof of a successful write; use the actual `ok` result/status.

With the default validation logic used here, synchronous change/blur/submit validation also clears `onServer` errors through a built-in server-cause validator. A corrected value can therefore be submitted again without a second application-owned error store or clearing listener. If replacing `validationLogic`, preserve or deliberately replace that error-clearing policy. [Pinned default validation logic](https://unpkg.com/@tanstack/form-core@1.33.5/src/ValidationLogic.ts).

Validation and save callbacks request focus; the wrapper releases `busy`, waits for the enabled DOM with `nextTick()`, then focuses. A disabled fieldset prevents focusing descendants, so awaiting a tick inside `onSubmit` is still too early. `onSubmitInvalid` is not awaited by the pinned core; keep this callback synchronous rather than launching an unowned focus promise. [Disabled controls](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled), [Vue DOM flush](https://vuejs.org/api/general.html#nexttick), [pinned submit lifecycle](https://unpkg.com/@tanstack/form-core@1.33.5/src/FormApi.ts).

## Async execution and error contracts

- Functional validators return `undefined` when valid; a string or structured value is an error. Errors preserve their return types; do not blindly call `.join()` on Standard Schema issue objects. The example uses strings only.
- The pinned validator matrix has synchronous `onMount`, and sync/async `onChange`, `onBlur`, `onSubmit`, and `onDynamic`. There is no `onMountAsync` option merely because other events have async counterparts.
- Synchronous validators run before matching `Async` validators; failure skips async work unless `asyncAlways: true` is explicitly set. This avoids remote checks for obviously invalid values.
- `asyncDebounceMs` sets a field-wide debounce; `onChangeAsyncDebounceMs`/`onBlurAsyncDebounceMs` override it by event. Use the canonical camelCase option key in `form.Field` bindings. Debouncing is not cancellation.
- Async validators receive **`signal: AbortSignal`**. In 1.33.5, a new run aborts the previous run for that validation cause and ignores its aborted result. Forward the signal to the actual request; returning from an aborted validator does not declare the current field valid. Do not mutate errors or caches from inside an obsolete validator. [Pinned cancellation logic](https://unpkg.com/@tanstack/form-core@1.33.5/src/FieldApi.ts).
- `state.meta.isValidating` is field pending; `form.useSelector(s => s.isValidating)` aggregates **field** pending in 1.33.5. Form-level-only async validators use `isFormValidating`; select `s.isFieldsValidating || s.isFormValidating` when both kinds are present. `isSubmitting` spans submit validation and awaited `onSubmit`. The example permits editing during ordinary name checks, but locks edits during submit.
- An `onChange`/`onBlur` validator also runs for submission. `canSubmit` is initially optimistic until interaction; it is not proof that untouched data is valid. Do not invent a rule that all pristine forms must be unsavable.
- For cross-field dependencies, use a form validator or `onChangeListenTo`/`onBlurListenTo` on the dependent field. For defaults `{ password: '', confirm: '' }`, the `confirm` field's validators can be `{ onChangeListenTo: ['password'], onChange: ({ value, fieldApi }) => value === fieldApi.form.getFieldValue('password') ? undefined : 'Passwords do not match.' }`. Changing the password then reruns the dependent validator; an unrelated field change does not. Linked names use full deep form paths.
- Form-level validation may return `{ form: 'Summary', fields: { 'profile.email': 'Message' } }`; errors are assigned to deep paths. A field-specific validator can overwrite the form-assigned error for the same cause. Choose one rule owner per invariant.
- A server preflight check may live in `validators.onSubmitAsync`, returning the documented `{ form, fields }` error shape. Keep a write in `onSubmit`; do not perform a write in a validator that may rerun. Expected save rejection can use the public `setFieldMeta`/`setErrorMap` APIs, as above, or a separate application error summary.

### Programmatic validation and reusable actions

Choose the operation, not a second local state copy:

| Need | Public operation and effect |
| --- | --- |
| Update a deep value | `form.setFieldValue(path, valueOrUpdater)` updates value and normally marks touched/dirty, runs change listeners, and validates. Options `dontUpdateMeta`, `dontRunListeners`, `dontValidate` are deliberate exceptions, not normal field binding. |
| Validate one/all mounted fields | `form.validateField(path, 'blur')` / `form.validateAllFields('submit')`; await their results. These checks do not perform the application's save. |
| Restore one field | `form.resetField(path)` restores its default and resets metadata; `deleteField(path)` deletes value and field/subfield registration, not a harmless hide operation. |
| Diagnose errors | `form.getAllErrors()` returns `{ form, fields }` with errors/error maps; use selectors for a reactive displayed summary rather than taking a one-time snapshot. |
| Combine schema and a functional rule | `field.parseValueWithSchema(schema)` / `form.parseValuesWithSchema(schema)` return issues without setting internal errors; return the combined result from the validator. Use the `Async` variants for asynchronous schemas. These helpers do not return transformed submit output. |

Use `listeners.onChange` for side effects such as clearing province when country changes: `({ fieldApi }) => fieldApi.form.setFieldValue('province', '')`. Keep the actual country/province names in the typed defaults, check for a real dependency change before writing, and avoid circular listeners. Listener hooks (`onChange`, `onBlur`, `onMount`, `onSubmit`, `onGroupSubmit`) are not validators and their return values do not block submission. [1.33.5 form API](https://unpkg.com/@tanstack/form-core@1.33.5/src/FormApi.ts), [field API](https://unpkg.com/@tanstack/form-core@1.33.5/src/FieldApi.ts).

For reusable defaults/validators, `formOptions({ defaultValues, ... })` preserves inference; spread the result into `useForm` instead of manually supplying the complete generic matrix. For multiple submit intents, type the default with `onSubmitMeta: { action: 'save' as 'save' | 'publish' }`, then call `form.handleSubmit({ action: 'publish' })`; `onSubmit` receives `meta.action`. The metadata selects application policy, not authorization. Do not pass Vue's submit event as this metadata by accidentally binding the method without invoking it.

`meta.errorMap` retains errors by cause (`onChange`, `onBlur`, `onSubmit`, `onDynamic`, `onServer`); `meta.errors` is flattened by one level by default in **1.33.5**. Set `disableErrorFlat: true` only when the consumer intentionally needs nested validator results; update rendering accordingly. `field.getValue()` is deprecated; read `field.state.value`. In a component setup on **Vue 3.5+**, the adapter generates an SSR-safe form ID with `useId`. On Vue 3.4 or outside an active component, the pinned helper falls back to a random UUID: supply a deterministic `formId` for SSR rather than assuming that fallback will match across hydration. `useFormId` is internal and not an importable application API. [Pinned ID helper](https://unpkg.com/@tanstack/vue-form@1.33.5/src/useFormId.ts).

## Reset, defaults, and reactive configuration

`form.reset()` resets current values and field metadata to the accepted defaults. **`form.reset(values)` also updates `defaultValues`**; use it after a successful canonical save. `form.reset(values, { keepDefaultValues: true })` replaces current state while retaining the previous default baseline. [Pinned reset source](https://unpkg.com/@tanstack/form-core@1.33.5/src/FormApi.ts).

`isDirty` means a value has been changed through the form, even if changed back; `isPristine` is its inverse. `isDefaultValue` compares current values against defaults and answers a different question. Do not use interaction dirtiness as exact unsaved-change equality.

The 1.33.5 Vue `useForm` adapter takes an options object once; it does not make an arbitrary later mutation of that object reactive. Use `form.update(nextOptions)` when configuration actually changes, supplying the still-required callbacks/options. For asynchronously loaded records, follow [form draft ownership](forms.md): deliberately reset a pristine form to the new record; preserve a dirty form and resolve the conflict. Do not overwrite drafts on every background refetch.

## Arrays and nested paths

Use dot paths for objects (`details.email`) and bracket indices for arrays (`people[0].name`). A numeric path is not a domain ID. `mode="array"` subscribes the wrapping field to structural array changes, not every child edit. Mutate with `pushValue`, `removeValue`, `insertValue`, `replaceValue`, `swapValues`, `moveValue`, or `clearValues`.

Complete standalone session-only SFC for array editing/submission. IDs are stable render keys; remove/reorder addresses still use current indices. The submitted projection excludes those UI-only IDs.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@tanstack/vue-form'

interface PersonRow { key: number; name: string }
let nextKey = 1
const submittedNames = ref<string[]>([])
const form = useForm({
  defaultValues: { people: [] as PersonRow[] },
  onSubmit: ({ value }) => {
    submittedNames.value = value.people.map(person => person.name.trim())
  },
})
</script>

<template>
  <form novalidate @submit.prevent.stop="form.handleSubmit()">
    <form.Field name="people" mode="array" v-slot="{ field: people }">
      <fieldset v-for="(person, index) in people.state.value" :key="person.key">
        <legend>Person {{ index + 1 }}</legend>
        <form.Field
          :name="`people[${index}].name`"
          :validators="{ onChange: ({ value }) => value.trim() ? undefined : 'Enter a name.' }"
          v-slot="{ field, state }"
        >
          <label :for="`person-${person.key}`">Name</label>
          <input
            :id="`person-${person.key}`"
            :value="state.value"
            :name="field.name"
            :aria-invalid="!state.meta.isValid"
            :aria-describedby="`person-error-${person.key}`"
            @blur="field.handleBlur"
            @input="field.handleChange(($event.target as HTMLInputElement).value)"
          />
          <p :id="`person-error-${person.key}`">{{ state.meta.errors.join(' ') }}</p>
        </form.Field>
        <button type="button" @click="people.removeValue(index)">Remove</button>
      </fieldset>
      <button type="button" @click="people.pushValue({ key: nextKey++, name: '' })">
        Add person
      </button>
    </form.Field>
    <button type="submit">Apply for this session</button>
    <p role="status">Session-only names: {{ submittedNames.join(', ') }}</p>
  </form>
</template>
```

When removing/reordering, use the array APIs so paths and metadata move coherently. An empty array is valid unless the product requires a minimum-length validator. When rows contain async checks, exercise removal while a check is pending; do not retain the old index in application request side effects.

## Schemas, dynamic validation, and groups

Standard Schema validators are supported directly; no old `zodValidator()` adapter is required. Compatible documented provider lines include Zod ≥3.24, Valibot ≥1, ArkType ≥2.1.20, and Yup ≥1.7; confirm the actual provider implements Standard Schema. Current confirmed package releases used elsewhere here are Zod **4.6.7**, Valibot **1.5.0**, and Yup **1.7.1**. Do not apply vee-validate v4's Zod adapter peer restriction to TanStack.

Match the provider's execution mode to the validator slot. In **Yup 1.7.1**, `schema['~standard'].validate` is always async, even without custom async tests: use `validators: { onChangeAsync: yupSchema }` (or another `*Async` cause), not `onChange`. Likewise use async slots for asynchronous Zod/Valibot refinements. TanStack **1.33.5** throws `async function passed to sync validator` if a Standard Schema returns a promise in a synchronous slot. [Pinned Yup adapter](https://unpkg.com/yup@1.7.1/index.esm.js), [TanStack Standard Schema dispatch](https://unpkg.com/@tanstack/form-core@1.33.5/src/standardSchemaValidator.ts).

Complete setup-only example using **Zod 4.6.7**. Schema validation does **not** replace form input with transformed output; explicitly parse on submit. Use `parseAsync` if the schema itself contains asynchronous refinements.

```ts
import { useForm } from '@tanstack/vue-form'
import { z } from 'zod'

const schema = z.object({
  age: z.string().regex(/^\d+$/, 'Enter a whole number.').transform(Number),
})
const defaultValues: z.input<typeof schema> = { age: '' }
const form = useForm({
  defaultValues,
  validators: { onChange: schema },
  onSubmit: ({ value }) => {
    const output = schema.parse(value)
    window.alert(`Parsed age: ${output.age}`)
  },
})
```

Schema issue objects require message projection (for example `issue.message`), not implicit string conversion. For submit-first/revalidate-afterward behavior, supply `validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' })` (import `revalidateLogic` from `@tanstack/vue-form`) and `validators.onDynamic`. Without this logic, `onDynamic` does not run.

## Independently validated steps with FormGroup

`form.FormGroup` passes its parent automatically; standalone exported `FormGroup`/`Field` components need an explicit `form` option. The slot is `{ group, state }`; `state.value` is the group value and `state.meta` contains `isFieldsValid`, `isGroupValid`, `isValid`, `isSubmitting`, and its own `submissionAttempts`. A group error is `{ group: message, fields: { email: message } }`, with **relative** field-error paths; rendered `form.Field` names remain full form paths. `group.handleSubmit()` validates/submits only the group and awaits `onGroupSubmit`; `onGroupSubmitInvalid` handles rejection by validation. Neither proves the other steps valid.

Complete session-only two-step SFC, using **Zod 4.6.7**. Group schemas are the same objects composed into the final schema, so bypassing a step does not bypass final validation. Exactly one step's HTML form is mounted; forms are never nested. Each form submits its active group, so Enter and its submit button take the same path. Only the last group's callback invokes whole-form submission and accepts the session snapshot.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { revalidateLogic, useForm } from '@tanstack/vue-form'
import { z } from 'zod'

const contactSchema = z.object({ email: z.string().email('Enter an email.') })
const profileSchema = z.object({ age: z.number().int().min(18, 'Minimum age is 18.') })
const schema = z.object({ contact: contactSchema, profile: profileSchema })
const step = ref(0)
const status = ref('')
const accepted = ref<z.output<typeof schema> | null>(null)
const form = useForm({
  defaultValues: { contact: { email: '' }, profile: { age: 18 } },
  validationLogic: revalidateLogic(),
  validators: { onDynamic: schema },
  onSubmit: ({ value }) => {
    accepted.value = schema.parse(value)
    status.value = 'Applied for this session; not persisted.'
  },
  onSubmitInvalid: () => {
    step.value = 0
    status.value = 'Review all steps; final validation failed.'
  },
})
function invalidStep() {
  status.value = 'Correct this step before continuing.'
}
</script>

<template>
  <div>
    <form.FormGroup
      v-if="step === 0"
      name="contact"
      :validators="{ onDynamic: contactSchema }"
      :onGroupSubmit="() => { step = 1; status = '' }"
      :onGroupSubmitInvalid="invalidStep"
      v-slot="{ group, state }"
    >
      <form novalidate @submit.prevent.stop="group.handleSubmit()">
      <fieldset>
        <legend>Contact</legend>
        <form.Field name="contact.email" v-slot="{ field, state: emailState }">
          <label for="step-email">Email</label>
          <input
            id="step-email" type="email" autocomplete="email"
            :value="emailState.value" :name="field.name"
            :aria-invalid="!emailState.meta.isValid"
            aria-describedby="step-email-error"
            @blur="field.handleBlur"
            @input="field.handleChange(($event.target as HTMLInputElement).value)"
          />
          <p id="step-email-error">
            {{ emailState.meta.errors.map(issue => issue?.message).join(' ') }}
          </p>
        </form.Field>
        <button type="submit" :disabled="state.meta.isSubmitting">
          Next
        </button>
      </fieldset>
      </form>
    </form.FormGroup>
    <form.FormGroup
      v-else name="profile"
      :validators="{ onDynamic: profileSchema }"
      :onGroupSubmit="() => form.handleSubmit()"
      :onGroupSubmitInvalid="invalidStep"
      v-slot="{ group, state }"
    >
      <form novalidate @submit.prevent.stop="group.handleSubmit()">
      <fieldset>
        <legend>Profile</legend>
        <form.Field name="profile.age" v-slot="{ field, state: ageState }">
          <label for="step-age">Age</label>
          <input
            id="step-age" type="number" :value="ageState.value" :name="field.name"
            :aria-invalid="!ageState.meta.isValid" aria-describedby="step-age-error"
            @blur="field.handleBlur"
            @input="field.handleChange(($event.target as HTMLInputElement).valueAsNumber)"
          />
          <p id="step-age-error">
            {{ ageState.meta.errors.map(issue => issue?.message).join(' ') }}
          </p>
        </form.Field>
        <button type="button" @click="step = 0">Back</button>
        <button type="submit" :disabled="state.meta.isSubmitting">
          Apply for this session
        </button>
      </fieldset>
      </form>
    </form.FormGroup>
    <p role="status">{{ status }}</p>
    <p v-if="accepted">Session-only email: {{ accepted.contact.email }}</p>
  </div>
</template>
```

`onDynamic` on the parent alone does not switch a group's before/after-submit behavior. Supply the group's own sub-schema as above; group validation uses its own submission attempts with the inherited `revalidateLogic`. Keep the full parent schema for final submission, including steps whose field components are unmounted. `onSubmitMeta`/`handleSubmit(meta)` also exist on the group when a step needs typed intent. With actual async saves, add the duplicate-submit/error/focus contract from the main SFC rather than relying on the session-only example's synchronous acceptance. [Group guide](https://tanstack.com/form/latest/docs/framework/vue/guides/form-groups), [pinned group state/submit implementation](https://unpkg.com/@tanstack/form-core@1.33.5/src/FormGroupApi.ts).

In **1.33.5**, `Field` and `FormGroup` spread fallthrough attrs directly into their API options; undeclared attrs preserve their original casing. Bind option names in canonical camelCase (`:onGroupSubmit`, `:onGroupSubmitInvalid`, `:asyncDebounceMs`) or use a `v-bind` object with those keys. Ordinary kebab-case prop normalization does not repair raw attrs: a kebab-cased group callback can be silently ignored even though validation and type checking succeed. [Vue attr casing](https://vuejs.org/guide/components/attrs.html#accessing-fallthrough-attributes-in-javascript), [pinned group adapter](https://unpkg.com/@tanstack/vue-form@1.33.5/src/useFormGroup.tsx), [pinned field adapter](https://unpkg.com/@tanstack/vue-form@1.33.5/src/useField.tsx).

## Vuetify boundary

Contextual replacements for the main SFC, not a standalone component. Keep its Vue import, add the imports/helpers below to the same `<script setup>`, and replace only the existing `nameInput` declaration with the declaration below. Then replace the entire native `<label>`, `<input>`, and `<p id="public-name-errors">` block with the second fence. Retain the surrounding `form.Field` (including its validators and slot), pending message, native outer `<form>`, and submission wrapper unchanged. Leave Vuetify `rules` unset.

```ts
import type { InputHTMLAttributes } from 'vue'
import { VTextField } from 'vuetify/components'

const nameInput = useTemplateRef<InstanceType<typeof VTextField>>('nameInput')

function nameInputAttrs(onBlur: () => void, isInvalid: boolean): Pick<
  InputHTMLAttributes, 'autocomplete' | 'required' | 'onBlur' | 'aria-invalid' | 'class' | 'style'
> {
  return { autocomplete: 'nickname', required: true, onBlur, 'aria-invalid': isInvalid }
}

function stringErrors(errors: readonly (string | undefined)[]): string[] {
  return errors.filter((error): error is string => typeof error === 'string')
}
```

```vue
<VTextField
  ref="nameInput"
  :model-value="state.value"
  label="Public name"
  :name="field.name"
  v-bind="nameInputAttrs(field.handleBlur, state.meta.isTouched && !state.meta.isValid)"
  :disabled="busy"
  :error-messages="state.meta.isTouched ? stringErrors(state.meta.errors) : []"
  @update:model-value="field.handleChange($event ?? '')"
/>
```

The component ref preserves the wrapper's focus-after-unlock behavior; 4.3.0 forwards the native input's focus method. A clearable component may emit `null` even through global defaults; normalize it to `''` for this string field, not by casting or introducing a second model. TanStack's inferred error array still includes `undefined` from successful validators; `stringErrors` narrows each item before passing Vuetify's `readonly string[]` contract. This string-only helper is not a Standard Schema issue renderer.

Native `blur`, `autocomplete`, `required`, and `aria-invalid` travel in a narrow Vue-checked attribute bag, following the [strict-template fallthrough recipe](vuetify-setup.md#strict-template-checking-and-native-fallthrough). Optional `class`/`style` keys keep its type compatible with the component's shared surface without adding runtime attributes; no component-wide augmentation or unchecked dictionary is used. `VTextField` routes these attributes/listeners to its real input. The explicit `aria-invalid` mirrors TanStack's touched/error validity, including `onServer` errors: it stays false before touch and becomes true for a touched rejected field even when a nonempty value passes native `required` validity. Visible error messages and native constraint validity alone do not expose that application rejection as an accessible invalid state. Vuetify renders the supplied errors and associations; TanStack remains the sole value/rule owner. These are exact assembly instructions, not a claim that the contextual fences were independently typechecked. [Pinned VTextField forwarding](https://unpkg.com/vuetify@4.3.0/lib/components/VTextField/VTextField.js), [native-attribute routing](https://unpkg.com/vuetify@4.3.0/lib/util/helpers.js), [4.3.0 error-message declaration](https://unpkg.com/vuetify@4.3.0/lib/components/VTextField/VTextField.d.ts), [TanStack derived field validity](https://unpkg.com/@tanstack/form-core@1.33.5/src/FormApi.ts).

## Verification boundary and sources

No examples were run here. The primary component is complete at its explicit callback boundary; the array SFC is standalone in an installed Vue app; the schema fence is setup-only. Exercise empty/untouched submit, reversed async responses, cancellation/outage, server rejection, reset baseline, nested rows/reorder, and keyboard/error focus in the consuming app.

- [Vue quick start](https://tanstack.com/form/latest/docs/framework/vue/quick-start).
- [Validation and async/debounce/error contracts](https://tanstack.com/form/latest/docs/framework/vue/guides/validation).
- [Submission and schema output](https://tanstack.com/form/latest/docs/framework/vue/guides/submission-handling).
- [Vue arrays](https://tanstack.com/form/latest/docs/framework/vue/guides/arrays), [dynamic validation](https://tanstack.com/form/latest/docs/framework/vue/guides/dynamic-validation).
- [1.33.5 FormApi](https://unpkg.com/@tanstack/form-core@1.33.5/src/FormApi.ts), [FieldApi](https://unpkg.com/@tanstack/form-core@1.33.5/src/FieldApi.ts), [Vue Field implementation](https://unpkg.com/@tanstack/vue-form@1.33.5/src/useField.tsx).
