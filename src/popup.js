import {
	app,
	db,
	auth,
	signInAnonymously,
	onAuthStateChanged,
} from "./firebaseConfig.js";
import {
	getDoc,
	setDoc,
	doc,
	collection,
	addDoc,
	onSnapshot,
	updateDoc,
	arrayUnion,
	arrayRemove,
} from "firebase/firestore";

console.log("Firebase app initialized:", app.name);

let userId = null;
let currentUsername = null;
let isOnline = navigator.onLine;
let activeTimer = null;
let currentRoomId = null;
let roomListener = null;

const FEEDBACK_DURATION = 3000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const LoadingStates = {
	INITIALIZING: "initializing",
	AUTHENTICATING: "authenticating",
	SETTING_USERNAME: "setting_username",
	DETECTING_PROBLEM: "detecting_problem",
	READY: "ready",
	ERROR: "error",
};

let currentLoadingState = LoadingStates.INITIALIZING;

function showLoadingUI(state, message) {
	const problemInfo = document.getElementById("problemInfo");

	const stateConfig = {
		[LoadingStates.INITIALIZING]: {
			icon: "🚀",
			title: "Starting SpeedCode...",
			subtitle: "Initializing extension",
			color: "#3b82f6",
		},
		[LoadingStates.AUTHENTICATING]: {
			icon: "🔐",
			title: "Connecting...",
			subtitle: "Setting up secure connection",
			color: "#8b5cf6",
		},
		[LoadingStates.SETTING_USERNAME]: {
			icon: "👤",
			title: "Setting up profile...",
			subtitle: "One moment please",
			color: "#10b981",
		},
		[LoadingStates.DETECTING_PROBLEM]: {
			icon: "🔍",
			title: "Analyzing page...",
			subtitle: "Looking for LeetCode problems",
			color: "#f59e0b",
		},
		[LoadingStates.ERROR]: {
			icon: "⚠️",
			title: "Connection Error",
			subtitle: message || "Please try again",
			color: "#ef4444",
		},
	};

	const config =
		stateConfig[state] || stateConfig[LoadingStates.INITIALIZING];

	problemInfo.innerHTML = `
		<div style="text-align: center; padding: 32px 24px;">
			<div style="font-size: 32px; margin-bottom: 16px; animation: bounce 2s infinite;">
				${config.icon}
			</div>
			<div style="color: white; font-size: 16px; font-weight: 600; margin-bottom: 8px;">
				${config.title}
			</div>
			<div style="color: #6b7280; font-size: 13px; margin-bottom: 20px;">
				${config.subtitle}
			</div>
			<div style="width: 100%; height: 3px; background: #333; border-radius: 2px; overflow: hidden;">
				<div style="
					width: 100%; 
					height: 100%; 
					background: linear-gradient(90deg, ${config.color}, ${config.color}aa);
					animation: loading 2s ease-in-out infinite;
					border-radius: 2px;
				"></div>
			</div>
		</div>
	`;
}

function addLoadingStyles() {
	if (document.getElementById("speedcode-loading-styles")) return;

	const style = document.createElement("style");
	style.id = "speedcode-loading-styles";
	style.textContent = `
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
	document.head.appendChild(style);
}

function showUsernameSetup() {
	return new Promise((resolve) => {
		const modal = document.createElement("div");
		modal.className = "speedcode-fade-in";
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0,0,0,0.9);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 10000;
			backdrop-filter: blur(8px);
		`;

		modal.innerHTML = `
			<div class="speedcode-fade-in" style="background: #1a1a1a; padding: 32px; border-radius: 16px; width: 320px; text-align: center; border: 1px solid #333;">
				<div style="font-size: 40px; margin-bottom: 16px;">👋</div>
				<h3 style="color: white; margin: 0 0 8px 0; font-size: 20px;">Welcome to SpeedCode!</h3>
				<p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px; line-height: 1.5;">
					Choose a username to get started with collaborative problem solving
				</p>
				<input 
					type="text" 
					id="usernameInput" 
					placeholder="Enter your username..."
					style="
						width: 100%; 
						padding: 14px; 
						border: 2px solid #333; 
						border-radius: 8px; 
						background: #333; 
						color: white; 
						font-size: 16px; 
						margin-bottom: 20px;
						box-sizing: border-box;
						transition: border-color 0.2s ease;
					"
					maxlength="20"
				>
				<button 
					id="saveUsernameBtn"
					style="
						background: linear-gradient(135deg, #10b981, #059669); 
						color: white; 
						border: none; 
						padding: 14px 28px; 
						border-radius: 8px; 
						cursor: pointer; 
						font-weight: 600; 
						width: 100%;
						font-size: 16px;
						transition: transform 0.2s ease;
					"
				>
					Get Started
				</button>
				<div style="color: #6b7280; font-size: 12px; margin-top: 12px;">
					No registration required • You can change this later
				</div>
			</div>
		`;

		document.body.appendChild(modal);

		const input = document.getElementById("usernameInput");
		const saveBtn = document.getElementById("saveUsernameBtn");

		setTimeout(() => input.focus(), 100);

		saveBtn.addEventListener("mouseenter", () => {
			saveBtn.style.transform = "translateY(-1px)";
		});

		saveBtn.addEventListener("mouseleave", () => {
			if (!saveBtn.disabled) {
				saveBtn.style.transform = "translateY(0)";
			}
		});

		input.addEventListener("focus", () => {
			input.style.borderColor = "#10b981";
		});

		input.addEventListener("blur", () => {
			input.style.borderColor = "#333";
		});

		input.addEventListener("input", () => {
			const username = input.value.trim();
			if (username.length >= 2) {
				input.style.borderColor = "#10b981";
				saveBtn.disabled = false;
				saveBtn.style.opacity = "1";
			} else {
				input.style.borderColor = "#333";
				saveBtn.disabled = true;
				saveBtn.style.opacity = "0.6";
			}
		});

		const handleSave = async () => {
			const username = input.value.trim();
			if (username.length < 2) {
				input.style.borderColor = "#ef4444";
				input.placeholder = "Username must be at least 2 characters";
				return;
			}

			saveBtn.disabled = true;
			saveBtn.innerHTML = "⏳ Setting up...";
			saveBtn.style.transform = "translateY(0)";

			try {
				await setDoc(
					doc(db, `users/${userId}`),
					{
						username: username,
						createdAt: new Date().toISOString(),
						joinedRooms: [],
					},
					{ merge: true }
				);

				currentUsername = username;

				saveBtn.innerHTML = "✅ Welcome!";
				saveBtn.style.background = "#10b981";

				setTimeout(() => {
					modal.style.opacity = "0";
					modal.style.transition = "opacity 0.3s ease";
					setTimeout(() => {
						if (document.body.contains(modal)) {
							document.body.removeChild(modal);
						}
						resolve(username);
					}, 300);
				}, 800); // Reduced delay for faster transition
			} catch (error) {
				console.error("Error saving username:", error);
				saveBtn.disabled = false;
				saveBtn.innerHTML = "Get Started";
				input.style.borderColor = "#ef4444";

				const errorDiv = document.createElement("div");
				errorDiv.style.cssText =
					"color: #ef4444; font-size: 12px; margin-top: 8px;";
				errorDiv.textContent =
					"Failed to save username. Please try again.";
				saveBtn.parentNode.insertBefore(errorDiv, saveBtn.nextSibling);

				setTimeout(() => errorDiv.remove(), 3000);
			}
		};

		saveBtn.addEventListener("click", handleSave);
		input.addEventListener("keypress", (e) => {
			if (e.key === "Enter" && !saveBtn.disabled) handleSave();
		});
	});
}

document.addEventListener("DOMContentLoaded", async () => {
	addLoadingStyles();
	showLoadingUI(LoadingStates.INITIALIZING);

	try {
		showLoadingUI(LoadingStates.AUTHENTICATING);
		await signInAnonymously(auth);
		console.log("Signed in anonymously");

		await new Promise((resolve) => {
			const unsubscribe = onAuthStateChanged(auth, async (user) => {
				if (user) {
					unsubscribe();
					userId = user.uid;
					console.log("Current user ID:", userId);
					resolve();
				}
			});
		});

		showLoadingUI(LoadingStates.SETTING_USERNAME);
		await initializeUsername();
		console.log("Username initialized:", currentUsername);

		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});

		if (tab?.url?.toLowerCase().includes("leetcode.com")) {
			showLoadingUI(LoadingStates.DETECTING_PROBLEM);
			await new Promise((resolve) => setTimeout(resolve, 300));
		}

		console.log("Initializing main UI...");
		await initPopupWithUser(userId);
	} catch (error) {
		console.error("Initialization error:", error);
		showLoadingUI(LoadingStates.ERROR, error.message);

		setTimeout(() => {
			const problemInfo = document.getElementById("problemInfo");
			const retryDiv = document.createElement("div");
			retryDiv.style.cssText = "margin-top: 16px;";

			const retryBtn = document.createElement("button");
			retryBtn.style.cssText = `
				background: #3b82f6; 
				color: white; 
				border: none; 
				padding: 8px 16px; 
				border-radius: 6px; 
				cursor: pointer; 
				font-size: 12px;
			`;
			retryBtn.textContent = "Retry";
			retryBtn.addEventListener("click", () => {
				window.location.reload();
			});

			retryDiv.appendChild(retryBtn);
			problemInfo.appendChild(retryDiv);
		}, 1000);
	}
});

async function initializeUsername() {
	try {
		const userDoc = await getDoc(doc(db, `users/${userId}`));

		if (userDoc.exists() && userDoc.data().username) {
			currentUsername = userDoc.data().username;
			console.log("Existing username found:", currentUsername);
			return currentUsername;
		} else {
			return await showUsernameSetup();
		}
	} catch (error) {
		console.error("Error initializing username:", error);
		return await showUsernameSetup();
	}
}

function generateRoomId() {
	return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createSharedRoom() {
	const roomName =
		prompt("Enter room name (optional):") || `${currentUsername}'s Room`;
	const roomId = generateRoomId();

	try {
		await setDoc(doc(db, `sharedBuckets/${roomId}`), {
			name: roomName,
			createdBy: currentUsername,
			createdAt: new Date().toISOString(),
			problems: [],
			members: [currentUsername],
		});

		await updateDoc(doc(db, `users/${userId}`), {
			joinedRooms: arrayUnion(roomId),
		});

		return roomId;
	} catch (error) {
		console.error("Error creating room:", error);
		throw error;
	}
}

async function joinSharedRoom(roomId) {
	try {
		const roomDoc = await getDoc(doc(db, `sharedBuckets/${roomId}`));

		if (!roomDoc.exists()) {
			throw new Error("Room not found");
		}

		await updateDoc(doc(db, `sharedBuckets/${roomId}`), {
			members: arrayUnion(currentUsername),
		});

		await updateDoc(doc(db, `users/${userId}`), {
			joinedRooms: arrayUnion(roomId),
		});

		return roomId;
	} catch (error) {
		console.error("Error joining room:", error);
		throw error;
	}
}

function showShareModal() {
	return new Promise((resolve) => {
		const modal = document.createElement("div");
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0,0,0,0.8);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 10000;
			padding: 20px;
			box-sizing: border-box;
			overflow-y: auto;
		`;

		modal.innerHTML = `
			<div style="
				background: #1a1a1a; 
				padding: 20px; 
				border-radius: 12px; 
				width: 100%;
				max-width: 280px;
				max-height: 90vh;
				text-align: center;
				border: 1px solid #333;
				overflow-y: auto;
				margin: auto;
			">
				<h3 style="color: white; margin: 0 0 16px 0; font-size: 18px;">Shared Problem Bucket</h3>
				
				<button 
					id="createRoomBtn"
					style="
						background: #10b981; 
						color: white; 
						border: none; 
						padding: 10px 20px; 
						border-radius: 6px; 
						cursor: pointer; 
						font-weight: 600; 
						width: 100%; 
						margin-bottom: 12px;
						font-size: 14px;
					"
				>
					🏠 Create New Room
				</button>
				
				<div style="display: flex; align-items: center; margin: 14px 0;">
					<div style="flex: 1; height: 1px; background: #333;"></div>
					<span style="color: #6b7280; margin: 0 10px; font-size: 11px;">OR</span>
					<div style="flex: 1; height: 1px; background: #333;"></div>
				</div>
				
				<input 
					type="text" 
					id="roomIdInput" 
					placeholder="Enter Room ID..."
					style="
						width: 100%; 
						padding: 10px; 
						border: 1px solid #333; 
						border-radius: 6px; 
						background: #333; 
						color: white; 
						font-size: 13px; 
						margin-bottom: 12px; 
						text-transform: uppercase;
						box-sizing: border-box;
					"
					maxlength="6"
				>
				
				<button 
					id="joinRoomBtn"
					style="
						background: #3b82f6; 
						color: white; 
						border: none; 
						padding: 10px 20px; 
						border-radius: 6px; 
						cursor: pointer; 
						font-weight: 600; 
						width: 100%; 
						margin-bottom: 14px;
						font-size: 14px;
					"
				>
					🚪 Join Room
				</button>
				
				<button 
					id="cancelBtn"
					style="
						background: #6b7280; 
						color: white; 
						border: none; 
						padding: 6px 14px; 
						border-radius: 6px; 
						cursor: pointer; 
						font-size: 12px;
					"
				>
					Cancel
				</button>
			</div>
		`;

		document.body.appendChild(modal);

		const createBtn = document.getElementById("createRoomBtn");
		const joinBtn = document.getElementById("joinRoomBtn");
		const roomInput = document.getElementById("roomIdInput");
		const cancelBtn = document.getElementById("cancelBtn");

		roomInput.addEventListener("input", (e) => {
			e.target.value = e.target.value
				.toUpperCase()
				.replace(/[^A-Z0-9]/g, "");
		});

		createBtn.addEventListener("click", async () => {
			createBtn.disabled = true;
			createBtn.textContent = "Creating...";

			try {
				const roomId = await createSharedRoom();
				document.body.removeChild(modal);
				resolve({ action: "create", roomId });
			} catch (error) {
				alert("Failed to create room. Please try again.");
				createBtn.disabled = false;
				createBtn.textContent = "🏠 Create New Room";
			}
		});

		joinBtn.addEventListener("click", async () => {
			const roomId = roomInput.value.trim();
			if (!roomId) {
				roomInput.style.borderColor = "#ef4444";
				return;
			}

			joinBtn.disabled = true;
			joinBtn.textContent = "Joining...";

			try {
				await joinSharedRoom(roomId);
				document.body.removeChild(modal);
				resolve({ action: "join", roomId });
			} catch (error) {
				alert("Failed to join room. Check the room ID and try again.");
				joinBtn.disabled = false;
				joinBtn.textContent = "🚪 Join Room";
				roomInput.style.borderColor = "#ef4444";
			}
		});

		cancelBtn.addEventListener("click", () => {
			document.body.removeChild(modal);
			resolve(null);
		});

		modal.addEventListener("click", (e) => {
			if (e.target === modal) {
				document.body.removeChild(modal);
				resolve(null);
			}
		});
	});
}

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
	} else if (element.id === "shareBtn") {
		element.innerHTML = "🔗 Share";
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

async function initPopupWithUser(userId) {
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
					<div style="margin-top: 12px; display: flex; gap: 8px;">
						<button id="viewBucketBtn" class="bucket-btn">👁️ View</button>
						<button id="shareBtn" class="bucket-btn">🔗 Share</button>
					</div>
				</div>
			`;

			setupUtilityButtons(bucketListContainer);
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
				renderProblemInfo(response, problemInfo, bucketListContainer);
			} else {
				problemInfo.innerHTML = `
					<div style="color: #f59e0b; text-align: center; padding: 20px;">
						<div>⚠️ Problem Not Detected</div>
						<div style="font-size: 12px; margin-top: 8px;">
							Make sure you're on a LeetCode problem page
						</div>
						<div style="margin-top: 12px; display: flex; gap: 8px;">
							<button id="viewBucketBtn" class="bucket-btn">👁️ View</button>
							<button id="shareBtn" class="bucket-btn">🔗 Share</button>
						</div>
					</div>
				`;

				setupUtilityButtons(bucketListContainer);
			}
		} catch (error) {
			console.log("Content script error:", error);
			problemInfo.innerHTML = `
				<div style="color: #f59e0b; text-align: center; padding: 20px;">
					<div>⚠️ Connection Error</div>
					<div style="font-size: 12px; margin-top: 8px;">
						Try refreshing the LeetCode page
					</div>
					<div style="margin-top: 12px; display: flex; gap: 8px;">
						<button id="viewBucketBtn" class="bucket-btn">👁️ View</button>
						<button id="shareBtn" class="bucket-btn">🔗 Share</button>
					</div>
				</div>
			`;

			setupUtilityButtons(bucketListContainer);
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

	function setupUtilityButtons(bucketListContainer) {
		const viewBucketBtn = document.getElementById("viewBucketBtn");
		const shareBtn = document.getElementById("shareBtn");

		if (viewBucketBtn) {
			setupBucketViewButton(viewBucketBtn, bucketListContainer);
		}

		if (shareBtn) {
			setupShareButton(shareBtn, bucketListContainer);
		}
	}

	function renderProblemInfo(response, problemInfo, bucketListContainer) {
		let infoHTML = "";

		infoHTML += `<div class="info-header speedcode-fade-in">`;

		if (response.problemNumber) {
			infoHTML += `<div class="problem-number">#${response.problemNumber}</div>`;
		}

		infoHTML += `<div class="button-group">`;
		infoHTML += `<button id="addToBucketBtn" class="bucket-btn">🪣 Add</button>`;
		infoHTML += `<button id="viewBucketBtn" class="bucket-btn">👁️ View</button>`;
		infoHTML += `<button id="shareBtn" class="bucket-btn">🔗 Share</button>`;
		infoHTML += `<button id="startTimerBtn" class="bucket-btn">⏱️ Timer</button>`;
		infoHTML += `</div>`;
		infoHTML += `</div>`;

		if (response.problemTitle) {
			infoHTML += `<div class="problem-title speedcode-fade-in" style="animation-delay: 0.1s;">${response.problemTitle}</div>`;
		}

		if (response.difficulty) {
			infoHTML += `<div class="difficulty difficulty-${response.difficulty.toLowerCase()} speedcode-fade-in" style="animation-delay: 0.2s;">${
				response.difficulty
			}</div>`;
		}

		problemInfo.innerHTML = infoHTML;

		const addBucketBtn = document.getElementById("addToBucketBtn");
		const viewBucketBtn = document.getElementById("viewBucketBtn");
		const shareBtn = document.getElementById("shareBtn");
		const timerBtn = document.getElementById("startTimerBtn");

		chrome.storage.local.get(["activeTimer"], (result) => {
			const activeTimer = result.activeTimer;
			if (
				activeTimer &&
				activeTimer.problemTitle === response.problemTitle
			) {
				timerBtn.innerHTML = "⏹️ Stop";
				timerBtn.style.background = "#f59e0b";
				timerBtn.style.color = "white";
			}
		});

		setupAddToBucketButton(addBucketBtn, response);
		setupBucketViewButton(viewBucketBtn, bucketListContainer);
		setupShareButton(shareBtn, bucketListContainer);
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
					const targetBucket = currentRoomId
						? `sharedBuckets/${currentRoomId}`
						: `users/${userId}/buckets/default`;

					const bucketRef = doc(db, targetBucket);
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
						const problemToAdd = {
							problemNumber:
								problemData.problemNumber || "Unknown",
							problemTitle:
								problemData.problemTitle || "Unknown Problem",
							difficulty: problemData.difficulty || "Unknown",
							url: problemData.url,
							addedAt: new Date().toISOString(),
							addedBy: currentUsername,
							times: [],
						};

						currentProblems.push(problemToAdd);

						if (currentRoomId) {
							await updateDoc(bucketRef, {
								problems: currentProblems,
							});
						} else {
							await setDoc(
								bucketRef,
								{ problems: currentProblems },
								{ merge: true }
							);
						}

						showSuccess(
							button,
							currentRoomId
								? "Added to shared room!"
								: "Added to bucket!"
						);
					} else {
						showSuccess(button, "Already in bucket");
					}
				});
			} catch (error) {
				console.error("Error adding to bucket:", error);
				showError(button, "Failed to add - Try again");
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

				if (roomListener) {
					roomListener();
					roomListener = null;
				}
			}
		});
	}

	function setupShareButton(button, bucketListContainer) {
		button.addEventListener("click", async () => {
			showLoading(button, "Loading...");

			try {
				const result = await showShareModal();

				if (result) {
					currentRoomId = result.roomId;

					if (result.action === "create") {
						showSuccess(button, `Room ${result.roomId} created!`);
					} else {
						showSuccess(button, `Joined room ${result.roomId}!`);
					}

					setTimeout(() => {
						const viewBtn =
							document.getElementById("viewBucketBtn");
						if (viewBtn && !isBucketVisible) {
							viewBtn.click();
						}
					}, 1000);
				} else {
					resetButton(button);
				}
			} catch (error) {
				console.error("Share error:", error);
				showError(button, "Share failed");
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
					const elapsedMs = Date.now() - activeTimer.startTime;
					const elapsedSeconds = Math.round(elapsedMs / 1000);
					const mins = Math.floor(elapsedSeconds / 60);
					const secs = elapsedSeconds % 60;

					chrome.storage.local.remove("activeTimer");

					button.innerHTML = "⏱️ Timer";
					button.style.background = "";
					button.style.color = "";

					try {
						await retryOperation(async () => {
							const targetBucket = currentRoomId
								? `sharedBuckets/${currentRoomId}`
								: `users/${userId}/buckets/default`;

							const bucketRef = doc(db, targetBucket);
							const docSnap = await getDoc(bucketRef);
							if (!docSnap.exists()) return;

							const currentProblems =
								docSnap.data().problems || [];
							const index = currentProblems.findIndex(
								(p) => p.problemTitle === currentTitle
							);
							if (index === -1) return;

							if (!Array.isArray(currentProblems[index].times)) {
								currentProblems[index].times = [];
							}

							currentProblems[index].times.push({
								time: `${mins}m ${secs}s`,
								username: currentUsername,
								timestamp: new Date().toISOString(),
							});

							if (currentRoomId) {
								await updateDoc(bucketRef, {
									problems: currentProblems,
								});
							} else {
								await setDoc(
									bucketRef,
									{ problems: currentProblems },
									{ merge: true }
								);
							}

							showSuccess(button, "Time saved!");
						});
					} catch (error) {
						console.error("Failed to save time:", error);
						showError(button, "Failed to save time");
					}
				} else {
					chrome.storage.local.set({
						activeTimer: {
							startTime: Date.now(),
							problemTitle: problemData.problemTitle,
						},
					});
					button.innerHTML = "⏹️ Stop";
					button.style.background = "#f59e0b";
					button.style.color = "white";
				}
			});
		});
	}

	async function renderBucketList() {
		const bucketList = document.getElementById("bucketList");

		bucketList.innerHTML = `
			<div style="color: #6b7280; text-align: center; padding: 20px;">
				⏳ Loading bucket...
			</div>
		`;

		try {
			const userDoc = await getDoc(doc(db, `users/${userId}`));
			const joinedRooms = userDoc.exists()
				? userDoc.data().joinedRooms || []
				: [];

			if (joinedRooms.length > 0) {
				const roomSelector = document.createElement("div");
				roomSelector.style.cssText = `
					margin-bottom: 16px; 
					padding: 12px; 
					background: #333; 
					border-radius: 8px;
				`;

				const select = document.createElement("select");
				select.style.cssText = `
					width: 100%; 
					padding: 8px; 
					background: #1a1a1a; 
					color: white; 
					border: 1px solid #555; 
					border-radius: 4px;
				`;

				const personalOption = document.createElement("option");
				personalOption.value = "";
				personalOption.textContent = `📝 ${currentUsername}'s Personal Bucket`;
				select.appendChild(personalOption);

				for (const roomId of joinedRooms) {
					try {
						const roomDoc = await getDoc(
							doc(db, `sharedBuckets/${roomId}`)
						);
						if (roomDoc.exists()) {
							const roomData = roomDoc.data();
							const option = document.createElement("option");
							option.value = roomId;
							option.textContent = `🏠 ${roomData.name} (${roomId})`;
							if (roomId === currentRoomId)
								option.selected = true;
							select.appendChild(option);
						}
					} catch (error) {
						console.error(`Error loading room ${roomId}:`, error);
					}
				}

				select.addEventListener("change", (e) => {
					if (roomListener) {
						roomListener();
						roomListener = null;
					}
					currentRoomId = e.target.value || null;
					renderBucketList();
				});

				roomSelector.appendChild(select);
				bucketList.innerHTML = "";
				bucketList.appendChild(roomSelector);
			}

			await retryOperation(async () => {
				const targetBucket = currentRoomId
					? `sharedBuckets/${currentRoomId}`
					: `users/${userId}/buckets/default`;

				const bucketRef = doc(db, targetBucket);

				if (currentRoomId) {
					roomListener = onSnapshot(bucketRef, (doc) => {
						if (doc.exists()) {
							const data = doc.data();
							displayProblems(data.problems || [], data.name);
						}
					});
				} else {
					const docSnap = await getDoc(bucketRef);
					const bucket = docSnap.exists()
						? docSnap.data().problems || []
						: [];
					displayProblems(bucket);
				}
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

	function displayProblems(problems, roomName = null) {
		const bucketList = document.getElementById("bucketList");
		const existingSelector = bucketList.querySelector(
			'div[style*="margin-bottom: 16px"]'
		);

		if (problems.length === 0) {
			const emptyDiv = document.createElement("div");
			emptyDiv.style.cssText =
				"color: #6b7280; text-align: center; padding: 20px;";
			emptyDiv.innerHTML = `
				<div>📝 No problems saved yet</div>
				<div style="font-size: 12px; margin-top: 8px;">
					${
						currentRoomId
							? "Add problems to share with room members"
							: "Add problems from LeetCode to track them here"
					}
				</div>
			`;

			if (existingSelector) {
				bucketList.insertBefore(emptyDiv, existingSelector.nextSibling);
			} else {
				bucketList.appendChild(emptyDiv);
			}
			return;
		}

		const problemsContainer = document.createElement("div");

		problems.forEach((problem, index) => {
			const item = document.createElement("div");
			item.className = "bucket-item";

			const problemNumber = problem.problemNumber || "?";
			const problemTitle = problem.problemTitle || "Unknown Problem";
			const difficulty = (problem.difficulty || "").toLowerCase();
			const url = problem.url || "#";
			const addedBy = problem.addedBy || "Unknown";
			const times = Array.isArray(problem.times) ? problem.times : [];

			let timesDisplay = "";
			if (times.length > 0) {
				if (currentRoomId) {
					const timesList = times
						.map((t) => {
							if (typeof t === "string") {
								return t; // Legacy format
							} else {
								return `${t.time} (${t.username})`;
							}
						})
						.join(", ");
					timesDisplay = `<div style="font-size: 10px; color: #888; margin-top: 4px;">Times: ${timesList}</div>`;
				} else {
					const timesList = times
						.map((t) => (typeof t === "string" ? t : t.time))
						.join(", ");
					timesDisplay = `<div style="font-size: 10px; color: #888; margin-top: 4px;">Times: ${timesList}</div>`;
				}
			}

			item.innerHTML = `
				<div style="flex: 1;">
					<a href="${url}" target="_blank" style="text-decoration: none; color: inherit;">
						<span class="bucket-difficulty-${difficulty}">
							#${problemNumber}: ${problemTitle}
						</span>
					</a>
					${
						currentRoomId
							? `<div style="font-size: 10px; color: #888; margin-top: 2px;">Added by: ${addedBy}</div>`
							: ""
					}
					${timesDisplay}
				</div>
				<button data-index="${index}" class="remove-button" title="Remove from bucket">❌</button>
			`;

			problemsContainer.appendChild(item);
		});

		if (existingSelector) {
			const existingProblems = bucketList.children;
			for (let i = existingProblems.length - 1; i >= 0; i--) {
				if (existingProblems[i] !== existingSelector) {
					bucketList.removeChild(existingProblems[i]);
				}
			}
			bucketList.insertBefore(
				problemsContainer,
				existingSelector.nextSibling
			);
		} else {
			bucketList.innerHTML = "";
			bucketList.appendChild(problemsContainer);
		}

		document.querySelectorAll(".remove-button").forEach((btn) => {
			btn.addEventListener("click", async (e) => {
				const indexToRemove = parseInt(e.target.dataset.index);
				const originalText = e.target.innerHTML;

				e.target.innerHTML = "⏳";
				e.target.disabled = true;

				try {
					await retryOperation(async () => {
						const targetBucket = currentRoomId
							? `sharedBuckets/${currentRoomId}`
							: `users/${userId}/buckets/default`;

						const bucketRef = doc(db, targetBucket);
						const docSnap = await getDoc(bucketRef);
						if (!docSnap.exists()) return;

						const currentProblems = docSnap.data().problems || [];
						currentProblems.splice(indexToRemove, 1);

						if (currentRoomId) {
							await updateDoc(bucketRef, {
								problems: currentProblems,
							});
						} else {
							await setDoc(
								bucketRef,
								{ problems: currentProblems },
								{ merge: true }
							);
						}
					});

					if (!currentRoomId) {
						await renderBucketList();
					}
				} catch (error) {
					console.error("Error removing from bucket:", error);
					e.target.innerHTML = originalText;
					e.target.disabled = false;
				}
			});
		});
	}
}
