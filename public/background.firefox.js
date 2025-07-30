console.log("SpeedCode Firefox background script loaded");

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

browserAPI.runtime.onInstalled.addListener((details) => {
	console.log("SpeedCode installed/updated:", details.reason);

	if (details.reason === "install") {
		console.log("Welcome to SpeedCode!"); // first time installation

		browserAPI.storage.local.set({
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
			browserAPI.runtime.getManifest().version
		); // extension updated

		handleVersionUpdate(details.previousVersion); // migration logic if needed in future
	}
});

if (browserAPI.runtime.onStartup) {
	browserAPI.runtime.onStartup.addListener(() => {
		console.log("SpeedCode started");
	});
}

async function handleVersionUpdate(previousVersion) {
	try {
		const currentVersion = browserAPI.runtime.getManifest().version;
		console.log(
			"Handling update from",
			previousVersion,
			"to",
			currentVersion
		);

		await browserAPI.storage.local.set({
			speedcode_version: currentVersion,
			speedcode_update_date: new Date().toISOString(),
		}); // update version in storage
	} catch (error) {
		console.error("Error handling version update:", error);
	} // data migration handling for future
}

let leetcodeTabs = new Set(); // tab management for future

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
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

browserAPI.tabs.onRemoved.addListener((tabId) => {
	leetcodeTabs.delete(tabId);
});

// message handling for communications
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log("Background received message:", message);

	switch (message.type) {
		case "GET_EXTENSION_INFO":
			sendResponse({
				version: browserAPI.runtime.getManifest().version,
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

	// IMPORTANT - return true for async response in Firefox
	return true;
});

if (typeof window !== "undefined") {
	window.addEventListener("error", (error) => {
		console.error("Background script error:", error);
	});

	window.addEventListener("unhandledrejection", (event) => {
		console.error("Background script unhandled rejection:", event.reason);
	});
}

function isLeetCodeTab(tabId) {
	return leetcodeTabs.has(tabId);
}

function getLeetCodeTabs() {
	return Array.from(leetcodeTabs);
}

if (typeof window !== "undefined") {
	window.speedCodeBackground = {
		isLeetCodeTab,
		getLeetCodeTabs,
	};
}
