import { HostRoot } from './workTag'
import { beginWork } from './beginWork'
import { completeWork } from './completeWork'
import {
	createWorkInProgress,
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects
} from './fiber'
import { NoFlags, MutationMask, PassiveMask } from './fiberFlags'
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitMutationEffect
} from './commitWork'
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield,
	unstable_cancelCallback
} from 'scheduler'
import {
	getHighestPriorityLane,
	Lane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes,
	NoLane,
	SyncLane
} from './fiberLanes'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { scheduleMicroTask } from 'hostConfig'
import { HookHasEffect, Passive } from './hookEffectTags'

let workInProgress: FiberNode | null = null // 全局指针，指向正在工作的fiber节点
let workInProgressRootRenderLane: Lane = NoLane // 本次更新的lane
let rootDoesHasPassiveEffects = false // 防止useEffect多次调度

type RootExitStatus = number
const RootInComplete = 1
const RootCompleted = 2
// 执行过程中报错了

// 记录fiber节点更新的lane到FiberRootNode里
function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane)
}

// 往上遍历到根节点
function markUpdateFormFiberToRoot(fiber: FiberNode) {
	let node = fiber
	let parent = node.return

	while (parent !== null) {
		node = parent
		parent = node.return
	}

	if (node.tag === HostRoot) {
		return node.stateNode
	}

	return null
}

// 在fiber中调度update
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// TODO 调度功能
	// fiberRootNode
	const root = markUpdateFormFiberToRoot(fiber)
	markRootUpdated(root, lane)
	ensureRootIsScheduled(root)
}

// schedule 调度阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes)
	const existingCallback = root.callbackNode

	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback)
		}
		root.callbackNode = null
		root.callbackPriority = NoLane
		return
	}

	const curPriority = updateLane
	const prevPriority = root.callbackPriority
	// 同更新级不需要产生新的调度
	if (curPriority === prevPriority) {
		return
	}

	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback)
	}

	let newCallbackNode = null

	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度
		if (__DEV__) {
			console.log('在微任务中调度， 优先级：', updateLane)
		}
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane))
		// 使用微任务进行异步调用
		scheduleMicroTask(flushSyncCallbacks)
	} else {
		// 其它优先级 用宏任务调度
		const schedulerPriority = lanesToSchedulerPriority(updateLane)

		newCallbackNode = scheduleCallback(
			schedulerPriority,
			// @ts-ignore
			performConcurrentWorkOnRoot.bind(null, root)
		)
	}

	root.callbackNode = newCallbackNode
	root.callbackPriority = curPriority
}

function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	// 保证useEffect回调执行
	const curCallback = root.callbackNode
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects)
	if (didFlushPassiveEffect) {
		if (root.callbackNode !== curCallback) {
			return null
		}
	}

	const lane = getHighestPriorityLane(root.pendingLanes)
	const curCallbackNode = root.callbackNode
	if (lane === NoLane) {
		return null
	}
	const needSync = lane === SyncLane || didTimeout

	// render阶段
	const exitStatus = renderRoot(root, lane, !needSync)

	// 开启更高优先级的调度
	ensureRootIsScheduled(root)

	if (exitStatus === RootInComplete) {
		// 中断
		if (root.callbackNode !== curCallbackNode) {
			return null
		}
		return performConcurrentWorkOnRoot.bind(null, root)
	}

	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate
		root.finishedWork = finishedWork
		root.finishedLane = lane
		workInProgressRootRenderLane = NoLane

		commitRoot(root)
	} else if (__DEV__) {
		console.error('还未实现的并发更新结束状态')
	}
}

function performSyncWorkOnRoot(root: FiberRootNode) {
	const nextLane = getHighestPriorityLane(root.pendingLanes)

	// 批处理的条件
	if (nextLane !== SyncLane) {
		// 其它比SyncLane低的优先级
		// 还有一种NoLane的情况
		ensureRootIsScheduled(root)
		return
	}

	const exitStatus = renderRoot(root, nextLane, false)

	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate
		root.finishedWork = finishedWork
		root.finishedLane = nextLane
		workInProgressRootRenderLane = NoLane

		commitRoot(root)
	} else if (__DEV__) {
		console.error('还未实现同步更新结束状态')
	}
}

// 创建workInProgress
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane
	root.finishedWork = null
	workInProgress = createWorkInProgress(root.current, {})
	workInProgressRootRenderLane = lane
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root)
	}

	if (workInProgressRootRenderLane !== lane) {
		// 初始化workInProgress
		prepareFreshStack(root, lane)
	}

	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync()
			break
		} catch (error) {
			if (__DEV__) {
				console.warn('workLoop 发生错误', error)
			}
			workInProgress = null
		}
	} while (true)

	// 中断执行 || render阶段执行完
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete
	}
	// render阶段执行完
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error('render阶段结束时wip不应该不为null')
	}
	// 报错
	return RootCompleted
}

function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress)
	}
}

function workLoopConcurrent() {
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress)
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next: FiberNode | null = beginWork(fiber, workInProgressRootRenderLane) // 返回子节点
	fiber.memoizedProps = fiber.pendingProps

	if (next === null) {
		// 如果没有子节点，就开始往上遍历
		completeUnitOfWork(fiber)
	} else {
		// 否则继续往下遍历
		workInProgress = next
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber

	do {
		completeWork(node)
		const siblingFiber = node.sibling // 获取兄弟节点

		// 如果存在兄弟节点，赋值当前节点给兄弟节点
		if (siblingFiber !== null) {
			workInProgress = siblingFiber
			return
		}
		// 否则的话赋值为父节点开始往上遍历
		node = node.return
		workInProgress = node
	} while (node !== null)
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork

	if (finishedWork === null) {
		return
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork)
	}

	const lane = root.finishedLane

	if (lane === NoLane && __DEV__) {
		console.error('commit阶段finishedLane不应该是NoLane')
	}

	// 重置
	root.finishedWork = null
	root.finishedLane = NoLane

	markRootFinished(root, lane)

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		// 防止effect多次调用的处理
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true
			// 调度副作用
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects)
				return
			})
		}
	}

	// 判断3个子阶段需要执行的操作
	// 根据 MutationMask 来判断 root flags 和 root subtreeFlags 是否有需要执行的flags
	const subtreeFlags = (finishedWork.subtreeFlags & MutationMask) !== NoFlags
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags

	if (subtreeFlags || rootHasEffect) {
		// beforeMutation

		// mutation Placement
		commitMutationEffect(finishedWork, root)

		root.current = finishedWork

		// layout
	} else {
		root.current = finishedWork
	}

	rootDoesHasPassiveEffects = false
	ensureRootIsScheduled(root)
}

function flushPassiveEffects(pendingPassiveEffect: PendingPassiveEffects) {
	// 用来判断Effect是否执行
	let didFlushPassiveEffect = false

	pendingPassiveEffect.unmount.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffectListUnmount(Passive, effect)
	})
	pendingPassiveEffect.unmount = []

	// 先更新所有上一次更新的destroy回调
	pendingPassiveEffect.update.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffectListDestroy(Passive | HookHasEffect, effect)
	})

	// 执行完destroy后才能触发create的回调
	pendingPassiveEffect.update.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffectListCreate(Passive | HookHasEffect, effect)
	})
	pendingPassiveEffect.update = []
	// 可能在执行useEffect回调过程中，还有别的更新流程，这里做一个兜底
	flushSyncCallbacks()

	return didFlushPassiveEffect
}
