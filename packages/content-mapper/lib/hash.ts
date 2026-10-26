const offsetBasis = 2166136261;
const prime = 16777619;

/** The 32-bit FNV-1a hash of the UTF-16 code units of a string, or of a sequence of numbers. */
export function fnv1a(values: string | ArrayLike<number>) {
	let result = offsetBasis;
	for (let index = 0; index < values.length; index++) {
		const value = typeof values === 'string' ? values.charCodeAt(index) : values[index]!;
		result = Math.imul(result ^ value, prime);
	}
	return result >>> 0;
}
