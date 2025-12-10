<!-- @fallthroughAttributes true -->
<!-- @strictTemplate true -->

<script setup lang="ts">
defineEmits<{
	foo: [string];
}>();

defineProps<{
	bar?: string;
}>();
</script>
