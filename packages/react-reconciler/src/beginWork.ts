import { ReactElementType } from 'shared/ReactTypes'
import { mountChildFibers, reconcileChildFibers } from './childFiber'
import { UpdateQueue, processUpdateQueue } from './updateQueue'
import {
	HostComponent,
	HostText,
	HostRoot,
	FunctionComponent,
	Fragment
} from './workTag'
import { FiberNode } from './fiber'
import { renderWithHooks } from './fiberHooks'

// 递归中的递阶段
export const beginWork = (wip: FiberNode) => {
	// 比较ReactElement和FiberNode，返回子fiberNode

	// 根据tag执行对应操作
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip)
		case HostComponent:
			return updateHostComponent(wip)
		case HostText:
			return null
		case FunctionComponent:
			return updateFunctionComponent(wip)
		case Fragment:
			return updateFragment(wip)
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型')
			}
			break
	}
	return null
}

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps
	reconcileChildren(wip, nextChildren)
	return wip.child
}

function updateFunctionComponent(wip: FiberNode) {
	const nextChildren = renderWithHooks(wip)
	reconcileChildren(wip, nextChildren)
	return wip.child
}

function updateHostRoot(wip: FiberNode) {
	const baseState = wip.memoizedState
	const updateQueue = wip.updateQueue as UpdateQueue<Element>
	const pending = updateQueue.shared.pending
	updateQueue.shared.pending = null

	// 对于hostRoot类型，memoizedState就是当前的root节点
	const { memoizedState } = processUpdateQueue(baseState, pending)
	wip.memoizedState = memoizedState

	const nextChildren = wip.memoizedState
	reconcileChildren(wip, nextChildren)
	return wip.child
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps
	const nextChildren = nextProps.children
	reconcileChildren(wip, nextChildren)
	return wip.child
}

function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate

	// 把生成的子fiber节点赋值给当前fiber节点的child
	if (current !== null) {
		// update
		wip.child = reconcileChildFibers(wip, current?.child, children)
	} else {
		// mount
		wip.child = mountChildFibers(wip, null, children)
	}
}
