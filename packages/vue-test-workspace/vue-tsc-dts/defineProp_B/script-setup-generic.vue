<script setup lang="ts" generic="T">
// @experimentalDefinePropProposal=johnsonEdition

const a = defineProp<T>();
const b = defineProp<T>(undefined);
const c = defineProp<T>(undefined, false);
const d = defineProp<T>(undefined, true);
</script>
