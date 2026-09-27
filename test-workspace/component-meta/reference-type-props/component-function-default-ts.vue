<script setup lang="ts">
withDefaults(defineProps<{
	items?: string[];
	formatter?: (value: number) => string;
}>(), {
	items() {
		return ['foo'];
	},
	formatter: value => String(value),
});

defineModel<(value: number) => number>('transform', { default: (value: number) => value });
</script>
