# VitePress fixture

Frontmatter and fenced code below are blanked, so nothing in them is type-checked:

```ts
const fenced: number = 'not checked';
```

<<< ./missing-snippet.ts

<script setup lang="ts">
const count: number = 'wrong';
</script>

Inline code like `const inline = 1` stays out of the template, and {{ count.toFixed() }} is checked
against the script setup. A missing property is reported at the markdown position:

{{ count.nope() }}
