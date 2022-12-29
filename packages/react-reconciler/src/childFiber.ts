import { Deletion, Placement } from './fiberFlags'
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'
import { Props, ReactElementType } from 'shared/ReactTypes'
import {
	createFiberFormElement,
	createWorkInProgress,
	FiberNode
} from './fiber'
import { HostText } from './workTag'

function ChildReconciler(shouldTrackEffects: boolean) {
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return
		}

		const deletions = returnFiber.deletions
		if (deletions === null) {
			returnFiber.deletions = [childToDelete]
			returnFiber.flags |= Deletion
		} else {
			deletions.push(childToDelete)
		}
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const { key, type, $$typeof } = element
		// 比较element和current是否可以复用
		if (currentFiber !== null) {
			// update
			work: if (key === currentFiber.key) {
				if ($$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === type) {
						const existing = useFiber(currentFiber, element.props)
						existing.return = returnFiber
						return existing
					}

					// key相同 type不同删除旧节点，break掉当前循环
					deleteChild(returnFiber, currentFiber)
					break work
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element)
						break work
					}
				}
			} else {
				// 不能复用，则删除旧的，创建新的
				deleteChild(returnFiber, currentFiber)
			}
		}

		// 根据element创建fiber
		const fiber = createFiberFormElement(element)
		fiber.return = returnFiber
		return fiber
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		if (currentFiber !== null) {
			// update type相同可以复用
			if (currentFiber.tag === HostText) {
				const existing = useFiber(currentFiber, { content })
				existing.return = returnFiber
				return existing
			}

			// 无法复原则先删除，后新建
			deleteChild(returnFiber, currentFiber)
		}

		const fiber = new FiberNode(HostText, { content }, null)
		fiber.return = returnFiber
		return fiber
	}

	// 边界处理，在mount时根节点插入Placement
	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement
		}
		return fiber
	}

	return function reconcileChildrenFiber(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		// 判断当前fiber的类型
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					)
				default:
					if (__DEV__) {
						console.warn('为实现的reconcile类型', newChild)
					}
					break
			}
		}
		// TODO 多节点的情况

		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			)
		}

		if (currentFiber !== null) {
			// 兜底删除
			deleteChild(returnFiber, currentFiber)
		}

		if (__DEV__) {
			console.warn('未实现的reconcile类型', newChild)
		}

		return null
	}
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(fiber, pendingProps)
	clone.index = 0
	clone.sibling = null
	return clone
}

// 更新时调用的函数
export const reconcileChildFibers = ChildReconciler(true)
// 初始化时调用的函数
export const mountChildFibers = ChildReconciler(false)
