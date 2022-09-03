export class IterableWeakSet<T extends object> extends Set {
	add(el: T) {
		super.add(new WeakRef(el));
		return this;
	}
	forEach(fn: (el: T, el2: T, set: Set<any>) => void) {
		super.forEach(ref => {
			const value = ref.deref();
			if (value) fn(value, value, this);
		});
	}
	*[Symbol.iterator]() {
		for (const ref of super.values()) {
			const value = ref.deref();
			if (value) yield value;
		}
	}
}
