<script setup>
import { ref } from 'vue'

const a = 1
const b = ref(2)

defineExpose({
	a,
	b
})
</script>
