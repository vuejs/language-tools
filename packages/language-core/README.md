# @vue/language-core

<p>
  <a href="https://www.npmjs.com/package/@vue/language-core"><img src="https://img.shields.io/npm/v/@vue/language-core.svg?labelColor=18181B&color=1584FC" alt="NPM version"></a>
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

The core module for Vue Language Tools, responsible for parsing Vue Single File Components (SFCs) and transforming them into virtual code structures that TypeScript can understand. This package is a low-level dependency for `@vue/language-server` and `vue-tsc`.

## Installation

```bash
npm install @vue/language-core
```

## Core API

### `createVueLanguagePlugin`

Creates a Vue language plugin for integration with Volar language services.

```typescript
import { createVueLanguagePlugin } from '@vue/language-core';
import type { LanguagePlugin } from '@volar/language-core';
import ts from 'typescript';

const plugin: LanguagePlugin<string> = createVueLanguagePlugin(
  ts,
  compilerOptions,    // ts.CompilerOptions
  vueCompilerOptions, // VueCompilerOptions
  (scriptId) => scriptId  // asFileName: Converts scriptId to a file name
);
```

### `createParsedCommandLine`

Parses TypeScript and Vue compiler options from `tsconfig.json`.

```typescript
import { createParsedCommandLine } from '@vue/language-core';
import ts from 'typescript';

const parsed = createParsedCommandLine(ts, ts.sys, '/path/to/tsconfig.json');
// parsed.options: ts.CompilerOptions
// parsed.vueOptions: VueCompilerOptions
```

### `parse`

Parses Vue SFC source code and returns an `SFCParseResult`.

```typescript
import { parse } from '@vue/language-core';

const result = parse(`
<template>
  <div>{{ msg }}</div>
</template>
<script setup lang="ts">
const msg = 'Hello'
</script>
`);

// result.descriptor.template
// result.descriptor.scriptSetup
// result.descriptor.styles
// result.errors
```

## `vueCompilerOptions`

Configure Vue compiler behavior through the `vueCompilerOptions` field in `tsconfig.json`:

```jsonc
{
  "compilerOptions": { /* ... */ },
  "vueCompilerOptions": {
    "target": 3.5,
    "strictTemplates": true,
    "plugins": ["@vue/language-plugin-pug"]
  }
}
```

### File Handling Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `target` | `number \| 'auto'` | `'auto'` | Vue version. `'auto'` reads from `node_modules/vue/package.json`. |
| `extensions` | `string[]` | `['.vue']` | File extensions to be treated as Vue SFCs. |
| `vitePressExtensions` | `string[]` | `[]` | File extensions to be treated as VitePress Markdown. |
| `petiteVueExtensions` | `string[]` | `[]` | File extensions to be treated as Petite Vue HTML. |
| `plugins` | `string[]` | `[]` | Custom language plugins, e.g., [`@vue/language-plugin-pug`](../language-plugin-pug). |

### Type Checking Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `strictTemplates` | `boolean` | `false` | A convenience option that enables the four `check*` options below and `strictVModel`. |
| `checkUnknownProps` | `boolean` | `false` | Check for unknown props. |
| `checkUnknownEvents` | `boolean` | `false` | Check for unknown events. |
| `checkUnknownComponents` | `boolean` | `false` | Check for unknown components. |
| `checkUnknownDirectives` | `boolean` | `false` | Check for unknown directives. |
| `strictVModel` | `boolean` | `false` | Strictly check v-model bindings. |
| `strictCssModules` | `boolean` | `false` | Strictly check CSS Modules class names (not affected by `strictTemplates`). |

### Advanced Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `lib` | `string` | `'vue'` | Vue package name, used for generating import statements. |
| `skipTemplateCodegen` | `boolean` | `false` | Skip virtual code generation for templates. |
| `fallthroughAttributes` | `boolean` | `false` | Enable type inference for fallthrough attributes. |
| `jsxSlots` | `boolean` | `false` | Use JSX-style slots types. |
| `dataAttributes` | `string[]` | `[]` | Allowed data-* attribute patterns. |
| `htmlAttributes` | `string[]` | `['aria-*']` | Allowed HTML attribute patterns. |
| `resolveStyleImports` | `boolean` | `false` | Resolve import statements in styles. |
| `resolveStyleClassNames` | `boolean \| 'scoped'` | `'scoped'` | Resolve class names in styles. |

## Built-in Plugins

This package includes the following built-in plugins to handle different file types and blocks:

### File Parsing Plugins

| Plugin | Function | Controlled By |
| :--- | :--- | :--- |
| `file-vue` | Parses `.vue` files into an SFC structure. | `extensions` |
| `file-md` | Parses Markdown files into an SFC structure. | `vitePressExtensions` |
| `file-html` | Parses HTML files into an SFC structure. | `petiteVueExtensions` |

### Virtual Code Generation Plugins

| Plugin | Function |
| :--- | :--- |
| `vue-tsx` | Generates TypeScript virtual code from an SFC. |
| `vue-template-html` | Compiles HTML templates. |
| `vue-template-inline-ts` | Handles TypeScript expressions in templates. |
| `vue-template-inline-css` | Handles inline styles in templates. |
| `vue-style-css` | Compiles CSS styles. |
| `vue-script-js` | Handles JavaScript script blocks. |

### Embedded Code Extraction Plugins

| Plugin | Function |
| :--- | :--- |
| `vue-sfc-template` | Extracts the `<template>` block. |
| `vue-sfc-styles` | Extracts `<style>` blocks. |
| `vue-sfc-scripts` | Extracts `<script>` blocks (for formatting). |
| `vue-sfc-customblocks` | Extracts custom blocks. |

## Related Packages

- [`@vue/language-server`](../language-server) - Language Server
- [`@vue/language-service`](../language-service) - Language Service
- [`vue-tsc`](../tsc) - Command-line Type Checker

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
