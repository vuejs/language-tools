import { h, defineComponent } from 'vue';
import { MyProps } from './PropDefinitions';

export default defineComponent((props: MyProps) => {
	return () => h('pre', JSON.stringify(props, null, 2));
});
