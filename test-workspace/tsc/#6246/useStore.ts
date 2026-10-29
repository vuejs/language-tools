import { ref } from 'vue';
import Modal from './main.vue';

declare function useModal<T>(options: { component: T }): { open: () => void };

export function useStore() {
	const items = ref<string[]>([]);
	const { open } = useModal({ component: Modal });
	return { items, open };
}
