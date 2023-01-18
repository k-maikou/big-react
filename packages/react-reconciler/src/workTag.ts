// 方法组件的节点
export const FunctionComponent = 0
// 根节点，比如说React.render包裹的那个节点
export const HostRoot = 3
// Dom节点
export const HostComponent = 5
// Dom文本
export const HostText = 6
// Fragment
export const Fragment = 7
// class节点
export const ClassComponent = 1

export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText
	| typeof Fragment
	| typeof ClassComponent
