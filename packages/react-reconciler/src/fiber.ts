import { ReactElementType, Props, Key, Ref } from 'shared/ReactTypes'
import { Fragment, FunctionComponent, HostComponent, WorkTag } from './workTag'
import { Flags, NoFlags } from './fiberFlags'
import { Container } from 'hostConfig'
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes'

// fiber节点
export class FiberNode {
	tag: WorkTag
	type: any
	key: Key | null
	stateNode: any
	ref: Ref

	return: FiberNode | null
	sibling: FiberNode | null
	child: FiberNode | null
	index: number

	pendingProps: Props
	memoizedProps: Props | null
	memoizedState: any

	alternate: FiberNode | null
	flags: Flags
	subtreeFlags: Flags

	updateQueue: unknown

	deletions: FiberNode[] | null

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag
		this.key = key || null
		this.stateNode = null // 对应的dom节点
		this.type = null // fiberNode的类型

		// 构成树状结构
		this.return = null // 指向父节点
		this.sibling = null // 指向兄弟节点
		this.child = null // 指向子节点
		this.index = 0 // 如果同级的fiber有好几个，index指向对应下标

		this.ref = null

		// 作为工作单元
		this.pendingProps = pendingProps // 表示刚开始工作的时候保存的props
		this.memoizedProps = null // 工作完后确认的props
		this.memoizedState = null
		this.updateQueue = null
		this.alternate = null // 指向该fiber在另一次更新时对应的fiber

		// 副作用
		this.flags = NoFlags
		this.subtreeFlags = NoFlags
		this.deletions = null
	}
}

// 根节点下面的root节点
export class FiberRootNode {
	container: Container
	current: FiberNode
	finishedWork: FiberNode | null
	pendingLanes: Lanes
	finishedLane: Lane

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container
		this.current = hostRootFiber
		this.finishedWork = null
		hostRootFiber.stateNode = this
		this.pendingLanes = NoLanes
		this.finishedLane = NoLane
	}
}

// 基于current创建一颗workInProgress树
export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate

	if (wip === null) {
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key)
		wip.stateNode = current.stateNode

		wip.alternate = current
		current.alternate = wip
	} else {
		// update
		wip.pendingProps = pendingProps
		wip.flags = NoFlags
		wip.subtreeFlags = NoFlags
		wip.deletions = null
	}
	wip.type = current.type
	wip.updateQueue = current.updateQueue
	wip.child = current.child
	wip.memoizedProps = current.memoizedProps
	wip.memoizedState = current.memoizedState

	return wip
}

// 根据element创建fiber
export function createFiberFormElement(element: ReactElementType): FiberNode {
	const { type, key, props } = element
	let fiberTag: WorkTag = FunctionComponent

	if (typeof type === 'string') {
		// 比如说'div'也是一种div的string类型
		fiberTag = HostComponent
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('为定义的type类型', element)
	}

	const fiber = new FiberNode(fiberTag, props, key)
	fiber.type = type
	return fiber
}

export function createFiberFormFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key)
	return fiber
}
