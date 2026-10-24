# @vue/language-server

<p>
  <a href="https://www.npmjs.com/package/@vue/language-server"><img src="https://img.shields.io/npm/v/@vue/language-server.svg?labelColor=18181B&color=1584FC" alt="NPM version"></a>
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

A Vue language server based on the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/). This package provides an executable language server that can be integrated with any LSP-compatible editor.

## Installation

```bash
npm install @vue/language-server
```

## Command-Line Usage

After installation, the `vue-language-server` command is available:

```bash
# Start in stdio mode
vue-language-server --stdio

# Check version
vue-language-server --version

# Specify TypeScript SDK path
vue-language-server --stdio --tsdk=/path/to/typescript/lib
```

### `--tsdk` Parameter (required)

The server runs on the API of TypeScript 5 or 6, which TypeScript 7's `typescript` package does not provide. Point `--tsdk` at the `lib` directory of a `typescript` 5 or 6 package; without it, the server loads `typescript` from its own location and exits if that is TypeScript 7.

To keep TypeScript 5/6 beside the project's TypeScript 7, install it under an alias, e.g. `npm i -D typescript-6@npm:typescript@6`. That package also installs `tsc` and `tsserver` into `node_modules/.bin` and may replace TypeScript 7's `tsc` there, so run TypeScript 7 as `node node_modules/typescript/bin/tsc`, or install TypeScript 5/6 outside the project.

## Editor Integration

### VSCode

Simply install the [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension, which already includes this language server.

### Neovim

Configure the `vue_ls` config of [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig):

```lua
vim.lsp.config('vue_ls', {
  cmd = { 'vue-language-server', '--stdio', '--tsdk=/path/to/typescript-6/lib' },
})
vim.lsp.enable('vue_ls')
```

The client must also implement the [Client Requirements](#client-requirements).

### Sublime Text

See [sublimelsp/LSP-volar](https://github.com/sublimelsp/LSP-volar).

### Emacs

See [lsp-mode](https://github.com/emacs-lsp/lsp-mode) for Vue support.

## Programmatic Usage

If you need to start the language server within your own program:

```typescript
import { startServer } from '@vue/language-server/lib/server';
// TypeScript 5 or 6, see `--tsdk`
import * as ts from 'typescript';

// startServer creates an LSP connection and starts listening
// Requires communication with the client via stdio or other means
startServer(ts);
```

> **Note**: `startServer` creates a stdio-based LSP connection. The client must implement the requests described in [Client Requirements](#client-requirements).

## Client Requirements

Besides LSP, the client that starts this server must connect it to the editor's TypeScript 7 language server. VS Code does this in the Vue (Official) extension; other editors must:

1. Start the server with [`--tsdk`](#--tsdk-parameter-required).
2. Start the TypeScript 7 language server (`tsc --lsp --stdio`) with `initializationOptions: { runExternalCode: true }`, so that it loads the `contentMappers` of the project's tsconfig. `tsc --lsp` has no `--runExternalCode` flag.
3. Answer [`vue/typescriptApiConnection`](#vuetypescriptapiconnection-required).
4. Optionally, pass `initializationOptions: { contentMappers: [...] }` to this server, in the tsconfig `contentMappers` format (e.g. `[{ "package": "@vue/content-mapper", "extensions": [".vue"] }]`), for files outside any tsconfig.

### `vue/typescriptApiConnection` (required)

The server asks which project owns a file from the editor's TypeScript 7 language server (`tsc --lsp --stdio` of the `typescript@7` package), through its API pipe. It sends this request to the client on first use, and again whenever the previous pipe stops working (e.g. after the TypeScript server restarted):

- Request (server → client): `vue/typescriptApiConnection`, no params.
- The client forwards `custom/initializeAPISession` with params `{}` to the TypeScript 7 language server, which replies `{ pipe }`.
- Response: `{ pipe: string, packageJsonPath: string }`, where `packageJsonPath` is the `package.json` of the `typescript@7` package that language server runs from. The server loads the matching `typescript/async` API client from it.

There is no fallback: until the client answers, requests wait, and if it fails, the server shows the error and requests fail.

Neovim sketch, assuming the TypeScript 7 client is named `typescript` and runs from the project's `node_modules/typescript`:

```lua
vim.lsp.config('vue_ls', {
  handlers = {
    ['vue/typescriptApiConnection'] = function()
      local typescript = vim.lsp.get_clients({ name = 'typescript' })[1]
      if not typescript then
        return nil, vim.lsp.rpc.rpc_response_error(-32603, 'TypeScript 7 language server is not running')
      end
      local response = typescript:request_sync('custom/initializeAPISession', {}, 10000)
      if not response or response.err then
        return nil, response and response.err or vim.lsp.rpc.rpc_response_error(-32603, 'timeout')
      end
      return {
        pipe = response.result.pipe,
        packageJsonPath = vim.fs.joinpath(typescript.config.root_dir, 'node_modules/typescript/package.json'),
      }
    end,
  },
})
```

## Related Packages

- [`@vue/language-core`](https://github.com/vuejs/language-tools/tree/master/packages/language-core) - Core module
- [`@vue/language-service`](https://github.com/vuejs/language-tools/tree/master/packages/language-service) - Language service plugins
- [`@vue/content-mapper`](https://www.npmjs.com/package/@vue/content-mapper) - TypeScript 7 content mapper for Vue files

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
