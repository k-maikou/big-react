import { beginWork } from './beginWork'
import { completeWork } from './completeWork'
import { FiberNode } from './fiber'

let workInProgress: FiberNode | null = null // 全局指针，指向正在工作的fiber节点

function prepareRefreshStack(fiber: FiberNode) {
	workInProgress = fiber
}

function renderRoot(root: FiberNode) {
	// 初始化workInProgress
	prepareRefreshStack(root)

	do {
		try {
			workLoop()
			break
		} catch (error) {
			console.warn('workLoop 发生错误', error)
			workInProgress = null
		}
	} while (true)
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
