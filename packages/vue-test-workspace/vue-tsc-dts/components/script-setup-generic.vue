<script setup lang="ts" generic="T">
defineProps<{ foo: T }>();
defineEmits<{ (e: 'bar', data: T): void }>();
defineExpose({ baz: {} as T });
defineSlots<{ default?(data: T): any }>();
</script>
