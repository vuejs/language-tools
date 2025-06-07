# Vue Language Tools

<p>
  <a href="https://marketplace.visualstudio.com/items?itemName=Vue.volar"><img src="https://img.shields.io/visual-studio-marketplace/v/Vue.volar?labelColor=18181B&color=1584FC" alt="Version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Vue.volar"><img src="https://img.shields.io/visual-studio-marketplace/i/Vue.volar?labelColor=18181B&color=1584FC" alt="Downloads"></a>
  <a href="https://github.com/vuejs/language-tools/tree/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
  <a href="https://nightly.link/vuejs/language-tools/workflows/extension-build/master/extensions.zip"><img src="https://img.shields.io/badge/Nightly%20Build-18181B" alt="Nightly Build"></a>
</p>

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
  <summary>Configuring vue language server with neovim.</summary>

> [!IMPORTANT]
> V3 currently only work with `vtsls`, if you are using `ts_ls`, either switch to `vtsls` or create an issue on `ts_ls`.
> See: https://github.com/yioneko/vtsls/issues/249#issuecomment-2866277424 and https://github.com/yioneko/vtsls/blob/main/packages/service/patches/260-allow-any-tsserver-commands.patch

```lua
-- If you are using mason.nvim, you can get the ts_plugin_path like this
-- For Mason v1,
-- local mason_registry = require('mason-registry')
-- local vue_language_server_path = mason_registry.get_package('vue-language-server'):get_install_path() .. '/node_modules/@vue/language-server'
-- For Mason v2,
-- local vue_language_server_path = vim.fn.expand '$MASON/packages' .. '/vue-language-server' .. '/node_modules/@vue/language-server'
-- or even
-- local vue_language_server_path = vim.fn.stdpath('data') .. "/mason/packages/vue-language-server/node_modules/@vue/language-server"
local vue_language_server_path = '/path/to/@vue/language-server'
local vue_plugin = {
  name = '@vue/typescript-plugin',
  location = vue_language_server_path,
  languages = { 'vue' },
  configNamespace = 'typescript',
}
local vtsls_config = {
  init_options = {
    plugins = {
      vue_plugin,
    },
  },
  filetypes = { 'typescript', 'javascript', 'javascriptreact', 'typescriptreact', 'vue' },
}
local vue_ls_config = {
  -- If you are not using mason
  -- You have to make sure `init_options.typescript.tsdk` is set for the projects do not have typescript installed(aka, no typescript dependency in `package.json`).
  --- @see Mason https://github.com/mason-org/mason-lspconfig.nvim/blob/main/lua/mason-lspconfig/lsp/vue_ls.lua
  init_options = {
    typescript = {
      tsserverRequestCommand = {
        'typescript.tsserverRequest',
        'typescript.tsserverResponse',
      },
    },
  },
  on_init = function(client)
    client.handlers['typescript.tsserverRequest'] = function(_, result, context)
      local clients = vim.lsp.get_clients({ bufnr = context.bufnr, name = 'vtsls' })
      if #clients == 0 then
        vim.notify('Could not found `vtsls` lsp client, vue_lsp would not work with it.', vim.log.levels.ERROR)
        return
      end
      local ts_client = clients[1]

      local param = unpack(result)
      local command, payload, id = unpack(param)
      ts_client:exec_cmd({
        command = 'typescript.tsserverRequest',
        arguments = {
          command,
          payload,
        },
      }, { bufnr = context.bufnr }, function(_, r)
          local response_data = { { id, r.body } }
          ---@diagnostic disable-next-line: param-type-mismatch
          client:notify('typescript.tsserverResponse', response_data)
        end)
    end
  end,
}
-- nvim 0.11 or above
vim.lsp.config('vtsls', vtsls_config)
vim.lsp.config('vue_ls', vue_ls_config)
vim.lsp.enable({'vtsls', 'vue_ls'})

-- nvim below 0.11
local lspconfig = require('lspconfig')
lspconfig.vtsls.setup vtsls_config
lspconfig.vue_ls.setup vue_ls_config
```
### nvim-cmp integration

Check out this [discussion](https://github.com/vuejs/language-tools/discussions/4495)

_For vue 2 please check:https://github.com/vuejs/language-tools/tree/v2?tab=readme-ov-file#community-integration_

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
