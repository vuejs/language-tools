<script setup lang="ts" generic="const T extends string">
defineProps<{
	foo: T;
	check?: (value: T) => void;
}>();
</script>
