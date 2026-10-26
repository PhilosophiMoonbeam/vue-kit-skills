import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import { VApp } from 'vuetify/components/VApp'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard, VCardActions, VCardText } from 'vuetify/components/VCard'
import { VDialog } from 'vuetify/components/VDialog'
import { VForm } from 'vuetify/components/VForm'
import { VContainer } from 'vuetify/components/VGrid'
import { VMain } from 'vuetify/components/VMain'
import { VTextField } from 'vuetify/components/VTextField'
import 'vuetify/styles'
import AboutPage from './AboutPage.vue'
import App from './App.vue'
import TaskPage from './TaskPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'tasks', component: TaskPage },
    { path: '/about', name: 'about', component: AboutPage },
    { path: '/graphics', name: 'graphics', component: () => import('./GraphicsPage.vue') },
  ],
})

const vuetify = createVuetify({
  components: {
    VApp,
    VBtn,
    VCard,
    VCardActions,
    VCardText,
    VContainer,
    VDialog,
    VForm,
    VMain,
    VTextField,
  },
  defaults: { VBtn: { ripple: false } },
  theme: {
    defaultTheme: 'light',
    themes: {
      dark: {
        dark: true,
        colors: {
          'on-primary': '#000000',
          error: '#FFB4AB',
          'on-error': '#000000',
        },
      },
    },
  },
})

createApp(App)
  .use(createPinia())
  .use(router)
  .use(vuetify)
  .mount('#app')
