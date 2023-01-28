import { Dispatch } from 'react/src/currentDispatcher'
import { Action } from 'shared/ReactTypes'
import { Lane } from './fiberLanes'

export interface Update<State> {
	action: Action<State>
	lane: Lane
	next: Update<any> | null
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null
	}
	dispatch: Dispatch<State> | null
}

export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null
	}
}

export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>
}

// 往updateQueue增加update
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending
	if (pending === null) {
		update.next = update
	} else {
		update.next = pending.next
		pending.next = update
	}

	updateQueue.shared.pending = update
}

// 调用updateQueue
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	}

	if (pendingUpdate !== null) {
		const first = pendingUpdate.next
		let pending = pendingUpdate.next as Update<any>

		do {
			const updateLane = pending.lane

			if (updateLane === renderLane) {
				const action = pending.action

				if (action instanceof Function) {
					// baseState 1 update (x) => 4x -> memoizedState = 4
					baseState = action(baseState)
				} else {
					// baseState 1 update 2 -> memoizedState = 2
					baseState = action
				}
			} else {
				if (__DEV__) {
					console.error('不应该进入updateLane !== renderLane这个逻辑')
				}
			}

			pending = pending.next as Update<any>
		} while (pending !== first)
	}

	result.memoizedState = baseState
	return result
}
