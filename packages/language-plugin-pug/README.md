# @vue/language-plugin-pug

<p>
  <a href="https://www.npmjs.com/package/@vue/language-plugin-pug"><img src="https://img.shields.io/npm/v/@vue/language-plugin-pug.svg?labelColor=18181B&color=1584FC" alt="NPM version"></a>
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

A Pug template language plugin for Vue Language Tools, enabling the use of `<template lang="pug">` in Vue SFCs.

## Installation

```bash
npm install @vue/language-plugin-pug --save-dev
```

## Configuration

Add this plugin to the `@vue/content-mapper` options in `tsconfig.json`:

```jsonc
{
  "contentMappers": [
    {
      "package": "@vue/content-mapper",
      "extensions": [".vue"],
      "options": { "plugins": ["@vue/language-plugin-pug"] }
    }
  ]
}
```

## Usage

After configuration, you can use Pug syntax in Vue components:

```vue
<template lang="pug">
div.container
  h1 {{ title }}
  p {{ description }}
  button(@click="handleClick") Click me
</template>

<script setup lang="ts">
const title = 'Hello'
const description = 'World'
const handleClick = () => console.log('clicked')
</script>
```

## Features

This plugin exports `ir.templateCompilers.pug` (see [Plugins](../language-core#plugins)), which converts Pug to HTML with mappings to the Pug source; the host compiles the HTML into the template AST at the offsets of the Pug source. It drops the duplicate attribute error of a class literal next to a `class` attribute (`.foo(class="bar")`), which Pug merges. It is needed wherever the IR of a Pug template is built: by `@vue/content-mapper` for type checking, and by the language server for the features that read the template AST.

The language server's syntax features of Pug templates are built in and work without this plugin.

## How it Works

1. [`muggle-pug`](https://github.com/johnsoncodehk/muggle-pug) compiles the Pug code to HTML pieces that copy the Pug code, with `pug-lexer` and `pug-parser`. A template whose every line is indented, which Vue dedents but Pug rejects, is read as the children of a `template` tag that is left out of the result
2. Builds the mappings from the HTML to the Pug code from the pieces
3. Compiles the HTML with the `compileTemplate` that the host passes
4. Maps the offsets of the AST, errors and warnings back to the original Pug code via the mappings

## Related Packages

- [`@vue/language-core`](../language-core) - Core module
- [`muggle-pug`](https://github.com/johnsoncodehk/muggle-pug) - Pug to HTML pieces

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
