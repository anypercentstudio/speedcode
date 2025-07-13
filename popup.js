document.addEventListener("DOMContentLoaded", async () => {
	const problemInfo = document.getElementById("problemInfo");

	try {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});

		if (!tab || !tab.url) {
			return;
		}

		const isOnLeetCode = tab.url.toLowerCase().includes("leetcode.com");

		if (isOnLeetCode) {
			try {
				const response = await chrome.tabs.sendMessage(tab.id, {
					action: "getProblemInfo",
				});

				if (response && response.onProblem) {
					let infoHTML = "";

					if (response.problemNumber) {
						infoHTML += `<div class="problem-number">#${response.problemNumber}</div>`;
					}

					if (response.problemTitle) {
						infoHTML += `<div class="problem-title">${response.problemTitle}</div>`;
					}

					if (response.difficulty) {
						infoHTML += `<div class="difficulty difficulty-${response.difficulty.toLowerCase()}">${
							response.difficulty
						}</div>`;
					}

					problemInfo.innerHTML = infoHTML;
				}
			} catch (error) {
				console.log("Content script error:", error);
			}
		}
	} catch (error) {
		console.error("Error:", error);
	}
});
