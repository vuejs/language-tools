# Troubleshooting

## Doctor panel

You can open the Volar doctor panel by pressing `F1` and writing `Volar: Show doctor panel`.
The doctor panel will show your current configuration and also give some warnings if something is configured false.
When you open a GitHub issue it's usually a good idea to include the doctor panel information.

## Recursive components

Volar can't typecheck recursive components out of the box due to TS limitation.
But there's a workaround, you can explicitly specify component's props like so:

`Bar.vue`

```vue
<template>
  <Bar :a="'wrong'" />
</template>

<script setup lang="ts">
import { defineAsyncComponent, type DefineComponent } from 'vue'

interface Props {
  a: number
}

const Bar = defineAsyncComponent<DefineComponent<Props>>(
  () => import('./Bar.vue') as any
)
defineProps<Props>()
</script>
```


## Property `class` does not exist on type `DetailedHTMLProps`

If VSCode gives an error for `class` and `slot` like this:

<kbd><img width="483" src="https://user-images.githubusercontent.com/3253920/145134536-7bb090e9-9dcd-4a61-8096-3c47d6c1a699.png" /></kbd>

This is because one of the packages installed in your project uses `@types/react` which breaks some parts of Volar.

Please see the following solutions:
- https://github.com/johnsoncodehk/volar/discussions/592
- https://github.com/johnsoncodehk/volar/discussions/592#discussioncomment-1763880