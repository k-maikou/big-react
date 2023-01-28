let syncQueue: ((...args: any) => void)[] | null = null
let isFlushSyncQueue = false

export function scheduleSyncCallback(callback: (...args: any) => void) {
	if (syncQueue === null) {
		syncQueue = [callback]
	} else {
		syncQueue.push(callback)
	}
}

export function flushSyncCallbacks() {
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
		}
	}
}
