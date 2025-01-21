<script setup lang="ts" generic="T">
import Child from './child.vue';

defineProps<{
	foo: T;
}>();
defineSlots<{
	default?(): ReturnType<typeof Child<T>>[];
}>();
</script>
