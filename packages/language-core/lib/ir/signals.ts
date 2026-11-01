import { computed } from 'alien-signals';

export function reactiveArray<I, O>(
	getArr: () => I[],
	getGetter: (item: () => I, index: number) => () => O,
) {
	const arr = computed(getArr);
	const length = computed(() => arr().length);
	const keys = computed(
		() => {
			const l = length();
			const keys = new Array<string>(l);
			for (let i = 0; i < l; i++) {
				keys.push(String(i));
			}
			return keys;
		},
	);
	const items = computed<(() => O)[]>(
		array => {
			array ??= [];
			while (array.length < length()) {
				const index = array.length;
				const item = computed(() => arr()[index]!);
				array.push(computed(getGetter(item, index)));
			}
			if (array.length > length()) {
				array.length = length();
			}
			return array;
		},
	);

	return new Proxy({}, {
		get(_, p, receiver) {
			if (p === 'length') {
				return length();
			}
			if (typeof p === 'string' && !isNaN(Number(p))) {
				return items()[Number(p)]?.();
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
