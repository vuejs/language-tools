<script setup lang="tsx" generic="T">
defineEmits<{
	(name: 'foo', value: string): void
}>();
</script>