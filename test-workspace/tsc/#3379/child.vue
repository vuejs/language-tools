<script setup lang="ts" generic="T">
type Emits = {
	(name: 'update:modelValue', modelValue: string): void
	(name: 'removeOptions', options: number): void
	(name: 'addOptions', options: number): void
	(name: 'selectOptions', options: number): void
	(name: 'clickNode', option: number): void
};

defineEmits<Emits>();
</script>
