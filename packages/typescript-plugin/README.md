# @vue/typescript-plugin

<p>
  <a href="https://www.npmjs.com/package/@vue/typescript-plugin"><img src="https://img.shields.io/npm/v/@vue/typescript-plugin.svg?labelColor=18181B&color=1584FC" alt="NPM version"></a>
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

A TypeScript language service plugin that enables `tsserver` to understand `.vue` files. This plugin is used by `@vue/language-server` to collaborate with the TypeScript language service.

## Installation

```bash
npm install @vue/typescript-plugin --save-dev
```

## Configuration

### VSCode

Create `.vscode/settings.json` in your project root:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### tsconfig.json

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "name": "@vue/typescript-plugin" }
    ]
  }
}
```

## Provided Features

This plugin registers the following Vue-specific commands for `tsserver`:

| Command | Description |
| :--- | :--- |
| `_vue:projectInfo` | Get project information |
| `_vue:collectExtractProps` | Collect extractable props |
| `_vue:getImportPathForFile` | Get import path for a file |
| `_vue:getAutoImportSuggestions` | Get auto-import suggestions |
| `_vue:resolveAutoImportCompletionEntry` | Resolve auto-import completion entry |
| `_vue:isRefAtPosition` | Check if position is a ref |
| `_vue:getComponentDirectives` | Get component directives |
| `_vue:getComponentNames` | Get component name list |
| `_vue:getComponentMeta` | Get component metadata |
| `_vue:getComponentSlots` | Get component slots |
| `_vue:getElementAttrs` | Get element attributes |
| `_vue:getElementNames` | Get element name list |
| `_vue:resolveModuleName` | Resolve module name |
| `_vue:documentHighlights-full` | Document highlights |
| `_vue:encodedSemanticClassifications-full` | Semantic classifications |
| `_vue:quickinfo` | Quick info |

## How it Works

This plugin is created using `createLanguageServicePlugin` from `@volar/typescript`. It:

1. Reads `vueCompilerOptions` from `tsconfig.json`
2. Creates a Vue language plugin to process `.vue` files
3. Intercepts and handles TypeScript language service requests
4. Registers Vue-specific protocol handlers

## Related Packages

- [`@vue/language-core`](../language-core) - Core module
- [`@vue/language-server`](../language-server) - Language server
- [`vue-component-meta`](../component-meta) - Component metadata

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
