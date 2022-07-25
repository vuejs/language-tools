import { h } from "vue";
import { MyProps } from "./PropDefinitions";

export default {
	setup(props: MyProps){
		return () => {
			h('pre', JSON.stringify(props, null, 2));
		}
	}
}