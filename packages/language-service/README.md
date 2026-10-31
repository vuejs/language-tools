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

// Create Vue language service plugins
// The optional argument `client` answers the type-aware requests of `lib/requests`
const plugins = createVueLanguageServicePlugins();
```

## Built-in Plugins

### General Language Services

| Plugin | Source | Description |
| :--- | :--- | :--- |
| JSON | `volar-service-json` | JSON language service |
| Pug Format | `volar-service-pug-beautify` | Pug formatting |
| Emmet | `volar-service-emmet` | Emmet abbreviation expansion |

### Vue-specific Plugins

| Plugin | Description |
| :--- | :--- |
| `vue-sfc` | SFC structure support, including folding, symbols, document links |
| `vue-template` | Template language service, supporting HTML and Pug |
| `vue-format-per-block` | Formatting per block |
| `vue-typescript-syntactic` | Folding, selection ranges, outline, formatting and JSX closing tags of script blocks and template expressions; provides nothing until TypeScript 7.1 has a project-free syntactic API |
| `vue-compiler-dom-errors` | Vue compiler error diagnostics |
| `vue-directive-comments` | Directive comment support (`<!-- @vue-skip -->`, etc.) |
| `vue-inlayhints` | Inlay hints (destructured props, inline handlers, etc.) |
| `vue-missing-props-hints` | Hints for missing required props |
| `vue-autoinsert-dotvalue` | Auto-insertion of `.value` for ref variables |
| `vue-autoinsert-space` | Auto-insertion of spaces in template interpolations |
| `vue-scoped-class-links` | Scoped CSS class name links |
| `vue-template-ref-links` | Template ref links |
| `vue-extract-file` | Extract component refactoring |
| `vue-document-drop` | Auto-generation of import on file drop |
| `vue-suggest-define-assignment` | Assignment suggestions for `defineProps`, etc. |
| `css` | CSS language service, supporting v-bind and CSS Modules |

## Related Packages

- [`@vue/language-core`](../language-core) - Core module
- [`@vue/language-server`](../language-server) - Language server
- [`@volar/language-service`](https://github.com/volarjs/volar.js) - Volar.js base framework

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
