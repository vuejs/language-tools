<script setup lang="ts" generic="T">
defineProps<{ foo: number }>();
defineEmits<{ (e: 'bar', data: number): void }>();
defineExpose({ baz: {} as number });
defineSlots<{ default?(data: { foo: number }): any }>();
defineModel<string>('title');
</script>
