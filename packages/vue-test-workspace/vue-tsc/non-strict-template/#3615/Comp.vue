<script setup lang="ts" generic="T">
defineProps<{
	modelValue: T;
}>()

const emit = defineEmits<{
	(e: "update:model-value", value: T): void;
}>();
</script>
