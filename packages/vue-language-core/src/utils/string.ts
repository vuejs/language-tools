import { hyphenate } from '@vue/shared';

export const SearchTexts = {
	PropsCompletion: (tag: string) => `/* __VLS_.SearchTexts.Completion.Props.${hyphenate(tag)} */`,
	EmitCompletion: (tag: string) => `/* __VLS_.SearchTexts.Completion.Emit.${hyphenate(tag)} */`,
};
