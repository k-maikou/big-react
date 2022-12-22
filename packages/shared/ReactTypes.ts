// 类型定义
export type Type = any
export type Key = any
export type Ref = any
export type Props = any
export type ElementType = any

export interface ReactElementType {
	$$typeof: symbol | number
	type: ElementType
	key: Key
	props: Props
	ref: Ref
	__mark: string
}

// 一种是state，另一种是修改的方法
export type Action<State> = State | ((prevState: State) => State)
