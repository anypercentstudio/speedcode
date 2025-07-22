console.log("SpeedCode background script loaded");

chrome.runtime.onInstalled.addListener((details) => {
	console.log("SpeedCode installed/updated:", details.reason);

	if (details.reason === "install") {
		console.log("Welcome to SpeedCode!"); // first time installation

		chrome.storage.local.set({
			speedcode_version: "1.1.0",
			speedcode_install_date: new Date().toISOString(),
			speedcode_settings: {
				notifications: true,
				auto_track: true,
				theme: "dark",
			},
		});
	} else if (details.reason === "update") {
		console.log(
			"SpeedCode updated from",
			details.previousVersion,
			"to",
			chrome.runtime.getManifest().version
		); // extention updated

		handleVersionUpdate(details.previousVersion); //migration logic if needed in future
	}
});

chrome.runtime.onStartup.addListener(() => {
	console.log("SpeedCode started");
});

async function handleVersionUpdate(previousVersion) {
	try {
		const currentVersion = chrome.runtime.getManifest().version;
		console.log(
			"Handling update from",
			previousVersion,
			"to",
			currentVersion
		);

		await chrome.storage.local.set({
			speedcode_version: currentVersion,
			speedcode_update_date: new Date().toISOString(),
		}); //update version in storage
	} catch (error) {
		console.error("Error handling version update:", error);
	} //data migration handling for future
}

let leetcodeTabs = new Set(); //tab management for future

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === "complete" && tab.url) {
		const isLeetCode = tab.url.toLowerCase().includes("leetcode.com");

		if (isLeetCode) {
			leetcodeTabs.add(tabId);
			console.log("LeetCode tab detected:", tabId);
		} else {
			leetcodeTabs.delete(tabId);
		}
	}
});

chrome.tabs.onRemoved.addListener((tabId) => {
	leetcodeTabs.delete(tabId);
});

// msg handling for comms
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log("Background received message:", message);

	switch (message.type) {
		case "GET_EXTENSION_INFO":
			sendResponse({
				version: chrome.runtime.getManifest().version,
				leetcodeTabs: Array.from(leetcodeTabs),
			});
			break;

		case "LOG_ERROR":
			console.error(
				"Error reported from",
				sender.tab?.url || "unknown:",
				message.error
			);
			// potential error tracking logic will go here
			break;

		case "LOG_EVENT":
			console.log("Event logged:", message.event, message.data);
			// potential analytics
			break;

		default:
			console.log("Unknown message type:", message.type);
	}
});

self.addEventListener("error", (error) => {
	console.error("Background script error:", error);
});

self.addEventListener("unhandledrejection", (event) => {
	console.error("Background script unhandled rejection:", event.reason);
});

function isLeetCodeTab(tabId) {
	return leetcodeTabs.has(tabId);
}

function getLeetCodeTabs() {
	return Array.from(leetcodeTabs);
}

globalThis.speedCodeBackground = {
	isLeetCodeTab,
	getLeetCodeTabs,
};
