# Volar

> Faster and more accurate TypeScript support of Vue 3

https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar

Roadmap: https://github.com/johnsoncodehk/volar/issues/28

## What is this?

Volar is a fast implementation to try to create faster Vue Language Service to near to native TypeScript Language Service performance. (How? use Composition API!)

You can ask [here](https://github.com/johnsoncodehk/volar/issues/17), if you are not sure whether to use. :)

## :warning: Warning!

The old `<script setup>` support ([RFC #182](https://github.com/vuejs/rfcs/pull/182)) is planning to remove: https://github.com/johnsoncodehk/volar/issues/27

## Some interesting features:

- [x] inline css services (v0.16.3 added)
- [x] ref sugar convert tool (v0.15.6 added)
- [x] CSS class codeLens (v0.15.4 added)
- [x] RFC [#222](https://github.com/vuejs/rfcs/pull/222) ([#227](https://github.com/vuejs/rfcs/pull/227), [#228](https://github.com/vuejs/rfcs/pull/228)) support (v0.15.2 added) (with `volar.scriptSetup.supportRfc` setting)
- [x] Scoped CSS services (v0.15.1 added)
- [x] Format all scripts command (v0.13.5 added)
- [x] Verify all scripts command (v0.13.3 added)
- [x] v-slot Type-Checking (v0.12.1 added)
- [x] Component props auto completion (v0.11.6 added)
- [x] emits Type-Checking (v0.11.4 added)
- [x] Interpolation formatting + commenting (v0.11.2 added)
- [x] Native html tag services (v0.11.0 added)
- [x] `<script setup>` support (v0.10.0 added)
- [x] Unused highlight for setup() return properties (v0.7.0 added)
- [x] pug-html convert tool
- [x] Asset url link jump
- [x] Css Module services
- [x] Pug interpolation services
- [x] Component props services (v0.5.0 added)
- [x] Component tag services
- [x] Multi root support

## Requirements

- tsconfig.json
- `lang="ts"`

## Components service

By default, Local components, Built-in components, native html elements Type-Checking are active.

For Global components, you need to add the `__VLS_GlobalComponents` interface definition, for example:

```typescript
// shims-volar.d.ts
import { RouterLink, RouterView } from 'vue-router'

declare global {
	interface __VLS_GlobalComponents {
		RouterLink: typeof RouterLink
		RouterView: typeof RouterView
	}
}
```

v0.16.0 new feature:

Now will detact Vue 3 global component registeres to declare `__VLS_GlobalComponents`.

```typescript
// my-global-components-plugin.ts
import Foo from '@/my-global-components/foo.vue'
import Bar from '@/my-global-components/bar.vue'

export const plugin: Plugin = {
    install(app) {
        app.component('f-o-o', Foo);
        app.component('BAR', Bar);
    }
}

/* The following code will be automatically generated */
declare global {
	interface __VLS_GlobalComponents {
		'f-o-o': typeof Foo
		'BAR': typeof Bar
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
		RouterLink: typeof RouterLink & {
			__VLS_slots: {
				default: UnwrapRef<ReturnType<typeof useLink>>
			}
		}
		RouterView: typeof RouterView & {
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

## Limitations

- Due to TypeScript limitations and performance considerations, if component emits events count greater than 8, emits type-checking will stop work for this component. (https://github.com/microsoft/TypeScript/issues/26591, https://github.com/microsoft/TypeScript/issues/37079#issuecomment-592078751)

## Note

> Syntax highlighting is based on [vue-syntax-highlight](https://github.com/vuejs/vue-syntax-highlight)

> If your rename location includes both a .ts and a .vue file. Please perform the rename operation on the .vue file, otherwise the rename location in the .vue wouldn't be found.

> Currently supported languages:
> - template: html, pug
> - script: js, ts, jsx, tsx
> - style: css, scss, less
