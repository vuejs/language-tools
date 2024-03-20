# typescript plugin

This is a plug-in for `tsserver` or `typescript-language-server`. It must be installed in a file-system location accessible by the language server or in the `node_modules` directory of projects being edited.

The LSP client must be configured to explicitly enable this plug-in. This is done by passing `initializationOptions` with the appropriate [`plugins`] configuration to the language server:

[`plugins`]: https://github.com/typescript-language-server/typescript-language-server/blob/b224b878652438bcdd639137a6b1d1a6630129e4/docs/configuration.md?plain=1#L27-L31

```json
"initializationOptions":  {
    "plugins": [
        {
          "name": "@vue/typescript-plugin",
          "location": "/usr/local/lib/node_modules/@vue/language-server",
          "languages": ["vue"],
        },
    ],
  },
```

The `languages` field must specify file-types for which the plug-in will be enabled. If the plug-in package is installed in the local `node_modules`, the `location` field may contain any arbitrary string, but MUST be present.

## Client-specific configuration

- For neovim, see the [details on configuring `tsserver`][nvim].

[nvim]: https://github.com/neovim/nvim-lspconfig/blob/master/doc/server_configurations.md#vue-support
