# vue-tsc

<p>
  <a href="https://www.npmjs.com/package/vue-tsc"><img src="https://img.shields.io/npm/v/vue-tsc.svg?labelColor=18181B&color=1584FC" alt="NPM version"></a>
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

A command-line type checking tool for Vue, based on a `tsc` wrapper, enabling the TypeScript compiler to understand `.vue` files.

## Installation

```bash
npm install vue-tsc typescript --save-dev
```

Requires TypeScript 5.0.0 or higher.

## Usage

### Type Checking

```bash
vue-tsc --noEmit
```

### Generate Declaration Files

```bash
vue-tsc --declaration --emitDeclarationOnly
```

### Configuration in package.json

```json
{
  "scripts": {
    "type-check": "vue-tsc --noEmit",
    "build:types": "vue-tsc --declaration --emitDeclarationOnly"
  }
}
```

## Supported File Types

`vue-tsc` automatically reads file types to process from `vueCompilerOptions.extensions` in `tsconfig.json`, defaulting to `['.vue']`.

If `vitePressExtensions` or `petiteVueExtensions` are configured, those extensions will also be processed.

## Differences from tsc

`vue-tsc` is a wrapper around `tsc` that:

1. Reads `vueCompilerOptions` from `tsconfig.json`
2. Creates a Vue language plugin to process `.vue` files
3. Transforms `.vue` files into TypeScript virtual code before passing them to `tsc`

All `tsc` command-line arguments can be used directly.

## Programmatic Usage

```typescript
import { run } from 'vue-tsc';

// Use the default tsc path
run();

// Specify a custom tsc path
run('/path/to/typescript/lib/tsc.js');
```

## Related Packages

- [`@vue/language-core`](../language-core) - Core module

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
