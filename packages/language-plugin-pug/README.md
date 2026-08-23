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

Add this plugin in `tsconfig.json`:

```jsonc
{
  "vueCompilerOptions": {
    "plugins": ["@vue/language-plugin-pug"]
  }
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

This plugin implements the `VueLanguagePlugin` interface, providing:

- **`getEmbeddedCodes`** - Identifies `<template lang="pug">` blocks
- **`resolveEmbeddedCode`** - Extracts Pug content as embedded code
- **`compileSFCTemplate`** - Compiles Pug to HTML, then parses it into an AST using `@vue/compiler-dom`

## How it Works

1. Uses `pug-lexer` to convert Pug syntax into tokens
2. Uses `pug-parser` to parse tokens into an AST
3. Traverses the AST to generate HTML while building a source map
4. Uses `@vue/compiler-dom.parse` to parse the HTML
5. Uses `@vue/compiler-dom.transform` to transform the AST
6. Maps error and warning positions back to the original Pug code via the source map

## Related Packages

- [`@vue/language-core`](../language-core) - Core module

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
