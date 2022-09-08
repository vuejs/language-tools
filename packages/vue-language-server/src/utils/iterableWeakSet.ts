export class IterableWeakSet<T extends object> extends Set {

	adds = new WeakSet();

	add(el: T) {
		if (!this.adds.has(el)) {
			this.adds.add(el);
			super.add(new WeakRef(el));
		}
		return this;
	}
	forEach(fn: (el: T, el2: T, set: Set<any>) => void) {
		super.forEach(ref => {
			const value = ref.deref();
			if (value) fn(value, value, this);
		});
	}
	get size() {
		let _size = 0;
		super.forEach(ref => {
			const value = ref.deref();
			if (value) _size++;
		});
		return _size;
	}
	*[Symbol.iterator]() {
		for (const ref of super.values()) {
			const value = ref.deref();
			if (value) yield value;
		}
	}
}
