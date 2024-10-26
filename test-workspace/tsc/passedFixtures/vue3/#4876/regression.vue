<script setup>
// @ts-check
import { exactType } from '../../shared';
import Self from './regression.vue';

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
