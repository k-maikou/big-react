import { FiberNode } from './fiber'
// 递归中的归
export const completeWork = (node: FiberNode) => {
	console.log(node)
}
