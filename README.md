# Volar

> ⚡ Fast Vue Language Support Extension

https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar

Volar is a Language Support plugin built specifically for Vue 3. It's based on [`@vue/reactivity`](https://www.npmjs.com/package/@vue/reactivity) to calculate everything on-demand, to implement native TypeScript language service level performance.

🛠️ This project is still in refactoring to make contributing easier.

[[Tips](https://github.com/johnsoncodehk/volar/issues/53)] [[Discord](https://discord.gg/5bnSSSSBbK)]

## Sponsors

Create a tool that can help many people it feels amazing! But maintain this project requires lot of time and energy, if you want to support the sustainability of this project, please consider becoming a sponsor, thank you. 🙏

This company is [sponsoring this project](https://github.com/sponsors/johnsoncodehk) to improve your DX. 💪

<table>
  <tr>
    <td>
      <a href="https://github.com/Leniolabs">
        <img itemprop="image" src="https://github.com/Leniolabs.png" width="100" height="100">
      </a>
    </td>
    <td>
      <h3>Leniolabs_</h3>
      <p>Scale your Front-end development with our unique approach</p>
      <p>
        <a href="https://www.leniolabs.com/">https://www.leniolabs.com/</a>
        ・<a href="https://twitter.com/Leniolabs_">@Leniolabs_</a>
        ・<a href="mailto:info@leniolabs.com">info@leniolabs.com</a>
      </p>
    </td>
  </tr>
</table>

## Quick Start

- [create-vite](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-vue-ts)
- [Vitesse](https://github.com/antfu/vitesse)
- [volar-starter](https://github.com/johnsoncodehk/volar-starter) (For bug report and experiment features testing)

## Community's Language Client Implements

- coc.nvim: https://github.com/yaegassy/coc-volar ⚡
- nvim: https://github.com/neovim/nvim-lspconfig
- vim-lsp: https://github.com/mattn/vim-lsp-settings
- Sublime: https://github.com/sublimelsp/LSP-volar

⚡ - This implement supported multiple server ([Affect](https://github.com/johnsoncodehk/volar/discussions/441#discussioncomment-1263173))

## By-product

- [@volar/server](https://www.npmjs.com/package/@volar/server): Bridging module for LSP <-> vscode-vue-languageservice.
- [vue-tsc](https://github.com/johnsoncodehk/vue-tsc): Type-Checking on command line
- [typescript-vue-plugin](https://www.npmjs.com/package/typescript-vue-plugin): See [#169](https://github.com/johnsoncodehk/volar/issues/169#issuecomment-832377254).
- [vscode-vue-languageservice](https://www.npmjs.com/package/vscode-vue-languageservice) : Generic language server module for Vue
- [vscode-pug-languageservice](https://www.npmjs.com/package/vscode-pug-languageservice): Generic language server module for Pug
- [vscode-typescript-languageservice](https://www.npmjs.com/package/vscode-typescript-languageservice): Generic language server module for TypeScript

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
    "experimentalCompatMode": 2
  },
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

// declare module '@vue/runtime-core' works for vue 3
// declare module 'vue' works for vue2 + vue 3
declare module 'vue' {
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

> Please check https://vuejs.org/v2/guide/typescript.html#Recommended-Configuration for recommended tsconfig options.

> Volar does not include ESLint and Prettier, but the official [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions support Vue, so you could install these yourself if needed.

> If using Vetur's [Customizable Scaffold Snippets](https://vuejs.github.io/vetur/guide/snippet.html#customizable-scaffold-snippets), recommend use [Snippet Generator](https://marketplace.visualstudio.com/items?itemName=wenfangdu.snippet-generator) convert to VSCode Snippets.
