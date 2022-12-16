import { Props, Key, Ref } from 'shared/ReactTypes'
import { WorkTag } from './workTag'
import { Flags, NoFlags } from './fiberFlags'

export class FiberNode {
	tag: WorkTag
	type: any
	key: Key
	stateNode: any
	ref: Ref

	return: FiberNode | null
	sibling: FiberNode | null
	child: FiberNode | null
	index: number

	pendingProps: Props
	memoizedProps: Props | null

	alternate: FiberNode | null
	flags: Flags | null

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag
		this.key = key
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

		this.alternate = null // 指向该fiber在另一次更新时对应的fiber

		// 副作用
		this.flags = NoFlags
	}
}
