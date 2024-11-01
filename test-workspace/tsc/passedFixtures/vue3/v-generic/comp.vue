<script setup lang="ts" generic="T extends string | number, K = any">
defineEmits<{
    foo: [bar: T, baz: K]
}>();
</script>