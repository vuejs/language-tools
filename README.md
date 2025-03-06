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

> For nvim-lspconfig versions below [v1.0.0](https://newreleases.io/project/github/neovim/nvim-lspconfig/release/v1.0.0) use tsserver instead of ts_ls, e.g. `lspconfig.ts_ls.setup`

```lua
-- If you are using mason.nvim, you can get the ts_plugin_path like this
-- local mason_registry = require('mason-registry')
-- local vue_language_server_path = mason_registry.get_package('vue-language-server'):get_install_path() .. '/node_modules/@vue/language-server'

local vue_language_server_path = '/path/to/@vue/language-server'

local lspconfig = require('lspconfig')

lspconfig.ts_ls.setup {
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

### Non-Hybrid mode(similar to takeover mode) configuration (Requires `@vue/language-server` version `^2.0.7`)

Note: If `hybridMode` is set to `false` `Volar` will run embedded `ts_ls` therefore there is no need to run it separately.

For more information see [#4119](https://github.com/vuejs/language-tools/pull/4119)

*Make sure you have typescript installed globally or pass the location to volar*

Use volar for all `.{vue,js,ts,tsx,jsx}` files.
```lua
local lspconfig = require('lspconfig')

-- lspconfig.ts_ls.setup {} 
lspconfig.volar.setup {
  filetypes = { 'typescript', 'javascript', 'javascriptreact', 'typescriptreact', 'vue' },
  init_options = {
    vue = {
      hybridMode = false,
    },
  },
}
```

Use `volar` for only `.vue` files and `ts_ls` for `.ts` and `.js` files.
```lua
local lspconfig = require('lspconfig')

lspconfig.ts_ls.setup {
  init_options = {
    plugins = {
      {
        name = '@vue/typescript-plugin',
        location = '/path/to/@vue/language-server',
        languages = { 'vue' },
      },
    },
  },
}

lspconfig.volar.setup {
  init_options = {
    vue = {
      hybridMode = false,
    },
  },
}
```

### nvim-cmp integration

Check out this [discussion](https://github.com/vuejs/language-tools/discussions/4495)

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

<!-- Editor link: https://www.mermaidchart.com/app/projects/c62d8944-0e06-47f0-a8de-f89a7378490f/diagrams/91fd02c0-5c91-4f72-a8b4-7af21b7c4d86/version/v0.1/edit -->

<a href="https://www.mermaidchart.com/raw/91fd02c0-5c91-4f72-a8b4-7af21b7c4d86?theme=light&version=v0.1&format=svg">
	<img src="https://www.mermaidchart.com/raw/91fd02c0-5c91-4f72-a8b4-7af21b7c4d86?theme=light&version=v0.1&format=svg"/>
</a>

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

---

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle" colspan="6">
        <b>Special Sponsor</b>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle" colspan="6">
        <br>
        <a href="https://voidzero.dev/">
          <img src="https://raw.githubusercontent.com/johnsoncodehk/sponsors/master/logos/VoidZero.svg" height="60" />
        </a>
        <h3>Next Generation Tooling</h3>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle" colspan="6">
        <b>Platinum Sponsors</b>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle" width="50%"  colspan="3">
        <a href="https://vuejs.org/">
          <img src="https://raw.githubusercontent.com/johnsoncodehk/sponsors/master/logos/Vue.svg" height="80" />
        </a>
        <p>An approachable, performant and versatile framework for building web user interfaces.</p>
      </td>
      <td align="center" valign="middle" width="50%" colspan="3">
        <a href="https://astro.build/">
          <!-- Expire: 2025-02-04 -->
          <img src="https://raw.githubusercontent.com/johnsoncodehk/sponsors/master/logos/Astro.svg" width="200" />
        </a>
        <p>Astro powers the world's fastest websites, client-side web apps, dynamic API endpoints, and everything in-between.</p>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle" colspan="3">
        <!-- Expire: 2025-02-04 -->
        <a href="https://www.jetbrains.com/">
          <img src="https://raw.githubusercontent.com/johnsoncodehk/sponsors/master/logos/JetBrains.svg" width="80" />
        </a>
        <p>Essential tools for software developers and teams.</p>
      </td>
      <td align="center" valign="middle" colspan="3">
        <a href="https://stackblitz.com/">
          <img src="https://raw.githubusercontent.com/johnsoncodehk/sponsors/master/logos/StackBlitz.svg" width="240" />
        </a>
        <p>Stay in the flow with instant dev experiences.<br>No more hours stashing/pulling/installing locally</p>
        <p><b> — just click, and start coding.</b></p>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle" colspan="6">
        <b>Silver Sponsors</b>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle" width="33.3%" colspan="2">
        <a href="https://www.prefect.io/"><img src="https://raw.githubusercontent.com/johnsoncodehk/sponsors/master/logos/Prefect.svg" width="200" /></a>
      </td>
      <td align="center" valign="middle" width="33.3%" colspan="2">
        <a href="https://www.techjobasia.com/"><img src="https://raw.githubusercontent.com/johnsoncodehk/sponsors/master/logos/TechJobAsia.svg" width="200" /></a>
      </td>
      <td align="center" valign="middle" width="33.3%" colspan="2">
        <a href="https://haoqun.blog/"><img src="https://avatars.githubusercontent.com/u/3277634?v=4" height="80" /></a>
      </td>
    </tr>
  </tbody>
</table>

<p align="center">
	<a href="https://github.com/sponsors/johnsoncodehk">Become a sponsor</a>
</p>

<p align="center">
	<a href="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg">
		<img src="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.png"/>
	</a>
</p>
