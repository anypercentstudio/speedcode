import {
	app,
	db,
	auth,
	signInAnonymously,
	onAuthStateChanged,
} from "./firebaseConfig.js";
import { getDoc, setDoc, doc } from "firebase/firestore";

console.log("Firebase app initialized:", app.name);

let userId = null;
let isOnline = navigator.onLine;
let activeTimer = null;

const FEEDBACK_DURATION = 3000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function showError(element, message, duration = FEEDBACK_DURATION) {
	element.innerHTML = `❌ ${message}`;
	element.style.background = "#ef4444";
	element.style.color = "white";
	element.disabled = true;

	setTimeout(() => {
		resetButton(element);
	}, duration);
}

function showSuccess(element, message, duration = FEEDBACK_DURATION) {
	element.innerHTML = `✅ ${message}`;
	element.style.background = "#10b981";
	element.style.color = "white";
	element.disabled = true;

	setTimeout(() => {
		resetButton(element);
	}, duration);
}

function showLoading(element, message = "Loading...") {
	element.innerHTML = `⏳ ${message}`;
	element.style.background = "#6b7280";
	element.style.color = "white";
	element.disabled = true;
}

function resetButton(element) {
	element.disabled = false;
	if (element.id === "addToBucketBtn") {
		element.innerHTML = "🪣 Add";
	} else if (element.id === "viewBucketBtn") {
		element.innerHTML = "👁️ View";
	}
	element.style.background = "";
	element.style.color = "";
}

function showConnectionStatus() {
	const statusDiv = document.createElement("div");
	statusDiv.id = "connectionStatus";
	statusDiv.style.cssText = `
		position: fixed;
		top: 10px;
		left: 10px;
		right: 10px;
		padding: 8px;
		border-radius: 6px;
		font-size: 12px;
		text-align: center;
		z-index: 1000;
		display: none;
	`;

	if (!isOnline) {
		statusDiv.innerHTML = "📶 Offline - Changes will sync when connected";
		statusDiv.style.background = "#f59e0b";
		statusDiv.style.color = "white";
		statusDiv.style.display = "block";
	}

	document.body.insertBefore(statusDiv, document.body.firstChild);
	return statusDiv;
}

async function retryOperation(operation, maxRetries = MAX_RETRIES) {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			console.log(`Attempt ${attempt} failed:`, error);

			if (attempt === maxRetries) {
				throw error;
			}

			// Wait before retrying
			await new Promise((resolve) =>
				setTimeout(resolve, RETRY_DELAY * attempt)
			);
		}
	}
}

window.addEventListener("online", () => {
	isOnline = true;
	const statusDiv = document.getElementById("connectionStatus");
	if (statusDiv) {
		statusDiv.style.display = "none";
	}
});

window.addEventListener("offline", () => {
	isOnline = false;
	showConnectionStatus();
});

document.addEventListener("DOMContentLoaded", async () => {
	const statusDiv = showConnectionStatus();

	try {
		await signInAnonymously(auth);
		console.log("Signed in anonymously");
	} catch (error) {
		console.error("Anonymous sign-in error:", error);
	}

	onAuthStateChanged(auth, (user) => {
		if (user) {
			userId = user.uid;
			console.log("Current user ID:", userId);
			initPopupWithUser(userId);
		} else {
			console.error("Authentication failed");
			showAuthError();
		}
	});

	function showAuthError() {
		const problemInfo = document.getElementById("problemInfo");
		problemInfo.innerHTML = `
			<div style="color: #ef4444; text-align: center; padding: 20px;">
				<div>⚠️ Authentication Error</div>
				<div style="font-size: 12px; margin-top: 8px;">
					Please refresh the extension or check your connection
				</div>
			</div>
		`;
	}

	async function initPopupWithUser(userId) {
		const problemInfo = document.getElementById("problemInfo");
		const bucketList = document.getElementById("bucketList");
		const bucketListContainer = document.getElementById(
			"bucketListContainer"
		);
		let isBucketVisible = false;

		try {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab || !tab.url) {
				problemInfo.innerHTML = `
					<div style="color: #6b7280; text-align: center; padding: 20px;">
						<div>🔍 No Active Tab</div>
						<div style="font-size: 12px; margin-top: 8px;">
							Please navigate to a LeetCode problem
						</div>
					</div>
				`;
				return;
			}

			const isOnLeetCode = tab.url.toLowerCase().includes("leetcode.com");

			if (!isOnLeetCode) {
				problemInfo.innerHTML = `
					<div style="color: #6b7280; text-align: center; padding: 20px;">
						<div>🎯 Not on LeetCode</div>
						<div style="font-size: 12px; margin-top: 8px;">
							Visit a LeetCode problem to track it
						</div>
						<button id="viewBucketBtn" class="bucket-btn" style="margin-top: 12px;">👁️ View Bucket</button>
					</div>
				`;

				// allow bucket viewing when not on LeetCode
				const viewBucketBtn = document.getElementById("viewBucketBtn");
				if (viewBucketBtn) {
					setupBucketViewButton(viewBucketBtn, bucketListContainer);
				}
				return;
			}

			problemInfo.innerHTML = `
				<div style="color: #6b7280; text-align: center; padding: 20px;">
					<div>⏳ Loading problem info...</div>
				</div>
			`;

			try {
				const response = await chrome.tabs.sendMessage(tab.id, {
					action: "getProblemInfo",
				});

				if (response && response.onProblem) {
					renderProblemInfo(
						response,
						problemInfo,
						bucketListContainer
					);
				} else {
					problemInfo.innerHTML = `
						<div style="color: #f59e0b; text-align: center; padding: 20px;">
							<div>⚠️ Problem Not Detected</div>
							<div style="font-size: 12px; margin-top: 8px;">
								Make sure you're on a LeetCode problem page
							</div>
							<button id="viewBucketBtn" class="bucket-btn" style="margin-top: 12px;">👁️ View Bucket</button>
						</div>
					`;

					const viewBucketBtn =
						document.getElementById("viewBucketBtn");
					if (viewBucketBtn) {
						setupBucketViewButton(
							viewBucketBtn,
							bucketListContainer
						);
					}
				}
			} catch (error) {
				console.log("Content script error:", error);
				problemInfo.innerHTML = `
					<div style="color: #f59e0b; text-align: center; padding: 20px;">
						<div>⚠️ Connection Error</div>
						<div style="font-size: 12px; margin-top: 8px;">
							Try refreshing the LeetCode page
						</div>
						<button id="viewBucketBtn" class="bucket-btn" style="margin-top: 12px;">👁️ View Bucket</button>
					</div>
				`;

				const viewBucketBtn = document.getElementById("viewBucketBtn");
				if (viewBucketBtn) {
					setupBucketViewButton(viewBucketBtn, bucketListContainer);
				}
			}
		} catch (error) {
			console.error("Error in initPopupWithUser:", error);
			problemInfo.innerHTML = `
				<div style="color: #ef4444; text-align: center; padding: 20px;">
					<div>❌ Extension Error</div>
					<div style="font-size: 12px; margin-top: 8px;">
						Please restart the extension
					</div>
				</div>
			`;
		}

		function renderProblemInfo(response, problemInfo, bucketListContainer) {
			let infoHTML = "";

			infoHTML += `<div class="info-header">`;

			if (response.problemNumber) {
				infoHTML += `<div class="problem-number">#${response.problemNumber}</div>`;
			}

			infoHTML += `<div class="button-group">`;
			infoHTML += `<button id="addToBucketBtn" class="bucket-btn">🪣 Add</button>`;
			infoHTML += `<button id="viewBucketBtn" class="bucket-btn">👁️ View</button>`;
			infoHTML += `<button id="startTimerBtn" class="bucket-btn">⏱️ Timer</button>`;
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

			const addBucketBtn = document.getElementById("addToBucketBtn");
			const viewBucketBtn = document.getElementById("viewBucketBtn");
			const timerBtn = document.getElementById("startTimerBtn");

			//if timer is already running, update UI
			chrome.storage.local.get(["activeTimer"], (result) => {
				const activeTimer = result.activeTimer;
				if (activeTimer && activeTimer.problemTitle === response.problemTitle) {
					timerBtn.innerHTML = "⏹️ Stop";
					timerBtn.style.background = "#f59e0b";
					timerBtn.style.color = "white";
				}
			});

			setupAddToBucketButton(addBucketBtn, response);
			setupBucketViewButton(viewBucketBtn, bucketListContainer);
			setupTimerButton(timerBtn, response);
		}

		function setupAddToBucketButton(button, problemData) {
			button.addEventListener("click", async () => {
				if (!problemData || !isOnline) {
					if (!isOnline) {
						showError(button, "Offline - Try again when connected");
					} else {
						showError(button, "Problem data missing");
					}
					return;
				}

				showLoading(button, "Adding...");

				try {
					await retryOperation(async () => {
						const bucketRef = doc(
							db,
							`users/${userId}/buckets/default`
						);
						const docSnap = await getDoc(bucketRef);
						const currentProblems = docSnap.exists()
							? docSnap.data().problems || []
							: [];

						const alreadyInBucket = currentProblems.some(
							(p) =>
								p.url.toLowerCase() ===
								problemData.url.toLowerCase()
						);

						if (!alreadyInBucket) {
							//data validation
							const problemToAdd = {
								problemNumber:
									problemData.problemNumber || "Unknown",
								problemTitle:
									problemData.problemTitle ||
									"Unknown Problem",
								difficulty: problemData.difficulty || "Unknown",
								url: problemData.url,
								addedAt: new Date().toISOString(),
								times: [],
							};

							currentProblems.push(problemToAdd);
							await setDoc(
								bucketRef,
								{ problems: currentProblems },
								{ merge: true }
							);
							showSuccess(button, "Added to bucket!");
						} else {
							showSuccess(button, "Already in bucket");
						}
					});
				} catch (error) {
					console.error("Error adding to bucket:", error);

					if (error.code === "permission-denied") {
						showError(
							button,
							"Permission denied - Try signing in again"
						);
					} else if (error.code === "unavailable") {
						showError(
							button,
							"Service unavailable - Try again later"
						);
					} else {
						showError(button, "Failed to add - Try again");
					}
				}
			});
		}

		function setupBucketViewButton(button, bucketListContainer) {
			button.addEventListener("click", async () => {
				isBucketVisible = !isBucketVisible;

				if (isBucketVisible) {
					bucketListContainer.style.display = "block";
					button.innerHTML = "🙈 Hide";
					button.style.background = "#6b7280";
					button.style.color = "white";
					await renderBucketList();
				} else {
					bucketListContainer.style.display = "none";
					button.innerHTML = "👁️ View";
					button.style.background = "";
					button.style.color = "";
				}
			});
		}

		function setupTimerButton(button, problemData) {
			button.addEventListener("click", async () => {
				if (!problemData || !userId) return;

				const currentTitle = problemData.problemTitle;

				chrome.storage.local.get(["activeTimer"], async (result) => {
					const activeTimer = result.activeTimer;
					const activeTitle = activeTimer?.problemTitle;

					if (activeTimer && activeTitle == currentTitle) {
						//case 1: if timer is alrdy runnning and we're on the problem with the timer, stop the timer
						const elapsedMs = Date.now() - activeTimer.startTime;
						const elapsedSeconds = Math.round(elapsedMs / 1000);
						const mins = Math.floor(elapsedSeconds / 60);
						const secs = elapsedSeconds % 60;

						chrome.storage.local.remove("activeTimer");

						//reset button UI
						button.innerHTML = "⏱️ Timer";
						button.style.background = "";
						button.style.color = "";

						//save to firestore
						try {
							await retryOperation(async () => {
								const bucketRef = doc(db, `users/${userId}/buckets/default`);
								const docSnap = await getDoc(bucketRef);
								if (!docSnap.exists()) return;

								const currentProblems = docSnap.data().problems || [];
								const index = currentProblems.findIndex(p => p.problemTitle === currentTitle);
								if (index === -1) return;

								if (!Array.isArray(currentProblems[index].times)) {
									currentProblems[index].times = [];
								}
								currentProblems[index].times.push(`${mins}m ${secs}s`);

								await setDoc(bucketRef, { problems: currentProblems }, { merge: true });
								showSuccess(button, "Time saved!");
							});
						} catch (error) {
							console.error("Failed to save time:", error);
							showError(button, "Failed to save time");
						}
					} else { 
						//either no active timer or we're not on the same problem with the active timer, so start a new timer
						chrome.storage.local.set({
							activeTimer: {
								startTime: Date.now(),
								problemTitle: problemData.problemTitle,
							}
						});
						button.innerHTML = "⏹️ Stop";
						button.style.background = "#f59e0b";
						button.style.color = "white";
					}
				});
			});
		}
	}

	async function renderBucketList() {
		const bucketList = document.getElementById("bucketList");

		bucketList.innerHTML = `
			<div style="color: #6b7280; text-align: center; padding: 20px;">
				⏳ Loading bucket...
			</div>
		`;

		try {
			await retryOperation(async () => {
				const bucketRef = doc(db, `users/${userId}/buckets/default`);
				const docSnap = await getDoc(bucketRef);
				const bucket = docSnap.exists()
					? docSnap.data().problems || []
					: [];

				bucketList.innerHTML = "";

				if (bucket.length === 0) {
					bucketList.innerHTML = `
						<div style="color: #6b7280; text-align: center; padding: 20px;">
							<div>📝 No problems saved yet</div>
							<div style="font-size: 12px; margin-top: 8px;">
								Add problems from LeetCode to track them here
							</div>
						</div>
					`;
					return;
				}

				bucket.forEach((problem, index) => {
					const item = document.createElement("div");
					item.className = "bucket-item";

					const problemNumber = problem.problemNumber || "?";
					const problemTitle =
						problem.problemTitle || "Unknown Problem";
					const difficulty = (problem.difficulty || "").toLowerCase();
					const url = problem.url || "#";

					item.innerHTML = `
						<a href="${url}" target="_blank">
							<span class="bucket-difficulty-${difficulty}">
								#${problemNumber}: ${problemTitle}
							</span>
						</a>
						<button data-index="${index}" class="remove-button" title="Remove from bucket">❌</button>
					`;
					bucketList.appendChild(item);
				});

				document.querySelectorAll(".remove-button").forEach((btn) => {
					//TODO: change to matching by problem title rather than data-index attribute for safety
					btn.addEventListener("click", async (e) => {
						const indexToRemove = parseInt(e.target.dataset.index);
						const originalText = e.target.innerHTML;

						e.target.innerHTML = "⏳";
						e.target.disabled = true;

						try {
							await retryOperation(async () => {
								bucket.splice(indexToRemove, 1);
								const bucketRef = doc(
									db,
									`users/${userId}/buckets/default`
								);
								await setDoc(
									bucketRef,
									{ problems: bucket },
									{ merge: true }
								);
							});

							await renderBucketList(); // re-render the list
						} catch (error) {
							console.error("Error removing from bucket:", error);
							e.target.innerHTML = "❌";
							e.target.disabled = false;

							//temp error message
							const errorMsg = document.createElement("div");
							errorMsg.style.cssText =
								"color: #ef4444; font-size: 12px; margin-top: 4px;";
							errorMsg.textContent =
								"Failed to remove - try again";
							e.target.parentNode.appendChild(errorMsg);

							setTimeout(() => {
								if (errorMsg.parentNode) {
									errorMsg.parentNode.removeChild(errorMsg);
								}
							}, 3000);
						}
					});
				});
			});
		} catch (error) {
			console.error("Error loading bucket:", error);
			bucketList.innerHTML = `
				<div style="color: #ef4444; text-align: center; padding: 20px;">
					<div>❌ Failed to load bucket</div>
					<div style="font-size: 12px; margin-top: 8px;">
						Check your connection and try again
					</div>
				</div>
			`;
		}
	}
});
