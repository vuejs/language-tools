import { ref } from 'vue';
import Modal from './Modal.vue';
import SlotDep from './SlotDep.vue';
import SlotModal from './SlotModal.vue';

declare function useModal<T>(options: { component: T }): { open: () => void };

export function useStore() {
	const items = ref<string[]>([]);
	const { open } = useModal({ component: Modal });
	const { open: open2 } = useModal({ component: SlotModal });
	const { open: open3 } = useModal({ component: SlotDep });
	return { items, open, open2, open3 };
}
