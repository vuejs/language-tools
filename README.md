# Vue Language Tools

<p>
  <!-- https://github.com/badges/shields/pull/11792
  <a href="https://marketplace.visualstudio.com/items?itemName=Vue.volar"><img src="https://img.shields.io/visual-studio-marketplace/v/Vue.volar?labelColor=18181B&color=1584FC" alt="Version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Vue.volar"><img src="https://img.shields.io/visual-studio-marketplace/i/Vue.volar?labelColor=18181B&color=1584FC" alt="Downloads"></a>
  -->
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

> ⚡ Vue language toolset with native TypeScript performance based-on [Volar.js](https://volarjs.dev/)

💬 **#language-tools** on our [Discord Server](https://discord.gg/vue)

## Quick Start

### For VSCode Users

Install the [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension to get full Vue language support.

### Command-Line Type Checking

```bash
npm install typescript @vue/content-mapper --save-dev
```

```jsonc
// tsconfig.json
{
  "compilerOptions": { "noEmit": true },
  "contentMappers": [
    { "package": "@vue/content-mapper", "extensions": [".vue"] }
  ]
}
```

```json
{
  "scripts": {
    "type-check": "tsc --noEmit --runExternalCode"
  }
}
```

## Packages

### For End Users

| Package | Description |
| :--- | :--- |
| [Vue (Official)](./extensions/vscode) | Vue, Vitepress, petite-vue language support extension for VSCode |
| [@vue/content-mapper](./packages/content-mapper) | Type-check `.vue` files with native TypeScript |

### For Editor Integration

| Package | Description |
| :--- | :--- |
| [@vue/language-server](./packages/language-server) | The language server itself |
| [@vue/language-service](./packages/language-service) | Language service plugin collection |

### Core Module

| Package | Description |
| :--- | :--- |
| [@vue/language-core](./packages/language-core) | SFC parsing and virtual code generation |

### Helper Tools

| Package | Description |
| :--- | :--- |
| [vue-component-meta](./packages/component-meta) | Component props, events, slots types information extract tool |
| [vue-component-type-helpers](./packages/component-type-helpers) | Component type helper utilities |
| [@vue/language-plugin-pug](./packages/language-plugin-pug) | Pug template support |

## Community Integration

[yaegassy/coc-volar](https://github.com/yaegassy/coc-volar) \
*Vue language client for coc.nvim*

[neovim/nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) \
*Vue language server configuration for Neovim*, check documentation [here](https://github.com/vuejs/language-tools/wiki/Neovim) to set it up.

[mattn/vim-lsp-settings](https://github.com/mattn/vim-lsp-settings) \
*Vue language server auto configuration for vim-lsp*

[sublimelsp/LSP-volar](https://github.com/sublimelsp/LSP-volar) \
*Vue language client for Sublime*

[kabiaa/atom-ide-volar](https://github.com/kabiaa/atom-ide-volar) \
*Vue language client for Atom*

[emacs-lsp/lsp-mode](https://github.com/emacs-lsp/lsp-mode) ([jadestrong/lsp-volar](https://github.com/jadestrong/lsp-volar)) \
*Vue language client for Emacs*

[tommasongr/nova-vue](https://github.com/tommasongr/nova-vue) \
*Vue language client for Nova*

[xiaoxin-sky/lapce-vue](https://github.com/xiaoxin-sky/lapce-vue) \
*Vue language client for Lapce*

[Kingwl/monaco-volar](https://github.com/Kingwl/monaco-volar) \
*Vue language support for Monaco on Browser*

[WebStorm](https://www.jetbrains.com/webstorm/) \
*Built-in integration for `@vue/language-server`*

[Eclipse WildWebDeveloper](https://github.com/eclipse-wildwebdeveloper/wildwebdeveloper) \
*Vue language server configuration for Eclipse*

<!-- Editor link: https://www.mermaidchart.com/app/projects/c62d8944-0e06-47f0-a8de-f89a7378490f/diagrams/91fd02c0-5c91-4f72-a8b4-7af21b7c4d86/version/v0.1/edit -->
<a href="https://www.mermaidchart.com/raw/91fd02c0-5c91-4f72-a8b4-7af21b7c4d86?theme=light&version=v0.1&format=svg">
	<img src="https://www.mermaidchart.com/raw/91fd02c0-5c91-4f72-a8b4-7af21b7c4d86?theme=light&version=v0.1&format=svg"/>
</a>

## Configuration

Configure Vue compiler options inside the content mapper's `options`:

```jsonc
{
  "compilerOptions": { /* ... */ },
  "contentMappers": [
    {
      "package": "@vue/content-mapper",
      "extensions": [".vue"],
      "options": {
        "target": 3.5
      }
    }
  ]
}
```

For detailed options, please refer to the [@vue/language-core](./packages/language-core) documentation.

## Contribution Guide

If you want to work on the volar extension follow these commands to set up your local development environment.

🔎 Note that you will need pnpm - you can download it here: https://pnpm.io/installation.

```bash
git clone --recurse-submodules https://github.com/vuejs/language-tools.git
cd language-tools
pnpm install
npm run build
```

In an existing clone, run `git submodule update --init` to fetch the submodules.

The recommended way to develop the volar extension is to use the [Debug Tools](https://code.visualstudio.com/Docs/editor/debugging) provided by VSCode.

Alternatively, you can run one of the scripts defined in the [package.json](https://github.com/vuejs/language-tools/blob/master/package.json) file.

❗ You should always use the debug launch configs or package.json scripts defined in the root of the project.

Additional info for contributing to open source projects can be found here: https://docs.github.com/en/get-started/quickstart/contributing-to-projects

### Repository layout

A Vue file is read into the IR by `@vue/language-core`; `@vue/content-mapper` generates TypeScript from the IR for TS 7.1, `@vue/language-service` builds the embedded documents of the editor features, and `vue-component-meta` reads component types through the TS 7.1 API.

```
packages/
  language-core/lib/      Vue file -> IR
    formats/              file formats: .vue SFC, VitePress markdown, petite-vue HTML -> SFC blocks
    template/             template blocks: compiling, element queries, expression scopes
    script/               script blocks: script and script setup ranges, bindings
    style/                style blocks: CSS bindings and classes, scoped class references
    typescript/           loading the TypeScript API, cached parsing, node helpers
    options/              Vue compiler options, comment options, IR plugins
    ir/                   the IR pipeline and the reactive IR and analysis of a file
    mappings/             mapping features and source mappings
  content-mapper/         TS 7.1 Content Mapper (server.ts: the process, worker.ts: a worker thread)
    lib/protocol.ts       the protocol messages
    lib/server/           JSON-RPC over stdio, the worker threads and their pool
    lib/mapper/           projects, their Vue options and option diagnostics, the transform of a file
    lib/codegen/          IR -> TypeScript code, by script, template and style
    lib/result/           generated code -> transform result: mappings, span mappings, diagnostic directives
  language-service/lib/   Volar language service plugins (plugins/) and embedded documents (virtualCode/)
  language-server/lib/    the LSP server, the TS 7.1 project bridge and the checker queries behind its requests
  component-meta/         component props, events, slots and exposed types
  language-plugin-pug/    pug templates
  component-type-helpers/ component type helpers
extensions/vscode/        the VS Code extension
test-workspace/           fixtures shared by the tests
```

### Volar.js

[Volar.js](https://github.com/volarjs/volar.js) is checked out at `volar.js/` as a git submodule tracking its `v3` branch, and its packages are part of the pnpm workspace, so every `@volar/*` dependency resolves to the submodule instead of npm. `npm run build` compiles them first (`npm run build:volar`, with TypeScript 7.1 as Volar.js itself does); `npm run watch:volar` watches them.

To change Volar.js, commit inside the submodule, push to `v3`, then commit the new submodule pointer here:

```bash
cd volar.js
git switch v3 # the submodule is checked out at a detached commit
# edit, build and test, then:
git commit -am "..."
git push origin HEAD:refs/heads/v3
cd ..
git add volar.js
git commit -m "chore: bump volar.js"
```

To pick up commits that others pushed to `v3`, run `git submodule update --remote volar.js` and commit the pointer. Releases do not publish `@volar/*`: they are published from Volar.js, and the release workflow stops unless the submodule's versions are already on npm.

### Volar services

[volarjs/services](https://github.com/volarjs/services) is checked out at `services/` as a git submodule tracking its `master` branch. Only the `volar-service-*` packages that `@vue/language-service` uses are part of the pnpm workspace, and they resolve to the submodule instead of npm. `npm run build` compiles them first (`npm run build:services`, emitting with TypeScript 5.9, as the services still set `esModuleInterop: false`, which TypeScript 7 removed) and type-checks them with the repository's TypeScript through `tsconfig.services/`; `npm run watch:services` watches them.

Changing them works as for Volar.js, with `services` and `master` in place of `volar.js` and `v3`. Releases do not publish `volar-service-*` either, and the release workflow stops unless the submodule's versions are already on npm.

## ❤️ Sponsors

This project is made possible thanks to our generous sponsors:

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.png"/>
  </a>
</p>

## License

[MIT](./LICENSE) License
