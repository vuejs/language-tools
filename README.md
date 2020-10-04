# Volar

> Faster and more acurrate TypeScript support of Vue 3

https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar

## Status: Preview

> It is still in the stage of rapid prototype implementation, source code will be uploaded after reconstruction.

## Why not Vetur?

My motivation for building this tool is that Vetur's Type-Checking is too slow (it has been improved now). I hope to get an experience similar to coding native ts when coding vue. It is more realistic to abandon the technical debt of Vue2 and rewrite it than to participate in the reconstruction of Vetur.

Thanks to Vue3's `ref` and `computed` (Yes, I use Composition API to write Vue Language Service!), the current development experience is quite close to coding native ts. And I added All the TypeScript features I need.

This tool will not replace Vetur. This tool only focuses on Vue3+TypeScript and only supports major languages (no sass, vue2...etc), so if Vetur is good for you now, just continue to use Vetur.

## Features other than Vetur (until v0.26)

- [x] Multi root support
- [x] Interpolation formatting
- [x] Component tag services
- [x] Component props services (v0.5.0 added)
- [x] Pug interpolation services
- [x] css module services
- [x] Asset url link jump
- [x] pug-html convert tool
- [x] Unused highlight for setup() return properties (v0.7.0 added)
- [x] Diagnostic all vue scripts (v0.9.0 added)
- [x] `<script setup>` support (v0.10.0 added)
- [x] Native html tag services (v0.11.0 added)

## Template component element LS support

Local components, Built-in components, native html elements Type-Checking is default active.

For Global components, you need to definition `__VLS_GlobalComponents` interface, for example:

```typescript
import { RouterLink, RouterView } from 'vue-router';

declare global {
  interface __VLS_GlobalComponents {
      'RouterLink': typeof RouterLink;
      'RouterView': typeof RouterView;
  }
}
```

## Note

> To avoid performance impact, you need to disable Vetur when enabling this tool.

> Syntax highlighting is power by [vue-syntax-highlight](https://github.com/vuejs/vue-syntax-highlight)

> If rename location include both .ts and .vue files. Please perform the rename operation in the .vue file, otherwise the rename location in the .vue cannot be found correctly.

> Click `<template>` tag to use pug convert tool.

> Currently support languages:
> - template: html, pug
> - script: js, ts, jsx, tsx
> - style: css, scss

## TODO

- Tests
