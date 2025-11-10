import EaglePlugin from '../../../src/EaglePlugin'
import { EAGLE_PLUGIN_ID } from '../constants'

declare module 'obsidian' {
  interface App {
    plugins: {
      plugins: {
        [index: string]: Plugin
        [EAGLE_PLUGIN_ID]: EaglePlugin
      }
      setEnable(toggle: boolean): void
      enablePlugin(pluginId: string): void
    }
    commands: {
      executeCommandById: (id: string) => boolean
    }
  }
}
