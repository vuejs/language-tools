# Volar

> Faster and more acurrate TypeScript support of Vue 3

https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar

## Some interesting features:

- [x] Format all scripts command (v0.13.5 added)
- [x] Verify all scripts command (v0.13.3 added)
- [x] v-slot Type-Checking (v0.12.1 added)
- [x] Component props auto completion (v0.11.6 added)
- [x] Emits Type-Checking (v0.11.4 added)
- [x] Interpolation formatting + commenting (v0.11.2 added)
- [x] Native html tag services (v0.11.0 added)
- [x] `<script setup>` support (v0.10.0 added)
- [x] Unused highlight for setup() return properties (v0.7.0 added)
- [x] pug-html convert tool
- [x] Asset url link jump
- [x] css module services
- [x] Pug interpolation services
- [x] Component props services (v0.5.0 added)
- [x] Component tag services
- [x] Multi root support

## Components service

Local components, Built-in components, native html elements Type-Checking is default active.

For Global components, you need to definition `__VLS_GlobalComponents` interface, for example:

```typescript
// shims-volar.d.ts
import { RouterLink, RouterView } from 'vue-router'

declare global {
	interface __VLS_GlobalComponents {
		'RouterLink': typeof RouterLink
		'RouterView': typeof RouterView
	}
}
```

## v-slot Type-Checking

v-slot Type-Checking will auto service the .vue files under project, but for third party library you need to define the slot types, for example:

```typescript
// shims-volar.d.ts
import { RouterLink, RouterView, useLink, RouteLocationNormalized } from 'vue-router'
import { UnwrapRef, VNode } from 'vue'

declare global {
	interface __VLS_GlobalComponents {
		'RouterLink': typeof RouterLink & {
			__VLS_slots: {
				default: UnwrapRef<ReturnType<typeof useLink>>
			}
		}
		'RouterView': typeof RouterView & {
			__VLS_slots: {
				default: {
					Component: VNode
					route: RouteLocationNormalized & { href: string }
				}
			}
		}
	}
}
```

## Work for Vue 2?

This tool using Vue 3 types from '@vue/runtime-dom' module to calculate completion.

Vue 3 is include '@vue/runtime-dom'. for Vue 2 you need to install by yourself:

```json
{
  "devDependencies": {
    "@vue/runtime-dom": "latest"
  }
}
```

## Note

> Syntax highlighting is base on [vue-syntax-highlight](https://github.com/vuejs/vue-syntax-highlight)

> If rename location include both .ts and .vue files. Please perform the rename operation in the .vue file, otherwise the rename location in the .vue cannot be found correctly.

> Click `<template>` tag to use pug convert tool.

> Currently support languages:
> - template: html, pug
> - script: js, ts, jsx, tsx
> - style: css, scss
