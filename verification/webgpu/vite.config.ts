import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import templateCompilerOptions from '@tresjs/core/template-compiler-options'

const installedVersion = async (name: string) => {
  const metadata = await Bun.file(new URL(`./node_modules/${name}/package.json`, import.meta.url)).json() as { version: string }
  return metadata.version
}

export default defineConfig(async () => {
  const [coreVersion, threeVersion, threeTypesVersion] = await Promise.all([
    installedVersion('@tresjs/core'),
    installedVersion('three'),
    installedVersion('@types/three'),
  ])

  return {
    plugins: [vue(templateCompilerOptions)],
    define: {
      __LAB_CORE_VERSION__: JSON.stringify(coreVersion),
      __LAB_THREE_VERSION__: JSON.stringify(threeVersion),
      __LAB_THREE_TYPES_VERSION__: JSON.stringify(threeTypesVersion),
    },
    build: {
      rolldownOptions: {
        input: {
          index: fileURLToPath(new URL('./index.html', import.meta.url)),
          case: fileURLToPath(new URL('./case.html', import.meta.url)),
        },
      },
    },
  }
})
