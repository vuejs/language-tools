# @vue/typescript-plugin

<p>
  <a href="https://www.npmjs.com/package/@vue/typescript-plugin"><img src="https://img.shields.io/npm/v/@vue/typescript-plugin.svg?labelColor=18181B&color=1584FC" alt="NPM version"></a>
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

A TypeScript language service plugin that enables `tsserver` to understand `.vue` files.

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

## How it Works

This plugin is created using `createLanguageServicePlugin` from `@volar/typescript`. It:

1. Reads `vueCompilerOptions` from `tsconfig.json`
2. Creates a Vue language plugin to process `.vue` files
3. Intercepts and handles TypeScript language service requests

## Related Packages

- [`@vue/language-core`](../language-core) - Core module
- [`@vue/language-server`](../language-server) - Language server
- [`vue-component-meta`](../component-meta) - Component metadata

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
