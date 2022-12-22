import { Placement } from './fiberFlags'
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'
import { ReactElementType } from 'shared/ReactTypes'
import { createFiberFormElement, FiberNode } from './fiber'
import { HostText } from './workTag'

function ChildReconciler(shouldTrackEffects: boolean) {
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
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
		return null
	}
}

// 更新时调用的函数
export const reconcileChildFibers = ChildReconciler(true)
// 初始化时调用的函数
export const mountChildFibers = ChildReconciler(false)
