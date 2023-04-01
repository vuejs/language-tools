<script lang="tsx">
import Comp from './Comp.vue'
import GenericComp from './GenericComp.vue'

(<Comp>
  {{ activator: props => props.isActive }}
</Comp>);
(<GenericComp>
  {{ activator: props => props.isActive }}
</GenericComp>);
</script>
