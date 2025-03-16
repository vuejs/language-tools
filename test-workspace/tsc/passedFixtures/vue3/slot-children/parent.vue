<script setup lang="ts" generic="T">
import type { VNode } from 'vue';
import Child from './child.vue';

defineProps<{
	foo: T;
}>();
defineSlots<{
	default?: () => (ReturnType<typeof Child<T>> | VNode<HTMLAnchorElement>)[];
}>();
</script>
