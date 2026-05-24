import { defineComponent, PropType } from 'vue';

export const Loading = defineComponent({
	props: { a: {} as PropType<(arg: string) => void> },
});
