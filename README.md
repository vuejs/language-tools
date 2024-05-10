# Vue Language Tools

> ⚡ High-performance Vue language tooling based-on [Volar.js](https://volarjs.dev/)

💬 **#language-tools** on our [Discord Server](https://discord.gg/vue)  

## Packages

- [Vue Language Features](https://github.com/vuejs/language-tools/tree/master/extensions/vscode) \
*Vue, Vitepress, petite-vue language support extension for VSCode*
- [vue-tsc](https://github.com/vuejs/language-tools/tree/master/packages/tsc) \
*Type-check and dts build command line tool*
- [vue-component-meta](https://github.com/vuejs/language-tools/tree/master/packages/component-meta) \
*Component props, events, slots types information extract tool*
- [vite-plugin-vue-component-preview](https://github.com/johnsoncodehk/vite-plugin-vue-component-preview) \
*Vite plugin for support Vue component preview view with `Vue Language Features`*
- [`@vue/language-server`](/packages/language-server/) \
*The language server itself*.
- [`@vue/typescript-plugin`](/packages/typescript-plugin/) \
*Typescript plugin for the language server*.

## Community Integration

[yaegassy/coc-volar](https://github.com/yaegassy/coc-volar) ⚡ 🤝 🅿️ \
*Vue language client for coc.nvim*

[neovim/nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) ⚡ 🤝 \
*Vue language server configuration for Neovim*

<details>
  <summary>How to configure vue language server with neovim and lsp?</summary>

### Hybrid mode configuration (Requires `@vue/language-server` version `^2.0.0`)

Note: The "Take Over" mode has been discontinued. Instead, a new "Hybrid" mode has been introduced. In this mode, the Vue Language Server exclusively manages the CSS/HTML sections. As a result, you must run `@vue/language-server` in conjunction with a TypeScript server that employs `@vue/typescript-plugin`. Below is a streamlined configuration for Neovim's LSP, updated to accommodate the language server following the upgrade to version `2.0.0`.

```lua
-- If you are using mason.nvim, you can get the ts_plugin_path like this
-- local mason_registry = require('mason-registry')
-- local vue_language_server_path = mason_registry.get_package('vue-language-server'):get_install_path() .. '/node_modules/@vue/language-server'

local vue_language_server_path = '/path/to/@vue/language-server'

local lspconfig = require('lspconfig')

lspconfig.tsserver.setup {
  init_options = {
    plugins = {
      {
        name = '@vue/typescript-plugin',
        location = vue_language_server_path,
        languages = { 'vue' },
      },
    },
  },
  filetypes = { 'typescript', 'javascript', 'javascriptreact', 'typescriptreact', 'vue' },
}

-- No need to set `hybridMode` to `true` as it's the default value
lspconfig.volar.setup {}
```

### None-Hybrid mode(similar to takeover mode) configuration (Requires `@vue/language-server` version `^2.0.7`)

Note: If `hybridMode` is set to `false` `Volar` will run embedded `tsserver` therefore there is no need to run it separately.

For more information see [#4119](https://github.com/vuejs/language-tools/pull/4119)

*Make sure you have typescript installed globally or pass the location to volar*

Use volar for all `.{vue,js,ts,tsx,jsx}` files.
```lua
local lspconfig = require('lspconfig')

-- lspconfig.tsserver.setup {} 
lspconfig.volar.setup {
  filetypes = { 'typescript', 'javascript', 'javascriptreact', 'typescriptreact', 'vue' },
  init_options = {
    vue = {
      hybridMode = false,
    },
  },
}
```

Use `volar` for only `.vue` files and `tsserver` for `.ts` and `.js` files.
```lua
local lspconfig = require('lspconfig')

lspconfig.tsserver.setup {
  init_options = {
    plugins = {
      {
        name = '@vue/typescript-plugin',
        location = '/path/to/@vue/language-server',
        languages = { 'vue' },
      },
    },
  },

lspconfig.volar.setup {
  init_options = {
    vue = {
      hybridMode = false,
    },
  },
},
```

</details>

[mattn/vim-lsp-settings](https://github.com/mattn/vim-lsp-settings) ⚡ \
*Vue language server auto configuration for vim-lsp*

[sublimelsp/LSP-volar](https://github.com/sublimelsp/LSP-volar) 🤝 \
*Vue language client for Sublime*

[kabiaa/atom-ide-volar](https://github.com/kabiaa/atom-ide-volar) \
*Vue language client for Atom*

[emacs-lsp/lsp-mode](https://github.com/emacs-lsp/lsp-mode) ([jadestrong/lsp-volar](https://github.com/jadestrong/lsp-volar)) ⚡ 🤝 \
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

\* ⚡ support [multiple servers](https://github.com/vuejs/language-tools/discussions/393#discussioncomment-1213736) \
\* 🤝 support [take over mode](https://github.com/vuejs/language-tools/discussions/471) \
\* 🅿️ support [extra preview features](https://twitter.com/johnsoncodehk/status/1507024137901916161)

## Contribution Guide

If you want to work on the volar extension follow these commands to set up your local development environment.

🔎 Note that you will need pnpm - you can download it here: https://pnpm.io/installation.

```bash
git clone https://github.com/vuejs/language-tools.git
cd language-tools
pnpm install
pnpm run build
```

The recommended way to develop the volar extension is to use the [Debug Tools](https://code.visualstudio.com/Docs/editor/debugging) provided by VSCode.
Alternatively, you can run one of the scripts defined in the [package.json](https://github.com/vuejs/language-tools/blob/master/package.json) file.

❗ You should always use the debug launch configs or package.json scripts defined in the root of the project.

Additional info for contributing to open source projects can be found here: https://docs.github.com/en/get-started/quickstart/contributing-to-projects

To develop with upstream Volar.js modules, you can setup workspace with https://github.com/volarjs/workspace.

## High Level System Overview

```mermaid
flowchart LR
	%% IDEs
	VSC[VSCode]
	COC[coc.nvim]
	NEO[Neovim]
	VIM[vim-lsp]
	SUBLIME[Sublime]
	ATOM[Atom]
	EMACS[Emacs]
	NOVA[Nova]
	LAPCE[Lapce]

	%% Language Clients
	COC_VUE[yaegassy/coc-volar]
	NEO_VUE[neovim/nvim-lspconfig]
	VIM_VUE[mattn/vim-lsp-settings]
	SUBLIME_VUE[sublimelsp/LSP-volar]
	ATOM_VUE[kabiaa/atom-ide-volar]
	EMACS_VUE[jadestrong/lsp-volar]
	NOVA_VUE[tommasongr/nova-vue]
	LAPCE_VUE[xiaoxin-sky/lapce-vue]

	click COC_VUE "https://github.com/yaegassy/coc-volar"
	click NEO_VUE "https://github.com/neovim/nvim-lspconfig"
	click VIM_VUE "https://github.com/mattn/vim-lsp-settings"
	click SUBLIME_VUE "https://github.com/sublimelsp/LSP-volar"
	click ATOM_VUE "https://github.com/kabiaa/atom-ide-volar"
	click EMACS_VUE "https://github.com/jadestrong/lsp-volar"
	click NOVA_VUE "https://github.com/tommasongr/nova-vue"
	click LAPCE_VUE "https://github.com/xiaoxin-sky/lapce-vue"

	%% Volar - Extensions
	VSC_VUE[vscode-vue]
	VSC_TSVP[vscode-typescript-vue-plugin]

	click VSC_VUE "https://github.com/vuejs/language-tools/tree/master/extensions/vscode"
	click VSC_TSVP "https://github.com/vuejs/language-tools/tree/master/extensions/vscode-typescript-plugin"

	%% Volar - Packages
	VOLAR_VUE_SERVER["@vue/language-server"]
	VOLAR_VUE_TS["@vue/typescript"]
	VOLAR_VUE_CORE["@vue/language-core"]
	VOLAR_VUE_SERVICE["@vue/language-service"]
	VOLAR_PUG_SERVICE["@volar/pug-language-service"]
	VOLAR_TS_SERVICE["@volar/typescript-language-service"]
	VUE_TSC[vue-tsc]
	VUE_COMPONENT_META[vue-component-meta]
	TS_VUE_PLUGIN[typescript-vue-plugin]

	click VOLAR_VUE_SERVER "https://github.com/vuejs/language-tools/tree/master/packages/language-server"
	click VOLAR_VUE_TS "https://github.com/vuejs/language-tools/tree/master/packages/typescript"
	click VOLAR_VUE_CORE "https://github.com/vuejs/language-tools/tree/master/packages/language-core"
	click VOLAR_VUE_SERVICE "https://github.com/vuejs/language-tools/tree/master/packages/language-service"
	click VUE_TSC "https://github.com/vuejs/language-tools/tree/master/packages/tsc"
	click VUE_COMPONENT_META "https://github.com/vuejs/language-tools/tree/master/packages/component-meta"
	click TS_VUE_PLUGIN "https://github.com/vuejs/language-tools/tree/master/packages/typescript-plugin"
	click VOLAR_PUG_SERVICE "https://github.com/vuejs/language-tools/tree/master/packages/pug-language-service"
	click VOLAR_TS_SERVICE "https://github.com/vuejs/language-tools/tree/master/packages/typescript-language-service"

	%% External Packages
	HTML_SERVICE[vscode-html-languageservice]
	CSS_SERVICE[vscode-css-languageservice]
	JSON_SERVICE[vscode-json-languageservice]
	%% TS[typescript]
	VSC_TS[vscode.typescript-language-features]
	VUE_REPL["@vue/repl"]
	MONACO_VOLAR[Kingwl/monaco-volar]
	%% VITE_PLUGIN_CHECKER[fi3ework/vite-plugin-checker]
	%% COMPILE_VUE_SFC[leonzalion/compile-vue-sfc]

	click HTML_SERVICE "https://github.com/microsoft/vscode-html-languageservice"
	click CSS_SERVICE "https://github.com/microsoft/vscode-css-languageservice"
	click JSON_SERVICE "https://github.com/microsoft/vscode-json-languageservice"
	click TS "https://github.com/microsoft/TypeScript"
	click VSC_TS "https://github.com/microsoft/vscode/tree/main/packages/typescript-language-features"
	click VUE_REPL "https://github.com/vuejs/repl"
	click MONACO_VOLAR "https://github.com/Kingwl/monaco-volar"
	%% click VITE_PLUGIN_CHECKER "https://github.com/fi3ework/vite-plugin-checker"
	%% click COMPILE_VUE_SFC "https://github.com/leonzalion/compile-vue-sfc"

	subgraph VUE_CLIENTS[Language Clients]
	  direction LR
	  VUE_CLIENT_SEMANTIC[Semantic Features]
	  VUE_CLIENT_SYNTACTIC[Syntactic Features]
	end

	click VUE_CLIENT_SEMANTIC "https://github.com/vuejs/language-tools/discussions/393#discussioncomment-1213736"
	click VUE_CLIENT_SYNTACTIC "https://github.com/vuejs/language-tools/discussions/393#discussioncomment-1213736"

	subgraph Embedded Language Services
	  direction LR
	  VOLAR_TS_SERVICE
	  VOLAR_PUG_SERVICE
	  HTML_SERVICE
	  CSS_SERVICE
	  JSON_SERVICE
	end

	VSC --> VSC_VUE
	COC --> COC_VUE
	NEO --> NEO_VUE
	SUBLIME --> SUBLIME_VUE
	ATOM --> ATOM_VUE
	EMACS --> EMACS_VUE
	NOVA --> NOVA_VUE
	VIM --> VIM_VUE
	LAPCE --> LAPCE_VUE

	VSC_VUE --> VUE_CLIENTS
	COC_VUE --> VUE_CLIENTS
	NEO_VUE --> VUE_CLIENTS
	SUBLIME_VUE --> VUE_CLIENTS
	ATOM_VUE --> VUE_CLIENTS
	EMACS_VUE --> VUE_CLIENTS
	NOVA_VUE --> VUE_CLIENTS
	VIM_VUE --> VUE_CLIENTS
	LAPCE_VUE --> VUE_CLIENTS

	VUE_CLIENTS -- Language Server Protocol --> VOLAR_VUE_SERVER

	VSC --> VSC_TS
	VSC_TS --> VSC_TSVP
	VSC_TSVP --> TS_VUE_PLUGIN
	VOLAR_VUE_SERVER --> VOLAR_VUE_SERVICE
	VUE_TSC --> VOLAR_VUE_TS
	%% VITE_PLUGIN_CHECKER --> VUE_TSC
	%% COMPILE_VUE_SFC --> VUE_TSC
	TS_VUE_PLUGIN --> VOLAR_VUE_TS

	VUE_REPL --> MONACO_VOLAR
	MONACO_VOLAR --> VOLAR_VUE_SERVICE

	%% VOLAR_VUE_TS --> TS
	VUE_COMPONENT_META --> VOLAR_VUE_CORE
	VOLAR_VUE_TS --> VOLAR_VUE_CORE

	VOLAR_VUE_SERVICE --> VOLAR_VUE_CORE
	VOLAR_VUE_SERVICE --> VOLAR_TS_SERVICE
	VOLAR_VUE_SERVICE --> VOLAR_PUG_SERVICE
	VOLAR_VUE_SERVICE --> HTML_SERVICE
	VOLAR_VUE_SERVICE --> CSS_SERVICE
	VOLAR_VUE_SERVICE --> JSON_SERVICE
```

---

<h3 align="center">Full-time Support by</h3>
<br />

<p align="center">
	<span>
		<a href="https://stackblitz.com/">
			<img src="https://raw.githubusercontent.com/johnsoncodehk/sponsors/master/logos/StackBlitz.svg" height="80" />
			<h4 align="center">Boot a fresh environment in milliseconds.</h4>
		</a>
	</span>
</p>
<br />

<p align="center">
	<a href="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg">
		<img src="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.png"/>
	</a>
</p>
