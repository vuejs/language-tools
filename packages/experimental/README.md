# @volar/experimental

## Experimental Code Finder and Component Preview Features

Currently only support for Vue 3 + Vite.

Example: https://github.com/johnsoncodehk/volar-starter

1. Install [@volar/experimental](https://www.npmjs.com/package/@volar/experimental).
2. Use Vue plugin.
    ```ts
    // main.ts
    import { createApp } from 'vue';
    import * as volar from '@volar/experimental/client';

    const app = createApp(App);
    app.use(volar.vuePlugin);
    // ...
    ```
3. Use Vite plugin options.
    ```ts
    // vite.config.ts
    import { defineConfig } from 'vite';
    import vue from '@vitejs/plugin-vue';
    import * as volar from '@volar/experimental/compiler';

    export default defineConfig({
        // ...
        plugins: [vue(volar.getVuePluginOptionsForVite())]
    });
    ```
4. Open a Vue file in VSCode from a Vite project.
5. Run `Volar (Experimental): Open Code Finder` / `Volar (Experimental): Open Component Preview` command.
