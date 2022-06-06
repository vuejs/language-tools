# Volar

> ⚡ Explore high-performance tooling for Vue

- [Vue Language Features](https://github.com/johnsoncodehk/volar/tree/master/extensions/vscode-vue-language-features) \
*Vue language support extension for VSCode*
- [TypeScript Vue Plugin](https://github.com/johnsoncodehk/volar/tree/master/extensions/vscode-typescript-vue-plugin) \
*VSCode extension to support Vue in TS server*
- [vue-tsc](https://github.com/johnsoncodehk/volar/tree/master/packages/vue-tsc) \
*Type-check and dts build command line tool*
- [volar-plugins](https://github.com/johnsoncodehk/volar-plugins) \
*Common plugins to changes IDE behavior with Volar language server*

Discord: https://discord.gg/5bnSSSSBbK

## IDE Supports by Community

[yaegassy/coc-volar](https://github.com/yaegassy/coc-volar) ⚡ 🤝 🅿️ \
*Vue language client for coc.nvim*

[neovim/nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) ⚡ 🤝 \
*Vue language server configuration for Neovim* \
[[Multiple servers set up tutorial](https://github.com/johnsoncodehk/volar/discussions/606)]

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

\* ⚡ support [multiple servers](https://github.com/johnsoncodehk/volar/discussions/393#discussioncomment-1213736) \
\* 🤝 support [take over mode](https://github.com/johnsoncodehk/volar/discussions/471) \
\* 🅿️ support [extra preview features](https://twitter.com/johnsoncodehk/status/1507024137901916161)

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

	%% Language Clients
	COC_VUE[yaegassy/coc-volar]
	NEO_VUE[neovim/nvim-lspconfig]
	VIM_VUE[mattn/vim-lsp-settings]
	SUBLIME_VUE[sublimelsp/LSP-volar]
	ATOM_VUE[kabiaa/atom-ide-volar]
	EMACS_VUE[jadestrong/lsp-volar]
	NOVA_VUE[tommasongr/nova-vue]

	click COC_VUE "https://github.com/yaegassy/coc-volar"
	click NEO_VUE "https://github.com/neovim/nvim-lspconfig"
	click VIM_VUE "https://github.com/mattn/vim-lsp-settings"
	click SUBLIME_VUE "https://github.com/sublimelsp/LSP-volar"
	click ATOM_VUE "https://github.com/kabiaa/atom-ide-volar"
	click EMACS_VUE "https://github.com/jadestrong/lsp-volar"
	click NOVA_VUE "https://github.com/tommasongr/nova-vue"

	%% Volar - Extensions
	VSC_VUE[vscode-vue-language-features]
	VSC_TSVP[vscode-typescript-vue-plugin]

	click VSC_VUE "https://github.com/johnsoncodehk/volar/tree/master/extensions/vscode-vue-language-features"
	click VSC_TSVP "https://github.com/johnsoncodehk/volar/tree/master/extensions/vscode-typescript-vue-plugin"

	%% Volar - Packages
	VOLAR_VUE_SERVER["@volar/vue-language-server"]
	VOLAR_VUE_TS["@volar/vue-typescript"]
	VOLAR_VUE_CG["@volar/vue-code-gen"]
	VOLAR_VUE_SERVICE["@volar/vue-language-service"]
	VOLAR_PUG_SERVICE["@volar/pug-language-service"]
	VOLAR_TS_SERVICE["@volar/typescript-language-service"]
	VOLAR_PREVIEW["@volar/preview"]
	VUE_TSC[vue-tsc]
	TS_VUE_PLUGIN[typescript-vue-plugin]

	click VOLAR_VUE_SERVER "https://github.com/johnsoncodehk/volar/tree/master/packages/vue-language-server"
	click VOLAR_VUE_TS "https://github.com/johnsoncodehk/volar/tree/master/packages/vue-typescript"
	click VOLAR_VUE_CG "https://github.com/johnsoncodehk/volar/tree/master/packages/vue-code-gen"
	click VOLAR_VUE_SERVICE "https://github.com/johnsoncodehk/volar/tree/master/packages/vue-language-service"
	click VOLAR_PUG_SERVICE "https://github.com/johnsoncodehk/volar/tree/master/packages/pug-language-service"
	click VOLAR_TS_SERVICE "https://github.com/johnsoncodehk/volar/tree/master/packages/typescript-language-service"
	click VOLAR_PREVIEW "https://github.com/johnsoncodehk/volar/tree/master/packages/preview"
	click VUE_TSC "https://github.com/johnsoncodehk/volar/tree/master/packages/vue-tsc"
	click TS_VUE_PLUGIN "https://github.com/johnsoncodehk/volar/tree/master/packages/typescript-vue-plugin"

	%% Extrnal Packages
	HTML_SERVICE[vscode-html-languageservice]
	CSS_SERVICE[vscode-css-languageservice]
	JSON_SERVICE[vscode-json-languageservice]
	TS[typescript]
	VSC_TS[vscode.typescript-language-features]
	VUE_REPL["@vue/repl"]
	VITE_PLUGIN_CHECKER[fi3ework/vite-plugin-checker]
	COMPILE_VUE_SFC[leonzalion/compile-vue-sfc]

	click HTML_SERVICE "https://github.com/microsoft/vscode-html-languageservice"
	click CSS_SERVICE "https://github.com/microsoft/vscode-css-languageservice"
	click JSON_SERVICE "https://github.com/microsoft/vscode-json-languageservice"
	click TS "https://github.com/microsoft/TypeScript"
	click VSC_TS "https://github.com/microsoft/vscode/tree/main/extensions/typescript-language-features"
	click VUE_REPL "https://github.com/vuejs/repl"
	click VITE_PLUGIN_CHECKER "https://github.com/fi3ework/vite-plugin-checker"
	click COMPILE_VUE_SFC "https://github.com/leonzalion/compile-vue-sfc"

	subgraph VUE_CLIENTS[Language Clients]
	  direction LR
	  VUE_CLIENT_API[Language Features]
	  VUE_CLIENT_DOC[Second Language Features]
	  VUE_CLIENT_HTML[Document Features]
	end

	click VUE_CLIENT_API "https://github.com/johnsoncodehk/volar/discussions/393#discussioncomment-1213736"
	click VUE_CLIENT_DOC "https://github.com/johnsoncodehk/volar/discussions/393#discussioncomment-1213736"
	click VUE_CLIENT_HTML "https://github.com/johnsoncodehk/volar/discussions/393#discussioncomment-1213736"

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

	VSC_VUE --> VUE_CLIENTS
	COC_VUE --> VUE_CLIENTS
	NEO_VUE --> VUE_CLIENTS
	SUBLIME_VUE --> VUE_CLIENTS
	ATOM_VUE --> VUE_CLIENTS
	EMACS_VUE --> VUE_CLIENTS
	NOVA_VUE --> VUE_CLIENTS
	VIM_VUE --> VUE_CLIENTS

	VSC_VUE --> VOLAR_PREVIEW
	COC_VUE --> VOLAR_PREVIEW

	VUE_CLIENTS -- Language Server Protocol --> VOLAR_VUE_SERVER

	VSC --> VSC_TS
	VSC_TS --> VSC_TSVP
	VSC_TSVP --> TS_VUE_PLUGIN
	VOLAR_VUE_SERVER --> VOLAR_VUE_SERVICE
	VUE_REPL --> VOLAR_VUE_SERVICE
	VUE_TSC --> VOLAR_VUE_TS
	VITE_PLUGIN_CHECKER --> VUE_TSC
	COMPILE_VUE_SFC --> VUE_TSC
	TS_VUE_PLUGIN --> VOLAR_VUE_TS

	VOLAR_VUE_SERVICE --> VOLAR_VUE_TS
	VOLAR_VUE_SERVICE --> VOLAR_TS_SERVICE
	VOLAR_VUE_SERVICE --> VOLAR_PUG_SERVICE
	VOLAR_VUE_SERVICE --> HTML_SERVICE
	VOLAR_VUE_SERVICE --> CSS_SERVICE
	VOLAR_VUE_SERVICE --> JSON_SERVICE

	VOLAR_VUE_TS --> TS
	VOLAR_VUE_TS --> VOLAR_VUE_CG
```

## Sponsors

<p align="center">
	<a href="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/company/sponsors.svg">
		<img src="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/company/sponsors.svg"/>
	</a>
</p>

---

<p align="center">
	<a href="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg">
		<img src="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg"/>
	</a>
</p>
