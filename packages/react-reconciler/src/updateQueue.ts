import { Action } from 'shared/ReactTypes'

export interface Update<State> {
	action: Action<State>
}

export const createUpdate = <State>(action: Action<State>): Update<State> => {
	return {
		action
	}
}
