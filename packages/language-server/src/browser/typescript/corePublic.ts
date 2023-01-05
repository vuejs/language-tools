// WARNING: The script `configurePrerelease.ts` uses a regexp to parse out these values.
// If changing the text in this section, be sure to test `configurePrerelease` too.
export const versionMajorMinor = "4.9";
// The following is baselined as a literal template type without intervention
/** The version of the TypeScript compiler release */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = `${versionMajorMinor}.0-dev`;

/**
 * Type of objects whose values are all of the same type.
 * The `in` and `for-in` operators can *not* be safely used,
 * since `Object.prototype` may be modified by outside code.
 */
export interface MapLike<T> {
	[index: string]: T;
}

export interface SortedReadonlyArray<T> extends ReadonlyArray<T> {
	" __sortedArrayBrand": any;
}

export interface SortedArray<T> extends Array<T> {
	" __sortedArrayBrand": any;
}

/** Common read methods for ES6 Map/Set. */
export interface ReadonlyCollection<K> {
	readonly size: number;
	has(key: K): boolean;
	keys(): Iterator<K>;
}

/** Common write methods for ES6 Map/Set. */
export interface Collection<K> extends ReadonlyCollection<K> {
	delete(key: K): boolean;
	clear(): void;
}

/** ES6 Map interface, only read methods included. */
export interface ReadonlyESMap<K, V> extends ReadonlyCollection<K> {
	get(key: K): V | undefined;
	values(): Iterator<V>;
	entries(): Iterator<[K, V]>;
	forEach(action: (value: V, key: K) => void): void;
}

/**
 * ES6 Map interface, only read methods included.
 */
export interface ReadonlyMap<T> extends ReadonlyESMap<string, T> {
}

/** ES6 Map interface. */
export interface ESMap<K, V> extends ReadonlyESMap<K, V>, Collection<K> {
	set(key: K, value: V): this;
}

/**
 * ES6 Map interface.
 */
export interface Map<T> extends ESMap<string, T> {
}

/* @internal */
export interface MapConstructor {
	// eslint-disable-next-line @typescript-eslint/prefer-function-type
	new <K, V>(iterable?: readonly (readonly [K, V])[] | ReadonlyESMap<K, V>): ESMap<K, V>;
}

/** ES6 Set interface, only read methods included. */
export interface ReadonlySet<T> extends ReadonlyCollection<T> {
	has(value: T): boolean;
	values(): Iterator<T>;
	entries(): Iterator<[T, T]>;
	forEach(action: (value: T, key: T) => void): void;
}

/** ES6 Set interface. */
export interface Set<T> extends ReadonlySet<T>, Collection<T> {
	add(value: T): this;
	delete(value: T): boolean;
}

/* @internal */
export interface SetConstructor {
	// eslint-disable-next-line @typescript-eslint/prefer-function-type
	new <T>(iterable?: readonly T[] | ReadonlySet<T>): Set<T>;
}

/** ES6 Iterator type. */
export interface Iterator<T> {
	next(): { value: T, done?: false; } | { value: void, done: true; };
}

/** Array that is only intended to be pushed to, never read. */
export interface Push<T> {
	push(...values: T[]): void;
        /* @internal*/ readonly length: number;
}

/* @internal */
export type EqualityComparer<T> = (a: T, b: T) => boolean;

/* @internal */
export type Comparer<T> = (a: T, b: T) => Comparison;

/* @internal */
export const enum Comparison {
	LessThan = -1,
	EqualTo = 0,
	GreaterThan = 1
}

/* @internal */
namespace NativeCollections {
	declare const self: any;

	const globals = typeof globalThis !== "undefined" ? globalThis :
		typeof global !== "undefined" ? global :
			typeof self !== "undefined" ? self :
				undefined;

	/**
	 * Returns the native Map implementation if it is available and compatible (i.e. supports iteration).
	 */
	export function tryGetNativeMap(): MapConstructor {
		// Internet Explorer's Map doesn't support iteration, so don't use it.
		const gMap = globals?.Map;
		// eslint-disable-next-line local/no-in-operator
		const constructor = typeof gMap !== "undefined" && "entries" in gMap.prototype && new gMap([[0, 0]]).size === 1 ? gMap : undefined;
		if (!constructor) {
			throw new Error("No compatible Map implementation found.");
		}
		return constructor;
	}

	/**
	 * Returns the native Set implementation if it is available and compatible (i.e. supports iteration).
	 */
	export function tryGetNativeSet(): SetConstructor {
		// Internet Explorer's Set doesn't support iteration, so don't use it.
		const gSet = globals?.Set;
		// eslint-disable-next-line local/no-in-operator
		const constructor = typeof gSet !== "undefined" && "entries" in gSet.prototype && new gSet([0]).size === 1 ? gSet : undefined;
		if (!constructor) {
			throw new Error("No compatible Set implementation found.");
		}
		return constructor;
	}
}

/* @internal */
export const Map = NativeCollections.tryGetNativeMap();
/* @internal */
export const Set = NativeCollections.tryGetNativeSet();
