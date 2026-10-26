# Form ownership, submission, and Vuetify

Read this before adding validation, editing server records, or connecting a form library to Vuetify. It owns cross-library decisions; package contracts belong to [vee-validate](vee-validate.md), [TanStack Vue Form](tanstack-form.md), and [FormKit](formkit.md). Read [accessibility](accessibility.md) for interaction requirements and [remote-data architecture](architecture-data.md) for query/mutation ownership.

For an existing or explicitly selected OpenVue application, continue to [OpenVue forms and input contracts](openvue-forms.md) for its optional Form/FormField owner, resolver semantics, model shapes and native-input forwarding. Keep the cross-library draft/submission boundaries here; do not layer a second validation owner over an existing form.

Baseline: Vue **3.5.44**, Vuetify **4.3.0**. Recommendations about ownership and conflict policy below are application architecture, not guarantees made by a form library.

## Pick one validation owner

Inspect installed packages, existing field wrappers, validation schemas, and submission contracts first. Preserve an incumbent library during a narrow change.

| Situation | Owner | Integration boundary |
| --- | --- | --- |
| Small Vuetify form with local rules | Vuetify `VForm` + input `rules` | Await its validation result; own persistence and draft baseline separately. |
| Incumbent vee-validate app; reusable controlled fields | vee-validate | Bind model/events/errors into Vuetify; do not repeat validation with `rules`. |
| Type-directed field paths and event-specific validators | TanStack Vue Form | `form.Field` owns state and validation; Vuetify renders the control. |
| Schema-generated forms and inherited input plugins | FormKit | Nodes own the graph; Vue adapter renders inputs. A Vuetify input requires an explicit custom integration. |
| Browser-native constraint validation only | Native form | Keep native submission/constraint semantics; do not add a second validator accidentally. |

Client validation improves feedback; the server must still authorize and validate a write. A schema shared between client and server is not an authorization boundary. Do not wrap one library's form in another library's form, nest HTML `<form>` elements, or keep independent `v-model` copies for the same field.

## Separate draft, baseline, and server state

1. Fetch the server record through the chosen data layer. Do not bind input models directly to cached query data or readonly props.
2. Create a form-owned draft and an accepted baseline. Copy nested editable objects deliberately; `{ ...record }` is only a shallow copy.
3. Define the payload mapper explicitly. Exclude client-only row keys, computed totals, server IDs the user cannot edit, and credentials that must not be retained.
4. A background refetch may update a pristine draft. When dirty, preserve edits and expose a reload/merge decision; do not silently reset on every query result.
5. Lock editing during submission, or version each draft and reconcile the response against that version. Never attach an old response's field errors to newly edited values.
6. After confirmed success, accept the server's canonical representation as the new baseline using the owner's reset API. On failure preserve the draft and dirty state.
7. Record switching is a deliberate reset boundary. Remount by record ID or explicitly replace the baseline; do not reuse one record's touched/errors state for another.

Dirty is not universal: vee-validate compares against initial values; TanStack distinguishes interaction dirtiness from `isDefaultValue`; Vuetify's input `isDirty` describes whether an input has a value, not whether it differs from the saved record. Use the package's documented meaning, not the name alone.

## Honest save contracts

This is a complete application-owned TypeScript contract, **not** an implemented backend or a library API. The application supplies transport, authorization, runtime response validation, and conflict handling. Resolve `ok: true` only after the authoritative write succeeds. Throw for transport/unexpected failures; return field rejection for expected validation failures.

```ts
export interface ProfileDraft { email: string }
export type SaveProfileResult =
  | { ok: true; value: ProfileDraft }
  | {
      ok: false
      message: string
      fields: Partial<Record<keyof ProfileDraft, string>>
    }
export type SaveProfile = (draft: ProfileDraft) => Promise<SaveProfileResult>
```

A save callback is preferable to an invented `/api/profile` endpoint. A local demonstration may update memory, but must say “Applied for this session,” not “Saved to server.” Await the actual promise; a fire-and-forget callback makes pending indicators end too early. Retrying a write needs a product/backend idempotency contract, not an automatic form retry.

Separate the authoritative write from subsequent cache invalidation/refetch. If the write succeeded but refresh failed, retain the accepted canonical baseline and report “Saved; refresh failed,” not “Save failed”; offer a read-only refresh retry, not another write. If the write response has no canonical record, retain the submitted snapshot and write receipt/version until reconciliation; do not silently replace it with stale cached data. A conflict rejection preserves the draft and exposes the server version plus an explicit reload/merge decision. These are application outcome policies, not meanings inferred from a library's `isSubmitting` or success flag.

## Vuetify: one validation pass

In **4.3.0**, `VForm` starts validation before emitting `submit`. The emitted `SubmitEventPromise` is thenable: **await the event** in a `@submit` handler. Calling `form.validate()` there starts a second pass. For an explicit Validate button or non-submit imperative action, **await `form.validate()`** instead. Both results have `{ valid, errors }`; a Promise or result object is always truthy and is not the validity flag. [Pinned VForm source](https://unpkg.com/vuetify@4.3.0/lib/components/VForm/VForm.js), [form implementation](https://unpkg.com/vuetify@4.3.0/lib/composables/form.js).

Complete SFC for an installed Vuetify app; it applies a title only in component memory. It has no network service or artificial delay. The input stays readonly during validation; the synchronous guard prevents duplicate writes. `novalidate` is provided by `VForm`.

```vue
<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { VBtn, VForm, VTextField } from 'vuetify/components'
import type { SubmitEventPromise } from 'vuetify'

const form = useTemplateRef<InstanceType<typeof VForm>>('form')
const titleInput = useTemplateRef<InstanceType<typeof VTextField>>('titleInput')
const title = ref<string | null>('')
const acceptedTitle = ref('')
const busy = ref(false)
const status = ref('')
const dirty = computed(() => (title.value ?? '') !== acceptedTitle.value)
const titleRules = [
  (value: unknown) =>
    (typeof value === 'string' && value.trim().length > 0) || 'Enter a title.',
]

async function submit(event: SubmitEventPromise) {
  if (busy.value) return
  busy.value = true
  status.value = ''
  try {
    const { valid } = await event
    if (!valid) {
      await nextTick()
      titleInput.value?.focus()
      return
    }
    acceptedTitle.value = (title.value ?? '').trim()
    title.value = acceptedTitle.value
    status.value = 'Applied for this session; not persisted.'
    form.value?.resetValidation()
  } catch (cause) {
    status.value = cause instanceof Error ? cause.message : 'Validation failed.'
  } finally {
    busy.value = false
  }
}

function discard() {
  if (busy.value) return
  title.value = acceptedTitle.value
  status.value = ''
  form.value?.resetValidation()
}
</script>

<template>
  <VForm ref="form" validate-on="submit lazy" @submit.prevent="submit">
    <VTextField
      ref="titleInput"
      v-model="title"
      label="Title"
      name="title"
      :rules="titleRules"
      :readonly="busy"
    />
    <VBtn type="submit" :disabled="busy" :loading="busy">Apply locally</VBtn>
    <VBtn type="button" :disabled="busy || !dirty" @click="discard">
      Discard changes
    </VBtn>
    <p role="status">{{ status }}</p>
  </VForm>
</template>
```

Contextual alternative for an explicit imperative validation action, using the `form` ref above:

```ts
async function checkDraft() {
  if (!form.value || busy.value) return false
  busy.value = true
  try {
    const { valid, errors } = await form.value.validate()
    status.value = valid ? 'Draft is valid.' : `${errors.length} field(s) need attention.`
    return valid
  } finally {
    busy.value = false
  }
}
```

`VForm.reset()` clears input models (typically to `null`); it does not restore the accepted server baseline. Assign that baseline yourself and call `resetValidation()` when that is the intended operation. `resetValidation()` retains values. `validate-on="blur lazy"` skips initial validation and validates on blur; **lazy does not mean “only after the first submit.”** Rule functions should return `true` or a message, or a promise of either; reject/catch infrastructure failures deliberately. Plain functions need no rules plugin. If adopting Vuetify's builders, **4.3.0 exports `useRules`/`createRulesPlugin` from `vuetify`, not the old labs path**; see [Vuetify components](vuetify-components.md).

Vuetify **4.3.0 does not cancel or latest-gate overlapping rule promises**: each completed `validate()` assigns its errors, and later rules read the then-current model. For remote rules, serialize validation and hold a stable draft, or choose an external owner with a documented stale-result policy; debounce alone is insufficient. Catch expected request failures inside the rule and return an honest checking-failed message. An uncaught rejection bypasses the pinned runtime's normal pending-flag cleanup; catching only the submit handler reports the exception but does not repair that field's validation lifecycle. A handler guard blocks duplicate writes, not the validation `VForm` already starts before emitting another submit.

Ordinary `type`/`@click` on `VBtn` and native attributes on `VTextField` above are runtime fallthrough, not necessarily declared component props/emits. For consumers enabling `strictTemplates`, see [strict template checking and native fallthrough](vuetify-setup.md#strict-template-checking-and-native-fallthrough) for the Vue-native checked attribute-bag recipe; do not suppress template checks or augment Vuetify's component API.

## External validators with Vuetify

Use a native `<form novalidate>` when vee-validate or TanStack owns submission. Feed `modelValue`, update/blur events, `error-messages`, and pending state to Vuetify. Leave `rules` unset. Setting `error-messages` only renders errors; it does not submit, touch, or validate the external field. Normalize nullable clear values before passing them to a string field. Do not bind a native `<Field>`'s `field` object wholesale to a custom component if its value/event contract differs; use the component binding documented by the validator.

Keep a real submit button and handle the form's `submit` event so keyboard Enter and assistive technology share the same path. For programmatic DOM submission use `formElement.requestSubmit(submitButton)`; `formElement.submit()` bypasses both the submit event and native constraint validation. `novalidate` deliberately delegates constraints to the chosen owner; it does not remove labels, input types, or required semantics. If constructing `FormData`, disabled controls are omitted while readonly controls remain eligible; the examples instead map values from their form owner. [Native submission contract](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/requestSubmit), [disabled control semantics](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled).

## Failure and accessibility checklist

- Keep a visible label; use `autocomplete`, `inputmode`, and suitable types without treating browser hints as validation.
- Native controls need `aria-invalid` and `aria-describedby` linking visible errors/help. Check the actual rendered input when wrapping Vuetify, not just wrapper attributes.
- On invalid submit, expose an error summary and move focus to the summary or first invalid input. Announce submit success/failure once; avoid a live alert for every keystroke.
- Field errors map to an allowlisted path, not arbitrary server keys. Unknown keys and permission/conflict/transport errors belong in a form-level message. Never insert server error HTML.
- Distinguish checking (`pending`/`isValidating`) from saving (`isSubmitting`). A disabled button alone is not a duplicate-write guard; guard the handler too. Keep an explanation for a blocked submission.
- Availability checks are advisory and race with other users. The save endpoint remains authoritative. Debouncing reduces requests, not stale-result risk; cancellation and latest-result handling belong to the chosen validation/request owner.
- Do not disable a pristine submit button solely by habit: untouched valid defaults may be intentionally submittable. State the UX requirement first.
- Preserve input on errors. Confirm destructive reset for a long draft; do not clear after a failed save. Use explicit `type="button"` for add/remove/reset controls inside a form.

## Verification boundary

Historical compiler/type scopes are recorded in the [verification record](../assets/verification.json); that record is not a fresh execution of the current examples. Exercise keyboard Enter, invalid submit/focus, duplicate submit, out-of-order async validation, save rejection, server field mapping, reset, background refetch while dirty, and record switching in the consuming app. See [testing](testing.md).

## Sources

- [Vue forms and component v-model](https://vuejs.org/guide/components/v-model.html).
- [Vuetify forms](https://vuetifyjs.com/en/components/forms/).
- [Vuetify 4.3.0 VForm](https://unpkg.com/vuetify@4.3.0/lib/components/VForm/VForm.js), [form](https://unpkg.com/vuetify@4.3.0/lib/composables/form.js), [input validation/reset](https://unpkg.com/vuetify@4.3.0/lib/composables/validation.js).
- [vee-validate form metadata/reset](https://vee-validate.logaretm.com/v4/api/use-form/).
- [TanStack 1.33.5 form state/reset source](https://unpkg.com/@tanstack/form-core@1.33.5/src/FormApi.ts).
- [WAI accessible validation](https://www.w3.org/WAI/tutorials/forms/validation/) and [error/success notifications](https://www.w3.org/WAI/tutorials/forms/notifications/).
- [OWASP validation and separate authorization boundaries](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).
