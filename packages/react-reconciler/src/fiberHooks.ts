import { Dispatcher, Dispatch } from 'react/src/currentDispatcher'
import internals from 'shared/internals'
import { Action } from 'shared/ReactTypes'
import { FiberNode } from './fiber'
import { Flags, PassiveEffect } from './fiberFlags'
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes'
import { HookHasEffect, Passive } from './hookEffectTags'
import {
	createUpdate,
	enqueueUpdate,
	createUpdateQueue,
	processUpdateQueue,
	UpdateQueue,
	Update
} from './updateQueue'
import { scheduleUpdateOnFiber } from './workLoop'

// 保存正在执行的workInProgress
let currentlyRenderingFiber: FiberNode | null = null
let workInProgressHook: Hook | null = null
let currentHook: Hook | null = null
let renderLane: Lane = NoLane

const { currentDispatcher } = internals

type EffectCallback = () => void
type EffectDeps = any[] | null

interface Hook {
	memoizedState: any
	updateQueue: unknown
	next: Hook | null
	baseState: any
	baseQueue: Update<any> | null
}

export interface Effect {
	tag: Flags
	create: EffectCallback | void
	destroy: EffectCallback | void
	deps: EffectDeps
	next: Effect | null
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect
}

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect
}

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值操作
	currentlyRenderingFiber = wip
	// 重置 hooks链表
	wip.memoizedState = null
	// 重置 effect链表
	wip.updateQueue = null
	renderLane = lane

	const current = wip.alternate

	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount
	}

	const Component = wip.type
	const props = wip.pendingProps
	const children = Component(props)

	// render完后的重置操作
	currentlyRenderingFiber = null
	workInProgressHook = null
	currentHook = null
	renderLane = NoLane

	return children
}

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const hook = mountWorkInProgress()
	const nextDeps = deps === undefined ? null : deps

	;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect

	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	)
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const hook = updateWorkInProgress()
	const nextDeps = deps === undefined ? null : deps
	let destroy: EffectCallback | void

	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState as Effect
		destroy = prevEffect.destroy

		if (nextDeps !== null) {
			// 获取到上一次的deps
			const prevDeps = prevEffect.deps
			// 浅比较依赖 上一次的deps和现在的deps进行比较，看依赖有没有发生变化
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps)
				return
			}
		}
		// 浅比较后不相等
		;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect
		hook.memoizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destroy,
			nextDeps
		)
	}
}

// 浅比较方法
function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (nextDeps === null || prevDeps === null) {
		return false
	}
	for (let i = 0; i < nextDeps.length && i < prevDeps.length; i++) {
		if (Object.is(nextDeps[i], prevDeps[i])) {
			continue
		}
		return false
	}
	return true
}

// 往updateQueue插入effect
function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	}
	const fiber = currentlyRenderingFiber as FiberNode
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>

	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue()
		fiber.updateQueue = updateQueue
		effect.next = effect
		updateQueue.lastEffect = effect
	} else {
		// 插入effect的操作
		const lastEffect = updateQueue.lastEffect

		if (lastEffect === null) {
			effect.next = effect
			updateQueue.lastEffect = effect
		} else {
			const firstEffect = lastEffect.next
			lastEffect.next = effect
			effect.next = firstEffect
			updateQueue.lastEffect = effect
		}
	}

	return effect
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>
	updateQueue.lastEffect = null
	return updateQueue
}

function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = updateWorkInProgress()

	// 计算新state的逻辑
	const queue = hook.updateQueue as UpdateQueue<State>
	const baseState = hook.baseState
	const pending = queue.shared.pending
	const current = currentHook as Hook

	let baseQueue = current.baseQueue

	if (pending !== null) {
		if (baseQueue !== null) {
			// 把pending baseQueue合并成一条完整的环状链表
			const baseFirst = baseQueue.next
			const pendingFirst = pending.next

			baseQueue.next = pendingFirst
			pending.next = baseFirst
		}
		baseQueue = pending
		// 保存在current中
		current.baseQueue = pending
		queue.shared.pending = null

		if (baseQueue !== null) {
			const {
				memoizedState,
				baseQueue: newBaseQueue,
				baseState: newBaseState
			} = processUpdateQueue(baseState, baseQueue, renderLane)

			hook.memoizedState = memoizedState
			hook.baseState = newBaseState
			hook.baseQueue = newBaseQueue
		}
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>]
}

function updateWorkInProgress(): Hook {
	// TODO render阶段触发的更新
	let nextCurrentHook: Hook | null

	if (currentHook === null) {
		// 这是FunctionComponent Update时第一个hook
		const current = currentlyRenderingFiber?.alternate

		if (current !== null) {
			nextCurrentHook = current?.memoizedState
		} else {
			nextCurrentHook = null
		}
	} else {
		// 这是FC后续的hook
		nextCurrentHook = currentHook.next
	}

	if (nextCurrentHook === null) {
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的hook比上一次执行时多`
		)
	}

	currentHook = nextCurrentHook as Hook

	const newHook: Hook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null,
		baseQueue: currentHook.baseQueue,
		baseState: currentHook.baseState
	}

	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook')
		} else {
			workInProgressHook = newHook
			currentlyRenderingFiber.memoizedState = workInProgressHook
		}
	} else {
		workInProgressHook.next = newHook
		workInProgressHook = newHook
	}

	return workInProgressHook
}

function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = mountWorkInProgress()
	let memoizedState

	if (initialState instanceof Function) {
		memoizedState = initialState()
	} else {
		memoizedState = initialState
	}

	const queue = createUpdateQueue<State>()
	hook.updateQueue = queue
	hook.memoizedState = memoizedState

	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue)
	queue.dispatch = dispatch

	return [memoizedState, dispatch]
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLanes()
	const update = createUpdate(action, lane)
	enqueueUpdate(updateQueue, update)
	scheduleUpdateOnFiber(fiber, lane)
}

function mountWorkInProgress(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null,
		baseQueue: null,
		baseState: null
	}

	if (workInProgressHook === null) {
		// mount时 第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook')
		} else {
			workInProgressHook = hook
			currentlyRenderingFiber.memoizedState = workInProgressHook
		}
	} else {
		// mount时后续的hook
		workInProgressHook.next = hook
		workInProgressHook = hook
	}

	return workInProgressHook
}
