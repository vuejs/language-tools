# Volar

> Faster and more accurate TypeScript support of Vue 3

https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar

Volar is a Language Support plugin built specifically for Vue 3. This is based on Composition API to calculate on-demand, so as to achieve performance close to native TypeScript script.

Roadmap: https://github.com/johnsoncodehk/volar/issues/28

## Using

<details>
<summary>Components services</summary>

By default, Local components, Built-in components, native html elements Type-Checking are active.

For Global components, you need to have  `__VLS_GlobalComponents` interface definition or component registeres call, for example:

- `__VLS_GlobalComponents` interface definition:

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

- component registeres call:

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

</details>

<details>
<summary>Slots services</summary>

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

</details>

<details>
<summary>Work with Vue 2?</summary>

This tool uses Vue 3 types from '@vue/runtime-dom' module to calculate completion.

Vue 3 in itself includes the package '@vue/runtime-dom'. For Vue 2 you will have to install this package yourself:

```json
{
  "devDependencies": {
    "@vue/runtime-dom": "latest"
  }
}
```

</details>

## Note

> Syntax highlighting is based on [vue-syntax-highlight](https://github.com/vuejs/vue-syntax-highlight)

> If your rename location includes both a .ts and a .vue file. Please perform the rename operation on the .vue file, otherwise the rename location in the .vue wouldn't be found.

> Currently supported languages:
> - template: html, pug
> - script: js, ts, jsx, tsx
> - style: css, scss, less

> You need to disable Vetur to avoid functional conflicts.

> tsconfig.json / jsconfig.json is required.


## Sponsors

If you like this extension and you can afford, please consider to becoming a [Sponsor](https://github.com/sponsors/johnsoncodehk). I can reduce other work and move time to Volar, so this will definitely speed up this project.
