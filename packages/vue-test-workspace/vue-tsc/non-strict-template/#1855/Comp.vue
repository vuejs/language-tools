<script setup lang="ts">
const emit = defineEmits<{
	(e: 'event-any', arg: any): void;
	(e: 'event-str', arg: string): void;
}>();
</script>
