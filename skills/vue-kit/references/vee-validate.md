# vee-validate: Vue form state and validation

Read for `useForm`, `defineField`, `useField`, `<Field>`, arrays, or an incumbent vee-validate integration. Read [form ownership](forms.md) first for draft/server separation and one-owner rules. This is Vue SPA guidance; Nuxt auto-import/module configuration is a separate integration.

## Exact release and schema boundary

Registry evidence: **`vee-validate@4.15.1` is latest stable**, Vue peer `^3.4.26`; **`5.0.0-beta.0` is the beta tag**, not the stable default. Vue 3.5.44 satisfies the v4 peer. Do not copy unversioned/main-branch v5 schema examples into v4. [Registry](https://registry.npmjs.org/vee-validate), [4.15.1 package](https://unpkg.com/vee-validate@4.15.1/package.json).

| Installed line | Schema contract | Decision |
| --- | --- | --- |
| v4.15.1 | Functions/object rules; raw Yup schemas supported | Raw Yup validation is valid, but does not provide the typed input/output inference of its adapter. |
| v4.15.1 typed schemas | `toTypedSchema` from `@vee-validate/yup`, `/zod`, or `/valibot` | Keep the adapter on 4.15.1 and the schema library inside its declared peer. |
| v5.0.0-beta.0 | Direct Standard Schema providers | Incumbent/explicit beta migration context only; not this guide's stable offering. |

Confirmed v4 adapter constraints: **`@vee-validate/yup@4.15.1` → `yup ^1.3.2`**; **`@vee-validate/zod@4.15.1` → `zod ^3.24.0`**; **`@vee-validate/valibot@4.15.1` → `valibot ^1.0.0-beta.7`**. Example-compatible pins include Yup **1.7.1**, Zod **3.25.76**, Valibot **1.5.0**. Zod's registry latest **4.6.7 is outside this v4 Zod adapter's declared peer**; do not claim Zod 4 support from an old issue/comment. [Yup adapter manifest](https://unpkg.com/@vee-validate/yup@4.15.1/package.json), [Zod adapter manifest](https://unpkg.com/@vee-validate/zod@4.15.1/package.json), [Valibot adapter manifest](https://unpkg.com/@vee-validate/valibot@4.15.1/package.json).

Each listed **4.15.1 adapter depends on `vee-validate: "4.15.1"`**, not a cross-major peer. Do not install these adapters alongside the v5 beta or pass Zod 4 into the v4 Zod adapter. Those combinations are excluded, not optional examples hidden behind a warning. Keep an incumbent v4 application on its compatible adapter/schema pair; if its wider application already requires Zod 4, use an application-owned function/object rule at the v4 boundary or select a separately evaluated Standard Schema form owner. Do not force incompatible peers or silently adopt a beta just to satisfy a dependency resolver. The manifests above establish the dependency/peer exclusion; no runtime incompatibility reproduction is claimed.

V5 migration docs require Standard Schema-capable versions: Zod ≥3.24.0, Yup ≥1.7.0, Valibot ≥1.0.0. They also remove schema-derived `required` metadata and schema defaults used to initialize the form. Supply explicit `initialValues` and required UI semantics. This is not a recommendation to migrate an incumbent v4 app. [Official migration source](https://github.com/logaretm/vee-validate/blob/main/docs/src/pages/guide/migration.mdx), [5.0.0-beta.0 Standard Schema declarations](https://unpkg.com/vee-validate@5.0.0-beta.0/dist/vee-validate.d.ts).

## Complete field and submit component

Complete embeddable SFC on v4.15.1. The required `save` prop is an **application-owned contract**, not an imported service assumed to exist. Its implementation must perform the real write or clearly identify local-only storage. Expected rejection returns a message/field errors; transport failures throw. Editing is disabled during validation and save, so response errors still refer to the submitted values.

```vue
<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { useForm } from 'vee-validate'

interface Draft { email: string }
type SaveResult =
  | { ok: true; value: Draft }
  | { ok: false; message: string; fields: { email?: string } }
const props = defineProps<{ save: (draft: Draft) => Promise<SaveResult> }>()
const emailInput = useTemplateRef<HTMLInputElement>('emailInput')
const busy = ref(false)
const status = ref('')
const failure = ref('')
const {
  defineField, handleSubmit, errors, meta, isSubmitting, isValidating,
  resetForm, setFieldError,
} = useForm<Draft>({
  initialValues: { email: '' },
  validationSchema: {
    email: (value: string) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter an email address.',
  },
})
const [email, emailAttrs] = defineField('email', state => ({
  validateOnModelUpdate: state.touched,
  validateOnBlur: true,
  props: {
    'aria-invalid': state.errors.length > 0,
    'aria-describedby': 'profile-email-error',
  },
}))

let focusEmail = false
const validatedSubmit = handleSubmit(async values => {
  const result = await props.save({ email: values.email })
  if (!result.ok) {
    failure.value = result.message
    setFieldError('email', result.fields.email)
    focusEmail = Boolean(result.fields.email)
    return
  }
  resetForm({ values: result.value }, { force: true })
  status.value = 'Changes accepted.'
}, () => {
  failure.value = 'Correct the marked field.'
  focusEmail = true
})

async function submit(event: Event) {
  event.preventDefault()
  if (busy.value) return
  busy.value = true
  focusEmail = false
  failure.value = ''
  status.value = ''
  try {
    await validatedSubmit()
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : 'Could not save changes.'
  } finally {
    busy.value = false
    if (focusEmail) {
      focusEmail = false
      await nextTick()
      emailInput.value?.focus()
    }
  }
}

function discard() {
  if (busy.value) return
  resetForm()
  failure.value = ''
  status.value = ''
}
</script>

<template>
  <form novalidate :aria-busy="busy" @submit="submit">
    <p v-if="failure" role="alert">{{ failure }}</p>
    <fieldset :disabled="busy">
      <legend>Profile</legend>
      <label for="profile-email">Email</label>
      <input
        id="profile-email"
        ref="emailInput"
        v-model="email"
        v-bind="emailAttrs"
        name="email"
        type="email"
        autocomplete="email"
        required
      />
      <p id="profile-email-error">{{ errors.email }}</p>
      <button type="submit">{{ isSubmitting ? 'Saving…' : 'Save' }}</button>
      <button type="button" :disabled="!meta.dirty" @click="discard">Discard</button>
    </fieldset>
    <p v-if="isValidating || meta.pending" role="status">Checking fields…</p>
    <p role="status">{{ status }}</p>
  </form>
</template>
```

The regex is a lightweight client check, not full mailbox validation. `handleSubmit` validates, touches fields, and awaits the callback; it is a factory, not the handler itself. The wrapper supplies the synchronous duplicate guard and catches callback rejection. `resetForm({ values }, { force: true })` replaces the accepted baseline, resets errors/touched/submit count, and prevents old optional keys surviving a merge. `setValues` updates values but is not “accept this new baseline.” Never mutate the readonly `values` object directly.

Error callbacks only request email focus. The wrapper clears `busy` first, then awaits Vue's [`nextTick`](https://vuejs.org/api/general.html#nexttick) so the native fieldset and contextual Vuetify field are enabled in the DOM before calling `focus()`. Awaiting a tick inside a validation/save callback is too early: the wrapper still holds the editing lock until that callback returns.

For a fully local consumer, this complete parent SFC implements the same contract honestly; name the component above `ProfileForm.vue`. Nothing survives unmount/reload and no server validation is simulated.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import ProfileForm from './ProfileForm.vue'
const accepted = ref<{ email: string } | null>(null)
async function applyForSession(draft: { email: string }) {
  const value = { email: draft.email.trim() }
  accepted.value = value
  return { ok: true as const, value }
}
</script>
<template>
  <ProfileForm :save="applyForSession" />
  <p>Session-only value: {{ accepted?.email ?? 'None applied' }}</p>
</template>
```

## Custom controls and Vuetify

`defineField` returns `[model, attrs]`; use `v-model` plus `v-bind`. For a custom input built on `useField`, opt into `syncVModel: true` only when its public `v-model` contract requires it. Pass a changing name as `useField(() => props.name)`, not a snapshot of a prop.

Contextual replacement for the main component's native `emailInput` ref, `defineField` declaration, and field element. Keep the same `useForm` owner, native `<form>`, and submission handler; replace the old ref declaration rather than adding another one. The component ref preserves invalid-submit focus. Do **not** add Vuetify `rules` or a second `VForm.validate()`.

```ts
import type { InputHTMLAttributes } from 'vue'
import { VTextField } from 'vuetify/components'

const emailInput = useTemplateRef<InstanceType<typeof VTextField>>('emailInput')
function emailInputAttrs(isInvalid: boolean): Pick<
  InputHTMLAttributes, 'autocomplete' | 'required' | 'aria-invalid' | 'class' | 'style'
> {
  return { autocomplete: 'email', required: true, 'aria-invalid': isInvalid }
}
const [email, emailAttrs] = defineField('email', state => ({
  validateOnModelUpdate: state.touched,
  props: {
    ...emailInputAttrs(state.errors.length > 0),
    'error-messages': state.errors,
  },
}))
```

```vue
<VTextField
  ref="emailInput"
  :model-value="email"
  v-bind="emailAttrs"
  label="Email"
  name="email"
  type="email"
  :disabled="busy"
  @update:model-value="email = $event ?? ''"
/>
```

`emailAttrs` forwards blur/change/input handlers, error messages, and the checked native attribute bag to the real input. Explicit `aria-invalid` follows vee-validate's errors, including authoritative rejection; Vuetify's `error-messages` does not set that native attribute. `required` preserves the original field's semantics without adding a second validation owner. The explicit model update writes only the existing vee-validate field and normalizes a nullable clear to `''`. Global Vuetify defaults can enable clearing even when the local component does not declare `clearable`. Native fallthrough follows the [checked attribute-bag recipe](vuetify-setup.md#strict-template-checking-and-native-fallthrough), not a fabricated Vuetify prop declaration. [Pinned native routing](https://unpkg.com/vuetify@4.3.0/lib/components/VTextField/VTextField.js), [field description without invalid-state projection](https://unpkg.com/vuetify@4.3.0/lib/components/VField/VField.js).

For `<Field v-slot>`, `field` targets native value/input/change bindings; `componentField` targets `modelValue`/`update:modelValue` controls. Do not combine an independent outer `v-model` with `v-bind="field"` on the same input. `<Form>` is the component alternative to `useForm`; choose one context, rather than mounting both for the same logical form. Global `configure({ validateOnBlur, validateOnChange, validateOnInput, validateOnModelUpdate })` trigger defaults apply to `<Field>`, not `useField`; configure the latter explicitly. `defineInputBinds`, `defineComponentBinds`, and `useFieldModel` are deprecated; use `defineField`.

### Declarative components and non-text controls

Complete session-only SFC using `<Form>` instead of `useForm`. `Field` groups checkboxes/radios by **shared name and distinct values**. `unchecked-value` defines a single checkbox's false state; it is not an array-item identifier. The multiple select explicitly projects its selected options because native multiple-select initial selection is not restored by a plain value attribute. The `ErrorMessage` slot contains the first error message; its `name` is the same exact field path as the control. Under strict component-prop checking, pass `type` and `value` to each `Field` through a checked narrow native-attribute bag: the pinned runtime reads both from `ctx.attrs` when registering the field, although its public component props omit them. Keep those registration attributes on `Field` **and** their matching native input; putting them only on the input would register a text field. Render native accessibility attributes inside the slots, not as undeclared component props. Each control still has one registration and the same form owner. [Pinned Field declarations](https://unpkg.com/vee-validate@4.15.1/dist/vee-validate.d.ts), [registration and slot runtime](https://unpkg.com/vee-validate@4.15.1/dist/vee-validate.mjs), [checkbox slot contract](https://vee-validate.logaretm.com/v4/examples/checkboxes-and-radio).

```vue
<script setup lang="ts">
import { nextTick, ref, useTemplateRef, type InputHTMLAttributes } from 'vue'
import { ErrorMessage, Field, Form } from 'vee-validate'

type ChoiceRegistration = Pick<InputHTMLAttributes, 'type' | 'class' | 'style'> & {
  value: boolean | string
}
const consentRegistration: ChoiceRegistration = { type: 'checkbox', value: true }
const basicRegistration: ChoiceRegistration = { type: 'radio', value: 'basic' }
const proRegistration: ChoiceRegistration = { type: 'radio', value: 'pro' }

const initialValues = { consent: false, plan: 'basic', channels: ['email'] }
const consentInput = useTemplateRef<HTMLInputElement>('consentInput')
async function focusInvalidConsent() {
  await nextTick()
  consentInput.value?.focus()
}
const applied = ref('')
const options = ['email', 'sms']
const consentRequired = (value: unknown) => value === true || 'Consent is required.'
function applyForSession(values: Record<string, unknown>) {
  applied.value = JSON.stringify({
    consent: values.consent === true,
    plan: values.plan,
    channels: values.channels,
  })
}
</script>

<template>
  <Form :initial-values="initialValues" @submit="applyForSession"
    @invalid-submit="focusInvalidConsent" v-slot="{ isSubmitting, errors }">
    <Field name="consent" v-bind="consentRegistration" :unchecked-value="false"
      :rules="consentRequired" v-slot="{ field }">
      <label>
        <input ref="consentInput" v-bind="field" type="checkbox" :value="true" required
          :aria-invalid="Boolean(errors.consent)" aria-describedby="consent-error" />
        I consent (required)
      </label>
    </Field>
    <ErrorMessage name="consent" v-slot="{ message }">
      <p id="consent-error" role="alert">{{ message }}</p>
    </ErrorMessage>
    <fieldset>
      <legend>Plan</legend>
      <Field name="plan" v-bind="basicRegistration" v-slot="{ field }">
        <label><input v-bind="field" type="radio" value="basic" />Basic</label>
      </Field>
      <Field name="plan" v-bind="proRegistration" v-slot="{ field }">
        <label><input v-bind="field" type="radio" value="pro" />Pro</label>
      </Field>
    </fieldset>
    <Field name="channels" v-slot="{ value, handleChange, handleBlur }">
      <label for="contact-channels">Contact channels</label>
      <select id="contact-channels" name="channels" multiple
        @change="handleChange" @blur="handleBlur">
        <option v-for="option in options" :key="option" :value="option"
          :selected="Array.isArray(value) && value.includes(option)">
          {{ option }}
        </option>
      </select>
    </Field>
    <button type="submit" :disabled="isSubmitting">Apply for this session</button>
    <button type="reset">Restore defaults</button>
    <p role="status">Session-only selection: {{ applied }}</p>
  </Form>
</template>
```

For **multiple checkbox selections**, use the same name with distinct `value` attributes in the checked registration bags above and initialize that field to an array; render one native checkbox per `Field`, with its matching value and slot `field` bindings. In a `useField` wrapper, configure `type: 'checkbox' | 'radio'`, `checkedValue`, and optionally `uncheckedValue`; bind `checked` plus `handleChange`, not a text-style `value` model. For files, bind only change/blur and let the library receive `File` values; never write a file input's value attribute. For custom components use `componentField`, not native `field`. `<FieldArray name="people">` is the renderless component alternative to `useFieldArray` and exposes the same stable entries and mutation operations; do not register both for the same array. A renderless `<Form as="">` requires an explicit native form/event boundary; `submitForm` is the valid-only native-submit workflow, whereas `handleSubmit` is the JavaScript callback workflow. [Field](https://vee-validate.logaretm.com/v4/api/field/), [Form](https://vee-validate.logaretm.com/v4/api/form/), [FieldArray](https://vee-validate.logaretm.com/v4/api/field-array/).

### Shared context, setters, and validation diagnostics

Descendant components use `useFormContext<Draft>()` during setup to retrieve the existing owner; calling `useForm` in the child creates a **new** context. The provider must be an ancestor, not a context created later in that child's render subtree. `useFieldValue(path)`, `useFieldError(path)`, `useFormValues`, `useFormErrors`, `useIsFieldDirty/Touched/Valid`, `useIsFormDirty/Touched/Valid`, `useIsSubmitting`, `useIsValidating`, and `useSubmitCount` are focused readers. Setter composables (`useSetFieldValue/Error/Touched`, `useSetFormValues/Errors/Touched`) and action factories (`useValidateField`, `useValidateForm`, `useResetForm`, `useSubmitForm`) likewise bind to the nearest existing form, not a global store.

Use `setFieldValue(path, value, false)` to deliberately skip validation for a programmatic write; otherwise it validates. `setFieldTouched`/`setTouched` control interaction metadata, not values. `setFieldError`/`setErrors` set visible validity errors; `errorBag[path]` contains all messages, while `errors[path]` contains the first. `resetField(path, state?)` changes one field's reset state; `resetForm` owns the accepted whole-form baseline. Use `controlled: false` for a genuinely standalone `useField`, not as a fix for a field that accidentally lost its parent.

`await validate()` defaults to **`force`** in 4.15.1 (including `handleSubmit`): mark fields validated and update errors. `validate({ mode: 'validated-only' })` limits visible error replacement to previously validated registered fields. `mode: 'silent'` avoids their visible error replacement, **not all state changes**: the schema runtime still updates `pathState.valid`, removes obsolete extra errors, and can assign errors for unrendered paths. For a truly detached check use the standalone utilities below. Do not copy the source claim that silent validation “mutates nothing” or is the default submit mode. [Pinned implementation](https://unpkg.com/vee-validate@4.15.1/dist/vee-validate.mjs), [declarations](https://unpkg.com/vee-validate@4.15.1/dist/vee-validate.d.ts).

`handleSubmit.withControlled(callback)` filters to registered values **before** schema-output handling; schema output can replace that projection (reported in [#4960](https://github.com/logaretm/vee-validate/issues/4960), also visible in the pinned runtime). It is not a payload allowlist. Always map explicit editable keys as in the main SFC. Keep expensive schema instances outside deep reactive state/`markRaw` them; for conditional rules use an intentional `computed` schema that exists initially. Do not wrap the whole form result in `reactive` merely to make nested refs usable: destructure returned refs in setup or address nested `.value` correctly.

## Async validation: pending and stale responses

A validator returns `true`/a message or a promise. Keep it side-effect-free: return the error rather than calling `setFieldError` after an awaited request. v4.15.1 wraps field validation and schema validation in latest-run handling; this prevents an older completion from overwriting the newer validation state, **not** from consuming network resources or performing application side effects. [Pinned implementation](https://unpkg.com/vee-validate@4.15.1/dist/vee-validate.mjs).

Contextual setup helper with a completely specified checker contract. Call during component setup inside the intended `useForm` context instead of registering the same email through `defineField`. The application provides the checker; no endpoint is invented here.

```ts
import { useField } from 'vee-validate'

function useAvailableEmail(check: (email: string) => Promise<boolean>) {
  return useField<string>('email', async value => {
    if (!value.trim()) return 'Enter an email address.'
    try {
      return (await check(value)) || 'This email is unavailable.'
    } catch {
      return 'Availability could not be checked; try again.'
    }
  }, { validateOnValueUpdate: false })
}
```

Bind its returned `value`; call `handleBlur(event, true)` to validate on blur. Read field `meta.pending` and form `meta.pending`/`isValidating`; never treat `meta.valid` alone as proof that an initial async check finished. `isSubmitting` spans submit validation and the returned save promise. A pending UI must not disappear while the actual save runs. Rate-limit/debounce the remote check at a deliberate boundary; if implementing cancellation, scope controllers per field, abort on unmount, and distinguish cancellation from a genuine “available” answer. Availability can change after checking; handle authoritative save rejection too.

## Nested values and repeatable fields

Paths are names, not arbitrary JavaScript: `profile.email` nests an object; `people[0].email` nests an array. `[profile.email]` opts out of nesting. Error keys remain **flat exact path strings** (`errors['people[0].email']`). Array entry `key` is a stable render ID, not the numeric index used in the field name.

Contextual repeatable-field block; these declarations belong in the same SFC setup and template. It adds a second field group to the current form only after extending its `Draft`/`initialValues` and save mapper accordingly.

```ts
import { Field, useFieldArray } from 'vee-validate'
const { fields, push, remove } = useFieldArray<{ email: string }>('people')
const requiredEmail = (value: unknown) =>
  (typeof value === 'string' && value.trim().length > 0) || 'Enter an email.'
```

```vue
<fieldset v-for="(entry, index) in fields" :key="entry.key">
  <legend>Person {{ index + 1 }}</legend>
  <Field :name="`people[${index}].email`" :rules="requiredEmail" v-slot="{ field, errorMessage }">
    <label :for="`person-${entry.key}`">Email</label>
    <input :id="`person-${entry.key}`" v-bind="field" type="email"
      :aria-invalid="Boolean(errorMessage)" :aria-describedby="`person-error-${entry.key}`" />
    <p :id="`person-error-${entry.key}`">{{ errorMessage }}</p>
  </Field>
  <button type="button" @click="remove(index)">Remove person</button>
</fieldset>
<button type="button" @click="push({ email: '' })">Add person</button>
```

Use `push`, `remove`, `move`, `swap`, `update`, or `replace`; do not mutate readonly entries. Initial values should include `{ people: [] }`; type empty arrays explicitly. When a field unmounts, its last registered path can be removed. Multi-step/tab forms may require `keepValuesOnUnmount: true` on `useForm` or `keepValueOnUnmount` per field, plus whole-form validation for hidden steps. Preserving a value does not automatically register a hidden control's rule.

## Typed schema example

Complete setup-only example for **v4.15.1 + `@vee-validate/zod@4.15.1` + Zod 3.25.76**. `submitted` receives transformed output; editing `values.age` remains an input string. Supply explicit empty/default values for predictable dirty tracking. No save service is implied.

```ts
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'

const schema = toTypedSchema(z.object({
  age: z.string().regex(/^\d+$/, 'Enter a whole number.').transform(Number),
}))
const { defineField, handleSubmit } = useForm({
  initialValues: { age: '' },
  validationSchema: schema,
})
const [age, ageAttrs] = defineField('age')
const showParsedAge = handleSubmit(submitted => {
  window.alert(`Parsed age: ${submitted.age}`)
})
```

Use the returned model/attrs in a native input and `showParsedAge` as submit handler. Zod refinements can skip when required object keys are missing; do not rely on a cross-field refinement being the only required-field rule. Raw Yup without an adapter is supported in v4; the blanket claim that every raw Yup schema throws `VVTypedSchema` is incorrect. Match the schema line to the installed major before debugging a runtime error.

## Incumbent global rules, localization, and detached checks

String rule names require registration; a function rule does not require `defineRule`. This complete initialization/check module uses **`@vee-validate/rules@4.15.1` and `@vee-validate/i18n@4.15.1`** with vee-validate 4.15.1. Register only the rules needed by the app. The custom inline dictionaries avoid a JSON-loader assumption.

```ts
import { configure, defineRule, validate, validateObject } from 'vee-validate'
import { email, required } from '@vee-validate/rules'
import { localize, setLocale } from '@vee-validate/i18n'

defineRule('required', required)
defineRule('email', email)
configure({
  bails: true,
  generateMessage: localize({
    en: { messages: { required: '{field} is required.', email: 'Enter a valid {field}.' } },
    fr: { messages: { required: '{field} est requis.', email: '{field} est invalide.' } },
  }),
})

export function useFrenchMessages() {
  setLocale('fr')
}
export async function checkEmail(value: string) {
  return validate(value, 'required|email', { name: 'email', label: 'Email' })
}
export async function checkProfile(values: { email: string }) {
  return validateObject({ email: 'required|email' }, values)
}
```

The standalone result has `valid`/`errors`; object validation adds per-path `results`/`errors`. Neither creates form/field metadata or a submission context. `normalizeRules` normalizes a string/rule map, not an untrusted validation language; path helpers `isNotNestedPath`/`cleanupNonNestedPath` handle literal bracket escapes. Function validators receive `(value, context)` with `context.form` for cross-field comparisons; global rules receive `(value, params, context)`. A rule may return a string array as well as `true`/a string; `bails: false` collects more messages from the rule pipeline, not a promise that a Yup schema follows the same configuration.

`setLocale` changes future generated messages; it does not translate already-stored error strings. Deliberately revalidate visible/previously validated fields after a locale change, preserving touched policy; do not retranslate server text. Global configuration/rule/localization state is shared at module scope: avoid per-user locale mutation in concurrent SSR requests without an isolated integration. [Global rules](https://vee-validate.logaretm.com/v4/guide/global-validators/), [i18n](https://vee-validate.logaretm.com/v4/guide/i18n/), [pinned localization manifest](https://unpkg.com/@vee-validate/i18n@4.15.1/package.json).

## Incumbent upgrades and targeted debugging

- For older v4 wrappers replace `handleInput` with `handleChange`, `valueProp` with `checkedValue`, `standalone` with inverse `controlled`, and `modelPropName` with `syncVModel`. The 4.10 changes to readonly values and opt-in v-model sync require caller updates, not aliases. Current 4.15.1 requires Vue `^3.4.26`; do not use historical Vue 3.3 requirements as the current peer contract.
- Use plain typed `initialValues` and explicit reset on record changes. The 4.15.1 declaration accepts `PartialDeep<TValues>`, not a supported getter API; do not copy older reactive-initial-values recipes as a draft synchronization contract.
- For bracket-array-path type errors ([#5074](https://github.com/logaretm/vee-validate/issues/5074)) or imprecise array errors ([#4721](https://github.com/logaretm/vee-validate/issues/4721)), first inspect the exact installed `Path`/`PathValue` declarations and typed defaults. Do not cast the entire form to `any` or weaken validation.
- Radio selection after deleting a row has a specific [FieldArray report #5013](https://github.com/logaretm/vee-validate/issues/5013). Reproduce remove/reorder with stable entry keys and inspect the real browser checked property; do not claim key discipline alone fixes that report.
- For “invalid with no visible errors,” inspect `errorBag`, `meta.pending`, the schema result, and registered/unmounted fields. A remount report labeled v5 ([#4630](https://github.com/logaretm/vee-validate/issues/4630)) is not proof of a v4 regression. Optional-field dirty tracking ([#4697](https://github.com/logaretm/vee-validate/issues/4697)) needs explicit/default values and a reset-boundary reproduction, not unconditional error suppression.
- Existing messages after locale switching ([#4672](https://github.com/logaretm/vee-validate/issues/4672)) require message regeneration as above. Devtools CJS interoperability ([#4863](https://github.com/logaretm/vee-validate/issues/4863)) requires inspecting the installed bundler/dependency export resolution, not importing a private runtime file. Give `useForm({ name: 'Profile' })` a diagnostic name to distinguish contexts in Vue devtools.

These links are scoped upstream reports, **not** locally reproduced bugs or claims that every listed issue remains unfixed. The pinned declarations/runtime decide the taught contract; exercise the specific failing path in the consuming app before attributing its failure to a report.

## Verification boundary and sources

No examples were executed here. The main SFC and its local parent are complete components; control/array blocks are explicitly contextual; the schema example is setup-only. In the consuming app exercise invalid/valid submit, handler rejection, field server errors, pending state, reversed async completion order, new baseline reset, and remove/reorder of array rows.

- [v4 `useForm` API, triggers, reset](https://vee-validate.logaretm.com/v4/api/use-form/).
- [Typed schemas, defaults, transforms, refinements](https://vee-validate.logaretm.com/v4/guide/composition-api/typed-schema/).
- [Nested objects and field arrays](https://vee-validate.logaretm.com/v4/guide/composition-api/nested-objects-and-arrays/).
- [`useField` API](https://vee-validate.logaretm.com/v4/api/use-field/), [component Field API](https://vee-validate.logaretm.com/v4/api/field/).
- [v5 migration](https://github.com/logaretm/vee-validate/blob/main/docs/src/pages/guide/migration.mdx), [stable/beta registry tags](https://registry.npmjs.org/vee-validate).
- [4.15.1 runtime](https://unpkg.com/vee-validate@4.15.1/dist/vee-validate.mjs) and adapter manifests linked above establish the version boundary.
