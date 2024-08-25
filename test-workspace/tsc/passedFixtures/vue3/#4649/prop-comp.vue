<script lang="ts" setup>
// @experimentalDefinePropProposal=kevinEdition
import { exactType } from '../../shared';

const fooAlias = defineProp('foo', {
	type: Number
});

const barAlias = defineProp('bar', {
	type: Number,
	default: 1
});

const bazAlias = defineProp('baz', {
	default: 1
});

exactType(fooAlias.value, {} as number | undefined);
exactType(barAlias.value, {} as number);
exactType(bazAlias.value, {} as number);
</script>
