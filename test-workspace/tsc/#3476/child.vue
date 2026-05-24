<script setup lang="ts" generic="T extends number">
defineEmits<{
	(e: 'myEvent', data: T): void;
}>()
</script>
