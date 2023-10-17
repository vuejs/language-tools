<script setup lang="ts">
defineProps<{
	border?: boolean; 
}>();
defineEmits<{
	(event: 'click'): void;
}>();
</script>
