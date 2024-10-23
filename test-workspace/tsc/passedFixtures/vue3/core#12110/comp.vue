<script setup lang="ts">
type Props = {
	foo: string;
} | {
	foo?: boolean;
	bar: string;
};

withDefaults(defineProps<Props>(), {
	foo: true
});

defineEmits<{
	click: [e: number]
}>();
</script>
