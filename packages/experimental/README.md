# @volar/experimental

## Experimental Preview Feature

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
    import * as volar from '../volar/packages/experimental/compiler';

    export default defineConfig({
        // ...
        plugins: [vue(volar.vitePluginOptions)]
    });
    ```
4. Start Vite DEV server.
5. Run `Volar (Experimental): Preview` command in VSCode.
