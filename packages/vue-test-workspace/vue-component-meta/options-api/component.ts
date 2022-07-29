import { defineComponent, h } from "vue"

const logger = {
  mounted() {
    console.log('mounted')
  },
}

interface SubmitPayload{
	/**
	 * email of user
	 */
	email: string
	/**
	 * password of same user
	 */
	password: string
}

/**
 * The only true button.
 * @example ../../../docs/Button.md
 * @example ../../../docs/ButtonConclusion.md
 * @displayName Best Button
 */
export default defineComponent({
	emits: {
		// Validate submit event
    submit: ({ email, password }: SubmitPayload) => {
      if (email && password) {
        return true
      } else {
        console.warn('Invalid submit event payload!')
        return false
      }
    }
	},
  props: {
		/**
     * A test for default number
     */
		propNumberDefault: {
      type: Number,
      default: 4
    },
    /**
     * A test for default function Object
     */
    propObjectDefault: {
      type: Object,
      default: () => ({})
    },
    /**
     * A test for default function Array
     */
    propArrayDefault: {
      type: Array,
      default: () => [1, 2, 3]
    },
    /**
     * A test for default function more complex
     */
    propComplexDefault: {
      type: Array,
      default: () => {
        if (typeof logger.mounted === 'function') {
          return []
        } else {
          return undefined
        }
      }
    },
  },
  methods: {
    onMyClick() {
      console.log('clicked')
    }
  },
	render(){
		return h('div', this.propComplexDefault.toString())
	}
})