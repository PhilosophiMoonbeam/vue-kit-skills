<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from 'vue'
import type { SubmitEventPromise } from 'vuetify'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard, VCardActions, VCardText } from 'vuetify/components/VCard'
import { VDialog } from 'vuetify/components/VDialog'
import { VForm } from 'vuetify/components/VForm'
import { VTextField } from 'vuetify/components/VTextField'
import { TASK_TITLE_MAX_LENGTH, useTasksStore } from './task-store'

const store = useTasksStore()
const title = shallowRef('')
const submitting = shallowRef(false)
const resetDialogOpen = shallowRef(false)
const feedback = shallowRef('')
const form = useTemplateRef<InstanceType<typeof VForm>>('form')
const titleField = useTemplateRef<InstanceType<typeof VTextField>>('titleField')
const cancelButton = useTemplateRef<InstanceType<typeof VBtn>>('cancelButton')
const completedCount = computed(() => store.tasks.reduce((count, task) => count + Number(task.done), 0))
const titleRules = [
  (value: string | null | undefined) => Boolean(value?.trim()) || 'Enter a task title.',
  (value: string | null | undefined) => (value?.length ?? 0) <= TASK_TITLE_MAX_LENGTH
    || `Use ${TASK_TITLE_MAX_LENGTH} characters or fewer.`,
]

async function addTask(event: SubmitEventPromise): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  feedback.value = ''
  try {
    // VForm has already called validate(); its submit event resolves to that result.
    const { valid } = await event
    if (!valid) return
    const taskTitle = title.value.trim()
    store.addTask(taskTitle)
    title.value = ''
    await nextTick()
    form.value?.resetValidation()
    feedback.value = `Added “${taskTitle}” for this session only.`
  } finally {
    submitting.value = false
    await nextTick()
    titleField.value?.focus()
  }
}

async function removeTask(id: number): Promise<void> {
  const index = store.tasks.findIndex((task) => task.id === id)
  const task = store.tasks[index]
  if (!task) return
  store.removeTask(id)
  feedback.value = `Removed “${task.title}” from this session.`
  const nextTask = store.tasks[Math.min(index, store.tasks.length - 1)]
  await nextTick()
  if (nextTask) document.getElementById(`task-${nextTask.id}`)?.focus()
  else titleField.value?.focus()
}

function focusCancel(): void {
  const button = cancelButton.value?.$el
  if (button instanceof HTMLElement) button.focus()
}

function confirmReset(): void {
  store.resetTasks()
  feedback.value = 'Restored the two example tasks for this session only.'
  resetDialogOpen.value = false
}
</script>

<template>
  <section aria-labelledby="tasks-heading">
    <header class="page-heading">
      <div>
        <p class="section-kicker">Your practice workspace</p>
        <h2 id="tasks-heading" class="page-title">Tasks</h2>
        <p class="page-description">A small list to try real state, validation, and keyboard controls.</p>
      </div>
      <p class="completion-summary">
        <strong>{{ completedCount }} / {{ store.tasks.length }}</strong>
        <span>tasks complete</span>
      </p>
    </header>

    <div class="workspace-grid">
      <div class="capture-column">
        <VCard class="capture-panel" variant="outlined" rounded="lg">
          <VCardText class="panel-body">
            <h3 class="panel-title">Add a little momentum</h3>
            <p class="panel-description">Write one clear next step.</p>
            <VForm ref="form" validate-on="input lazy" @submit.prevent="addTask">
              <VTextField
                id="task-title"
                ref="titleField"
                v-model="title"
                class="title-field"
                label="Task title"
                name="task-title"
                active
                v-bind="{ required: true, 'aria-invalid': titleField?.isValid === false || undefined } satisfies InputHTMLAttributes"
                autocomplete="off"
                variant="outlined"
                :readonly="submitting"
                :rules="titleRules"
                :counter="TASK_TITLE_MAX_LENGTH"
                :hint="`Required. Up to ${TASK_TITLE_MAX_LENGTH} characters; outer spaces are removed.`"
                persistent-hint
              />
              <VBtn
                class="add-button"
                v-bind="{ type: 'submit' } satisfies ButtonHTMLAttributes"
                color="primary"
                variant="flat"
                block
                :disabled="submitting"
              >
                Add task
              </VBtn>
            </VForm>
          </VCardText>
        </VCard>
        <aside class="session-note" aria-label="Example data limits">
          <h3 class="note-title">Only here, only for now.</h3>
          <p>Tasks live in memory in this tab. Navigating between pages keeps them; reloading restores the examples. Nothing is sent to a server or saved to storage.</p>
        </aside>
      </div>

      <section class="task-list-panel" aria-labelledby="list-heading">
        <header class="list-header">
          <h3 id="list-heading" class="panel-title">Your task list</h3>
          <span class="task-count">{{ store.tasks.length }} {{ store.tasks.length === 1 ? 'task' : 'tasks' }}</span>
        </header>

        <ul v-if="store.tasks.length" class="task-list">
          <li v-for="task in store.tasks" :key="task.id" class="task-row">
            <label class="task-label" :for="`task-${task.id}`">
              <input
                :id="`task-${task.id}`"
                class="task-checkbox"
                type="checkbox"
                :checked="task.done"
                :aria-describedby="`task-state-${task.id}`"
                @change="store.toggleTask(task.id)"
              >
              <span class="task-copy">
                <span class="task-title" :class="{ 'is-done': task.done }">{{ task.title }}</span>
                <span :id="`task-state-${task.id}`" class="task-state">{{ task.done ? 'Completed' : 'To do' }}</span>
              </span>
            </label>
            <VBtn
              class="remove-button"
              v-bind="{ type: 'button', onClick: () => removeTask(task.id), 'aria-label': `Remove task ${task.title}` } satisfies ButtonHTMLAttributes"
              variant="text"
            >
              Remove
            </VBtn>
          </li>
        </ul>
        <div v-else class="empty-state">
          <p class="empty-title">No tasks left.</p>
          <p>Add a task to begin again, or reset to restore the two examples.</p>
        </div>

        <div class="list-footer">
          <p class="list-help">Check a task to mark it complete.</p>
          <VDialog
            v-model="resetDialogOpen"
            max-width="440"
            :transition="false"
            v-bind="{ 'aria-labelledby': 'reset-dialog-title', 'aria-describedby': 'reset-dialog-description' } satisfies HTMLAttributes"
            @after-enter="focusCancel"
          >
            <template #activator="{ props: activatorProps }">
              <VBtn
                v-bind="{ ...activatorProps, type: 'button' } satisfies ButtonHTMLAttributes"
                class="reset-button"
                variant="outlined"
              >
                Reset tasks
              </VBtn>
            </template>
            <VCard class="reset-card" rounded="lg">
              <VCardText class="dialog-body">
                <h3 id="reset-dialog-title" class="dialog-title">Reset tasks?</h3>
                <p id="reset-dialog-description" class="dialog-description">
                  Replace this session’s task list with the two original examples. Added tasks and completion changes will be lost. Your title draft will stay in the form.
                </p>
              </VCardText>
              <VCardActions class="dialog-actions">
                <VBtn
                  ref="cancelButton"
                  class="dialog-button"
                  v-bind="{ type: 'button', onClick: () => { resetDialogOpen = false } } satisfies ButtonHTMLAttributes"
                  variant="text"
                >
                  Cancel
                </VBtn>
                <VBtn
                  v-bind="{ type: 'button', onClick: confirmReset } satisfies ButtonHTMLAttributes"
                  class="dialog-button"
                  color="primary"
                  variant="flat"
                >
                  Confirm reset
                </VBtn>
              </VCardActions>
            </VCard>
          </VDialog>
        </div>
      </section>
    </div>
    <p class="feedback" role="status" aria-live="polite" aria-atomic="true">{{ feedback }}</p>
  </section>
</template>

<style scoped>
.page-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
  margin-block-end: 2rem;
}

.section-kicker {
  margin: 0 0 0.75rem;
  color: rgb(var(--v-theme-primary));
  font-size: 0.75rem;
  font-weight: 650;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.page-title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 2.75rem);
  line-height: 1.1;
  letter-spacing: -0.045em;
  font-weight: 650;
}

.page-description {
  max-width: 46ch;
  margin: 0.75rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.65;
  opacity: 0.8;
}

.completion-summary {
  display: grid;
  flex-shrink: 0;
  gap: 0.125rem;
  margin: 0;
  text-align: end;
  font-size: 0.8125rem;
}

.completion-summary strong {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.04em;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.45fr);
  align-items: start;
  gap: 2rem;
}

.capture-column,
.task-list-panel {
  min-width: 0;
}

.capture-panel {
  border-color: rgba(var(--v-theme-on-surface), 0.18);
  background: rgb(var(--v-theme-surface));
  /* Keep foreground/background theme changes atomic. */
  transition: none;
}

.panel-body {
  padding: 1.5rem;
}

.panel-title {
  margin: 0;
  font-size: 1rem;
  line-height: 1.4;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.panel-description {
  margin: 0.4rem 0 1.75rem;
  font-size: 0.875rem;
  line-height: 1.6;
  opacity: 0.8;
}

.title-field {
  margin-block-end: 1.25rem;
}

/* Vuetify 4.3's default 0.38 opacity is insufficient for this input boundary. */
.title-field :deep(.v-field__outline) {
  --v-field-border-opacity: 1;
}

.add-button,
.remove-button,
.reset-button,
.dialog-button {
  letter-spacing: 0;
  text-transform: none;
}

.session-note {
  margin-block-start: 1.5rem;
  padding-inline: 0.25rem;
  font-size: 0.8125rem;
  line-height: 1.7;
}

.note-title {
  margin: 0 0 0.375rem;
  font-size: inherit;
  font-weight: 650;
}

.session-note p {
  margin: 0;
  opacity: 0.8;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.125rem 0 1rem;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.18);
}

.task-count {
  font-size: 0.8125rem;
  white-space: nowrap;
  opacity: 0.8;
}

.task-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-block: 1rem;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.task-label {
  display: flex;
  flex: 1;
  align-items: start;
  gap: 0.875rem;
  min-width: 0;
  min-height: 2.75rem;
  padding-block: 0.25rem;
  cursor: pointer;
}

.task-checkbox {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  margin-block-start: 0.125rem;
  accent-color: rgb(var(--v-theme-primary));
  cursor: pointer;
}

.task-checkbox:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 4px;
}

.task-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.task-title {
  font-size: 0.9375rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.task-title.is-done {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
  opacity: 0.7;
}

.task-state {
  font-size: 0.75rem;
  line-height: 1.4;
  opacity: 0.75;
}

.remove-button {
  flex-shrink: 0;
  min-height: 2.75rem;
}

.list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-block-start: 1.5rem;
}

.list-help {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.6;
  opacity: 0.8;
}

.empty-state {
  padding: 3rem 1rem;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  text-align: center;
  font-size: 0.875rem;
  line-height: 1.7;
}

.empty-state p {
  margin: 0;
}

.empty-state .empty-title {
  margin-block-end: 0.375rem;
  font-size: 1.125rem;
  font-weight: 600;
}

.feedback {
  min-height: 1.5rem;
  margin: 1.5rem 0 0;
  font-size: 0.875rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.dialog-body {
  padding: 1.5rem 1.5rem 0.75rem;
}

.dialog-title {
  margin: 0 0 0.75rem;
  font-size: 1.375rem;
  line-height: 1.3;
  font-weight: 650;
  letter-spacing: -0.025em;
}

.dialog-description {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.7;
}

.dialog-actions {
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem 1.5rem;
}

@media (max-width: 800px) {
  .workspace-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
  }

  .session-note {
    margin-block-start: 1rem;
  }
}

@media (max-width: 450px) {
  .page-heading {
    align-items: start;
  }

  .completion-summary {
    padding-block-start: 1.5rem;
  }

  .panel-body {
    padding: 1.25rem;
  }
}
</style>
