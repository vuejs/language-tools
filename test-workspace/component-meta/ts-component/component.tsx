import { defineComponent } from 'vue';
import type { MyProps } from './PropDefinitions';

export default defineComponent((props: MyProps) => {
	return () => <pre>
		{JSON.stringify(props, null, 2)}
	</pre>;
});
