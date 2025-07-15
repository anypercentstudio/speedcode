document.addEventListener("DOMContentLoaded", async () => {
	const problemInfo = document.getElementById("problemInfo");
	const bucketList = document.getElementById("bucketList");

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

					infoHTML += `<div class="info-header">`;

					if (response.problemNumber) {
						infoHTML += `<div class="problem-number">#${response.problemNumber}</div>`;
					}

					infoHTML += `<button id="addToBucketBtn" class="bucket-btn">Add to Bucket</button>`;

					infoHTML += `<button id="viewBucketBtn" class="bucket-btn">View Bucket</button>`;

					infoHTML += `</div>`;

					if (response.problemTitle) {
						infoHTML += `<div class="problem-title">${response.problemTitle}</div>`;
					}

					if (response.difficulty) {
						infoHTML += `<div class="difficulty difficulty-${response.difficulty.toLowerCase()}">${
							response.difficulty
						}</div>`;
					}

					problemInfo.innerHTML = infoHTML;
					const addBucketBtn = document.getElementById("addToBucketBtn");
					const viewBucketBtn = document.getElementById("viewBucketBtn");

					addBucketBtn.addEventListener("click", async () => {
						if (!response) return;

						chrome.storage.local.get(["bucket"], (result) => {
							const bucket = result.bucket || [];

							const alreadyInBucket = bucket.some(
								(p) => p.url.toLowerCase() === response.url.toLowerCase()
							);

							if (!alreadyInBucket) {
								bucket.push(response);
							}

							saveAndRenderBucket(bucket, response);
						});
					});

					viewBucketBtn.addEventListener("click", async () => {
						if (!response) return;

						chrome.storage.local.get(["bucket"], (result) => {
							const bucket = result.bucket || [];
							saveAndRenderBucket(bucket, response);
						});
					})

					function saveAndRenderBucket(bucket, response) {
						chrome.storage.local.set({ bucket }, () => {
							console.log("Saved to bucket:", response);
							document.getElementById("bucketListContainer").style.display = "block";
							renderBucketList();
						});
					}
				}
			} catch (error) {
				console.log("Content script error:", error);
			}
		}
	} catch (error) {
		console.error("Error:", error);
	}

	function renderBucketList() {
		if (chrome && chrome.storage && chrome.storage.local) {
			chrome.storage.local.get(["bucket"], (result) => {
				const bucket = result.bucket || [];
				bucketList.innerHTML = "";
				console.log("bucket: ", bucket);

				bucket.forEach((problem, index) => {
					const item = document.createElement("div");
					item.className = "bucket-item";
					item.innerHTML = `
						<a href="${problem.url}" target="_blank">
						<span class="bucket-difficulty-${(problem.difficulty || "").toLowerCase()}">
							#${problem.problemNumber || "?"}: ${problem.problemTitle}
						</span>
						</a>
						<button data-index="${index}" class="remove-button">X</button>
					`;
					bucketList.appendChild(item);
				});

				document.querySelectorAll(".remove-button").forEach((btn) => {
					btn.addEventListener("click", (e) => {
						const indexToRemove = parseInt(e.target.dataset.index);
						bucket.splice(indexToRemove, 1);
						chrome.storage.local.set({ bucket }, renderBucketList);
					});
				});
			});
		} else {
			console.error("chrome.storage.local is not available.");
		}
	}

});
