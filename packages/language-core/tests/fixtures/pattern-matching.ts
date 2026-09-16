import '../../types/pattern-matching';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type Result = { kind: 'ok'; value: string } | { kind: 'error'; error: Error };
type Success = ['object', [['kind', ['literal', 'ok']]]];
type Remaining = __VLS_SubtractPattern<Result, Success>;

export type Cases = [
	Assert<Equal<__VLS_MatchPattern<Result, Success>, { kind: 'ok'; value: string }>>,
	Assert<Equal<Remaining, { kind: 'error'; error: Error }>>,
	Assert<Equal<__VLS_MatchPattern<Remaining, Success>, never>>,
	Assert<Equal<__VLS_SubtractPattern<Remaining, ['any']>, never>>,
	Assert<
		Equal<__VLS_MatchPattern<{ value?: string }, ['object', [['value', ['any']]]]>, { value: string | undefined }>
	>,
	Assert<Equal<__VLS_SubtractPattern<boolean, ['literal', true]>, false>>,
	Assert<Equal<__VLS_SubtractPattern<'a' | 'b', ['value', 'a' | 'b']>, 'a' | 'b'>>,
];

export const exhaustive: __VLS_CheckMatchExhaustive<never> = true;
// @ts-expect-error A remaining error arm is not exhaustive.
export const missing: __VLS_CheckMatchExhaustive<Remaining> = true;
// @ts-expect-error Descriptor tags must match the compiler's pattern grammar.
export type InvalidDescriptor = __VLS_MatchPattern<string, ['typo']>;
