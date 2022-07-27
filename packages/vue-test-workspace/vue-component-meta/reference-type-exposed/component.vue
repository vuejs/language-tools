<script setup lang="ts">
import { ref } from 'vue';

const counter = ref('foo')

defineExpose({
	/**
	 * a counter string
	 */
	counter
});
</script>