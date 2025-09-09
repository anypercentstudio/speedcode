import {
	LoadingStates,
	CONSTANTS,
	DOMUtils,
	AnimationUtils,
	ValidationUtils,
} from "./utils.js";

export class UIManager {
	constructor() {
		this.elements = {};
		this.modals = new Map();
		this.currentJoinedRooms = [];
		this.dropdownCleanups = new Set();
		this.isDropdownOpen = false;
		this.init();
	}

	init() {
		this.elements.header = document.getElementById("header");
		this.elements.mainContent = document.getElementById("mainContent");
		this.elements.problemInfo = document.getElementById("problemInfo");
		this.elements.quickActions = document.getElementById("quickActions");
		this.elements.bucketContainer =
			document.getElementById("bucketContainer");
		this.elements.roomSelector = document.getElementById("roomSelector");
		this.elements.bucketList = document.getElementById("bucketList");
		this.elements.addDropdown = document.getElementById("addDropdown");

		AnimationUtils.addLoadingStyles();
	}

	showLoadingUI(state, message) {
		const stateConfig = {
			[LoadingStates.INITIALIZING]: {
				icon: "🚀",
				title: "Starting SpeedCode...",
				subtitle: "Initializing extension",
				color: "#6366f1",
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

		this.elements.problemInfo.innerHTML = `
			<div class="loading-container">
				<div class="loading-icon">${config.icon}</div>
				<div class="loading-title">${config.title}</div>
				<div class="loading-subtitle">${config.subtitle}</div>
				<div class="loading-bar">
					<div class="loading-bar-fill" style="background: linear-gradient(90deg, ${config.color}, ${config.color}88, ${config.color});"></div>
				</div>
			</div>
		`;
		this.elements.quickActions.style.display = "none";
	}

	updateJoinedRooms(rooms) {
		this.currentJoinedRooms = rooms || [];
	}

	renderProblemInfo(problemData, joinedRooms, username, addToBucketCallback) {
		this.updateJoinedRooms(joinedRooms);

		let headerHTML = "";
		if (problemData.problemNumber) {
			headerHTML = `
				<div class="problem-header fade-in">
					<div class="problem-number">#${problemData.problemNumber}</div>
				</div>
			`;
		}

		let titleHTML = "";
		if (problemData.problemTitle) {
			titleHTML = `<div class="problem-title fade-in">${problemData.problemTitle}</div>`;
		}

		let difficultyHTML = "";
		if (problemData.difficulty) {
			difficultyHTML = `
				<div class="difficulty ${problemData.difficulty.toLowerCase()} fade-in">
					${problemData.difficulty}
				</div>
			`;
		}

		this.elements.problemInfo.innerHTML =
			headerHTML + titleHTML + difficultyHTML;

		this.elements.quickActions.style.display = "flex";
		this.setupAddToBucketDropdown(
			problemData,
			username,
			addToBucketCallback
		);
	}

	setupAddToBucketDropdown(problemData, username, callback) {
		const addBtn = document.getElementById("addToBucketBtn");
		const dropdown = this.elements.addDropdown;

		dropdown.innerHTML = "";

		const personalOption = this.createDropdownItem(
			"📝",
			`${username}'s Personal Bucket`,
			() => {
				callback(problemData, "", addBtn);
				this.hideDropdown();
			}
		);
		dropdown.appendChild(personalOption);

		if (this.currentJoinedRooms.length > 0) {
			const separator = document.createElement("div");
			separator.className = "dropdown-separator";
			dropdown.appendChild(separator);

			this.currentJoinedRooms.forEach((room) => {
				if (room && room.id) {
					const roomOption = this.createDropdownItem(
						"🏠",
						`${room.name} (${room.id})`,
						() => {
							callback(problemData, room.id, addBtn);
							this.hideDropdown();
						}
					);
					dropdown.appendChild(roomOption);
				}
			});
		}

		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.toggleDropdown(addBtn);
		});

		document.addEventListener("click", (e) => {
			if (!addBtn.contains(e.target) && !dropdown.contains(e.target)) {
				this.hideDropdown();
			}
		});
	}

	createDropdownItem(icon, text, onClick) {
		const item = document.createElement("button");
		item.className = "dropdown-item";
		item.innerHTML = `
			<span class="icon">${icon}</span>
			<span class="text">${text}</span>
		`;
		item.addEventListener("click", onClick);
		return item;
	}

	toggleDropdown(button) {
		const dropdown = this.elements.addDropdown;
		const rect = button.getBoundingClientRect();
		const containerRect =
			this.elements.quickActions.getBoundingClientRect();

		if (this.isDropdownOpen) {
			this.hideDropdown();
		} else {
			dropdown.style.position = "absolute";
			dropdown.style.top = `${rect.bottom - containerRect.top + 4}px`;
			dropdown.style.left = `${rect.left - containerRect.left}px`;
			dropdown.style.width = `${rect.width}px`;
			dropdown.style.display = "block";
			this.isDropdownOpen = true;
		}
	}

	hideDropdown() {
		this.elements.addDropdown.style.display = "none";
		this.isDropdownOpen = false;
	}

	refreshAddDropdown(problemData, username, addToBucketCallback) {
		if (this.isDropdownOpen) {
			this.hideDropdown();
		}
		this.setupAddToBucketDropdown(
			problemData,
			username,
			addToBucketCallback
		);
	}

	renderBucketList(
		problems,
		currentRoomId = null,
		joinedRooms = [],
		currentUsername = ""
	) {
		this.updateJoinedRooms(joinedRooms);

		if (joinedRooms.length > 0) {
			this.setupRoomSelector(joinedRooms, currentRoomId, currentUsername);
			this.elements.roomSelector.style.display = "block";
		} else {
			this.elements.roomSelector.style.display = "none";
		}

		if (problems.length === 0) {
			this.showEmptyBucket(currentRoomId);
		} else {
			this.displayProblems(problems, currentRoomId);
		}
	}

	setupRoomSelector(joinedRooms, currentRoomId, currentUsername) {
		const select = document.getElementById("roomSelect");
		select.innerHTML = "";

		const personalOption = document.createElement("option");
		personalOption.value = "";
		personalOption.textContent = `📝 ${currentUsername}'s Personal Bucket`;
		select.appendChild(personalOption);

		joinedRooms.forEach((room) => {
			if (room && room.id) {
				const option = document.createElement("option");
				option.value = room.id;
				option.textContent = `🏠 ${room.name} (${room.id})`;
				if (room.id === currentRoomId) {
					option.selected = true;
				}
				select.appendChild(option);
			}
		});
	}

	showEmptyBucket(currentRoomId) {
		this.elements.bucketList.innerHTML = `
			<div class="empty-state">
				<div class="empty-state-icon">📝</div>
				<div class="empty-state-title">No problems saved yet</div>
				<div class="empty-state-subtitle">
					${
						currentRoomId
							? "Add problems to share with room members"
							: "Add problems from LeetCode to track them here"
					}
				</div>
			</div>
		`;
	}

	displayProblems(problems, currentRoomId) {
		this.elements.bucketList.innerHTML = "";

		problems.forEach((problem, index) => {
			const item = this.createProblemItem(problem, index, currentRoomId);
			this.elements.bucketList.appendChild(item);
		});
	}

	createProblemItem(problem, index, currentRoomId) {
		const item = document.createElement("div");
		item.className = "bucket-item fade-in";

		const problemNumber = problem.problemNumber || "?";
		const problemTitle = problem.problemTitle || "Unknown Problem";
		const difficulty = (problem.difficulty || "").toLowerCase();
		const url = problem.url || "#";
		const addedBy = problem.addedBy || "Unknown";
		const times = Array.isArray(problem.times) ? problem.times : [];

		let metaHTML = `<span>#${problemNumber}</span>`;
		if (difficulty) {
			metaHTML += `<span class="bucket-item-difficulty ${difficulty}">${difficulty}</span>`;
		}
		if (currentRoomId && addedBy) {
			metaHTML += `<span>by ${addedBy}</span>`;
		}

		let timesHTML = "";
		if (times.length > 0) {
			const timesList = times
				.map((t) => {
					if (typeof t === "string") {
						return t;
					} else {
						return currentRoomId
							? `${t.time} (${t.username})`
							: t.time;
					}
				})
				.join(", ");
			timesHTML = `<div class="bucket-item-times">Times: ${timesList}</div>`;
		}

		item.innerHTML = `
			<div class="bucket-item-content">
				<a href="${url}" target="_blank" class="bucket-item-title">
					${problemTitle}
				</a>
				<div class="bucket-item-meta">${metaHTML}</div>
				${timesHTML}
			</div>
			<button class="remove-btn" data-index="${index}" title="Remove from bucket">
				✕
			</button>
		`;

		return item;
	}

	showStateMessage(type, message, hasUtilityButtons = false) {
		const stateConfig = {
			noTab: { icon: "🔍", class: "info" },
			notLeetCode: { icon: "🎯", class: "info" },
			notDetected: { icon: "⚠️", class: "warning" },
			connectionError: { icon: "⚠️", class: "warning" },
			extensionError: { icon: "❌", class: "error" },
		};

		const config = stateConfig[type] || stateConfig.extensionError;

		this.elements.problemInfo.innerHTML = `
			<div class="status-message ${config.class}">
				<div class="status-icon">${config.icon}</div>
				<div class="status-title">${message}</div>
				<div class="status-subtitle">${this.getSubMessage(type)}</div>
			</div>
		`;

		if (hasUtilityButtons) {
			this.elements.quickActions.style.display = "flex";
			const addBtn = document.getElementById("addToBucketBtn");
			if (addBtn) {
				addBtn.style.display = "none";
			}
		} else {
			this.elements.quickActions.style.display = "none";
		}
	}

	getSubMessage(type) {
		const messages = {
			noTab: "Please navigate to a LeetCode problem",
			notLeetCode: "Visit a LeetCode problem to track it",
			notDetected: "Make sure you're on a LeetCode problem page",
			connectionError: "Try refreshing the LeetCode page",
			extensionError: "Please restart the extension",
		};
		return messages[type] || "";
	}

	showUsernameSetup() {
		return new Promise((resolve) => {
			const modal = this.createModal("username", {
				title: "Welcome to SpeedCode!",
				subtitle:
					"Choose a username to get started with collaborative problem solving",
				onSubmit: resolve,
			});
			document.body.appendChild(modal);
		});
	}

	showShareModal() {
		return new Promise((resolve) => {
			const modal = this.createModal("share", {
				title: "Shared Problem Bucket",
				onSubmit: resolve,
			});
			document.body.appendChild(modal);
		});
	}

	createModal(type, options) {
		const overlay = document.createElement("div");
		overlay.className = "modal-overlay";

		const modal = document.createElement("div");
		modal.className = "modal-content";

		if (type === "username") {
			modal.appendChild(this.createUsernameModalContent(options));
		} else if (type === "share") {
			modal.appendChild(this.createShareModalContent(options));
		}

		overlay.appendChild(modal);

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) {
				this.closeModal(overlay, options.onSubmit, null);
			}
		});

		this.modals.set(type, overlay);
		return overlay;
	}

	createUsernameModalContent(options) {
		const content = document.createElement("div");
		content.innerHTML = `
			<div class="modal-header">
				<div class="modal-icon">👋</div>
				<div class="modal-title">${options.title}</div>
				<div class="modal-subtitle">${options.subtitle}</div>
			</div>
			<div class="modal-body">
				<input 
					type="text" 
					id="usernameInput" 
					class="modal-input"
					placeholder="Enter your username..."
					maxlength="20"
				>
			</div>
			<div class="modal-buttons">
				<button id="saveUsernameBtn" class="modal-btn primary">
					Get Started
				</button>
				<div style="font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 12px;">
					No registration required • You can change this later
				</div>
			</div>
		`;

		this.setupUsernameModalEvents(content, options);
		return content;
	}

	createShareModalContent(options) {
		const content = document.createElement("div");
		content.innerHTML = `
			<div class="modal-header">
				<div class="modal-icon">🔗</div>
				<div class="modal-title">${options.title}</div>
			</div>
			<div class="modal-body">
				<div class="modal-buttons">
					<button id="createRoomBtn" class="modal-btn primary">
						🏠 Create New Room
					</button>
					<div class="modal-divider">
						<span>or</span>
					</div>
					<input 
						type="text" 
						id="roomIdInput" 
						class="modal-input"
						placeholder="Enter Room ID..."
						maxlength="6"
						style="text-transform: uppercase;"
					>
					<button id="joinRoomBtn" class="modal-btn secondary">
						🚪 Join Room
					</button>
				</div>
			</div>
			<div style="text-align: center; margin-top: 20px;">
				<button id="cancelBtn" class="modal-btn secondary" style="width: auto; padding: 8px 16px; font-size: 12px;">
					Cancel
				</button>
			</div>
		`;

		this.setupShareModalEvents(content, options);
		return content;
	}

	setupUsernameModalEvents(content, options) {
		const input = content.querySelector("#usernameInput");
		const saveBtn = content.querySelector("#saveUsernameBtn");

		setTimeout(() => input.focus(), 100);

		input.addEventListener("input", () => {
			const username = input.value.trim();
			const isValid = ValidationUtils.isValidUsername(username);

			saveBtn.disabled = !isValid;
			if (isValid) {
				input.style.borderColor = "var(--primary-color)";
			} else {
				input.style.borderColor = "var(--border-color)";
			}
		});

		const handleSubmit = () => {
			const username = input.value.trim();
			if (!ValidationUtils.isValidUsername(username)) {
				input.style.borderColor = "var(--error-color)";
				input.placeholder = "Username must be at least 2 characters";
				return;
			}
			this.handleUsernameSubmit(
				saveBtn,
				input,
				username,
				options.onSubmit
			);
		};

		saveBtn.addEventListener("click", handleSubmit);
		input.addEventListener("keypress", (e) => {
			if (e.key === "Enter" && !saveBtn.disabled) handleSubmit();
		});
	}

	setupShareModalEvents(content, options) {
		const createBtn = content.querySelector("#createRoomBtn");
		const joinBtn = content.querySelector("#joinRoomBtn");
		const roomInput = content.querySelector("#roomIdInput");
		const cancelBtn = content.querySelector("#cancelBtn");

		roomInput.addEventListener("input", (e) => {
			e.target.value = e.target.value
				.toUpperCase()
				.replace(/[^A-Z0-9]/g, "");
			const isValid = ValidationUtils.isValidRoomId(e.target.value);
			joinBtn.disabled = !isValid;
		});

		createBtn.addEventListener("click", () => {
			this.handleRoomAction(
				createBtn,
				"create",
				null,
				options.onSubmit,
				content
			);
		});

		joinBtn.addEventListener("click", () => {
			const roomId = roomInput.value.trim();
			if (!ValidationUtils.isValidRoomId(roomId)) {
				roomInput.style.borderColor = "var(--error-color)";
				return;
			}
			this.handleRoomAction(
				joinBtn,
				"join",
				roomId,
				options.onSubmit,
				content
			);
		});

		cancelBtn.addEventListener("click", () => {
			this.closeModal(
				content.closest(".modal-overlay"),
				options.onSubmit,
				null
			);
		});
	}

	handleUsernameSubmit(button, input, username, callback) {
		button.disabled = true;
		button.innerHTML = "⏳ Setting up...";

		try {
			const modal = button.closest(".modal-overlay");
			this.closeModal(modal, callback, username);
		} catch (error) {
			console.error("Error in username submit:", error);
			button.disabled = false;
			button.innerHTML = "Get Started";
			input.style.borderColor = "var(--error-color)";
			this.showToast(
				"Failed to save username. Please try again.",
				"error"
			);
		}
	}

	handleRoomAction(button, action, roomId, callback, modalContent) {
		button.disabled = true;
		button.textContent = action === "create" ? "Creating..." : "Joining...";

		callback({
			action,
			roomId,
			modalContent: modalContent.closest(".modal-overlay"),
		});
	}

	closeModal(modal, callback, result) {
		if (!modal) return;

		modal.style.opacity = "0";
		setTimeout(() => {
			if (modal.parentNode) {
				modal.parentNode.removeChild(modal);
			}

			for (const [key, value] of this.modals.entries()) {
				if (value === modal) {
					this.modals.delete(key);
					break;
				}
			}

			if (callback && result !== undefined) callback(result);
		}, 300);
	}

	showButtonFeedback(
		element,
		type,
		message,
		duration = CONSTANTS.FEEDBACK_DURATION
	) {
		const originalContent = element.innerHTML;

		element.disabled = true;
		element.className =
			element.className.replace(
				/\b(primary|secondary|success|warning|error)\b/g,
				""
			) + ` ${type}`;

		const icons = {
			error: "❌",
			success: "✅",
			loading: "⏳",
		};

		element.innerHTML = `${icons[type]} ${message}`;

		if (type !== "loading") {
			setTimeout(() => {
				element.disabled = false;
				element.className = element.className.replace(
					/\b(success|warning|error)\b/g,
					"primary"
				);
				element.innerHTML = originalContent;
			}, duration);
		}
	}

	showError(element, message, duration) {
		this.showButtonFeedback(element, "error", message, duration);
	}

	showSuccess(element, message, duration) {
		this.showButtonFeedback(element, "success", message, duration);
	}

	showLoading(element, message = "Loading...") {
		this.showButtonFeedback(element, "loading", message);
	}

	resetButton(element) {
		element.disabled = false;
		element.className = element.className.replace(
			/\b(success|warning|error|loading)\b/g,
			"primary"
		);

		const buttonTexts = {
			addToBucketBtn:
				'<span class="icon">🪣</span><span class="text">Add to Bucket</span><span class="dropdown-arrow">▾</span>',
			startTimerBtn:
				'<span class="icon">⏱️</span><span class="text">Timer</span>',
			shareBtn: '<span class="icon">🔗</span>',
		};

		if (buttonTexts[element.id]) {
			element.innerHTML = buttonTexts[element.id];
		}
	}

	updateTimerButton(button, isActive) {
		if (isActive) {
			button.innerHTML =
				'<span class="icon">⏹️</span><span class="text">Stop</span>';
			button.className = button.className.replace(
				/\b(primary|secondary)\b/g,
				"warning"
			);
		} else {
			button.innerHTML =
				'<span class="icon">⏱️</span><span class="text">Timer</span>';
			button.className = button.className.replace(
				/\b(warning)\b/g,
				"secondary"
			);
		}
	}

	updateBucketViewButton(button, isVisible) {
		if (isVisible) {
			button.innerHTML = '<span class="icon">🙈</span>';
			button.className = button.className.replace(
				/\bheader-btn\b/,
				"header-btn active"
			);
		} else {
			button.innerHTML = '<span class="icon">👁️</span>';
			button.className = button.className.replace(/\bactive\b/, "");
		}
	}

	toggleBucketList(isVisible) {
		this.elements.bucketContainer.style.display = isVisible
			? "flex"
			: "none";
	}

	showToast(message, type = "success", duration = 3000) {
		const existingToast = document.querySelector(".toast");
		if (existingToast) {
			existingToast.remove();
		}

		const toast = document.createElement("div");
		toast.className = `toast ${type}`;
		toast.textContent = message;

		document.body.appendChild(toast);

		setTimeout(() => {
			toast.style.opacity = "0";
			setTimeout(() => toast.remove(), 300);
		}, duration);
	}

	getButtons() {
		return {
			viewBucket: document.getElementById("viewBucketBtn"),
			share: document.getElementById("shareBtn"),
			timer: document.getElementById("startTimerBtn"),
			addToBucket: document.getElementById("addToBucketBtn"),
		};
	}

	onRoomChange(callback) {
		const select = document.getElementById("roomSelect");
		if (select) {
			select.addEventListener("change", (e) => {
				callback(e.target.value || null);
			});
		}
	}

	onRemoveButtonClick(callback) {
		this.elements.bucketList.addEventListener("click", async (e) => {
			if (e.target.classList.contains("remove-btn")) {
				const index = parseInt(e.target.dataset.index);
				const originalContent = e.target.innerHTML;

				e.target.innerHTML = "⏳";
				e.target.disabled = true;

				try {
					await callback(index);
				} catch (error) {
					console.error("Error removing item:", error);
					e.target.innerHTML = originalContent;
					e.target.disabled = false;
				}
			}
		});
	}

	cleanup() {
		this.dropdownCleanups.forEach((cleanup) => {
			try {
				cleanup();
			} catch (error) {
				console.error("Error cleaning up dropdown:", error);
			}
		});
		this.dropdownCleanups.clear();

		this.modals.forEach((modal) => {
			if (modal.parentNode) {
				modal.parentNode.removeChild(modal);
			}
		});
		this.modals.clear();

		this.hideDropdown();
	}
}
