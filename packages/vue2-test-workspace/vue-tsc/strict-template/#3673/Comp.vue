<script setup lang="ts">
defineProps<{
	border?: boolean; 
}>();
defineEmits<{
	(event: 'click', s: string): void;
}>();
</script>
