import { NoFlags, Update } from './fiberFlags'
import {
	appendInitialChild,
	Container,
	createInstance,
	createTextInstance,
	Instance
} from 'hostConfig'
import { FiberNode } from './fiber'
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag'

function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update
}

// 递归中的归
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps
	const current = wip.alternate

	// 根据节点类型执行对应操作
	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
				markUpdate(wip)
			} else {
				// 1. 构建DOM
				const instance = createInstance(wip.type, newProps)
				// 2. 将DOM插入到DOM树中
				appendAllChildren(instance, wip)
				wip.stateNode = instance
			}
			bubbleProperties(wip)
			return null
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content
				const newText = newProps.content
				if (oldText !== newText) {
					markUpdate(wip)
				}
			} else {
				// 1. 构建DOM
				const instance = createTextInstance(newProps.content)
				// 2. 将DOM插入到DOM树中
				wip.stateNode = instance
			}
			bubbleProperties(wip)
			return null
		case HostRoot:
		case FunctionComponent:
		case Fragment:
			bubbleProperties(wip)
			return null
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip)
			}
			break
	}
}

function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
	let node = wip.child

	while (node !== null) {
		// 如果找到要插入的类型，直接在父节点插入当前节点
		if (node?.tag === HostComponent || node?.tag === HostText) {
			appendInitialChild(parent, node.stateNode)
		} else if (node.child !== null) {
			// 边界处理，如果不是要插入的类型，但是还有子节点，继续往下遍历
			node.child.return = node
			node = node.child
			continue
		}

		// 已经归到最顶层，退出循环
		if (node === wip) {
			return
		}

		// 没有命中上面的情况，开始往上递归
		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return
			}
			node = node?.return
		}

		// 判断当前节点是否有兄弟节点
		node.sibling.return = node.return
		node = node.sibling
	}
}

// 从子节点开始往上收集flags
function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags
	let child = wip.child

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags
		subtreeFlags |= child.flags

		child.return = wip
		child = child.sibling
	}

	wip.subtreeFlags |= subtreeFlags
}
