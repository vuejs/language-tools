/**
 * RFC 823 symbolic space subtraction. Object products are split one property
 * at a time; arrays are split into empty/nonempty tails. No Cartesian product
 * is materialized up front. Unknown spaces remain uncovered conservatively.
 * Emitted only for templates containing v-match.
 */
export const matchTypes = `
type __VLS_PMAny<T> = 0 extends (1 & T) ? true : false;
type __VLS_PMUnknown<T> = [keyof T] extends [never] ? {} extends T ? true : false : false;
type __VLS_PMUnion<T, C = T> = T extends C ? ([C] extends [T] ? false : true) : never;
type __VLS_PMSingle<T> = __VLS_PMAny<T> extends true ? false
 : true extends __VLS_PMUnion<T> ? false
 : T extends string | number | bigint | boolean | null | undefined
 ? string extends T ? false : number extends T ? false : bigint extends T ? false : boolean extends T ? false : true
 : false;
type __VLS_PMPretty<T> = { [K in keyof T]: T[K] };
type __VLS_PMReplace<T, K extends keyof T, V> = [V] extends [never] ? never
 : {} extends Pick<T, K> ? __VLS_PMPretty<Omit<T, K> & { [Q in K]-?: V }>
 : [T[K]] extends [V] ? [V] extends [T[K]] ? T : __VLS_PMPretty<Omit<T, K> & { [Q in K]-?: V }>
 : __VLS_PMPretty<Omit<T, K> & { [Q in K]-?: V }>;
type __VLS_PMDesc<P> = P extends ['any'] ? unknown
 : P extends ['literal' | 'value', infer V] ? V
 : P extends ['or', infer A extends unknown[]] ? __VLS_PMDesc<A[number]>
 : P extends ['object', infer A extends [PropertyKey, unknown][]] ? { [Q in A[number] as Q[0]]: __VLS_PMDesc<Q[1]> }
 : P extends ['array', infer A extends unknown[], infer R] ? [...{ [I in keyof A]: __VLS_PMDesc<A[I]> }, ...(R extends true ? unknown[] : [])]
 : never;
type __VLS_PMMatch<T, P> = P extends ['any'] ? T
 : __VLS_PMAny<T> extends true ? __VLS_PMDesc<P>
 : unknown extends T ? __VLS_PMDesc<P>
 : __VLS_PMUnknown<T> extends true ? T & __VLS_PMDesc<P>
 : T extends unknown ? P extends ['literal' | 'value', infer V] ? T & V
 : P extends ['or', infer A extends unknown[]] ? __VLS_PMMatch<T, A[number]>
 : P extends ['object', infer A extends [PropertyKey, unknown][]] ? T extends null | undefined ? never : __VLS_PMObjectMatch<T, A>
 : P extends ['array', infer A extends unknown[], infer R] ? T extends readonly unknown[] ? T extends unknown[] ? __VLS_PMArrayMatch<T, A, R> : Readonly<__VLS_PMArrayMatch<T, A, R>> : never
 : never : never;
type __VLS_PMRequire<T, K extends keyof T> = {} extends Pick<T, K> ? __VLS_PMPretty<Omit<T, K> & Record<K, T[K]>> : T;
type __VLS_PMObjectMatch<T, A> = A extends [infer H extends [PropertyKey, unknown], ...infer R]
 ? H[0] extends keyof T ? H[1] extends ['any'] ? __VLS_PMObjectMatch<__VLS_PMRequire<T, H[0]>, R> : __VLS_PMObjectMatch<__VLS_PMReplace<T, H[0], __VLS_PMMatch<T[H[0]], H[1]>>, R> : __VLS_PMObjectMatch<T & { [K in H[0]]: __VLS_PMDesc<H[1]> }, R>
 : T;
type __VLS_PMArrayMatch<T extends readonly unknown[], A extends unknown[], R> = A extends [infer H, ...infer Tail]
 ? T extends readonly [] ? never
 : T extends readonly [infer V, ...infer Rest] ? __VLS_PMPair<__VLS_PMMatch<V, H>, __VLS_PMArrayMatch<Rest, Tail, R>>
 : T extends readonly [(infer V)?, ...infer Rest] ? __VLS_PMPair<__VLS_PMMatch<T[0], H>, __VLS_PMArrayMatch<Rest, Tail, R>>
 : never
 : R extends true ? T : [] extends T ? [] : never;
type __VLS_PMPair<H, T> = [H] extends [never] ? never : T extends readonly unknown[] ? [H, ...T] : never;
type __VLS_PMSubtract<T, P> = [T] extends [never] ? never : P extends ['any'] ? never
 : __VLS_PMAny<T> extends true ? T : unknown extends T ? T : __VLS_PMUnknown<T> extends true ? T
 : string extends T ? T : number extends T ? T : bigint extends T ? T
 : P extends ['or', infer A extends unknown[]] ? __VLS_PMSubtractMany<T, A>
 : T extends unknown ? P extends ['literal', infer V] ? Exclude<T, V>
 : P extends ['value', infer V] ? __VLS_PMSingle<V> extends true ? Exclude<T, V> : T
 : P extends ['object', infer A extends [PropertyKey, unknown][]] ? T extends null | undefined ? T : __VLS_PMObjectSubtract<T, A>
 : P extends ['array', infer A extends unknown[], infer R] ? T extends readonly unknown[] ? __VLS_PMArraySubtract<T, A, R> : T
 : T : never;
type __VLS_PMSubtractMany<T, A> = A extends [infer H, ...infer R] ? __VLS_PMSubtractMany<__VLS_PMSubtract<T, H>, R> : T;
type __VLS_PMObjectSubtract<T, A> = [T] extends [never] ? never
 : A extends [infer H extends [PropertyKey, unknown], ...infer R]
 ? H[0] extends keyof T
 ? H[1] extends ['any'] ? ({} extends Pick<T, H[0]> ? Omit<T, H[0]> & { [K in H[0]]?: never } : never) | __VLS_PMObjectSubtract<__VLS_PMRequire<T, H[0]>, R>
 : ({} extends Pick<T, H[0]> ? Omit<T, H[0]> & { [K in H[0]]?: never } : never)
   | __VLS_PMReplace<T, H[0], __VLS_PMSubtract<T[H[0]], H[1]>>
   | __VLS_PMObjectSubtract<__VLS_PMReplace<T, H[0], __VLS_PMMatch<T[H[0]], H[1]>>, R>
 : T
 : never;
type __VLS_PMArraySubtract<T extends readonly unknown[], A extends unknown[], R> = A extends [infer H, ...infer Tail]
 ? T extends readonly [] ? T
 : T extends readonly [infer V, ...infer Rest]
 ? __VLS_PMPair<__VLS_PMSubtract<V, H>, Rest> | __VLS_PMPair<__VLS_PMMatch<V, H>, __VLS_PMArraySubtract<Rest, Tail, R>>
 : T extends readonly [(infer V)?, ...infer Rest]
 ? [] | __VLS_PMPair<__VLS_PMSubtract<T[0], H>, Rest> | __VLS_PMPair<__VLS_PMMatch<T[0], H>, __VLS_PMArraySubtract<Rest, Tail, R>>
 : T
 : R extends true ? never : T extends readonly [] ? never : T extends readonly [unknown, ...unknown[]] ? T
 : T extends readonly [(infer V)?, ...infer Rest] ? [T[0], ...Rest] : never;
type __VLS_PMAtom<T> = T extends string ? string extends T ? '_' : T extends \`\${string}\${"'" | '"' | "\\\\" | "\\n" | "\\r"}\${string}\` ? '_' : \`'\${T}'\`
 : T extends bigint ? bigint extends T ? '_' : \`\${T}n\`
 : T extends number ? number extends T ? '_' : \`\${T}\`
 : T extends boolean | null | undefined ? \`\${T}\`
 : T extends readonly unknown[] ? \`[\${__VLS_PMTuple<T>}]\` : '_';
type __VLS_PMTuple<T extends readonly unknown[]> = T extends readonly [] ? ''
 : T extends readonly [infer H, ...infer R] ? \`\${__VLS_PMAtom<H>}\${R extends [] ? '' : \`, \${__VLS_PMTuple<R>}\`}\` : '...';
type __VLS_PMHint<T> = __VLS_PMAny<T> extends true ? 'Add an unguarded v-when="_" to prove coverage.'
 : T extends string ? string extends T ? 'An open string requires an unguarded catch-all.'
 : T extends \`\${string}\${"'" | '"' | "\\\\" | "\\n" | "\\r"}\${string}\` ? 'Add an unguarded v-when="_".'
 : \`Missing v-when="'\${T}'".\`
 : T extends bigint ? bigint extends T ? 'An open bigint requires an unguarded catch-all.' : \`Missing v-when="\${T}n".\`
 : T extends number ? number extends T ? 'An open number requires an unguarded catch-all.' : \`Missing v-when="\${T}".\`
 : T extends boolean | null | undefined ? \`Missing v-when="\${T}".\`
 : T extends readonly unknown[] ? \`Missing v-when="[\${__VLS_PMTuple<T>}]".\`
 : 'Coverage cannot be proven. Add missing structural arms or an unguarded v-when="_".';
type __VLS_PMAssert<T> = [T] extends [never] ? true : {
 'Non-exhaustive v-match': T
} & { [K in __VLS_PMHint<T>]: never };
`;
