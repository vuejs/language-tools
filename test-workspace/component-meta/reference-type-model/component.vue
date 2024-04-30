<script setup lang="ts">
const bar = defineModel<number>("foo")
const baz = defineModel<string[]>("bar")
const [qux, modifiers] = defineModel<string, 'lazy' | 'trim'>("qux")
</script>
