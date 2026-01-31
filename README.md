# Vue Language Tools

<p>
  <a href="https://marketplace.visualstudio.com/items?itemName=Vue.volar"><img src="https://img.shields.io/visual-studio-marketplace/v/Vue.volar?labelColor=18181B&color=1584FC" alt="Version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Vue.volar"><img src="https://img.shields.io/visual-studio-marketplace/i/Vue.volar?labelColor=18181B&color=1584FC" alt="Downloads"></a>
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

> ⚡ Vue language toolset with native TypeScript performance based-on [Volar.js](https://volarjs.dev/)

💬 **#language-tools** on our [Discord Server](https://discord.gg/vue)

## Quick Start

### For VSCode Users

Install the [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension to get full Vue language support.

### Command-Line Type Checking

```bash
npm install vue-tsc typescript --save-dev
```

```json
{
  "scripts": {
    "type-check": "vue-tsc --noEmit"
  }
}
```

## Packages

### For End Users

| Package | Description |
| :--- | :--- |
| [Vue (Official)](./extensions/vscode) | Vue, Vitepress, petite-vue language support extension for VSCode |
| [vue-tsc](./packages/tsc) | Type-check and dts build command line tool |

### For Editor Integration

| Package | Description |
| :--- | :--- |
| [@vue/language-server](./packages/language-server) | The language server itself |
| [@vue/language-service](./packages/language-service) | Language service plugin collection |
| [@vue/typescript-plugin](./packages/typescript-plugin) | TypeScript language service plugin |

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

## `vueCompilerOptions`

Configure Vue compiler options in `tsconfig.json`:

```jsonc
{
  "compilerOptions": { /* ... */ },
  "vueCompilerOptions": {
    "target": 3.5,
    "strictTemplates": true
  }
}
```

For detailed options, please refer to the [@vue/language-core](./packages/language-core) documentation.

## Contribution Guide

If you want to work on the volar extension follow these commands to set up your local development environment.

🔎 Note that you will need pnpm - you can download it here: https://pnpm.io/installation.

```bash
git clone https://github.com/vuejs/language-tools.git
cd language-tools
pnpm install
npm run build
```

The recommended way to develop the volar extension is to use the [Debug Tools](https://code.visualstudio.com/Docs/editor/debugging) provided by VSCode.

Alternatively, you can run one of the scripts defined in the [package.json](https://github.com/vuejs/language-tools/blob/master/package.json) file.

❗ You should always use the debug launch configs or package.json scripts defined in the root of the project.

Additional info for contributing to open source projects can be found here: https://docs.github.com/en/get-started/quickstart/contributing-to-projects

To develop with upstream Volar.js modules, you can setup a workspace with https://github.com/volarjs/workspace.

## ❤️ Sponsors

This project is made possible thanks to our generous sponsors:

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.png"/>
  </a>
</p>

## License

[MIT](./LICENSE) License
