# Volar features

[[toc]]

## Automatic path resolving

While you are adding a new component or calling an external function, Volar will try to find that specific asset and automatically it
import for you. You just have to hit `↩ Enter` to confirm the import.

## Global Components 

Local components, Built-in components, native HTML elements Type-Checking is available with no configuration.

For Type-Checking in global components, you need to define a `GlobalComponents` interface, for example:

```typescript
// components.d.ts
declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    RouterLink: typeof import('vue-router')['RouterLink']
    RouterView: typeof import('vue-router')['RouterView']
  }
}

export {}
```

## Component preview

### What is Component Preview

With this feature you can see your components live in your VSCode editor and the changes you make to them.  
It uses https://github.com/antfu/vite-plugin-md to render the markdown in your vue components directly in your VSCode editor. 

:::warning
This feature is currently only available if you are using Vite
:::

![Example Video](./assets/component-preview.gif)

### Setup

1. Install [vite-plugin-vue-component-preview](https://github.com/johnsoncodehk/vite-plugin-vue-component-preview)
  ```sh
    $ npm install -D vite-plugin-vue-component-preview
  ```
  ```sh
    $ yarn add -D vite-plugin-vue-component-preview
  ```
  ```sh
    $ pnpm install -D vite-plugin-vue-component-preview
  ```
2. Add the plugin to your **vite.config.ts**
  ```ts{3,7}
    import { defineConfig } from 'vite';
    import Vue from '@vitejs/plugin-vue';
    import Preview from 'vite-plugin-vue-component-preview';

    export default defineConfig({
      plugins: [
        Preview(),
        Vue(),
      ],
    })
  ```
3. Add new types to your **tsconfig.json**
  ```json
    {
      "compilerOptions": {
        "types": ["vite-plugin-vue-component-preview/client"]
      }
    }
  ```
4. Include the plugin in your vue app
  ```ts{3,6}
  import { createApp } from 'vue';
  import App from './App.vue';
  import Previewer from 'virtual:vue-component-preview';

  const app = createApp(App);
  app.use(Previewer);
  ```

### Usage

You can now write markdown inside `<preview lang="md"></preview>` tags in your component which will be rendered as preview.

### Example

```vue
<!-- Component part -->
<template>
	<h1>{{ msg }}</h1>
	<button @click="count++">count is: {{ count }}</button>
</template>

<script setup>
import { ref } from 'vue'

defineProps<{ msg: string }>()

const count = ref(0)
</script>

<!-- Preview part -->

<preview lang="md">
# This is preview page of HelloWorld.vue

## Props

| Props       | Description    |
| ----------- | -------------- |
| msg         | Title message  |

## Examples

<script setup>
const msgs = [
  'Hello Peter',
  'Hello John',
];
</script>

<template v-for="msg in msgs">
	<slot :msg="msg"></slot>
</template>

</preview>
```

## VSCode Commands

Below is a list of helpful commands you can run in your VSCode editor

### Verify All Scripts

`Volar: Verify All Scripts` will type check all `<script>` tags in your components and report any errors.

### Show doctor panel

`Volar: Show doctor panel` will display an info page with you current editor configuration. Useful for troubleshooting if Volar is not working properly.

