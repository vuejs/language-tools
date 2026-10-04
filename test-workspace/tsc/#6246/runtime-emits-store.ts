import { ref } from 'vue';
import RuntimeEmits from './runtime-emits.vue';
import { useModal } from './use-modal';

export function useRuntimeEmitsStore() {
	const items = ref<string[]>([]);
	const { open } = useModal({ component: RuntimeEmits });
	return { items, open };
}
