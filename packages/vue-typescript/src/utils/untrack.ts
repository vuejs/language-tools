import { pauseTracking, resetTracking } from '@vue/reactivity';

export function untrack<T extends (...args: any[]) => any>(source: T) {
	return ((...args: any[]) => {
		pauseTracking();
		const result = source(...args);
		resetTracking();
		return result;
	}) as T;
}
