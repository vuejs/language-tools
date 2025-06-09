import { defineComponent, h } from 'vue';
import { type MyProps } from './PropDefinitions';

export default defineComponent((props: MyProps) => {
	return () => h('pre', JSON.stringify(props, null, 2));
});
