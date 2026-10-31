<script setup lang="ts">
withDefaults(defineProps<{ expression?: number[]; returned?: number[]; statements?: number[] }>(), {
	expression: () => [1],
	returned: () => {
		return [2];
	},
	statements: () => {
		const value = [3];
		return value;
	},
});
</script>
