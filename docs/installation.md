# Installation

:::warning
Dont forget to deactivate [Vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur) else Volar will not work properly!
:::

## Vue 3 

The easiest way to install Volar is to install the extension within in your VSCode Editor.
https://marketplace.visualstudio.com/items?itemName=Vue.volar

## CSS highlighting

Recommended css languages are `css / less /scss`. If you are using `postcss / stylus / sass` you need to install additional extensions for syntax highlighting.

- postcss: [language-postcss](https://marketplace.visualstudio.com/items?itemName=cpylua.language-postcss).
- stylus: [language-stylus](https://marketplace.visualstudio.com/items?itemName=sysoev.language-stylus)
- sass: [Sass](https://marketplace.visualstudio.com/items?itemName=Syler.sass-indented)

## ESLint / Prettier support

Volar does not include ESLint and Prettier, but the official [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions support Vue, so you could install these yourself if needed.

## Vue 2

### Install `@vue/runtime-dom`

:::warning Optional
If your Vue version is >=2.7 `@vue/runtime-dom` is already included
:::

```sh
  $ npm install -D @vue/runtime-dom
```
```sh
  $ yarn add -D @vue/runtime-dom
```
```sh
  $ pnpm install -D @vue/runtime-dom
```

### Remove `Vue.extend` from your components

Template type-checking is not supported with `Vue.extend`. You can use [composition-api](https://github.com/vuejs/composition-api), [vue-class-component](https://github.com/vuejs/vue-class-component), or `export default { ... }` instead of `export default Vue.extend`.

Here is a compatibility table for different ways of writing the script blocks:

|                                          | Component options type-checking in `<script>` | Interpolation type-checking in `<template>` | Cross-component props type-checking |
|:-----------------------------------------|:----------------------------------------------|:--------------------------------------------|:------------------------------------|
| `export default { ... }` with JS         | Not supported                                 | Not supported                               | Not supported                       |
| `export default { ... }` with TS         | Not supported                                 | Supported but deprecated                    | Supported but deprecated            |
| `export default Vue.extend({ ... })` with JS | Not supported                             | Not supported                               | Not supported                       |
| `export default Vue.extend({ ... })` with TS | Limited (supports `data` types but not `props` types) | Limited                         | Not supported                       |
| `export default defineComponent({ ... })` | Supported                                    | Supported                                   | Supported                           |
| Class component                          | Supported                                     | Supported with additional code ([#21](https://github.com/johnsoncodehk/volar/issues/21)) |  Supported with [additional code](https://github.com/johnsoncodehk/volar/pull/750#issuecomment-1023947885)     |

:::info
Note that you can use `defineComponent` even for components that are using the `Options API`.
:::

### Edit `tsconfig.json`

In order to support Vue 2 tempates you need to edit your `tsconfig.json` file

```jsonc{6}
{
  "compilerOptions": {
    // ...
  },
  "vueCompilerOptions": {
    "target": 2, // For Vue version <= 2.6.14
  }
}
```
:::warning
If you are using Vue 2.7 set target to `"target": 2.7`
:::

### Remove `.d.ts` files

Projects created by the [Vue CLI](https://cli.vuejs.org/) will have files `.d.ts` files like:
- shims-tsx.d.ts 
- shims-vue.d.ts

Remove these files as they are no longer needed.

## Editor support

Support for other editors is available under following links:

- [CoC Neovim](https://github.com/yaegassy/coc-volar)
- [Neovim LSP](https://github.com/neovim/nvim-lspconfig)
- [Vim LSP](https://github.com/mattn/vim-lsp-settings)
- [Sublime](https://github.com/sublimelsp/LSP-volar)
- [Atom](https://github.com/kabiaa/atom-ide-volar)
- [Emacs](https://github.com/emacs-lsp/lsp-mode)
- [Nova](https://github.com/tommasongr/nova-vue)
- [Monaco](https://github.com/Kingwl/monaco-volar)

## Next Steps

#### Having problems?

Check out the [Troubleshooting](troubleshooting.md) page

#### Additional features?

Check out additional Volar [Features](features.md)
 