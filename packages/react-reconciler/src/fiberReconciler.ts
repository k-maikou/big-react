import { ReactElementType } from 'shared/ReactTypes'
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	UpdateQueue
} from './updateQueue'
import { scheduleUpdateOnFiber } from './workLoop'
import { HostRoot } from './workTag'
import { FiberNode, FiberRootNode } from './fiber'
import { Container } from 'hostConfig'

// 创建root节点
export function createContainer(container: Container) {
	const hostRootFiber = new FiberNode(HostRoot, {}, null)
	const root = new FiberRootNode(container, hostRootFiber)
	hostRootFiber.updateQueue = createUpdateQueue()
	return root
}

// 创建update，然后放进fiber节点的updateQueue里面
export function updateContainer(
	element: ReactElementType | null,
	root: FiberRootNode
) {
	const hostRootFiber = root.current
	const update = createUpdate<ReactElementType | null>(element)
	enqueueUpdate(
		hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
		update
	)
	scheduleUpdateOnFiber(hostRootFiber)
	return element
}
