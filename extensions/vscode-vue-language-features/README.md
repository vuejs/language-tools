# Vue Language Features

> ⚡ Fast Vue Language Support Extension

https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar

VueLF is a Language Support plugin built specifically for Vue 3. It's based on [`@vue/reactivity`](https://www.npmjs.com/package/@vue/reactivity) to calculate everything on-demand, to implement native TypeScript language service level performance.

[[Tips](https://github.com/johnsoncodehk/volar/issues/53)]

## Sponsors

This company is [sponsoring this project](https://github.com/sponsors/johnsoncodehk) to improve your DX. 💪

<a href="https://github.com/Leniolabs">
  <img itemprop="image" src="https://github.com/Leniolabs.png" width="100" height="100">
</a>

## Quick Start

- [create-vite](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-vue-ts)
- [Vitesse](https://github.com/antfu/vitesse)
- [vue3-eslint-stylelint-demo](https://github.com/sethidden/vue3-eslint-stylelint-demo) (Volar + ESLint + stylelint + husky)
- [volar-starter](https://github.com/johnsoncodehk/volar-starter) (For bug report and experiment features testing)

## Using

<details>
<summary>Setup for Vue 2</summary>

1. Add `@vue/runtime-dom`

This extension required Vue 3 types from the `@vue/runtime-dom`.

Vue 3 in itself includes the package `@vue/runtime-dom`. For Vue 2 you will have to install this package yourself:

```jsonc
// package.json
{
  "devDependencies": {
    "@vue/runtime-dom": "latest"
  }
}
```

2. Remove `Vue.extend`

Template type-checking do not support with `Vue.extend`, you can use [composition-api](https://github.com/vuejs/composition-api), [vue-class-component](https://github.com/vuejs/vue-class-component), or `export default { ... }` instead of `export default Vue.extend`.

3. Support Vue 2 template

Volar preferentially supports Vue 3. Vue 3 and Vue 2 template has some different. You need to set the `experimentalCompatMode` option to support Vue 2 template.

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    ...
  },
  "vueCompilerOptions": {
    "experimentalCompatMode": 2,
    "experimentalTemplateCompilerOptions": {
      "compatConfig": { "MODE": 2 } // optional
    }
  }
}
```

</details>

<details>
<summary>Define Global Components</summary>

PR: https://github.com/vuejs/vue-next/pull/3399

Local components, Built-in components, native HTML elements Type-Checking is available with no configuration.

For Global components, you need to define `GlobalComponents` interface, for example:

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

</details>

## Note

> You need to disable Vetur to avoid conflicts.

> Recommended use css / less / scss as `<style>` language, because these base on [vscode-css-languageservice](https://github.com/microsoft/vscode-css-languageservice) to provide reliable language support.
>
> If use postcss / stylus / sass, you need to install additional extension for syntax highlighting. I tried these and it works, you can also choose others.
>
> - postcss: [language-postcss](https://marketplace.visualstudio.com/items?itemName=cpylua.language-postcss).
> - stylus: [language-stylus](https://marketplace.visualstudio.com/items?itemName=sysoev.language-stylus)
> - sass: [Sass](https://marketplace.visualstudio.com/items?itemName=Syler.sass-indented)

> If Auto-formatting of `<style>` in SFC doesn’t work, please check `.vscode/settings.json` is not set or set as :

```json
{
  "[vue]": {"editor.defaultFormatter": "johnsoncodehk.volar"}
}
```

> Please check https://vuejs.org/v2/guide/typescript.html#Recommended-Configuration for recommended tsconfig options.

> Volar does not include ESLint and Prettier, but the official [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions support Vue, so you could install these yourself if needed.

> If using Vetur's [Customizable Scaffold Snippets](https://vuejs.github.io/vetur/guide/snippet.html#customizable-scaffold-snippets), recommend use [Snippet Generator](https://marketplace.visualstudio.com/items?itemName=wenfangdu.snippet-generator) convert to VSCode Snippets.

> If your project included Storybook or `@types/react`, make sure you have config tsconfig `types` option to avoid template type-checking affect by react types.
> 
> It should like this:
> ```json
> // tsconfig.json
> {
>   "compilerOptions": {
>     ...
>     "types": ["vite/client", ...]
>   }
> }
> ```