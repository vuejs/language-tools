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

### `createVueSource`

Reads a Vue file into its IR and script analysis, without any embedded or generated code. It updates in place when given a new snapshot.

```typescript
import { createIRPipeline, createVueSource } from '@vue/language-core';

const pipeline = createIRPipeline(ts, vueCompilerOptions);
const source = createVueSource(ts, vueCompilerOptions, pipeline, fileName, snapshot);
source.ir; // the blocks of the file
source.analysis; // what its script blocks declare
source.update(newSnapshot);
```

`ts` is the TypeScript 7 `typescript/ast` module plus a synchronous `createSourceFile`, which TypeScript 7 only offers through its API process (`loadTypeScript` from `@vue/language-core/typescript` builds it from `typescript/sync`). The classic `typescript` module provides the same names, so `@vue/language-server` passes that instead.

`createIRPipeline` builds the IR of every file by `vueCompilerOptions.format`, with the built-in compilers and the `ir` exports of `vueCompilerOptions.plugins` ([Plugins](#plugins)). Its `errors` list the plugins, or the parts of them, that have no effect. A host creates one pipeline per `contentMappers` entry and gives it only the files of that entry's `extensions`. Nothing in the IR depends on other entries: like `@vue/compiler-sfc`, a template tag refers to the `<script setup>` binding of its name whatever it is imported from, and a file's own component name is its file name without the last extension.

The Volar language plugin that adds the embedded documents of the language service, `createVueLanguagePlugin`, is in [`@vue/language-service`](../language-service).

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

[`@vue/content-mapper`](../content-mapper) takes these options from its `contentMappers` entry's `options`, and `resolveVueCompilerOptions` resolves them. `@vue/language-server` reads them from the entry of a Vue file the same way, whichever Content Mapper the entry names, so another Vue Content Mapper that accepts these keys in its `options` gets the same language server behavior:

```jsonc
{
  "contentMappers": [
    {
      "package": "@vue/content-mapper",
      "extensions": [".vue"],
      "options": {
        "target": 3.5,
        "plugins": ["@vue/language-plugin-pug"]
      }
    }
  ]
}
```

### File Handling Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `target` | `number \| 'auto'` | `'auto'` | Vue version. `'auto'` reads from `node_modules/vue/package.json`. |
| `format` | `string` | `'sfc'` | How files are read: a built-in format (below) or one of the `formats` of a plugin. |
| `plugins` | `(string \| { name: string, ... })[]` | `[]` | [Plugins](#plugins) that change how the IR is built, e.g. [`@vue/language-plugin-pug`](../language-plugin-pug). A config that declares `plugins` replaces the inherited list. |

The built-in formats:

| `format` | Parses |
| :--- | :--- |
| `sfc` | A Vue SFC. |
| `vitepress` | VitePress markdown: `<script>` / `<style>` blocks are lifted out and the rest becomes the template. |
| `petite-vue` | A petite-vue HTML page: `<script>` / `<style>` blocks are lifted out and the rest becomes the template. |

### Type Checking Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `strictCssModules` | `boolean` | `false` | Strictly check CSS Modules class names. |

### Advanced Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `lib` | `string` | `'vue'` | Vue package name, used for generating import statements. |
| `vapor` | `boolean` | `false` | Enable Vapor mode for all Vue SFCs. |
| `fallthroughAttributes` | `boolean` | `false` | Enable type inference for fallthrough attributes. |
| `checkRequiredFallthroughAttributes` | `boolean` | `false` | Check required fallthrough attributes. |
| `jsxSlots` | `boolean` | `false` | Use JSX-style slots types. |
| `dataAttributes` | `string[]` | `[]` | Allowed data-* attribute patterns. |
| `htmlAttributes` | `string[]` | `['aria-*']` | Allowed HTML attribute patterns. |
| `resolveStyleClassNames` | `boolean \| 'scoped'` | `'scoped'` | Resolve class names in styles. |

## Plugins

A `plugins` entry names a module, resolved from the directory of the config that declares it; an object entry passes the rest of its keys to the module as its `config`. A module takes part in a mode by exporting its key, so nothing switches modes:

```ts
import type { VuePluginModule } from '@vue/language-core';

// Changes the IR, so every IR builder reads it: Content Mappers built on language-core,
// the language server and vue-component-meta.
export const ir: VuePluginModule['ir'] = ({ config, vueCompilerOptions }) => ({
  // Formats that `format` selects by name.
  formats: {
    'my-format': {
      parse(fileName, content) { /* return an SFCParseResult */ },
      update(oldResult, { start, end, newText }) { /* optional: update oldResult in place, or return undefined */ },
    },
  },
  // Template languages, by the `lang` of `<template>`: the HTML of `source`, and the span map segments
  // (`SpanMapSegment` of `@volar/source-map`) from ranges of the HTML (virtual) to ranges of `source` (original).
  templateCompilers: {
    'my-lang'(source) {
      return { html: toHTML(source), mappings: toMappings(source) };
    },
  },
  // Applied in `plugins` order to the options of every template compiler.
  resolveTemplateCompilerOptions(options) {
    return options;
  },
});
```

`ir` is a `VueIRPlugin` or a function of the entry's `config` and the resolved `vueCompilerOptions` that returns one. The `codegen` export contributes to the TS code that `@vue/content-mapper` generates. It is defined and read by that package alone (`VueCodegenExport`, see [Codegen plugins](../content-mapper#codegen-plugins)); the language server and vue-component-meta never load it.

- A format or template language belongs to the one plugin that provides its key. Providing a built-in key (`sfc`, `vitepress`, `petite-vue`, `html`, `md`) or a key of an earlier plugin is a load error, and that key of the plugin is not used.
- A template language only converts to HTML (`TemplateHTML`). The host compiles the HTML and gives every location of the AST, and of the compiler's errors and warnings, the offsets of `source`: an HTML offset that several segments cover, their ends included, gets the greatest source offset, one that no segment covers gets -1 (no source), and a location of which only one end has a source gets -1 at both ends. `ignoreError` drops compiler errors that come from the conversion rather than the template.
- Script and style blocks are always read by the built-in compilers: the script AST is a TypeScript `SourceFile`, and the style scanner does not depend on the style language.
- The embedded documents of the language service are built in, including the document of a `pug` template, so a plugin has no part in them.
- A module that exports a function, an array, or an object with `version` is a `VueLanguagePlugin` of v3 and fails to load with: "VueLanguagePlugin functions are no longer supported; export `{ ir: … }` (see language-core README)".

`@vue/content-mapper` reports the plugins that fail to load, and a `format` that nothing provides, as option diagnostics of its `contentMappers` entry. It watches each plugin's entry file and the `package.json` of its package, and the language server creates a project's IR again when one of them changes.

## Related Packages

- [`@vue/language-server`](../language-server) - Language Server
- [`@vue/language-service`](../language-service) - Language Service
- [`@vue/content-mapper`](../content-mapper) - Content mapper for native TypeScript

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
