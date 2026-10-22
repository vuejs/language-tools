# @vue/language-core

<p>
  <a href="https://www.npmjs.com/package/@vue/language-core"><img src="https://img.shields.io/npm/v/@vue/language-core.svg?labelColor=18181B&color=1584FC" alt="NPM version"></a>
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

The core module for Vue Language Tools, responsible for parsing Vue Single File Components (SFCs) and transforming them into virtual code structures that TypeScript can understand. This package is a low-level dependency for `@vue/language-server` and `@vue/content-mapper`.

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
  vueCompilerOptions, // VueCompilerOptions
  (scriptId) => scriptId  // asFileName: Converts scriptId to a file name
);
```

The plugin parses every file it is given by `vueCompilerOptions.format`; the host creates one plugin per `@vue/content-mapper` entry (with that entry's `format`) and routes to it only the files of that entry's `extensions`. Nothing in the generated code depends on other entries: like `@vue/compiler-sfc`, a template tag refers to the `<script setup>` binding of its name whatever it is imported from, and a file's own component name is its file name without the last extension.

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

`createParsedCommandLine` (used by `@vue/typescript-plugin` on TypeScript 5) reads Vue compiler options from the `vueCompilerOptions` field in `tsconfig.json`; [`@vue/content-mapper`](../content-mapper) ignores that field and takes the same options from its `contentMappers` entry's `options`:

```jsonc
{
  "compilerOptions": { /* ... */ },
  "vueCompilerOptions": {
    "target": 3.5,
    "plugins": ["@vue/language-plugin-pug"]
  }
}
```

### File Handling Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `target` | `number \| 'auto'` | `'auto'` | Vue version. `'auto'` reads from `node_modules/vue/package.json`. |
| `format` | `'sfc' \| 'vitepress' \| 'petite-vue'` | `'sfc'` | Built-in parser: a Vue SFC, VitePress markdown or a petite-vue HTML page. |
| `plugins` | `string[]` | `[]` | Custom language plugins, e.g., [`@vue/language-plugin-pug`](../language-plugin-pug). |

### Type Checking Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `strictCssModules` | `boolean` | `false` | Strictly check CSS Modules class names. |

### Advanced Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `lib` | `string` | `'vue'` | Vue package name, used for generating import statements. |
| `skipTemplateCodegen` | `boolean` | `false` | Skip virtual code generation for templates. |
| `vapor` | `boolean` | `false` | Enable Vapor mode for all Vue SFCs. |
| `fallthroughAttributes` | `boolean` | `false` | Enable type inference for fallthrough attributes. |
| `checkRequiredFallthroughAttributes` | `boolean` | `false` | Check required fallthrough attributes. |
| `jsxSlots` | `boolean` | `false` | Use JSX-style slots types. |
| `dataAttributes` | `string[]` | `[]` | Allowed data-* attribute patterns. |
| `htmlAttributes` | `string[]` | `['aria-*']` | Allowed HTML attribute patterns. |
| `resolveStyleClassNames` | `boolean \| 'scoped'` | `'scoped'` | Resolve class names in styles. |

## Built-in Plugins

This package includes the following built-in plugins to handle different file types and blocks.

### File Parsing

A plugin's `parseSFC(fileName, content)` hook can parse a file into SFC blocks; the first plugin returning a result wins. Otherwise the built-in parser of the file's format is used:

| `format` | Parses |
| :--- | :--- |
| `sfc` | A Vue SFC. |
| `vitepress` | VitePress markdown: `<script>` / `<style>` blocks are lifted out and the rest becomes the template. |
| `petite-vue` | A petite-vue HTML page: `<script>` / `<style>` blocks are lifted out and the rest becomes the template. |

Plugins must declare `version: 4`. Version 4 removed the `getLanguageId`, `isValidFile` and `parseSFC2` hooks: a plugin that only parses some files checks the file name in `parseSFC` and returns `undefined` for the others.

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
- [`@vue/content-mapper`](../content-mapper) - Content mapper for native TypeScript

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
