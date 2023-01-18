import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	Instance,
	removeChild
} from 'hostConfig'
import { FiberNode, FiberRootNode } from './fiber'
import {
	Deletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags'
import { FunctionComponent, HostComponent, HostRoot, HostText } from './workTag'

let nextEffect: FiberNode | null = null

export const commitMutationEffect = (finishedWork: FiberNode) => {
	nextEffect = finishedWork

	while (nextEffect !== null) {
		// 向下遍历
		const child: FiberNode | null = nextEffect.child

		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffect = child
		} else {
			// 遍历到底了 开始向上遍历 DFS
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect)
				const sibling: FiberNode | null = nextEffect.sibling

				if (sibling !== null) {
					nextEffect = sibling
					break up
				}

				nextEffect = nextEffect.return
			}
		}
	}
}

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags

	// 插入到DOM节点
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork)
		finishedWork.flags &= ~Placement
	}

	// 节点更新
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork)
		finishedWork.flags &= ~Update
	}

	// 节点删除
	if ((flags & Deletion) !== NoFlags) {
		const deletions = finishedWork.deletions
		if (deletions !== null) {
			deletions.forEach((deletion) => {
				commitDeletion(deletion)
			})
		}
		finishedWork.flags &= ~Deletion
	}
}

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 1. 找到第一个root host节点
	const lastOne = childrenToDelete[childrenToDelete.length - 1]

	if (!lastOne) {
		childrenToDelete.push(unmountFiber)
	} else {
		let node = lastOne.sibling
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber)
			}
			node = node.sibling
		}
	}
	// 2. 每找到一个host节点，判断下这个节点是不是第1步找到那个节点的兄弟节点
}

const commitDeletion = (childToDelete: FiberNode) => {
	const rootChildrenToDelete: FiberNode[] = []

	// 递归子树
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
				// TODO 解绑ref
				return
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
				return
			case FunctionComponent:
				// useEffect unmount
				return
			default:
				if (__DEV__) {
					console.warn('为处理的unmount类型', unmountFiber)
				}
				break
		}
	})

	// 移除rootHostComponent的dom操作
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(childToDelete)
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent)
			})
		}
	}

	childToDelete.return = null
	childToDelete.child = null
}

const commitNestedComponent = (
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) => {
	let node = root
	while (true) {
		onCommitUnmount(node)

		if (node.child !== null) {
			// 向下遍历的过程
			node.child.return = node
			node = node.child
			continue
		}

		if (node === root) {
			// 终止条件
			return
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return
			}
			// 向上归的过程
			node = node.return
		}

		node.sibling.return = node.return
		node = node.sibling
	}
}

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork)
	}

	// 先获取父级元素对应的数组环境节点
	const hostParent = getHostParent(finishedWork)

	// 之前的插入操作是appendChild，现在为了实现移动操作，需要支持insertBefore
	// 查找兄弟对应的Host节点
	const sibling = getHostSibling(finishedWork)

	if (hostParent !== null) {
		// 找到对应的DOM，然后插入到父节点的DOM中
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling)
	}
}

function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber

	findSibling: while (true) {
		// 如果向下没有找到，就向上遍历找到父级节点
		while (node.sibling === null) {
			const parent = node.return
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null
			}
			node = parent
		}

		node.sibling.return = node.return
		node = node.sibling

		// 如果当前fiber不是文本类型或Dom类型，则向下遍历找到对应Dom节点
		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 向下遍历，找子孙节点
			if ((node.flags && Placement) !== NoFlags) {
				continue findSibling
			}

			// 已经到底了
			if (node.child === null) {
				continue findSibling
			} else {
				// 向下遍历
				node.child.return = node
				node = node.child
			}
		}

		// 到这里就说明找到了当前的node节点，直接return dom
		if ((node.flags && Placement) === NoFlags) {
			return node.stateNode
		}
	}
}

function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return

	while (parent) {
		const parentTag = parent.tag
		if (parentTag === HostComponent) {
			return parent.stateNode as Container
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container
		}

		parent = parent.return
	}

	if (__DEV__) {
		console.warn('未找到host parent')
	}

	return null
}

function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) {
	if (finishedWork.tag === HostText || finishedWork.tag === HostComponent) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before)
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode)
		}
		return
	}

	const child = finishedWork.child
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent)
		let sibling = child.sibling

		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent)
			sibling = sibling.sibling
		}
	}
}
