<script setup lang="ts">
// @experimentalDefinePropProposal=kevinEdition
interface Qux { qux: true; };

defineProp<string>('foo');
defineProp<string>('bar', {
	type: String,
	required: true,
	default: 'bar',
});
defineProp<string | number>('baz', {
	required: true,
	default: () => [1, 2, 3],
});
defineProp<Qux>('qux');
defineProp<boolean>('quux', { default: true });

// infer prop name from variable name
const quuz = defineProp();
</script>
