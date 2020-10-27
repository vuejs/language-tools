# Volar

> Faster and more accurate TypeScript support of Vue 3

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

By default, Local components, Built-in components, native html elements Type-Checking are active.

For Global components, you need to add the `__VLS_GlobalComponents` interface definition, for example:

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

v-slot Type-Checking will auto service all .vue files under the project, but for third party libraries, you need to define the slot types, for example:

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

## Work with Vue 2?

This tool uses Vue 3 types from '@vue/runtime-dom' module to calculate completion.

Vue 3 in itself includes the package '@vue/runtime-dom'. For Vue 2 you will have to install this package yourself:

```json
{
  "devDependencies": {
    "@vue/runtime-dom": "latest"
  }
}
```

## Note

> Syntax highlighting is based on [vue-syntax-highlight](https://github.com/vuejs/vue-syntax-highlight)

> If your rename location includes both a .ts and a .vue file. Please perform the rename operation on the .vue file, otherwise the rename location in the .vue wouldn't be found.

> Click `<template>` tag to use pug convert tool.

> Currently supported languages:
> - template: html, pug
> - script: js, ts, jsx, tsx
> - style: css, scss
