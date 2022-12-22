import { HostRoot } from './workTag'
import { beginWork } from './beginWork'
import { completeWork } from './completeWork'
import { createWorkInProgress, FiberNode, FiberRootNode } from './fiber'
import { NoFlags, MutationMask } from './fiberFlags'
import { commitMutationEffect } from './commitWork'

let workInProgress: FiberNode | null = null // 全局指针，指向正在工作的fiber节点

// 在fiber中调度update
export function scheduleUpdateOnFiber(fiber: FiberNode) {
	// TODO 调度功能
	// fiberRootNode
	const root = markUpdateFormFiberToRoot(fiber)
	renderRoot(root)
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
function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProgress(root.current, {})
}

function renderRoot(root: FiberRootNode) {
	// 初始化workInProgress
	prepareFreshStack(root)

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

	commitRoot(root)
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress)
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next: FiberNode | null = beginWork(fiber) // 返回子节点
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

	// 重置
	root.finishedWork = null

	// 判断3个子阶段需要执行的操作
	// root flags root subtreeFlags
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
