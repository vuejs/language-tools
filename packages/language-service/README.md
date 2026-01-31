# @vue/language-service

<p>
  <a href="https://www.npmjs.com/package/@vue/language-service"><img src="https://img.shields.io/npm/v/@vue/language-service.svg?labelColor=18181B&color=1584FC" alt="NPM version"></a>
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

A collection of Vue language service plugins, providing the core implementation for IDE features. This package integrates various language services such as TypeScript, CSS, HTML, Pug, and Emmet, and adds Vue-specific feature plugins.

## Installation

```bash
npm install @vue/language-service
```

## Usage

```typescript
import { createVueLanguageServicePlugins } from '@vue/language-service';
import * as ts from 'typescript';

// Create Vue language service plugins
// The optional second argument `client` is used for communication with @vue/typescript-plugin
const plugins = createVueLanguageServicePlugins(ts);
```

## Built-in Plugins

### General Language Services

| Plugin | Source | Description |
| :--- | :--- | :--- |
| JSON | `volar-service-json` | JSON language service |
| Pug Format | `volar-service-pug-beautify` | Pug formatting |
| Emmet | `volar-service-emmet` | Emmet abbreviation expansion |
| TypeScript Syntactic | `volar-service-typescript` | TypeScript syntactic features |
| TypeScript Doc Comment | `volar-service-typescript` | JSDoc comment templates |

### Vue-specific Plugins

| Plugin | Description |
| :--- | :--- |
| `vue-sfc` | SFC structure support, including folding, symbols, document links |
| `vue-template` | Template language service, supporting HTML and Pug |
| `vue-format-per-block` | Formatting per block |
| `vue-compiler-dom-errors` | Vue compiler error diagnostics |
| `vue-directive-comments` | Directive comment support (`<!-- @vue-skip -->`, etc.) |
| `vue-component-semantic-tokens` | Component semantic tokens |
| `vue-inlayhints` | Inlay hints (destructured props, inline handlers, etc.) |
| `vue-missing-props-hints` | Hints for missing required props |
| `vue-autoinsert-dotvalue` | Auto-insertion of `.value` for ref variables |
| `vue-autoinsert-space` | Auto-insertion of spaces in template interpolations |
| `vue-scoped-class-links` | Scoped CSS class name links |
| `vue-template-ref-links` | Template ref links |
| `vue-extract-file` | Extract component refactoring |
| `vue-document-drop` | Auto-generation of import on file drop |
| `vue-document-highlights` | Document highlights |
| `vue-suggest-define-assignment` | Assignment suggestions for `defineProps`, etc. |
| `vue-twoslash-queries` | Twoslash query support (`// ^?`) |
| `css` | CSS language service, supporting v-bind and CSS Modules |
| `typescript-semantic-tokens` | TypeScript semantic tokens |

## Usage with @volar/kit

To use the language service in a Node.js environment (e.g., for linting or testing):

```typescript
import { createLanguage, createVueLanguagePlugin } from '@vue/language-core';
import { createLanguageService, createVueLanguageServicePlugins } from '@vue/language-service';
import ts from 'typescript';

const language = createLanguage([
  createVueLanguagePlugin(ts, compilerOptions, vueCompilerOptions, asFileName),
]);

const service = createLanguageService(
  language,
  createVueLanguageServicePlugins(ts),
  env,
);
```

## Related Packages

- [`@vue/language-core`](../language-core) - Core module
- [`@vue/language-server`](../language-server) - Language server
- [`@volar/language-service`](https://github.com/volarjs/volar.js) - Volar.js base framework

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
