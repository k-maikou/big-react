import { Action } from 'shared/ReactTypes'

export type Dispatch<State> = (action: Action<State>) => void
export interface Dispatcher {
	useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>]
	useEffect: (callback: () => void | void, deps: any[] | void) => void
}

type CurrentDispatcher = {
	current: Dispatcher | null
}

export const currentDispatcher: CurrentDispatcher = {
	current: null
}

export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current

	if (dispatcher === null) {
		throw new Error('hook只能在函数组件内执行')
	}

	return dispatcher
}

export default currentDispatcher
