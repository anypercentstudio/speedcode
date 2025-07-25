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
	retryOperation,
} from "./modules/utils.js";

class SpeedCodePopup {
	constructor() {
		this.state = new StateManager();
		this.database = new DatabaseManager(db, null);
		this.auth = new AuthManager(auth, this.database);
		this.ui = new UIManager();

		this.isInitialized = false;
		this.cleanupFunctions = [];

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

		this.ui.showLoadingUI(LoadingStates.SETTING_USERNAME);
		let username = this.auth.getUsername();

		if (!username) {
			username = await this.ui.showUsernameSetup();
			await this.auth.setupUsername(username);
		}

		this.state.setUsername(username);
		console.log("Auth initialized for user:", username);
	}

	setupEventListeners() {
		const authUnsubscribe = this.auth.addAuthStateListener((user) => {
			this.state.setUserAuth(user);
		});
		this.cleanupFunctions.push(authUnsubscribe);

		this.state.watch("network.isOnline", (isOnline) => {
			this.ui.showConnectionStatus(isOnline);
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
	}

	async initializeMainUI() {
		try {
			const tab = await ChromeUtils.getCurrentTab();

			if (!tab?.url) {
				this.ui.showStateMessage("noTab", "No Active Tab");
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

		try {
			const problemData = await ChromeUtils.sendMessageToTab(tab.id, {
				action: "getProblemInfo",
			});

			this.state.setProblemDetection(false);

			if (
				problemData?.onProblem &&
				ValidationUtils.isValidProblemData(problemData)
			) {
				this.state.setCurrentProblem(problemData);
				this.ui.renderProblemInfo(problemData);
				this.setupProblemButtons(problemData);
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

	setupProblemButtons(problemData) {
		const buttons = this.ui.getButtons();

		if (buttons.addToBucket) {
			buttons.addToBucket.addEventListener("click", () => {
				this.handleAddToBucket(problemData);
			});
		}

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
			this.setupTimerButton(buttons.timer, problemData);
		}

		this.loadActiveTimer(buttons.timer, problemData);
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

	async handleAddToBucket(problemData) {
		const button = this.ui.getButtons().addToBucket;
		if (!button || !ValidationUtils.isValidProblemData(problemData)) return;

		this.ui.showLoading(button, "Adding...");

		try {
			const currentRoomId = this.state.getState("room.currentRoomId");
			const username = this.state.getState("user.username");

			const result = await this.database.addProblemToBucket(
				problemData,
				currentRoomId,
				username
			);

			if (result.alreadyExists) {
				this.ui.showSuccess(button, "Already in bucket");
			} else {
				const message = currentRoomId
					? "Added to shared room!"
					: "Added to bucket!";
				this.ui.showSuccess(button, message);
				this.state.addProblemToBucket(result.problem);
			}
		} catch (error) {
			ErrorUtils.logError("handleAddToBucket", error);
			this.ui.showError(button, "Failed to add - Try again");
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
				this.ui.showSuccess(button, `Room ${roomId} created!`);
			} else {
				roomId = await this.database.joinRoom(result.roomId, username);
				this.ui.showSuccess(button, `Joined room ${roomId}!`);
			}

			this.state.setCurrentRoom(roomId);
			await this.refreshUserRooms();

			setTimeout(() => {
				const viewBtn = this.ui.getButtons().viewBucket;
				if (viewBtn && !this.state.getState("ui.isBucketVisible")) {
					viewBtn.click();
				}
			}, 1000);
		} catch (error) {
			ErrorUtils.logError("handleShare", error);
			this.ui.showError(button, "Share failed");
		}
	}

	setupTimerButton(button, problemData) {
		button.addEventListener("click", () => {
			this.handleTimerToggle(button, problemData);
		});
	}

	async handleTimerToggle(button, problemData) {
		const timerState = this.state.getState("timer");
		const currentTitle = problemData.problemTitle;

		if (timerState.active && timerState.problemTitle === currentTitle) {
			const elapsedSeconds = this.state.stopTimer();
			const timeString = TimeUtils.formatElapsed(timerState.startTime);

			try {
				await this.saveProblemTime(currentTitle, timeString);
				this.ui.showSuccess(button, "Time saved!");
			} catch (error) {
				ErrorUtils.logError("handleTimerToggle", error);
				this.ui.showError(button, "Failed to save time");
			}
		} else {
			this.state.startTimer(currentTitle);
		}
	}

	async saveProblemTime(problemTitle, timeString) {
		const currentRoomId = this.state.getState("room.currentRoomId");
		const username = this.state.getState("user.username");

		await this.database.addProblemTime(
			problemTitle,
			{
				time: timeString,
				username: username,
			},
			currentRoomId
		);
	}

	async loadActiveTimer(button, problemData) {
		if (!button || !problemData) return;

		const timerLoaded = await this.state.loadTimerFromStorage();
		if (timerLoaded) {
			const timerState = this.state.getState("timer");
			if (timerState.problemTitle === problemData.problemTitle) {
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
				<div style="color: #ef4444; text-align: center; padding: 20px;">
					<div>❌ Failed to load bucket</div>
					<div style="font-size: 12px; margin-top: 8px;">
						Check your connection and try again
					</div>
				</div>
			`;
		}
	}

	async refreshUserRooms() {
		const joinedRooms = await this.database.getUserRooms();
		this.state.setJoinedRooms(joinedRooms);
	}

	async renderBucketWithSelector() {
		const currentRoomId = this.state.getState("room.currentRoomId");
		const joinedRooms = this.state.getState("room.joinedRooms");
		const username = this.state.getState("user.username");

		try {
			let problems = [];
			let roomData = null;

			if (currentRoomId) {
				this.database.listenToBucket(
					currentRoomId,
					(bucketProblems, data) => {
						this.state.setBucketProblems(bucketProblems);
						this.displayProblems(bucketProblems, data);
					}
				);
			} else {
				problems = await this.database.getBucketProblems();
				this.state.setBucketProblems(problems);
			}

			this.ui.renderBucketList(
				problems,
				roomData?.name,
				currentRoomId,
				joinedRooms,
				username
			);

			this.ui.onRoomChange((newRoomId) => {
				this.handleRoomChange(newRoomId);
			});

			this.ui.onRemoveButtonClick(async (index) => {
				await this.handleRemoveProblem(index);
			});

			if (!currentRoomId) {
				this.displayProblems(problems);
			}
		} catch (error) {
			ErrorUtils.logError("renderBucketWithSelector", error);
			throw error;
		}
	}

	displayProblems(problems, roomData = null) {
		const currentRoomId = this.state.getState("room.currentRoomId");
		this.ui.displayProblems(problems, currentRoomId);

		this.ui.onRemoveButtonClick(async (index) => {
			await this.handleRemoveProblem(index);
		});
	}

	async handleRoomChange(newRoomId) {
		const oldRoomId = this.state.getState("room.currentRoomId");
		if (oldRoomId) {
			this.database.removeListener(`bucket_${oldRoomId}`);
		}

		this.state.setCurrentRoom(newRoomId);

		await this.renderBucketWithSelector();
	}

	async handleRemoveProblem(index) {
		const currentRoomId = this.state.getState("room.currentRoomId");

		await this.database.removeProblemFromBucket(index, currentRoomId);

		if (!currentRoomId) {
			this.state.removeProblemFromBucket(index);
			const problems = this.state.getState("bucket.problems");
			this.displayProblems(problems);
		}
	}

	handleInitializationError(error) {
		this.ui.showLoadingUI(LoadingStates.ERROR, error.message);

		setTimeout(() => {
			const problemInfo = this.ui.elements.problemInfo;
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

	cleanup() {
		this.cleanupFunctions.forEach((cleanup) => {
			try {
				cleanup();
			} catch (error) {
				ErrorUtils.logError("SpeedCodePopup.cleanup", error);
			}
		});

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

	await popup.initialize();

	window.speedCodePopup = popup;
});
