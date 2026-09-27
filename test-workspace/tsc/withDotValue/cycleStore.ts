import { ref, shallowRef } from 'vue';
import type CycleComp from './cycleComp.vue';

// The store refers back to the instance type of a component whose template narrows a store binding.
type Exposed = Pick<InstanceType<typeof CycleComp>, 'show'>;
const instance = shallowRef<Exposed | null>(null);

export function useCycleStore() {
	return { visible: ref(false), instance };
}
