<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <article class="about-page" aria-labelledby="about-heading">
    <p class="section-kicker">Small on purpose</p>
    <h2 id="about-heading" class="page-title">About this example</h2>
    <p class="about-introduction">
      Vue Kit Workbench is a runnable, local practice space for Vue 3.5,
      Vuetify 4.3, Pinia, and Vue Router. The task list is example data,
      not a connection to a task service.
    </p>

    <section class="about-section" aria-labelledby="working-heading">
      <h3 id="working-heading" class="section-title">What you can try</h3>
      <ul class="about-list">
        <li>Add a task with a required title of up to 80 characters. Leading and trailing spaces are removed after validation.</li>
        <li>Mark tasks complete, remove individual tasks, and reach a genuinely empty list.</li>
        <li>Cancel or confirm a reset to the two original tasks. Resetting keeps your unfinished title draft.</li>
        <li>Navigate between these pages without losing task-list changes, and switch between light and dark themes.</li>
        <li>Use the form, task controls, navigation, and reset dialog with a keyboard.</li>
      </ul>
    </section>

    <section class="about-section" aria-labelledby="limits-heading">
      <h3 id="limits-heading" class="section-title">What it does not do</h3>
      <p class="about-copy">
        State lives only in this app instance’s memory. Reloading or closing the tab
        discards changes; another tab has its own list. There is no database,
        browser-storage persistence, network request, sign-in, synchronization,
        or server-side validation. The theme choice is not saved either.
      </p>
      <p class="about-copy">
        The form reports a successful local state change, not a server save.
        A production application needs its own persistence and authorization
        contracts; this example does not simulate them.
      </p>
    </section>

    <div class="return-link">
      <RouterLink to="/">Back to Tasks</RouterLink>
      <span>Try a control. Inspect the state. Start again.</span>
    </div>
  </article>
</template>

<style scoped>
.about-page {
  max-width: 46rem;
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
  line-height: 1.15;
  font-weight: 650;
  letter-spacing: -0.045em;
}

.about-introduction {
  margin: 1rem 0 2.5rem;
  font-size: 1.125rem;
  line-height: 1.75;
  opacity: 0.85;
}

.about-section {
  margin-block-start: 2rem;
  padding-block-start: 1.5rem;
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.15);
}

.section-title {
  margin: 0 0 1rem;
  font-size: 1.125rem;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.about-list {
  display: grid;
  gap: 0.75rem;
  padding-inline-start: 1.25rem;
  font-size: 0.9375rem;
  line-height: 1.75;
}

.about-list li {
  padding-inline-start: 0.375rem;
}

.about-copy {
  margin: 0 0 1rem;
  font-size: 0.9375rem;
  line-height: 1.8;
}

.return-link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  margin-block-start: 2rem;
  font-size: 0.875rem;
  line-height: 1.6;
}

.return-link a {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
  text-underline-offset: 0.25rem;
}

.return-link a:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
}

.return-link span {
  opacity: 0.75;
}
</style>
