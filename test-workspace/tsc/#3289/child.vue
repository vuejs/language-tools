<script setup lang="tsx" generic="T">
defineEmits<{
	(name: 'foo', value: string): void
}>();
null as unknown as T;
</script>