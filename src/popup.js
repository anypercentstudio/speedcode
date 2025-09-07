import { app, db, auth } from "./firebaseConfig.js";
import { AuthManager } from "./modules/auth.js";
import { DatabaseManager } from "./modules/database.js";
import { UIManager } from "./modules/ui.js";
import { StateManager } from "./modules/state.js";
import {
	LoadingStates,
	ChromeUtils,
	ValidationUtils,
	ErrorUtils,
	TimeUtils,
} from "./modules/utils.js";

class SpeedCodePopup {
	constructor() {
		this.state = new StateManager();
		this.database = new DatabaseManager(db, null);
		this.auth = new AuthManager(auth, this.database);
		this.ui = new UIManager();

		this.isInitialized = false;
		this.cleanupFunctions = [];
		this.currentProblemData = null;

		console.log("SpeedCode popup initialized");
	}

	async initialize() {
		if (this.isInitialized) return;

		try {
			this.ui.showLoadingUI(LoadingStates.INITIALIZING);

			await this.initializeAuth();
			this.setupEventListeners();
			await this.initializeMainUI();

			this.isInitialized = true;
			console.log("SpeedCode popup fully initialized");
		} catch (error) {
			ErrorUtils.logError("SpeedCodePopup.initialize", error);
			this.handleInitializationError(error);
		}
	}

	async initializeAuth() {
		this.ui.showLoadingUI(LoadingStates.AUTHENTICATING);

		const user = await this.auth.initialize();
		this.state.setUserAuth(user);

		let username = this.auth.getUsername();

		if (!username) {
			this.ui.showLoadingUI(LoadingStates.SETTING_USERNAME);
			username = await this.ui.showUsernameSetup();
			if (username) {
				await this.auth.setupUsername(username);
			}
		}

		this.state.setUsername(username);
		console.log("Auth fully initialized for user:", username);
	}

	setupEventListeners() {
		const authUnsubscribe = this.auth.addAuthStateListener((user) => {
			this.state.setUserAuth(user);
		});
		this.cleanupFunctions.push(authUnsubscribe);

		this.state.watch("network.isOnline", (isOnline) => {
			if (!isOnline) {
				this.ui.showToast(
					"📶 Offline - Changes will sync when connected",
					"warning",
					5000
				);
			}
		});

		this.state.watch("room.currentRoomId", (roomId) => {
			this.handleRoomChange(roomId);
		});

		this.state.watch("ui.isBucketVisible", (isVisible) => {
			this.ui.toggleBucketList(isVisible);
		});

		this.state.watch("timer", (timerState) => {
			const buttons = this.ui.getButtons();
			if (buttons.timer) {
				this.ui.updateTimerButton(buttons.timer, timerState.active);
			}
		});

		this.state.watch("room.joinedRooms", () => {
			this.updateAddDropdown();
		});
	}

	async initializeMainUI() {
		try {
			await this.loadUserRooms();

			const tab = await ChromeUtils.getCurrentTab();

			if (!tab?.url) {
				this.ui.showStateMessage("noTab", "No Active Tab");
				this.setupUtilityButtons();
				return;
			}

			const isOnLeetCode = ChromeUtils.isLeetCodeUrl(tab.url);
			this.state.setState("problem.isOnLeetCode", isOnLeetCode);

			if (!isOnLeetCode) {
				this.ui.showStateMessage(
					"notLeetCode",
					"Not on LeetCode",
					true
				);
				this.setupUtilityButtons();
				return;
			}

			await this.detectAndRenderProblem(tab);
		} catch (error) {
			ErrorUtils.logError("SpeedCodePopup.initializeMainUI", error);
			this.ui.showStateMessage("extensionError", "Extension Error");
		}
	}

	async detectAndRenderProblem(tab) {
		this.ui.showLoadingUI(LoadingStates.DETECTING_PROBLEM);
		this.state.setProblemDetection(true);

		const joinedRooms = this.state.getState("room.joinedRooms");
		const username = this.state.getState("user.username");

		if (!username) {
			console.error("No username available for problem detection");
			this.ui.showStateMessage("extensionError", "Setup incomplete");
			this.state.setProblemDetection(false);
			return;
		}

		try {
			const problemData = await ChromeUtils.sendMessageToTab(tab.id, {
				action: "getProblemInfo",
			});

			this.state.setProblemDetection(false);

			if (
				problemData?.onProblem &&
				ValidationUtils.isValidProblemData(problemData)
			) {
				this.currentProblemData = problemData;
				this.state.setCurrentProblem(problemData);
				this.ui.renderProblemInfo(
					problemData,
					joinedRooms,
					username,
					(selectedProblemData, bucketId, item) => {
						this.handleAddToBucket(
							selectedProblemData,
							bucketId,
							item
						);
					}
				);
				this.setupProblemButtons();
			} else {
				this.ui.showStateMessage(
					"notDetected",
					"Problem Not Detected",
					true
				);
				this.setupUtilityButtons();
			}
		} catch (error) {
			ErrorUtils.logError("SpeedCodePopup.detectAndRenderProblem", error);
			this.state.setProblemDetection(false);
			this.ui.showStateMessage(
				"connectionError",
				"Connection Error",
				true
			);
			this.setupUtilityButtons();
		}
	}

	setupProblemButtons() {
		const buttons = this.ui.getButtons();

		if (buttons.viewBucket) {
			buttons.viewBucket.addEventListener("click", () => {
				this.handleToggleBucket();
			});
		}

		if (buttons.share) {
			buttons.share.addEventListener("click", () => {
				this.handleShare();
			});
		}

		if (buttons.timer) {
			buttons.timer.addEventListener("click", () => {
				this.handleTimerToggle();
			});
		}

		this.loadActiveTimer();
	}

	setupUtilityButtons() {
		const buttons = this.ui.getButtons();

		if (buttons.viewBucket) {
			buttons.viewBucket.addEventListener("click", () => {
				this.handleToggleBucket();
			});
		}

		if (buttons.share) {
			buttons.share.addEventListener("click", () => {
				this.handleShare();
			});
		}
	}

	async handleAddToBucket(problemData, bucketId, buttonElement) {
		if (!ValidationUtils.isValidProblemData(problemData)) return;

		const button = buttonElement || this.ui.getButtons().addToBucket;
		this.ui.showLoading(button, "Adding...");

		try {
			const username = this.state.getState("user.username");
			const result = await this.database.addProblemToBucket(
				problemData,
				bucketId,
				username
			);

			if (result.alreadyExists) {
				this.ui.showToast("✅ Already in bucket", "success");
			} else {
				const message = bucketId
					? "✅ Added to shared room!"
					: "✅ Added to bucket!";
				this.ui.showToast(message, "success");
				this.state.addProblemToBucket(result.problem);
			}

			this.ui.resetButton(button);
		} catch (error) {
			ErrorUtils.logError("handleAddToBucket", error);
			this.ui.showError(button, "Failed to add");
			this.ui.showToast("❌ Failed to add - Try again", "error");
		}
	}

	async handleToggleBucket() {
		const button = this.ui.getButtons().viewBucket;
		const isVisible = this.state.getState("ui.isBucketVisible");
		const newVisibility = !isVisible;

		this.state.setBucketVisibility(newVisibility);
		this.ui.updateBucketViewButton(button, newVisibility);

		if (newVisibility) {
			await this.loadAndRenderBucket();
		} else {
			const currentRoomId = this.state.getState("room.currentRoomId");
			if (currentRoomId) {
				this.database.removeListener(`bucket_${currentRoomId}`);
			}
		}
	}

	async handleShare() {
		const button = this.ui.getButtons().share;
		this.ui.showLoading(button, "Loading...");

		try {
			const result = await this.ui.showShareModal();

			if (!result) {
				this.ui.resetButton(button);
				return;
			}

			const username = this.state.getState("user.username");
			let roomId;

			if (result.action === "create") {
				const roomName =
					prompt("Enter room name (optional):") ||
					`${username}'s Room`;

				roomId = await this.database.createRoom(roomName, username);
				this.ui.showToast(`Room ${roomId} created!`, "success");
			} else if (result.action === "join") {
				roomId = await this.database.joinRoom(result.roomId, username);
				this.ui.showToast(`Joined room ${roomId}!`, "success");
			}

			if (result.modalContent) {
				this.ui.closeModal(result.modalContent, null, null);
			}

			this.ui.resetButton(button);

			if (roomId) {
				await this.refreshUserRooms();
				this.updateAddDropdown();
				this.state.setCurrentRoom(roomId);

				setTimeout(() => {
					const viewBtn = this.ui.getButtons().viewBucket;
					if (viewBtn && !this.state.getState("ui.isBucketVisible")) {
						viewBtn.click();
					}
				}, 1000);
			}
		} catch (error) {
			ErrorUtils.logError("handleShare", error);
			this.ui.resetButton(button); // Make sure button is reset on error
			this.ui.showToast("Failed to create/join room", "error");
		}
	}

	async handleTimerToggle() {
		const button = this.ui.getButtons().timer;
		const timerState = this.state.getState("timer");

		if (!this.currentProblemData) {
			this.ui.showToast("⚠️ No problem detected", "warning");
			return;
		}

		const currentTitle = this.currentProblemData.problemTitle;

		if (timerState.active && timerState.problemTitle === currentTitle) {
			const elapsedSeconds = this.state.stopTimer();
			const timeString = TimeUtils.formatElapsed(timerState.startTime);

			try {
				await this.saveProblemTime(currentTitle, timeString);
				this.ui.showSuccess(button, "Time saved!");
				this.ui.showToast(`⏱️ Time saved: ${timeString}`, "success");
			} catch (error) {
				ErrorUtils.logError("handleTimerToggle", error);
				this.ui.showError(button, "Failed to save");
				this.ui.showToast("❌ Failed to save time", "error");
			}
		} else {
			// Start timer
			this.state.startTimer(currentTitle);
			this.ui.showToast(`⏱️ Timer started for ${currentTitle}`, "info");
		}
	}

	async saveProblemTime(problemTitle, timeString) {
		const currentRoomId = this.state.getState("room.currentRoomId");
		const username = this.state.getState("user.username");

		await this.database.addProblemTime(
			problemTitle,
			{ time: timeString, username },
			currentRoomId
		);
	}

	async loadActiveTimer() {
		if (!this.currentProblemData) return;

		const timerLoaded = await this.state.loadTimerFromStorage();
		if (timerLoaded) {
			const timerState = this.state.getState("timer");
			const button = this.ui.getButtons().timer;

			if (
				timerState.problemTitle ===
					this.currentProblemData.problemTitle &&
				button
			) {
				this.ui.updateTimerButton(button, true);
			}
		}
	}

	async loadAndRenderBucket() {
		this.state.setBucketLoading(true);

		try {
			await this.refreshUserRooms();
			await this.renderBucketWithSelector();
		} catch (error) {
			ErrorUtils.logError("loadAndRenderBucket", error);
			this.ui.elements.bucketList.innerHTML = `
				<div class="status-message error">
					<div class="status-icon">❌</div>
					<div class="status-title">Failed to load bucket</div>
					<div class="status-subtitle">Check your connection and try again</div>
				</div>
			`;
		}
	}

	async loadUserRooms() {
		try {
			const joinedRooms = await this.database.getUserRooms();
			this.state.setJoinedRooms(joinedRooms);
			this.ui.updateJoinedRooms(joinedRooms);
		} catch (error) {
			ErrorUtils.logError("loadUserRooms", error);
		}
	}

	async refreshUserRooms() {
		const joinedRooms = await this.database.getUserRooms();
		this.state.setJoinedRooms(joinedRooms);
		this.ui.updateJoinedRooms(joinedRooms);
	}

	updateAddDropdown() {
		if (!this.currentProblemData) return;

		const username = this.state.getState("user.username");
		this.ui.refreshAddDropdown(
			this.currentProblemData,
			username,
			(selectedProblemData, bucketId, item) => {
				this.handleAddToBucket(selectedProblemData, bucketId, item);
			}
		);
	}

	async renderBucketWithSelector() {
		const currentRoomId = this.state.getState("room.currentRoomId");
		const joinedRooms = this.state.getState("room.joinedRooms");
		const username = this.state.getState("user.username");

		try {
			let problems = [];

			if (currentRoomId) {
				this.database.listenToBucket(
					currentRoomId,
					(bucketProblems, data) => {
						this.state.setBucketProblems(bucketProblems);
						this.ui.displayProblems(bucketProblems, currentRoomId);
						this.setupRemoveButtons();
					}
				);
			} else {
				problems = await this.database.getBucketProblems();
				this.state.setBucketProblems(problems);
			}

			this.ui.renderBucketList(
				problems,
				null,
				currentRoomId,
				joinedRooms,
				username
			);

			this.ui.onRoomChange((newRoomId) => {
				this.handleRoomChange(newRoomId);
			});

			this.setupRemoveButtons();

			if (!currentRoomId) {
				this.ui.displayProblems(problems, currentRoomId);
			}
		} catch (error) {
			ErrorUtils.logError("renderBucketWithSelector", error);
			throw error;
		}
	}

	setupRemoveButtons() {
		this.ui.onRemoveButtonClick(async (index) => {
			await this.handleRemoveProblem(index);
		});
	}

	async handleRoomChange(newRoomId) {
		const oldRoomId = this.state.getState("room.currentRoomId");
		if (oldRoomId === newRoomId) return;

		if (oldRoomId) {
			this.database.removeListener(`bucket_${oldRoomId}`);
		}

		this.state.setState("room.currentRoomId", newRoomId, true);

		await this.renderBucketWithSelector();
	}

	async handleRemoveProblem(index) {
		const currentRoomId = this.state.getState("room.currentRoomId");

		try {
			await this.database.removeProblemFromBucket(index, currentRoomId);

			if (!currentRoomId) {
				this.state.removeProblemFromBucket(index);
				const problems = this.state.getState("bucket.problems");
				this.ui.displayProblems(problems, currentRoomId);
				this.setupRemoveButtons();
			}

			this.ui.showToast("✅ Problem removed", "success");
		} catch (error) {
			ErrorUtils.logError("handleRemoveProblem", error);
			this.ui.showToast("❌ Failed to remove problem", "error");
		}
	}

	handleInitializationError(error) {
		this.ui.showLoadingUI(LoadingStates.ERROR, error.message);

		setTimeout(() => {
			const problemInfo = this.ui.elements.problemInfo;
			const retryContainer = document.createElement("div");
			retryContainer.style.cssText =
				"text-align: center; margin-top: 20px;";

			const retryBtn = document.createElement("button");
			retryBtn.className = "modal-btn primary";
			retryBtn.style.cssText =
				"width: auto; padding: 8px 16px; font-size: 12px;";
			retryBtn.textContent = "Retry";
			retryBtn.addEventListener("click", () => {
				window.location.reload();
			});

			retryContainer.appendChild(retryBtn);
			problemInfo.appendChild(retryContainer);
		}, 1000);
	}

	cleanup() {
		this.cleanupFunctions.forEach((cleanup) => {
			try {
				cleanup();
			} catch (error) {
				ErrorUtils.logError("SpeedCodePopup.cleanup", error);
			}
		});

		this.ui.cleanup();
		this.database.cleanup();
		this.auth.cleanup();
		this.state.cleanup();

		this.isInitialized = false;
		console.log("SpeedCode popup cleaned up");
	}
}

document.addEventListener("DOMContentLoaded", async () => {
	const popup = new SpeedCodePopup();

	window.addEventListener("beforeunload", () => {
		popup.cleanup();
	});

	try {
		await popup.initialize();
	} catch (error) {
		console.error("Failed to initialize popup:", error);
	}

	window.speedCodePopup = popup;
});
