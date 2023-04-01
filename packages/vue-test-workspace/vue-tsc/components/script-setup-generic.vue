<script setup lang="ts" generic="T">
const props: { foo: T } = defineProps<{ foo: T }>();
defineEmits<{ (e: 'bar', data: T): void }>();
defineExpose({ baz: props.foo });
defineSlots<{ default(data: T): any }>();
</script>

<script lang="ts">
declare function defineSlots<T>(): T;
</script>
