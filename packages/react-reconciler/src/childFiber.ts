import { Deletion, Placement } from './fiberFlags'
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols'
import { Key, Props, ReactElementType } from 'shared/ReactTypes'
import {
	createFiberFormFragment,
	createFiberFormElement,
	createWorkInProgress,
	FiberNode
} from './fiber'
import { Fragment, HostText } from './workTag'

type ExistingChildren = Map<string | number, FiberNode>

function ChildReconciler(shouldTrackEffects: boolean) {
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return
		}

		// 标记节点为删除
		const deletions = returnFiber.deletions
		if (deletions === null) {
			returnFiber.deletions = [childToDelete]
			returnFiber.flags |= Deletion
		} else {
			deletions.push(childToDelete)
		}
	}

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		if (!shouldTrackEffects) {
			return
		}
		let childToDelete = currentFirstChild
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete)
			// 标记所有的兄弟节点为删除
			childToDelete = childToDelete.sibling
		}
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const { key, type, $$typeof } = element
		// 比较element和current是否可以复用
		while (currentFiber !== null) {
			// update
			if (key === currentFiber.key) {
				if ($$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === type) {
						let props = element.props
						if (element.type === REACT_FRAGMENT_TYPE) {
							props = element.props.children
						}

						// key相同且type也相同，用useFiber复用节点
						const existing = useFiber(currentFiber, element.props)
						existing.return = returnFiber
						// 如 A1B2C3D4 -> A1，复用完A1节点后，其它节点需要标记删除
						deleteRemainingChildren(returnFiber, currentFiber.sibling)
						return existing
					}

					// key相同 type不同删除所有旧节点
					deleteChild(returnFiber, currentFiber)
					break
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element)
						break
					}
				}
			} else {
				// key不同，删掉当前不同的child，然后遍历兄弟节点
				deleteChild(returnFiber, currentFiber)
				currentFiber = currentFiber.sibling
			}
		}

		// 都不能复用，根据element创建fiber
		let fiber

		// 判断是element类型还是fragment类型
		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFormFragment(element.props.children, key)
		} else {
			fiber = createFiberFormElement(element)
		}
		fiber.return = returnFiber
		return fiber
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			// update type相同可以复用
			if (currentFiber.tag === HostText) {
				// 类型不变，可以复用节点
				const existing = useFiber(currentFiber, { content })
				existing.return = returnFiber
				// 把其他的兄弟节点标记为删除
				deleteRemainingChildren(returnFiber, currentFiber.sibling)
				return existing
			}

			// 无法复原则先删除，后新建
			deleteChild(returnFiber, currentFiber)
			currentFiber = currentFiber.sibling
		}

		// 都不能复用，创建新的fiber节点
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

	function reconcileChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) {
		// 最好一个可复用fiber在current中的index
		let lastPlacedIndex = 0
		// 创建的最后一个fiber
		let lastNewFiber: FiberNode | null = null
		// 创建的第一个fiber
		let firstNewFiber: FiberNode | null = null

		// 1. 将current保存到map中
		const existingChildren: ExistingChildren = new Map()
		let current = currentFirstChild

		while (current !== null) {
			// 如果当前节点没有key 使用他的index做为key
			const keyToUse = current.key !== null ? current.key : current.index
			existingChildren.set(keyToUse, current)
			current = current.sibling
		}

		for (let i = 0; i < newChild.length; i++) {
			// 2. 遍历newChild，寻找是否可复用
			const after = newChild[i]
			const newFiber = updateFormMap(returnFiber, existingChildren, i, after)

			if (newFiber === null) {
				continue
			}
			// 3. 标记移动还是插入
			newFiber.index = i
			newFiber.return = returnFiber

			if (lastNewFiber === null) {
				lastNewFiber = newFiber
				firstNewFiber = newFiber
			} else {
				lastNewFiber.sibling = newFiber
				lastNewFiber = lastNewFiber.sibling
			}

			if (!shouldTrackEffects) {
				continue
			}

			const current = newFiber.alternate
			if (current !== null) {
				const oldIndex = current.index
				if (oldIndex < lastPlacedIndex) {
					// 如果lastPlacedIndex大于oldIndex，标记当前fiber为移动
					newFiber.flags |= Placement
					continue
				} else {
					// 如果oldIndex大雨LastPlacedIndex，则不标记移动，更新lastPlacedIndex
					lastPlacedIndex = oldIndex
				}
			} else {
				// mount时直接标记插入
				newFiber.flags |= Placement
			}
		}

		// 4. 将map中剩下的标记为删除
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber)
		})
		return firstNewFiber
	}

	function updateFormMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		const keyToUse = element.key !== null ? element.key : index
		const before = existingChildren.get(keyToUse)

		// HostText类型
		if (typeof element === 'string' || typeof element === 'number') {
			if (before) {
				// 判断之前的fiber节点是不是HostText
				if (before.tag === HostText) {
					// 如果是，则把之前的key删掉
					existingChildren.delete(keyToUse)
					// 然后直接复用这个节点
					return useFiber(before, { content: element + '' })
				}
			}
			// 不能复用则创建新的fiber节点
			return new FiberNode(HostText, { content: element + '' }, null)
		}

		// ReactElement类型
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(
							returnFiber,
							before,
							element,
							keyToUse,
							existingChildren
						)
					}
					if (before) {
						if (before.type === element.type) {
							existingChildren.delete(keyToUse)
							return useFiber(before, element.props)
						}
					}
					return createFiberFormElement(element)
			}

			// TODO 数组类型
			if (Array.isArray(element) && __DEV__) {
				console.warn('还未实现数组类型的child')
			}
		}

		if (Array.isArray(element)) {
			return updateFragment(
				returnFiber,
				before,
				element,
				keyToUse,
				existingChildren
			)
		}

		return null
	}

	return function reconcileChildrenFiber(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: any
	) {
		// 判断Fragment
		const isUnKeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null

		if (isUnKeyedTopLevelFragment) {
			newChild = newChild.props.children
		}

		// 判断当前fiber的类型
		if (typeof newChild === 'object' && newChild !== null) {
			// 多节点的情况
			if (Array.isArray(newChild)) {
				return reconcileChildrenArray(returnFiber, currentFiber, newChild)
			}

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

		// HostText文本类型
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			)
		}

		if (currentFiber !== null) {
			// 兜底删除
			deleteRemainingChildren(returnFiber, currentFiber)
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

function updateFragment(
	returnFiber: FiberNode,
	current: FiberNode | undefined,
	elements: any[],
	key: Key,
	existingChildren: ExistingChildren
) {
	let fiber
	if (!current || current.tag !== Fragment) {
		fiber = createFiberFormFragment(elements, key)
	} else {
		existingChildren.delete(key)
		fiber = useFiber(current, elements)
	}

	fiber.return = returnFiber
	return fiber
}

// 更新时调用的函数
export const reconcileChildFibers = ChildReconciler(true)
// 初始化时调用的函数
export const mountChildFibers = ChildReconciler(false)
