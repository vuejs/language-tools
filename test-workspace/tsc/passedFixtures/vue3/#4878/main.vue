<script setup>
// @ts-check
import { exactType } from '../../shared';
import Self from './main.vue';

const props = defineProps({
	msg: {
		type: String,
		default: null
	},
	msgExact: {
		type: String,
	},
});

exactType((new Self()).$props.msg, props.msgExact);
</script>
