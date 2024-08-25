<script lang="ts" setup>
import { exactType } from '../../shared';

const modelAlias = defineModel({
	type: Number
});
const fooAlias = defineModel('foo', {
	type: Number,
	default: 1
});
const barAlias = defineModel('bar', {
	default: 1
});

exactType(modelAlias.value, {} as number | undefined);
exactType(fooAlias.value, {} as number);
exactType(barAlias.value, {} as number);
</script>
