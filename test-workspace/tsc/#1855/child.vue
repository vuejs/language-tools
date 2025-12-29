<script setup lang="ts">
defineEmits<{
	(e: 'event-any', arg: any): void;
	(e: 'event-str', arg: string): void;
}>();
</script>
