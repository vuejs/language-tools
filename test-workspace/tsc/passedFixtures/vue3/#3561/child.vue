<script setup lang="ts" generic="T, TValue extends undefined | string | number | symbol">
defineProps<{
	items: Array<T>,
	modelValue: TValue,
	getKey: (item: T) => TValue,
}>();

defineSlots<{
	default(props: { item: T }): any;
}>();
</script>
