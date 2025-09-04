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
		this.init();
	}

	init() {
		this.elements.problemInfo = document.getElementById("problemInfo");
		this.elements.bucketList = document.getElementById("bucketList");
		this.elements.bucketListContainer = document.getElementById(
			"bucketListContainer"
		);

		AnimationUtils.addLoadingStyles();
	}

	showLoadingUI(state, message) {
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

		this.elements.problemInfo.innerHTML = `
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

	renderProblemInfo(problemData, joinedRooms, username, addToBucketCallback) {
		let infoHTML = `<div class="info-header speedcode-fade-in">`;

		if (problemData.problemNumber) {
			infoHTML += `<div class="problem-number">#${problemData.problemNumber}</div>`;
		}

		infoHTML += `<div class="button-group">`;
		//add button is slotted in dynamically by createAddToBucketDropdown
		infoHTML += `<button id="viewBucketBtn" class="bucket-btn">👁️ View</button>`;
		infoHTML += `<button id="shareBtn" class="bucket-btn">🔗 Share</button>`;
		infoHTML += `<button id="startTimerBtn" class="bucket-btn">⏱️ Timer</button>`;
		infoHTML += `</div></div>`;

		if (problemData.problemTitle) {
			infoHTML += `<div class="problem-title speedcode-fade-in" style="animation-delay: 0.1s;">${problemData.problemTitle}</div>`;
		}

		if (problemData.difficulty) {
			infoHTML += `<div class="difficulty difficulty-${problemData.difficulty.toLowerCase()} speedcode-fade-in" style="animation-delay: 0.2s;">${
				problemData.difficulty
			}</div>`;
		}

		this.elements.problemInfo.innerHTML = infoHTML;
		const dropdown = this.createAddToBucketDropdown(
			problemData,
			joinedRooms,
			username,
			addToBucketCallback
		);
		this.elements.problemInfo.querySelector(".button-group").prepend(dropdown);
	}

	renderBucketList(
		problems,
		roomName = null,
		currentRoomId = null,
		joinedRooms = [],
		currentUsername = ""
	) {
		this.elements.bucketList.innerHTML = `
			<div style="color: #6b7280; text-align: center; padding: 20px;">
				⏳ Loading bucket...
			</div>
		`;

		if (joinedRooms.length > 0) {
			const roomSelector = this.createRoomSelector(
				joinedRooms,
				currentRoomId,
				currentUsername
			);
			this.elements.bucketList.innerHTML = "";
			this.elements.bucketList.appendChild(roomSelector);
		}

		if (problems.length === 0) {
			this.showEmptyBucket(currentRoomId);
			return;
		}

		this.displayProblems(problems, currentRoomId);
	}

	createRoomSelector(joinedRooms, currentRoomId, currentUsername) {
		const roomSelector = DOMUtils.createElement(
			"div",
			`
			margin-bottom: 16px; 
			padding: 12px; 
			background: #333; 
			border-radius: 8px;
		`
		);

		const select = DOMUtils.createElement(
			"select",
			`
			width: 100%; 
			padding: 8px; 
			background: #1a1a1a; 
			color: white; 
			border: 1px solid #555; 
			border-radius: 4px;
		`
		);

		const personalOption = document.createElement("option");
		personalOption.value = "";
		personalOption.textContent = `📝 ${currentUsername}'s Personal Bucket`;
		select.appendChild(personalOption);

		joinedRooms.forEach((roomData) => {
			if (roomData && roomData.id) {
				const option = document.createElement("option");
				option.value = roomData.id;
				option.textContent = `🏠 ${roomData.name} (${roomData.id})`;
				if (roomData.id === currentRoomId) option.selected = true;
				select.appendChild(option);
			}
		});

		roomSelector.appendChild(select);
		return roomSelector;
	}

	showEmptyBucket(currentRoomId) {
		const existingSelector = this.elements.bucketList.querySelector(
			'div[style*="margin-bottom: 16px"]'
		);

		const emptyDiv = DOMUtils.createElement(
			"div",
			"color: #6b7280; text-align: center; padding: 20px;",
			`
				<div>📝 No problems saved yet</div>
				<div style="font-size: 12px; margin-top: 8px;">
					${
						currentRoomId
							? "Add problems to share with room members"
							: "Add problems from LeetCode to track them here"
					}
				</div>
			`
		);

		if (existingSelector) {
			this.elements.bucketList.insertBefore(
				emptyDiv,
				existingSelector.nextSibling
			);
		} else {
			this.elements.bucketList.appendChild(emptyDiv);
		}
	}

	createAddToBucketDropdown(problemData, joinedRooms, username, callback) {
		const container = document.createElement("div");
		container.style.position = "relative";
		container.style.display = "inline-block";

		const mainButton = document.createElement("button");
		mainButton.className = "bucket-btn";
		mainButton.textContent = "🪣 Add ▾";
		mainButton.id = "addToBucketBtn";

		const list = document.createElement("div");
		Object.assign(list.style, {
			display: "none",
			position: "absolute",
			top: "calc(100% + 4px)",
			left: "0",
			background: "var(--color-surface-elevated)",
			border: "1px solid var(--color-border)",
			borderRadius: "var(--radius-sm)",
			boxShadow: "var(--shadow-md)",
			minWidth: "160px",
			zIndex: "1000",
			overflow: "hidden"
		});

		const addOption = (text, bucketId) => {
			const item = document.createElement("div");
			Object.assign(item.style, {
				padding: "var(--space-sm) var(--space-md)",
				cursor: "pointer",
				fontSize: "var(--font-size-sm)",
				color: "var(--color-text-primary)",
				background: "var(--color-surface-elevated)",
				transition: "background 0.2s ease"
			});
			item.textContent = text;
			item.addEventListener("mouseover", () => {
				item.style.background = "var(--color-surface-hover)";
			});
			item.addEventListener("mouseout", () => {
				item.style.background = "var(--color-surface-elevated)";
			});
			item.addEventListener("click", () => {
				callback(problemData, bucketId, item);
				list.style.display = "none";
			});
			list.appendChild(item);
		};

		// Personal bucket
		addOption(`📝 ${username}'s Personal Bucket`, "");

		// Shared buckets
		joinedRooms.forEach(room => {
			if (room && room.id) {
				addOption(`🏠 ${room.name} (${room.id})`, room.id);
			}
		});

		mainButton.addEventListener("click", (e) => {
			e.stopPropagation();
			list.style.display = (list.style.display === "block") ? "none" : "block";
		});

		document.addEventListener("click", () => {
			list.style.display = "none";
		});

		container.appendChild(mainButton);
		container.appendChild(list);

		return container;
	}

	displayProblems(problems, currentRoomId) {
		const existingSelector = this.elements.bucketList.querySelector(
			'div[style*="margin-bottom: 16px"]'
		);
		const problemsContainer = document.createElement("div");

		problems.forEach((problem, index) => {
			const item = this.createProblemItem(problem, index, currentRoomId);
			problemsContainer.appendChild(item);
		});

		if (existingSelector) {
			const existingProblems = this.elements.bucketList.children;
			for (let i = existingProblems.length - 1; i >= 0; i--) {
				if (existingProblems[i] !== existingSelector) {
					this.elements.bucketList.removeChild(existingProblems[i]);
				}
			}
			this.elements.bucketList.insertBefore(
				problemsContainer,
				existingSelector.nextSibling
			);
		} else {
			this.elements.bucketList.innerHTML = "";
			this.elements.bucketList.appendChild(problemsContainer);
		}
	}

	createProblemItem(problem, index, currentRoomId) {
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
			timesDisplay = `<div style="font-size: 10px; color: #888; margin-top: 4px;">Times: ${timesList}</div>`;
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

		return item;
	}

	showStateMessage(type, message, hasUtilityButtons = false) {
		const icons = {
			noTab: "🔍",
			notLeetCode: "🎯",
			notDetected: "⚠️",
			connectionError: "⚠️",
			extensionError: "❌",
		};

		const colors = {
			noTab: "#6b7280",
			notLeetCode: "#6b7280",
			notDetected: "#f59e0b",
			connectionError: "#f59e0b",
			extensionError: "#ef4444",
		};

		let buttonsHTML = "";
		if (hasUtilityButtons) {
			buttonsHTML = `
				<div style="margin-top: 12px; display: flex; gap: 8px;">
					<button id="viewBucketBtn" class="bucket-btn">👁️ View</button>
					<button id="shareBtn" class="bucket-btn">🔗 Share</button>
				</div>
			`;
		}

		this.elements.problemInfo.innerHTML = `
			<div style="color: ${colors[type]}; text-align: center; padding: 20px;">
				<div>${icons[type]} ${message}</div>
				<div style="font-size: 12px; margin-top: 8px;">
					${this.getSubMessage(type)}
				</div>
				${buttonsHTML}
			</div>
		`;
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
		const modal = DOMUtils.createElement(
			"div",
			`
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
		`
		);
		modal.className = "speedcode-fade-in";

		if (type === "username") {
			modal.appendChild(this.createUsernameModalContent(options));
		} else if (type === "share") {
			modal.appendChild(this.createShareModalContent(options));
		}

		modal.addEventListener("click", (e) => {
			if (e.target === modal) {
				this.closeModal(modal, options.onSubmit, null);
			}
		});

		this.modals.set(type, modal);
		return modal;
	}

	createUsernameModalContent(options) {
		const content = DOMUtils.createElement(
			"div",
			`
			background: #1a1a1a; 
			padding: 32px; 
			border-radius: 16px; 
			width: 320px; 
			text-align: center; 
			border: 1px solid #333;
		`
		);
		content.className = "speedcode-fade-in";

		content.innerHTML = `
			<div style="font-size: 40px; margin-bottom: 16px;">👋</div>
			<h3 style="color: white; margin: 0 0 8px 0; font-size: 20px;">${options.title}</h3>
			<p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px; line-height: 1.5;">
				${options.subtitle}
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
		`;

		this.setupUsernameModalEvents(content, options);
		return content;
	}

	createShareModalContent(options) {
		const content = DOMUtils.createElement(
			"div",
			`
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
		`
		);

		content.innerHTML = `
			<h3 style="color: white; margin: 0 0 16px 0; font-size: 18px;">${options.title}</h3>
			
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

			input.style.borderColor = isValid ? "#10b981" : "#333";
			saveBtn.disabled = !isValid;
			saveBtn.style.opacity = isValid ? "1" : "0.6";
		});

		input.addEventListener(
			"focus",
			() => (input.style.borderColor = "#10b981")
		);
		input.addEventListener("blur", () => {
			if (!ValidationUtils.isValidUsername(input.value.trim())) {
				input.style.borderColor = "#333";
			}
		});

		saveBtn.addEventListener("mouseenter", () => {
			if (!saveBtn.disabled) saveBtn.style.transform = "translateY(-1px)";
		});
		saveBtn.addEventListener("mouseleave", () => {
			if (!saveBtn.disabled) saveBtn.style.transform = "translateY(0)";
		});

		const handleSubmit = () => {
			const username = input.value.trim();
			if (!ValidationUtils.isValidUsername(username)) {
				input.style.borderColor = "#ef4444";
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
		});

		createBtn.addEventListener("click", () => {
			this.handleRoomCreate(createBtn, options.onSubmit);
		});

		joinBtn.addEventListener("click", () => {
			this.handleRoomJoin(joinBtn, roomInput, options.onSubmit);
		});

		cancelBtn.addEventListener("click", () => {
			this.closeModal(
				content.closest(".speedcode-fade-in"),
				options.onSubmit,
				null
			);
		});
	}

	async handleUsernameSubmit(button, input, username, callback) {
		button.disabled = true;
		button.innerHTML = "⏳ Setting up...";
		button.style.transform = "translateY(0)";

		try {
			callback(username);
		} catch (error) {
			console.error("Error in username submit:", error);
			button.disabled = false;
			button.innerHTML = "Get Started";
			input.style.borderColor = "#ef4444";

			const errorDiv = DOMUtils.createElement(
				"div",
				"color: #ef4444; font-size: 12px; margin-top: 8px;",
				"Failed to save username. Please try again."
			);
			button.parentNode.insertBefore(errorDiv, button.nextSibling);
			setTimeout(() => errorDiv.remove(), 3000);
		}
	}

	handleRoomCreate(button, callback) {
		button.disabled = true;
		button.textContent = "Creating...";
		callback({ action: "create" });
	}

	handleRoomJoin(button, input, callback) {
		const roomId = input.value.trim();
		if (!ValidationUtils.isValidRoomId(roomId)) {
			input.style.borderColor = "#ef4444";
			return;
		}

		button.disabled = true;
		button.textContent = "Joining...";
		callback({ action: "join", roomId });
	}

	closeModal(modal, callback, result) {
		modal.style.opacity = "0";
		modal.style.transition = "opacity 0.3s ease";
		setTimeout(() => {
			DOMUtils.removeElement(modal);
			if (callback) callback(result);
		}, 300);
	}

	showButtonFeedback(
		element,
		type,
		message,
		duration = CONSTANTS.FEEDBACK_DURATION
	) {
		const colors = {
			error: { bg: "#ef4444", color: "white" },
			success: { bg: "#10b981", color: "white" },
			loading: { bg: "#6b7280", color: "white" },
		};

		const icons = {
			error: "❌",
			success: "✅",
			loading: "⏳",
		};

		element.innerHTML = `${icons[type]} ${message}`;
		element.style.background = colors[type].bg;
		element.style.color = colors[type].color;
		element.disabled = true;

		if (type !== "loading") {
			setTimeout(() => {
				this.resetButton(element);
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
		element.style.background = "";
		element.style.color = "";

		const buttonTexts = {
			addToBucketBtn: "🪣 Add ▾",
			viewBucketBtn: "👁️ View",
			shareBtn: "🔗 Share",
			startTimerBtn: "⏱️ Timer",
		};

		element.innerHTML = buttonTexts[element.id] || element.innerHTML;
	}

	showConnectionStatus(isOnline) {
		let statusDiv = document.getElementById("connectionStatus");

		if (!statusDiv) {
			statusDiv = DOMUtils.createElement(
				"div",
				`
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
			`
			);
			statusDiv.id = "connectionStatus";
			document.body.insertBefore(statusDiv, document.body.firstChild);
		}

		if (!isOnline) {
			statusDiv.innerHTML =
				"📶 Offline - Changes will sync when connected";
			statusDiv.style.background = "#f59e0b";
			statusDiv.style.color = "white";
			statusDiv.style.display = "block";
		} else {
			statusDiv.style.display = "none";
		}

		return statusDiv;
	}

	updateTimerButton(button, isActive) {
		if (isActive) {
			button.innerHTML = "⏹️ Stop";
			button.style.background = "#f59e0b";
			button.style.color = "white";
		} else {
			button.innerHTML = "⏱️ Timer";
			button.style.background = "";
			button.style.color = "";
		}
	}

	updateBucketViewButton(button, isVisible) {
		if (isVisible) {
			button.innerHTML = "🙈 Hide";
			button.style.background = "#6b7280";
			button.style.color = "white";
		} else {
			button.innerHTML = "👁️ View";
			button.style.background = "";
			button.style.color = "";
		}
	}

	toggleBucketList(isVisible) {
		this.elements.bucketListContainer.style.display = isVisible
			? "block"
			: "none";
	}

	getButtons() {
		return {
			// addToBucket: document.getElementById("addToBucketBtn"),
			viewBucket: document.getElementById("viewBucketBtn"),
			share: document.getElementById("shareBtn"),
			timer: document.getElementById("startTimerBtn"),
		};
	}

	setInputError(input, message) {
		input.style.borderColor = "#ef4444";
		if (message) {
			input.placeholder = message;
		}
	}

	getRoomSelector() {
		return this.elements.bucketList.querySelector("select");
	}

	onRoomChange(callback) {
		const selector = this.getRoomSelector();
		if (selector) {
			selector.addEventListener("change", (e) => {
				callback(e.target.value || null);
			});
		}
	}

	onRemoveButtonClick(callback) {
		document.querySelectorAll(".remove-button").forEach((btn) => {
			btn.addEventListener("click", async (e) => {
				const indexToRemove = parseInt(e.target.dataset.index);
				const originalText = e.target.innerHTML;

				e.target.innerHTML = "⏳";
				e.target.disabled = true;

				try {
					await callback(indexToRemove);
				} catch (error) {
					console.error("Error removing item:", error);
					e.target.innerHTML = originalText;
					e.target.disabled = false;
				}
			});
		});
	}
}
