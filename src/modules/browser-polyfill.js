const isFirefox =
	typeof browser !== "undefined" && typeof chrome === "undefined";
const isChrome = typeof chrome !== "undefined";

const browserAPI = isFirefox ? browser : chrome;

export const CrossBrowserAPI = {
	runtime: {
		getManifest: () => browserAPI.runtime.getManifest(),

		sendMessage: (message) => {
			if (isFirefox) {
				return browserAPI.runtime.sendMessage(message);
			} else {
				return new Promise((resolve, reject) => {
					browserAPI.runtime.sendMessage(message, (response) => {
						if (browserAPI.runtime.lastError) {
							reject(
								new Error(browserAPI.runtime.lastError.message)
							);
						} else {
							resolve(response);
						}
					});
				});
			}
		},

		onMessage: {
			addListener: (callback) => {
				browserAPI.runtime.onMessage.addListener(
					(message, sender, sendResponse) => {
						const result = callback(message, sender, sendResponse);

						if (result instanceof Promise) {
							result.then(sendResponse).catch((error) => {
								console.error("Message handler error:", error);
								sendResponse({ error: error.message });
							});
							return true; // keep message channel open for async response
						}

						return result;
					}
				);
			},
		},
	},

	storage: {
		local: {
			get: (keys) => {
				if (isFirefox) {
					return browserAPI.storage.local.get(keys);
				} else {
					return new Promise((resolve) => {
						browserAPI.storage.local.get(keys, resolve);
					});
				}
			},

			set: (data) => {
				if (isFirefox) {
					return browserAPI.storage.local.set(data);
				} else {
					return new Promise((resolve) => {
						browserAPI.storage.local.set(data, resolve);
					});
				}
			},

			remove: (keys) => {
				if (isFirefox) {
					return browserAPI.storage.local.remove(keys);
				} else {
					return new Promise((resolve) => {
						browserAPI.storage.local.remove(keys, resolve);
					});
				}
			},
		},
	},

	tabs: {
		query: (queryInfo) => {
			if (isFirefox) {
				return browserAPI.tabs.query(queryInfo);
			} else {
				return new Promise((resolve) => {
					browserAPI.tabs.query(queryInfo, resolve);
				});
			}
		},

		sendMessage: (tabId, message) => {
			if (isFirefox) {
				return browserAPI.tabs.sendMessage(tabId, message);
			} else {
				return new Promise((resolve, reject) => {
					browserAPI.tabs.sendMessage(tabId, message, (response) => {
						if (browserAPI.runtime.lastError) {
							reject(
								new Error(browserAPI.runtime.lastError.message)
							);
						} else {
							resolve(response);
						}
					});
				});
			}
		},
	},
};

export const BrowserInfo = {
	isFirefox,
	isChrome,
	name: isFirefox ? "firefox" : isChrome ? "chrome" : "unknown",

	getManifestVersion: () => {
		const manifest = browserAPI.runtime.getManifest();
		return manifest.manifest_version;
	},

	isServiceWorker: () => {
		return (
			typeof importScripts === "function" && typeof window === "undefined"
		);
	},

	supportsPromiseAPI: () => isFirefox,

	supportsServiceWorkers: () =>
		isChrome && typeof ServiceWorker !== "undefined",
};

export const CrossBrowserLogger = {
	log: (...args) => {
		console.log(`[${BrowserInfo.name.toUpperCase()}]`, ...args);
	},

	error: (...args) => {
		console.error(`[${BrowserInfo.name.toUpperCase()}]`, ...args);
	},

	warn: (...args) => {
		console.warn(`[${BrowserInfo.name.toUpperCase()}]`, ...args);
	},
};

export { browserAPI };
