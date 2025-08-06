import { CrossBrowserAPI } from "./browser-polyfill.js";

export const CONSTANTS = {
	FEEDBACK_DURATION: 3000,
	MAX_RETRIES: 3,
	RETRY_DELAY: 1000,
	EXTRACTION_TIMEOUT: 5000,
	RETRY_DELAY_CONTENT: 500,
	MAX_EXTRACTION_RETRIES: 3,
};

export const LoadingStates = {
	INITIALIZING: "initializing",
	AUTHENTICATING: "authenticating",
	SETTING_USERNAME: "setting_username",
	DETECTING_PROBLEM: "detecting_problem",
	READY: "ready",
	ERROR: "error",
};

export function generateRoomId() {
	return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function formatTime(seconds) {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}m ${secs}s`;
}

export async function retryOperation(
	operation,
	maxRetries = CONSTANTS.MAX_RETRIES
) {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			console.log(`Attempt ${attempt} failed:`, error);

			if (attempt === maxRetries) {
				throw error;
			}

			await new Promise((resolve) =>
				setTimeout(resolve, CONSTANTS.RETRY_DELAY * attempt)
			);
		}
	}
}

export function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

export const DOMUtils = {
	createElement(tag, styles, content) {
		const element = document.createElement(tag);
		if (styles) {
			element.style.cssText = styles;
		}
		if (content) {
			if (typeof content === "string") {
				element.innerHTML = content;
			} else {
				element.appendChild(content);
			}
		}
		return element;
	},

	waitForElement(selector, timeout = 3000) {
		return new Promise((resolve, reject) => {
			const element = document.querySelector(selector);
			if (element) {
				resolve(element);
				return;
			}

			const observer = new MutationObserver((mutations, obs) => {
				const element = document.querySelector(selector);
				if (element) {
					obs.disconnect();
					resolve(element);
				}
			});

			observer.observe(document.body, {
				childList: true,
				subtree: true,
			});

			setTimeout(() => {
				observer.disconnect();
				reject(
					new Error(
						`Element ${selector} not found within ${timeout}ms`
					)
				);
			}, timeout);
		});
	},

	addStyles(id, cssText) {
		if (document.getElementById(id)) return;

		const style = document.createElement("style");
		style.id = id;
		style.textContent = cssText;
		document.head.appendChild(style);
	},

	removeElement(element) {
		if (element && element.parentNode) {
			element.parentNode.removeChild(element);
		}
	},
};

export const AnimationUtils = {
	addLoadingStyles() {
		const styles = `
			@keyframes loading {
				0% { transform: translateX(-100%); }
				50% { transform: translateX(0%); }
				100% { transform: translateX(100%); }
			}
			
			@keyframes bounce {
				0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
				40% { transform: translateY(-10px); }
				60% { transform: translateY(-5px); }
			}
			
			@keyframes fadeIn {
				from { opacity: 0; transform: translateY(10px); }
				to { opacity: 1; transform: translateY(0); }
			}
			
			.speedcode-fade-in {
				animation: fadeIn 0.3s ease-out;
			}
		`;
		DOMUtils.addStyles("speedcode-loading-styles", styles);
	},

	fadeIn(element, delay = 0) {
		element.className = "speedcode-fade-in";
		if (delay) {
			element.style.animationDelay = `${delay}s`;
		}
	},
};

export const ValidationUtils = {
	isValidUsername(username) {
		return (
			username &&
			username.trim().length >= 2 &&
			username.trim().length <= 20
		);
	},

	isValidRoomId(roomId) {
		return roomId && /^[A-Z0-9]{6}$/.test(roomId.trim());
	},

	isValidProblemData(problemData) {
		return (
			problemData &&
			problemData.onProblem &&
			problemData.problemTitle &&
			problemData.problemTitle.length >= 2
		);
	},
};

export const NetworkUtils = {
	isOnline() {
		return navigator.onLine;
	},

	setupNetworkListeners(onOnline, onOffline) {
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOffline);

		return () => {
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
		};
	},
};

export const ChromeUtils = {
	async getCurrentTab() {
		const tabs = await CrossBrowserAPI.tabs.query({
			active: true,
			currentWindow: true,
		});
		return tabs[0];
	},

	async sendMessageToTab(tabId, message) {
		try {
			return await CrossBrowserAPI.tabs.sendMessage(tabId, message);
		} catch (error) {
			console.log("Content script message error:", error);
			throw error;
		}
	},

	isLeetCodeUrl(url) {
		return url && url.toLowerCase().includes("leetcode.com");
	},
};

export const StorageUtils = {
	async get(keys, defaultValue = null) {
		return new Promise((resolve) => {
			chrome.storage.local.get(keys, (result) => {
				if (typeof keys === "string") {
					resolve(result[keys] ?? defaultValue);
				} else {
					resolve(result);
				}
			});
		});
	},

	async set(data) {
		return new Promise((resolve) => {
			chrome.storage.local.set(data, resolve);
		});
	},

	async remove(keys) {
		return new Promise((resolve) => {
			chrome.storage.local.remove(keys, resolve);
		});
	},
};

export const ErrorUtils = {
	logError(context, error, additionalData = {}) {
		console.error(`[${context}] Error:`, error, additionalData);

		try {
			chrome.runtime.sendMessage({
				type: "LOG_ERROR",
				error: {
					message: error.message,
					stack: error.stack,
					context,
					additionalData,
				},
			});
		} catch (e) {}
	},

	getUserFriendlyMessage(error) {
		if (!navigator.onLine) {
			return "Check your internet connection";
		}

		if (error.message?.includes("auth")) {
			return "Authentication error - try refreshing";
		}

		if (error.message?.includes("permission")) {
			return "Permission denied - check settings";
		}

		if (error.message?.includes("network")) {
			return "Network error - try again";
		}

		return "Something went wrong - try again";
	},
};

export const TimeUtils = {
	now() {
		return new Date().toISOString();
	},

	formatElapsed(startTime) {
		const elapsedMs = Date.now() - startTime;
		const elapsedSeconds = Math.round(elapsedMs / 1000);
		return formatTime(elapsedSeconds);
	},

	parseTimeToSeconds(timeString) {
		const match = timeString.match(/(\d+)m\s*(\d+)s/);
		if (match) {
			return parseInt(match[1]) * 60 + parseInt(match[2]);
		}
		return 0;
	},
};
