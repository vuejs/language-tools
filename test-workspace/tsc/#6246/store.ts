import { ref } from 'vue';
import Main from './main.vue';
import { useModal } from './use-modal';

export function useStore() {
	const items = ref<string[]>([]);
	const { open } = useModal({ component: Main });
	return { items, open };
}
