<script setup lang="ts">
// @experimentalDefinePropProposal=johnsonEdition

const a = defineProp<string>();
const b = defineProp('', true);
const c = defineProp(1, true);
const d = defineProp(1, false);
const e = defineProp<string>(undefined);
const f = defineProp<string>(undefined, true);
const g = defineProp<string>(undefined, false);
</script>
