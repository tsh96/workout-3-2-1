import vue from '@vitejs/plugin-vue'
import { defineConfig, type PluginOption } from 'vite'

declare const process: {
  env: Record<string, string | undefined>
}

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isUserOrOrgPage = repository.endsWith('.github.io')
const base = process.env.GITHUB_ACTIONS && repository && !isUserOrOrgPage ? `/${repository}/` : '/'

export default defineConfig({
  base,
  plugins: [vue() as unknown as PluginOption],
})
