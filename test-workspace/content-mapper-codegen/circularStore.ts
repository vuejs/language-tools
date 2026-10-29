import { ref } from 'vue';
import CircularStoreModal from './CircularStoreModal.vue';

declare function useModal<T>(options: { component: T }): { open: () => void };

export function useCircularStore() {
	const items = ref<string[]>([]);
	const { open } = useModal({ component: CircularStoreModal });
	return { items, open };
}
