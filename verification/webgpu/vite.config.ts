import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { templateCompilerOptions } from '@tresjs/core'

const installedVersion = (name: string) => JSON.parse(
  readFileSync(new URL(`./node_modules/${name}/package.json`, import.meta.url), 'utf8'),
).version as string

export default defineConfig({
  plugins: [vue({ ...templateCompilerOptions })],
  define: {
    __LAB_CORE_VERSION__: JSON.stringify(installedVersion('@tresjs/core')),
    __LAB_THREE_VERSION__: JSON.stringify(installedVersion('three')),
  },
  build: {
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        case: fileURLToPath(new URL('./case.html', import.meta.url)),
      },
    },
  },
})
