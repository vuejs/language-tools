import type * as CompilerDOM from '@vue/compiler-dom';
import type { Code, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { InlayHintInfo } from '../inlayHints';
import { endOfLine, newLine, wrapWith } from '../utils';
import type { TemplateCodegenOptions } from './index';

export type TemplateCodegenContext = ReturnType<typeof createTemplateCodegenContext>;

/**
 * Creates and returns a Context object used for generating type-checkable TS code
 * from the template section of a .vue file.
 *
 * ## Implementation Notes for supporting `@vue-ignore`, `@vue-expect-error`, and `@vue-skip` directives.
 *
 * Vue language tooling supports a number of directives for suppressing diagnostics within
 * Vue templates (https://github.com/vuejs/language-tools/pull/3215)
 *
 * Here is an overview for how support for how @vue-expect-error is implemented within this file
 * (@vue-expect-error is the most complicated directive to support due to its behavior of raising
 * a diagnostic when it is annotating a piece of code that doesn't actually have any errors/warning/diagnostics).
 *
 * Given .vue code:
 * 
 * ```vue
 *   <script setup lang="ts">
 *     defineProps<{
 *       knownProp1: string,
 *       knownProp2: string,
 *       knownProp3: string,
 *       knownProp4: string,
 *       knownProp5_will_trigger_unused_expect_error: string,
 *       knownProp6: string,
 *     }>()
 *   </script>
 *   
 *   <template>
 *     {{knownProp1}}
 *     {{error_unknownProp}} <!-- ERROR: Property 'error_unknownProp' does not exist on type [...] -->
 *     {{knownProp2}}
 *     <!-- @vue-expect-error this suppresses an Unknown Property Error -->
 *     {{ suppressed_error_unknownProp }}
 *     {{knownProp4}}
 *     <!-- @vue-expect-error This will trigger Unused '@ts-expect-error' directive.ts(2578) -->
 *     {{ knownProp5_will_trigger_unused_expect_error }}
 *     {{knownProp6}}
 *   </template>
 * ```
 * 
 * The above code should raise two diagnostics:
 * 
 * 1. Property 'error_unknownProp' does not exist on type [...]
 * 2. Unused '@ts-expect-error' directive.ts(2578) -- this is the bottom `@vue-expect-error` directive
 *    that covers code that doesn't actually raise an error -- note that all `@vue-...` directives
 *    will ultimately translate into `@ts-...` diagnostics.
 * 
 * The above code will produce the following type-checkable TS code (note: omitting asterisks
 * to prevent VSCode syntax double-greying out double-commented code).
 * 
 * ```ts
          (__VLS_ctx.knownProp1);
          (__VLS_ctx.error_unknownProp); // ERROR: Property 'error_unknownProp' does not exist on type [...]
          (__VLS_ctx.knownProp2);
          // @vue-expect-error start
          ( __VLS_ctx.suppressed_error_unknownProp );
          // @ts-expect-error __VLS_TS_EXPECT_ERROR
          ;
          // @vue-expect-error end of INTERPOLATION
          (__VLS_ctx.knownProp4);
          // @vue-expect-error start
          ( __VLS_ctx.knownProp5_will_trigger_unused_expect_error );
          // @ts-expect-error __VLS_TS_EXPECT_ERROR
          ;
          // @vue-expect-error end of INTERPOLATION
          (__VLS_ctx.knownProp6);
 * ```
 *
 * In the generated code, there are actually 3 diagnostic errors that'll be raised in the first
 * pass on this generated code (but through cleverness described below, not all of them will be
 * propagated back to the original .vue file):
 * 
 * 1. Property 'error_unknownProp' does not exist on type [...]
 * 2. Unused '@ts-expect-error' directive.ts(2578) from the 1st `@ts-expect-error __VLS_TS_EXPECT_ERROR`
 * 3. Unused '@ts-expect-error' directive.ts(2578) from the 2nd `@ts-expect-error __VLS_TS_EXPECT_ERROR`
 * 
 * Be sure to pay careful attention to the mixture of `@vue-expect-error` and `@ts-expect-error`;
 * Within the TS file, the only "real" directives recognized by TS are going to be prefixed with `@ts-`;
 * any `@vue-`-prefixed directives in the comments are only for debugging purposes.
 *
 * As mentioned above, there are 3 diagnostics errors that'll be generated for the above code, but
 * only 2 should be propagated back to the original .vue file.
 * 
 * (The reason we structure things this way is somewhat complicated, but in short it allows us
 * to lean on TS as much as possible to generate actual `unused @ts-expect-error directive` errors
 * while covering a number of edge cases.)
 * 
 * So, we need a way to dynamically decide whether each of the `@ts-expect-error __VLS_TS_EXPECT_ERROR`
 * directives should be reported as an unused directive or not.
 * 
 * To do this, we'll make use of the `shouldReport` callback that'll optionally be provided to the
 * `verification` property of the `CodeInformation` object attached to the mapping between source .vue
 * and generated .ts code. The `verification` property determines whether "verification" (which includes
 * semantic diagnostics) should be performed on the generated .ts code, and `shouldReport`, if provided,
 * can be used to determine whether a given diagnostic should be reported back "upwards" to the original
 * .vue file or not.
 * 
 * See the comments in the code below for how and where we use this hook to keep track of whether
 * an error/diagnostic was encountered for a region of code covered by a `@vue-expect-error` directive,
 * and additionally how we use that to determine whether to propagate diagnostics back upward.
 */
export function createTemplateCodegenContext(options: Pick<TemplateCodegenOptions, 'scriptSetupBindingNames' | 'edited'>) {
	let ignoredError = false;
	let expectErrorToken: {
		errors: number;
		node: CompilerDOM.CommentNode;
	} | undefined;
	let lastGenericComment: {
		content: string;
		offset: number;
	} | undefined;
	let variableId = 0;

	function resolveCodeFeatures(features: VueCodeInformation) {
		if (features.verification) {
			if (ignoredError) {
				// This mapping is covered by a @vue-ignore directive, so disable
				// any diagnostics from being reported by ensuring `verification` is false.
				return {
					...features,
					verification: false,
				};
			}
			if (expectErrorToken) {
				// This mapping is covered by a @vue-expect-error directive, so, similar to
				// the @vue-ignore case, we want to disable verification (unless `shouldReport`
				// is already defined) by defining a `shouldReport` that:
				// 1. returns false
				// 2. also keeps track that an error/warning/diagnostic was encountered within
				//    the node covered by `@vue-expect-error`. This will be used at a later point
				//    (see `resetDirectiveComments`) to make sure we don't report an "unused ts-expect-error" diagnostic.
				const token = expectErrorToken;
				return {
					...features,
					verification: {
						shouldReport: () => {
							token.errors++;
							return false;
						},
					},
				};
			}
		}
		return features;
	}

	const hoistVars = new Map<string, string>();
	const localVars = new Map<string, number>();
	const specialVars = new Set<string>();
	const accessExternalVariables = new Map<string, Set<number>>();
	const slots: {
		name: string;
		offset?: number;
		tagRange: [number, number];
		nodeLoc: any;
		propsVar: string;
	}[] = [];
	const dynamicSlots: {
		expVar: string;
		propsVar: string;
	}[] = [];
	const blockConditions: string[] = [];
	const scopedClasses: {
		source: string;
		className: string;
		offset: number;
	}[] = [];
	const emptyClassOffsets: number[] = [];
	const inlayHints: InlayHintInfo[] = [];
	const bindingAttrLocs: CompilerDOM.SourceLocation[] = [];
	const inheritedAttrVars = new Set<string>();
	const templateRefs = new Map<string, {
		varName: string;
		offset: number;
	}>();

	return {
		codeFeatures: new Proxy(codeFeatures, {
			get(target, key: keyof typeof codeFeatures) {
				const data = target[key];
				return resolveCodeFeatures(data);
			},
		}),
		resolveCodeFeatures,
		slots,
		dynamicSlots,
		specialVars,
		accessExternalVariables,
		lastGenericComment,
		blockConditions,
		scopedClasses,
		emptyClassOffsets,
		inlayHints,
		bindingAttrLocs,
		inheritedAttrVars,
		templateRefs,
		currentComponent: undefined as {
			ctxVar: string;
			used: boolean;
		} | undefined,
		singleRootElType: undefined as string | undefined,
		singleRootNode: undefined as CompilerDOM.ElementNode | undefined,
		accessExternalVariable(name: string, offset?: number) {
			let arr = accessExternalVariables.get(name);
			if (!arr) {
				accessExternalVariables.set(name, arr = new Set());
			}
			if (offset !== undefined) {
				arr.add(offset);
			}
		},
		hasLocalVariable: (name: string) => {
			return !!localVars.get(name);
		},
		addLocalVariable: (name: string) => {
			localVars.set(name, (localVars.get(name) ?? 0) + 1);
		},
		removeLocalVariable: (name: string) => {
			localVars.set(name, localVars.get(name)! - 1);
		},
		getInternalVariable: () => {
			return `__VLS_${variableId++}`;
		},
		getHoistVariable: (originalVar: string) => {
			let name = hoistVars.get(originalVar);
			if (name === undefined) {
				hoistVars.set(originalVar, name = `__VLS_${variableId++}`);
			}
			return name;
		},
		generateHoistVariables: function* () {
			// trick to avoid TS 4081 (#5186)
			for (const [originalVar, hoistVar] of hoistVars) {
				yield `var ${hoistVar} = ${originalVar}${endOfLine}`;
			}
		},
		ignoreError: function* (): Generator<Code> {
			if (!ignoredError) {
				ignoredError = true;
				yield `// @vue-ignore start${newLine}`;
			}
		},
		expectError: function* (prevNode: CompilerDOM.CommentNode): Generator<Code> {
			if (!expectErrorToken) {
				expectErrorToken = {
					errors: 0,
					node: prevNode,
				};
				yield `// @vue-expect-error start${newLine}`;
			}
		},
		resetDirectiveComments: function* (endStr: string): Generator<Code> {
			if (expectErrorToken) {
				const token = expectErrorToken;
				yield* wrapWith(
					expectErrorToken.node.loc.start.offset,
					expectErrorToken.node.loc.end.offset,
					{
						verification: {
							shouldReport: () => token.errors === 0,
						},
					},
					`// @ts-expect-error __VLS_TS_EXPECT_ERROR`
				);
				yield `${newLine}${endOfLine}`;
				expectErrorToken = undefined;
				yield `// @vue-expect-error ${endStr}${newLine}`;
			}
			if (ignoredError) {
				ignoredError = false;
				yield `// @vue-ignore ${endStr}${newLine}`;
			}
		},
		generateAutoImportCompletion: function* (): Generator<Code> {
			if (!options.edited) {
				return;
			}
			const all = [...accessExternalVariables.entries()];
			if (!all.some(([_, offsets]) => offsets.size)) {
				return;
			}
			yield `// @ts-ignore${newLine}`; // #2304
			yield `[`;
			for (const [varName, offsets] of all) {
				for (const offset of offsets) {
					if (options.scriptSetupBindingNames.has(varName)) {
						// #3409
						yield [
							varName,
							'template',
							offset,
							{
								...codeFeatures.additionalCompletion,
								...codeFeatures.withoutHighlightAndCompletionAndNavigation,
							},
						];
					}
					else {
						yield [
							varName,
							'template',
							offset,
							codeFeatures.additionalCompletion,
						];
					}
					yield `,`;
				}
				offsets.clear();
			}
			yield `]${endOfLine}`;
		}
	};
}
