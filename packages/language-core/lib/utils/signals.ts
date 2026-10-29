import { computed } from 'alien-signals';

interface ReactiveArrayItem<O> {
	active: boolean;
	get: () => O;
}

export function reactiveArray<I, O>(
	getArr: () => I[],
	getGetter: (item: () => I, index: number) => () => O,
) {
	const arr = computed(getArr);
	const length = computed(() => arr().length);
	const keys = computed(() => Array.from({ length: length() }, (_, i) => String(i)));

	const items = computed<ReactiveArrayItem<O>[]>(
		prevs => {
			prevs ??= [];
			const l = length();
			if (prevs.length === l) {
				return prevs;
			}
			const items = prevs.slice(0, l);
			for (let i = l; i < prevs.length; i++) {
				prevs[i]!.active = false;
			}
			while (items.length < l) {
				const index = items.length;
				let last = arr()[index]!;
				const item: ReactiveArrayItem<O> = {
					active: true,
					get: computed(getGetter(
						computed(() => {
							if (item.active) {
								const current = arr();
								if (index < current.length) {
									last = current[index]!;
								}
							}
							return last;
						}),
						index,
					)),
				};
				items.push(item);
			}
			return items;
		},
	);

	return new Proxy({}, {
		get(_, p, receiver) {
			if (p === 'length') {
				return length();
			}
			if (typeof p === 'string' && !isNaN(Number(p))) {
				return items()[Number(p)]?.get();
			}
			return Reflect.get(items(), p, receiver);
		},
		has(_, p) {
			return Reflect.has(items(), p);
		},
		ownKeys() {
			return keys();
		},
	}) as unknown as readonly Readonly<O>[];
}

export function computedSet<T>(source: () => Set<T>): () => Set<T> {
	return computed<Set<T>>(
		oldValue => {
			const newValue = source();
			if (oldValue?.size === newValue.size && [...oldValue].every(c => newValue.has(c))) {
				return oldValue;
			}
			return newValue;
		},
	);
}

export function computedArray<T>(
	source: () => T[],
	compareFn = (oldItem: T, newItem: T) => oldItem === newItem,
) {
	return computed<T[]>(
		oldArr => {
			oldArr ??= [];
			const newArr = source();
			if (oldArr.length === newArr.length && oldArr.every((item, index) => compareFn(item, newArr[index]!))) {
				return oldArr;
			}
			return newArr;
		},
	);
}
