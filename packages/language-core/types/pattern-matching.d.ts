/**
 * RFC 823 pattern types. Match narrows an arm; Subtract keeps the values left
 * for later arms. Objects split by property and arrays by head/tail, so nested
 * unions do not need their entire Cartesian product expanded up front.
 */
type Pattern =
	| ['any']
	| ['literal' | 'value', unknown]
	| ['or', Pattern[]]
	| ['object', [PropertyKey, Pattern][]]
	| ['array', Pattern[], boolean];

declare global {
	type __VLS_MatchPattern<T, P extends Pattern> = Match<T, P>;
	type __VLS_SubtractPattern<T, P extends Pattern> = Subtract<T, P>;
	type __VLS_CheckMatchExhaustive<T> = Exhaustiveness<T>;
}

type IsAny<T> = 0 extends (1 & T) ? true : false;

// Vue can unwrap unknown to {}. Keep that space conservative too.
type IsUnknownLike<T> = [keyof T] extends [never] ? {} extends T ? true : false : false;

type IsUnion<T, C = T> = T extends C ? ([C] extends [T] ? false : true) : never;

// A runtime value with a union type matches one member, so it cannot cover the whole union.
type IsSingleton<T> = IsAny<T> extends true ? false
	: true extends IsUnion<T> ? false
	: T extends string | number | bigint | boolean | null | undefined
		? string extends T ? false : number extends T ? false : bigint extends T ? false : boolean extends T ? false : true
	: false;

type Simplify<T> = { [K in keyof T]: T[K] };

// Retain the original type when refinement changes nothing, including its readonly modifiers.
type ReplaceProperty<T, K extends keyof T, V> = [V] extends [never] ? never
	: {} extends Pick<T, K> ? Simplify<Omit<T, K> & { [Q in K]-?: V }>
	: [T[K]] extends [V] ? [V] extends [T[K]] ? T : Simplify<Omit<T, K> & { [Q in K]-?: V }>
	: Simplify<Omit<T, K> & { [Q in K]-?: V }>;

// Turn the pattern descriptor emitted by vMatch.ts into a positive type constraint.
type PatternType<P> = P extends ['any'] ? unknown
	: P extends ['literal' | 'value', infer V] ? V
	: P extends ['or', infer A extends unknown[]] ? PatternType<A[number]>
	: P extends ['object', infer A extends [PropertyKey, unknown][]] ? { [Q in A[number] as Q[0]]: PatternType<Q[1]> }
	: P extends ['array', infer A extends unknown[], infer R]
		? [...{ [I in keyof A]: PatternType<A[I]> }, ...(R extends true ? unknown[] : [])]
	: never;

// Narrow one union member at a time. Object patterns constrain only their listed properties.
type Match<T, P> = P extends ['any'] ? T
	: IsAny<T> extends true ? PatternType<P>
	: unknown extends T ? PatternType<P>
	: IsUnknownLike<T> extends true ? T & PatternType<P>
	: T extends unknown ? P extends ['literal' | 'value', infer V] ? T & V
		: P extends ['or', infer A extends unknown[]] ? Match<T, A[number]>
		: P extends ['object', infer A extends [PropertyKey, unknown][]]
			? T extends null | undefined ? never : MatchObject<T, A>
		: P extends ['array', infer A extends unknown[], infer R]
			? T extends readonly unknown[] ? T extends unknown[] ? MatchArray<T, A, R> : Readonly<MatchArray<T, A, R>>
			: never
		: never
	: never;

// Presence does not remove undefined from an optional property value.
type RequireProperty<T, K extends keyof T> = {} extends Pick<T, K> ? Simplify<Omit<T, K> & Record<K, T[K]>> : T;

type MatchObject<T, A> = A extends [infer H extends [PropertyKey, unknown], ...infer R]
	? H[0] extends keyof T ? H[1] extends ['any'] ? MatchObject<RequireProperty<T, H[0]>, R>
		: MatchObject<ReplaceProperty<T, H[0], Match<T[H[0]], H[1]>>, R>
	: MatchObject<T & { [K in H[0]]: PatternType<H[1]> }, R>
	: T;

type MatchArray<T extends readonly unknown[], A extends unknown[], R> = A extends [infer H, ...infer Tail]
	? T extends readonly [] ? never
	: T extends readonly [infer V, ...infer Rest] ? Prepend<Match<V, H>, MatchArray<Rest, Tail, R>>
	: T extends readonly [(infer V)?, ...infer Rest] ? Prepend<Match<T[0], H>, MatchArray<Rest, Tail, R>>
	: never
	: R extends true ? T
	: [] extends T ? []
	: never;

type Prepend<H, T> = [H] extends [never] ? never : T extends readonly unknown[] ? [H, ...T] : never;

// Only unguarded arms call this helper. Unknown and open primitive spaces stay uncovered.
type Subtract<T, P> = [T] extends [never] ? never : P extends ['any'] ? never
: IsAny<T> extends true ? T
: unknown extends T ? T
: IsUnknownLike<T> extends true ? T
: string extends T ? T
: number extends T ? T
: bigint extends T ? T
: P extends ['or', infer A extends unknown[]] ? SubtractAlternatives<T, A>
: T extends unknown ? P extends ['literal', infer V] ? Exclude<T, V>
	: P extends ['value', infer V] ? IsSingleton<V> extends true ? Exclude<T, V> : T
	: P extends ['object', infer A extends [PropertyKey, unknown][]]
		? T extends null | undefined ? T : SubtractObject<T, A>
	: P extends ['array', infer A extends unknown[], infer R] ? T extends readonly unknown[] ? SubtractArray<T, A, R> : T
	: T
: never;

type SubtractAlternatives<T, A> = A extends [infer H, ...infer R] ? SubtractAlternatives<Subtract<T, H>, R> : T;

// The remaining object space has three cases: the key is absent, its pattern fails,
// or its pattern matches and a later property fails.
type SubtractObject<T, A> = [T] extends [never] ? never
	: A extends [infer H extends [PropertyKey, unknown], ...infer R] ? H[0] extends keyof T ? H[1] extends ['any'] ?
					| ({} extends Pick<T, H[0]> ? Omit<T, H[0]> & { [K in H[0]]?: never } : never)
					| SubtractObject<RequireProperty<T, H[0]>, R>
			:
				| ({} extends Pick<T, H[0]> ? Omit<T, H[0]> & { [K in H[0]]?: never } : never)
				| ReplaceProperty<T, H[0], Subtract<T[H[0]], H[1]>>
				| SubtractObject<ReplaceProperty<T, H[0], Match<T[H[0]], H[1]>>, R>
		: T
	: never;

// Split a tuple or array into its head and tail. Exact-length patterns also leave longer arrays.
type SubtractArray<T extends readonly unknown[], A extends unknown[], R> = A extends [infer H, ...infer Tail]
	? T extends readonly [] ? T
	: T extends readonly [infer V, ...infer Rest] ?
			| Prepend<Subtract<V, H>, Rest>
			| Prepend<Match<V, H>, SubtractArray<Rest, Tail, R>>
	: T extends readonly [(infer V)?, ...infer Rest] ?
			| []
			| Prepend<Subtract<T[0], H>, Rest>
			| Prepend<Match<T[0], H>, SubtractArray<Rest, Tail, R>>
	: T
	: R extends true ? never
	: T extends readonly [] ? never
	: T extends readonly [unknown, ...unknown[]] ? T
	: T extends readonly [(infer V)?, ...infer Rest] ? [T[0], ...Rest]
	: never;

// Diagnostic examples must be valid pattern syntax. Fall back to _ when a literal needs escaping.
type FormatPattern<T> = T extends string
	? string extends T ? '_' : T extends `${string}${"'" | '"' | '\\' | '\n' | '\r'}${string}` ? '_' : `'${T}'`
	: T extends bigint ? bigint extends T ? '_' : `${T}n`
	: T extends number ? number extends T ? '_' : `${T}`
	: T extends boolean | null | undefined ? `${T}`
	: T extends readonly unknown[] ? `[${FormatTuple<T>}]`
	: '_';

type FormatTuple<T extends readonly unknown[]> = T extends readonly [] ? ''
	: T extends readonly [infer H, ...infer R] ? `${FormatPattern<H>}${R extends [] ? '' : `, ${FormatTuple<R>}`}`
	: '...';

type MissingPatternMessage<T> = IsAny<T> extends true ? 'Add an unguarded v-when="_" to prove coverage.'
	: T extends string ? string extends T ? 'An open string requires an unguarded catch-all.'
		: T extends `${string}${"'" | '"' | '\\' | '\n' | '\r'}${string}` ? 'Add an unguarded v-when="_".'
		: `Missing v-when="'${T}'".`
	: T extends bigint ? bigint extends T ? 'An open bigint requires an unguarded catch-all.' : `Missing v-when="${T}n".`
	: T extends number ? number extends T ? 'An open number requires an unguarded catch-all.' : `Missing v-when="${T}".`
	: T extends boolean | null | undefined ? `Missing v-when="${T}".`
	: T extends readonly unknown[] ? `Missing v-when="[${FormatTuple<T>}]".`
	: 'Coverage cannot be proven. Add missing structural arms or an unguarded v-when="_".';

// A nonempty remaining space produces an error mapped to the v-match subject.
type Exhaustiveness<T> = [T] extends [never] ? true : {
	'Non-exhaustive v-match': T;
} & { [K in MissingPatternMessage<T>]: never };

export {};
