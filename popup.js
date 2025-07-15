document.addEventListener("DOMContentLoaded", async () => {
	const problemInfo = document.getElementById("problemInfo");
	const bucketList = document.getElementById("bucketList");
	const bucketListContainer = document.getElementById("bucketListContainer");
	let isBucketVisible = false;

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

					infoHTML += `<div class="button-group">`;
					infoHTML += `<button id="addToBucketBtn" class="bucket-btn">🪣 Add</button>`;
					infoHTML += `<button id="viewBucketBtn" class="bucket-btn">👁️ View</button>`;
					infoHTML += `</div>`;

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

					const addBucketBtn =
						document.getElementById("addToBucketBtn");
					const viewBucketBtn =
						document.getElementById("viewBucketBtn");

					addBucketBtn.addEventListener("click", async () => {
						if (!response) return;

						chrome.storage.local.get(["bucket"], (result) => {
							const bucket = result.bucket || [];

							const alreadyInBucket = bucket.some(
								(p) =>
									p.url.toLowerCase() ===
									response.url.toLowerCase()
							);

							if (!alreadyInBucket) {
								bucket.push(response);
								chrome.storage.local.set({ bucket }, () => {
									addBucketBtn.innerHTML = "✅ Added!";
									addBucketBtn.style.background = "#10b981";
									addBucketBtn.style.color = "white";

									setTimeout(() => {
										addBucketBtn.innerHTML = "🪣 Add";
										addBucketBtn.style.background = "";
										addBucketBtn.style.color = "";
									}, 1500);
								});
							} else {
								addBucketBtn.innerHTML = "👍 Already added";
								addBucketBtn.style.background = "#f59e0b";
								addBucketBtn.style.color = "white";

								setTimeout(() => {
									addBucketBtn.innerHTML = "🪣 Add";
									addBucketBtn.style.background = "";
									addBucketBtn.style.color = "";
								}, 1500);
							}
						});
					});

					viewBucketBtn.addEventListener("click", async () => {
						isBucketVisible = !isBucketVisible;

						if (isBucketVisible) {
							bucketListContainer.style.display = "block";
							viewBucketBtn.innerHTML = "🙈 Hide";
							viewBucketBtn.style.background = "#6b7280";
							viewBucketBtn.style.color = "white";
							renderBucketList();
						} else {
							bucketListContainer.style.display = "none";
							viewBucketBtn.innerHTML = "👁️ View";
							viewBucketBtn.style.background = "";
							viewBucketBtn.style.color = "";
						}
					});
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

				if (bucket.length === 0) {
					bucketList.innerHTML =
						'<div style="color: #6b7280; text-align: center; padding: 20px;">No problems in bucket yet</div>';
					return;
				}

				bucket.forEach((problem, index) => {
					const item = document.createElement("div");
					item.className = "bucket-item";
					item.innerHTML = `
						<a href="${problem.url}" target="_blank">
						<span class="bucket-difficulty-${(problem.difficulty || "").toLowerCase()}">
							#${problem.problemNumber || "?"}: ${problem.problemTitle}
						</span>
						</a>
						<button data-index="${index}" class="remove-button">❌</button>
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
