# Volar

> ⚡ The Fastest Vue Language Support Extension

https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar

Volar is a Language Support plugin built specifically for Vue 3. It's based on `@vue/reactivity` to calculate TypeScript on-demand to optimization performance close to native TypeScript language service.

[[Roadmap](https://github.com/johnsoncodehk/volar/issues/28)] [[Tips](https://github.com/johnsoncodehk/volar/issues/53)] [[Discord](https://discord.gg/5bnSSSSBbK)]

🛠️ This project is still refactoring to make it easier to contribute.

## Quick Start

Some templates that can used with Volar.

[vite/create-app](https://github.com/vitejs/vite/tree/main/packages/create-app/template-vue-ts), [Vitesse](https://github.com/antfu/vitesse)

## Using

<!-- Components services -->
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

<!-- v-slot services -->
<details>
<summary>v-slot services</summary>

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

<!-- Work with Vue 2? -->
<details>
<summary>Work with Vue 2?</summary>

This tool required Vue 3 types from `@vue/runtime-dom` module.

Vue 3 in itself includes the package `@vue/runtime-dom`. For Vue 2 you will have to install this package yourself:

```json
{
  "devDependencies": {
    "@vue/runtime-dom": "latest"
  }
}
```

</details>

<!-- Ignore Checking -->
<details>
<summary>Ignore Checking</summary>

```vue
<template>
checking...
</template>

<script>
checking...
</script>

<!-- @vue-ignore -->
<style>
not checking!
</style>
```

</details>

## Note

> Supported languages:
> - template: html, pug
> - script: js, ts, jsx, tsx
> - style: css, scss, less, postcss (stylus, sass has limited support)

> If use postcss / stylus / sass, you need to install additional extension for syntax highlighting. I tried these and it works, you can also choose other.
> - postcss: [language-postcss](https://marketplace.visualstudio.com/items?itemName=cpylua.language-postcss).
> - stylus: [language-stylus](https://marketplace.visualstudio.com/items?itemName=sysoev.language-stylus)
> - sass: [Sass](https://marketplace.visualstudio.com/items?itemName=Syler.sass-indented)

> You need to disable Vetur to avoid conflicts.

> tsconfig.json / jsconfig.json is required. And usually also need `"strict": true`.
>
> If use Vitepress, you may need to setup `"include": ["src/**/*", "src/.vitepress/**/*"]`.

> `__VLS_GlobalComponents` and `__VLS_slots` will change in future, see: [#40](https://github.com/johnsoncodehk/volar/discussions/40)

## Sponsors

If you like this extension, please consider to becoming a [Sponsor](https://github.com/sponsors/johnsoncodehk). Thank you. :)

<a href="https://github.com/yyx990803"><img src="https://avatars1.githubusercontent.com/u/499550?s=64&amp;v=4" width="32" height="32" alt="@yyx990803" style="border-radius: 50%;"></a>
<a href="https://github.com/Pizzacus"><img src="https://avatars1.githubusercontent.com/u/7659613?s=64&amp;v=4" width="32" height="32" alt="@Pizzacus" style="border-radius: 50%;"></a>
