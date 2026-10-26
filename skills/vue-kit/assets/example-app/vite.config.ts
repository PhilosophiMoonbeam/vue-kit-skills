import vue from '@vitejs/plugin-vue'
import templateCompilerOptions from '@tresjs/core/template-compiler-options'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue({ ...templateCompilerOptions })],
})
