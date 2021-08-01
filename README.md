# Volar

> ⚡ Fast Vue Language Support Extension

https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar

Volar is a Language Support plugin built specifically for Vue 3. It's based on [`@vue/reactivity`](https://www.npmjs.com/package/@vue/reactivity) to calculate TypeScript on-demand to optimize performance similar to the native TypeScript language service.

🛠️ This project is still in refactoring to make contributing easier.

[[Tips](https://github.com/johnsoncodehk/volar/issues/53)] [[Discord](https://discord.gg/5bnSSSSBbK)]

## Sponsors

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

## Community's Language Client Implements

- coc.nvim: https://github.com/yaegassy/coc-volar

## By-product

- [@volar/server](https://www.npmjs.com/package/@volar/server): Bridging module for LSP <-> vscode-vue-languageservice.
- [vue-tsc](https://github.com/johnsoncodehk/vue-tsc): Type-Checking on command line
- [typescript-vue-plugin](https://www.npmjs.com/package/typescript-vue-plugin): See [#169](https://github.com/johnsoncodehk/volar/issues/169#issuecomment-832377254).
- [vscode-vue-languageservice](https://www.npmjs.com/package/vscode-vue-languageservice) : Generic language server module for Vue
- [vscode-pug-languageservice](https://www.npmjs.com/package/vscode-pug-languageservice): Generic language server module for Pug
- [vscode-typescript-languageservice](https://www.npmjs.com/package/vscode-typescript-languageservice): Generic language server module for TypeScript

## Using

<!-- Global components support -->
<details>
<summary>Global components support (Updated at 5/4/2021)</summary>

See: https://github.com/vuejs/vue-next/pull/3399

By default, Local components, Built-in components, native HTML elements Type-Checking are active.

For Global components, you need to have Vue 3 `GlobalComponents` interface definition, for example:

```typescript
// components.d.ts
declare module 'vue' {
  export interface GlobalComponents {
    RouterLink: typeof import('vue-router')['RouterLink']
    RouterView: typeof import('vue-router')['RouterView']
  }
}

export {}
```

</details>

<!-- v-slot support -->
<details>
<summary>v-slot support</summary>

v-slot Type-Checking will auto service all .vue files under the project, but for third party libraries, you need to define the slot types, for example:

```typescript
// components.d.ts
import { RouterLink, RouterView, useLink, RouteLocationNormalized } from 'vue-router'
import { UnwrapRef, VNode } from 'vue'

declare module 'vue' {
  export interface GlobalComponents {
    RouterLink: typeof RouterLink & {
      __VLS_slots: {
        default: UnwrapRef<ReturnType<typeof useLink>>
      }
    }
    RouterView: typeof RouterView & {
      __VLS_slots: {
        default: {
          Component: VNode
          route: RouteLocationNormalized & { href: string }
        }
      }
    }
  }
}

export {}
```

</details>

<!-- Work with Vue 2? -->
<details>
<summary>Work with Vue 2?</summary>

This tool required Vue 3 types from the `@vue/runtime-dom` module.

Vue 3 in itself includes the package `@vue/runtime-dom`. For Vue 2 you will have to install this package yourself:

```json
{
  "devDependencies": {
    "@vue/runtime-dom": "latest"
  }
}
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

> tsconfig.json / jsconfig.json is required.
>
> Also required `"strict": true` and `"moduleResolution": "node"`.

> `__VLS_slots` is planed to remove in future, see: [#40](https://github.com/johnsoncodehk/volar/discussions/40)

> Volar does not include ESLint and Prettier, but the official [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions support Vue, so you could install these yourself if needed.

> If using Vetur's [Customizable Scaffold Snippets](https://vuejs.github.io/vetur/guide/snippet.html#customizable-scaffold-snippets), recommend use [Snippet Generator](https://marketplace.visualstudio.com/items?itemName=wenfangdu.snippet-generator) convert to VSCode Snippets.
