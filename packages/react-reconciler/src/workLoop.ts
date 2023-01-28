import { HostRoot } from './workTag'
import { beginWork } from './beginWork'
import { completeWork } from './completeWork'
import { createWorkInProgress, FiberNode, FiberRootNode } from './fiber'
import { NoFlags, MutationMask } from './fiberFlags'
import { commitMutationEffect } from './commitWork'
import {
	getHighestPriorityLane,
	Lane,
	markRootFinished,
	mergeLanes,
	NoLane,
	SyncLane
} from './fiberLanes'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { scheduleMicroTask } from 'hostConfig'

let workInProgress: FiberNode | null = null // 全局指针，指向正在工作的fiber节点
let workInProgressRootRenderLane: Lane = NoLane // 本次更新的lane

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
	if (updateLane === NoLane) {
		return
	}
	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度
		if (__DEV__) {
			console.log('在微任务中调度， 优先级：', updateLane)
		}
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane))
		scheduleMicroTask(flushSyncCallbacks)
	} else {
		// 其它优先级 用宏任务调度
	}
}

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

// 创建workInProgress
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(root.current, {})
	workInProgressRootRenderLane = lane
}

function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	const nextLane = getHighestPriorityLane(root.pendingLanes)

	if (nextLane !== SyncLane) {
		// 其它比SyncLane低的优先级
		// 还有一种NoLane的情况
		ensureRootIsScheduled(root)
		return
	}

	// 初始化workInProgress
	prepareFreshStack(root, lane)

	do {
		try {
			workLoop()
			break
		} catch (error) {
			if (__DEV__) {
				console.warn('workLoop 发生错误', error)
			}
			workInProgress = null
		}
	} while (true)

	const finishedWork = root.current.alternate
	root.finishedWork = finishedWork
	root.finishedLane = lane
	workInProgressRootRenderLane = NoLane

	commitRoot(root)
}

function workLoop() {
	while (workInProgress !== null) {
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

	// 判断3个子阶段需要执行的操作
	// 根据 MutationMask 来判断 root flags 和 root subtreeFlags 是否有需要执行的flags
	const subtreeFlags = (finishedWork.subtreeFlags & MutationMask) !== NoFlags
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags

	if (subtreeFlags || rootHasEffect) {
		// beforeMutation

		// mutation Placement
		commitMutationEffect(finishedWork)

		root.current = finishedWork

		// layout
	} else {
		root.current = finishedWork
	}
}
