<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import type { ButtonHTMLAttributes } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useTheme } from 'vuetify'
import { VApp } from 'vuetify/components/VApp'
import { VBtn } from 'vuetify/components/VBtn'
import { VContainer } from 'vuetify/components/VGrid'
import { VMain } from 'vuetify/components/VMain'

const theme = useTheme()
const route = useRoute()
const content = useTemplateRef<HTMLElement>('content')
const themeAction = computed(() => theme.current.value.dark ? 'Use light theme' : 'Use dark theme')

function changeTheme(): Promise<void> {
  // With transitions disabled, change() applies synchronously. Keep the trigger focusable.
  return theme.change(theme.current.value.dark ? 'light' : 'dark', false)
}

watch(() => route.path, async () => {
  const pageTitle = route.path === '/about'
    ? 'About this example'
    : route.path === '/graphics' ? 'Graphics' : 'Tasks'
  document.title = `${pageTitle} · Vue Kit Workbench`
  await nextTick()
  content.value?.focus({ preventScroll: true })
}, { immediate: true })
</script>

<template>
  <VApp class="workbench">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="app-header">
      <div class="header-inner">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">VK</span>
          <div>
            <p class="app-kicker">A local practice space</p>
            <h1 class="app-title">Vue Kit Workbench</h1>
          </div>
        </div>
        <VBtn
          class="theme-button"
          v-bind="{ type: 'button', onClick: changeTheme } satisfies ButtonHTMLAttributes"
          variant="outlined"
        >
          {{ themeAction }}
        </VBtn>
        <nav class="app-nav" aria-label="Main navigation">
          <RouterLink class="nav-link" to="/">Tasks</RouterLink>
          <RouterLink class="nav-link" to="/graphics">Graphics</RouterLink>
          <RouterLink class="nav-link" to="/about">About this example</RouterLink>
        </nav>
      </div>
    </header>

    <VMain>
      <VContainer class="content-container">
        <div id="main-content" ref="content" class="route-content" tabindex="-1">
          <RouterView />
        </div>
        <footer class="app-footer">
          <span>Vue 3.5 · Vuetify 4.3 · Pinia · Vue Router</span>
          <span>In memory. No account. No server.</span>
        </footer>
      </VContainer>
    </VMain>
  </VApp>
</template>

<style scoped>
.workbench {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

/* No task-essential transitions: keep theme foreground/background pairs atomic. */
.workbench,
.workbench :deep(*) {
  transition: none !important;
}

.skip-link {
  position: fixed;
  inset-block-start: 0.75rem;
  inset-inline-start: 1rem;
  z-index: 2500;
  padding: 0.75rem 1rem;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border: 2px solid currentColor;
  transform: translateY(-200%);
}

.skip-link:focus {
  transform: translateY(0);
}

.app-header {
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  background: rgb(var(--v-theme-surface));
}

.header-inner {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1.75rem 1.5rem;
  width: min(100%, 1120px);
  margin-inline: auto;
  padding: 2rem 2rem 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.brand-mark {
  display: grid;
  place-items: center;
  flex: 0 0 2.75rem;
  height: 2.75rem;
  border-radius: 0.75rem;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.875rem;
  font-weight: 750;
  letter-spacing: -0.04em;
}

.app-kicker {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  opacity: 0.75;
}

.app-title {
  margin: 0;
  font-size: clamp(1.125rem, 3vw, 1.5rem);
  line-height: 1.25;
  font-weight: 650;
  letter-spacing: -0.035em;
}

.theme-button {
  align-self: center;
  text-transform: none;
  letter-spacing: 0;
}

.app-nav {
  display: flex;
  grid-column: 1 / -1;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.nav-link {
  display: flex;
  align-items: center;
  min-height: 3rem;
  padding-block: 0.5rem;
  border-block-end: 3px solid transparent;
  color: inherit;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 550;
}

.nav-link.router-link-exact-active {
  border-block-end-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}

.nav-link:hover {
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

.nav-link:focus-visible,
.theme-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 4px;
}

.content-container {
  max-width: 1120px;
  padding: 3rem 2rem 1.5rem;
}

.route-content {
  outline: none;
}

.app-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  margin-block-start: 3.5rem;
  padding-block-start: 1.25rem;
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  font-size: 0.75rem;
  line-height: 1.6;
  opacity: 0.75;
}

@media (max-width: 600px) {
  .header-inner {
    gap: 1rem;
    padding: 1.25rem 1rem 0;
  }

  .brand {
    grid-column: 1 / -1;
    gap: 0.75rem;
  }

  .theme-button {
    justify-self: start;
  }

  .app-nav {
    gap: 1.25rem;
  }

  .content-container {
    padding: 2rem 1rem 1.25rem;
  }

  .app-footer {
    margin-block-start: 2.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workbench :deep(*),
  .workbench :deep(*::before),
  .workbench :deep(*::after) {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0s !important;
    scroll-behavior: auto !important;
  }
}
</style>
