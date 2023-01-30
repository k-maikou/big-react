let syncQueue: ((...args: any) => void)[] | null = null
let isFlushSyncQueue = false

// 把回调函数放入queue中等待执行
export function scheduleSyncCallback(callback: (...args: any) => void) {
	if (syncQueue === null) {
		syncQueue = [callback]
	} else {
		syncQueue.push(callback)
	}
}

// 异步执行的回调函数
export function flushSyncCallbacks() {
	// 批处理更新 防止多个update多次调用
	if (!isFlushSyncQueue && syncQueue) {
		isFlushSyncQueue = true

		try {
			syncQueue.forEach((callback) => callback())
		} catch (error) {
			if (__DEV__) {
				console.error('flushSyncCallbacks报错', error)
			}
		} finally {
			isFlushSyncQueue = false
			syncQueue = null
		}
	}
}
