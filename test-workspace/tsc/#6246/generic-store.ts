import { ref } from 'vue';
import Generic from './generic.vue';
import { useModal } from './use-modal';

export function useGenericStore() {
	const items = ref<string[]>([]);
	const { open } = useModal({ component: Generic });
	return { items, open };
}
