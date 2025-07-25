import { StorageUtils, ErrorUtils, NetworkUtils } from "./utils.js";

export class StateManager {
	constructor() {
		this.state = {
			user: {
				uid: null,
				username: null,
				isAuthenticated: false,
				isUsernameSet: false,
			},

			ui: {
				isBucketVisible: false,
				currentLoadingState: null,
				activeModal: null,
			},

			room: {
				currentRoomId: null,
				joinedRooms: [],
				activeListener: null,
			},

			problem: {
				current: null,
				isOnLeetCode: false,
				detectionInProgress: false,
			},

			timer: {
				active: null,
				startTime: null,
				problemTitle: null,
			},

			network: {
				isOnline: navigator.onLine,
				lastSync: null,
			},

			bucket: {
				problems: [],
				lastUpdated: null,
				isLoading: false,
			},
		};

		this.listeners = new Map();
		this.middlewares = [];
		this.history = [];
		this.maxHistorySize = 50;

		this.init();
	}

	init() {
		this.setupNetworkMonitoring();

		this.loadPersistedState();

		this.setupAutoSave();
	}

	getState(path) {
		if (!path) return this.state;

		const keys = path.split(".");
		let current = this.state;

		for (const key of keys) {
			if (current === null || current === undefined) return undefined;
			current = current[key];
		}

		return current;
	}

	setState(path, value, silent = false) {
		const keys = path.split(".");
		const lastKey = keys.pop();
		let current = this.state;

		for (const key of keys) {
			if (!(key in current)) {
				current[key] = {};
			}
			current = current[key];
		}

		const oldValue = current[lastKey];

		const processedValue = this.applyMiddlewares(path, value, oldValue);

		current[lastKey] = processedValue;

		this.addToHistory(path, oldValue, processedValue);

		if (!silent) {
			this.emit(`change:${path}`, processedValue, oldValue);
			this.emit("stateChange", { path, value: processedValue, oldValue });
		}

		return processedValue;
	}

	updateState(path, updates, silent = false) {
		const currentValue = this.getState(path);
		const newValue = { ...currentValue, ...updates };
		return this.setState(path, newValue, silent);
	}

	resetState(path) {
		const defaultValue = this.getDefaultValue(path);
		return this.setState(path, defaultValue);
	}

	subscribe(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}

		this.listeners.get(event).push(callback);

		return () => {
			const callbacks = this.listeners.get(event);
			if (callbacks) {
				const index = callbacks.indexOf(callback);
				if (index > -1) {
					callbacks.splice(index, 1);
				}
			}
		};
	}

	emit(event, ...args) {
		const callbacks = this.listeners.get(event);
		if (callbacks) {
			callbacks.forEach((callback) => {
				try {
					callback(...args);
				} catch (error) {
					ErrorUtils.logError("StateManager.emit", error, { event });
				}
			});
		}
	}

	watch(path, callback) {
		return this.subscribe(`change:${path}`, callback);
	}

	addMiddleware(middleware) {
		this.middlewares.push(middleware);
	}

	applyMiddlewares(path, value, oldValue) {
		let processedValue = value;

		for (const middleware of this.middlewares) {
			try {
				processedValue = middleware(
					path,
					processedValue,
					oldValue,
					this.state
				);
			} catch (error) {
				ErrorUtils.logError("StateManager.applyMiddlewares", error, {
					path,
					middleware,
				});
			}
		}

		return processedValue;
	}

	addToHistory(path, oldValue, newValue) {
		this.history.push({
			timestamp: Date.now(),
			path,
			oldValue,
			newValue,
		});

		if (this.history.length > this.maxHistorySize) {
			this.history.shift();
		}
	}

	getHistory() {
		return [...this.history];
	}

	clearHistory() {
		this.history = [];
	}

	setUserAuth(user) {
		this.updateState("user", {
			uid: user?.uid || null,
			isAuthenticated: !!user,
		});
	}

	setUsername(username) {
		this.updateState("user", {
			username,
			isUsernameSet: !!username,
		});
	}

	getCurrentUser() {
		return this.getState("user");
	}

	setCurrentRoom(roomId) {
		this.setState("room.currentRoomId", roomId);
	}

	setJoinedRooms(rooms) {
		this.setState("room.joinedRooms", rooms);
	}

	addJoinedRoom(room) {
		const currentRooms = this.getState("room.joinedRooms") || [];
		const updatedRooms = [...currentRooms, room];
		this.setState("room.joinedRooms", updatedRooms);
	}

	setCurrentProblem(problemData) {
		this.updateState("problem", {
			current: problemData,
			isOnLeetCode: !!problemData?.onProblem,
		});
	}

	setProblemDetection(inProgress) {
		this.setState("problem.detectionInProgress", inProgress);
	}

	startTimer(problemTitle) {
		this.updateState("timer", {
			active: true,
			startTime: Date.now(),
			problemTitle,
		});

		StorageUtils.set({
			activeTimer: {
				startTime: Date.now(),
				problemTitle,
			},
		});
	}

	stopTimer() {
		const timer = this.getState("timer");
		if (!timer.active) return null;

		const elapsedMs = Date.now() - timer.startTime;
		const elapsedSeconds = Math.round(elapsedMs / 1000);

		this.updateState("timer", {
			active: false,
			startTime: null,
			problemTitle: null,
		});

		StorageUtils.remove("activeTimer");

		return elapsedSeconds;
	}

	async loadTimerFromStorage() {
		const activeTimer = await StorageUtils.get("activeTimer");
		if (activeTimer && activeTimer.problemTitle) {
			this.updateState("timer", {
				active: true,
				startTime: activeTimer.startTime,
				problemTitle: activeTimer.problemTitle,
			});
			return true;
		}
		return false;
	}

	setBucketVisibility(isVisible) {
		this.setState("ui.isBucketVisible", isVisible);
	}

	setLoadingState(state) {
		this.setState("ui.currentLoadingState", state);
	}

	setActiveModal(modalType) {
		this.setState("ui.activeModal", modalType);
	}

	setBucketProblems(problems) {
		this.updateState("bucket", {
			problems,
			lastUpdated: Date.now(),
			isLoading: false,
		});
	}

	setBucketLoading(isLoading) {
		this.setState("bucket.isLoading", isLoading);
	}

	addProblemToBucket(problem) {
		const currentProblems = this.getState("bucket.problems") || [];
		const updatedProblems = [...currentProblems, problem];
		this.setBucketProblems(updatedProblems);
	}

	removeProblemFromBucket(index) {
		const currentProblems = this.getState("bucket.problems") || [];
		const updatedProblems = currentProblems.filter((_, i) => i !== index);
		this.setBucketProblems(updatedProblems);
	}

	setupNetworkMonitoring() {
		NetworkUtils.setupNetworkListeners(
			() => this.setNetworkStatus(true),
			() => this.setNetworkStatus(false)
		);
	}

	setNetworkStatus(isOnline) {
		this.setState("network.isOnline", isOnline);
		if (isOnline) {
			this.setState("network.lastSync", Date.now());
		}
	}

	setupAutoSave() {
		this.watch("ui", () => this.saveUIState());
		this.watch("room.currentRoomId", () => this.saveRoomState());
	}

	async saveUIState() {
		const uiState = this.getState("ui");
		await StorageUtils.set({ speedcode_ui_state: uiState });
	}

	async saveRoomState() {
		const roomState = this.getState("room");
		await StorageUtils.set({ speedcode_room_state: roomState });
	}

	async loadPersistedState() {
		try {
			const uiState = await StorageUtils.get("speedcode_ui_state");
			if (uiState) {
				this.setState("ui", uiState, true);
			}

			const roomState = await StorageUtils.get("speedcode_room_state");
			if (roomState) {
				this.setState("room", roomState, true);
			}

			await this.loadTimerFromStorage();
		} catch (error) {
			ErrorUtils.logError("StateManager.loadPersistedState", error);
		}
	}

	getDefaultValue(path) {
		const defaults = {
			user: {
				uid: null,
				username: null,
				isAuthenticated: false,
				isUsernameSet: false,
			},
			ui: {
				isBucketVisible: false,
				currentLoadingState: null,
				activeModal: null,
			},
			room: {
				currentRoomId: null,
				joinedRooms: [],
				activeListener: null,
			},
			problem: {
				current: null,
				isOnLeetCode: false,
				detectionInProgress: false,
			},
			timer: {
				active: false,
				startTime: null,
				problemTitle: null,
			},
			bucket: {
				problems: [],
				lastUpdated: null,
				isLoading: false,
			},
		};

		return defaults[path] || null;
	}

	getSnapshot() {
		return JSON.parse(JSON.stringify(this.state));
	}

	getStatus() {
		return {
			listeners: this.listeners.size,
			middlewares: this.middlewares.length,
			historySize: this.history.length,
			state: this.getSnapshot(),
		};
	}

	exportState() {
		return {
			timestamp: Date.now(),
			state: this.getSnapshot(),
			history: this.getHistory(),
		};
	}

	cleanup() {
		this.listeners.clear();
		this.middlewares = [];
		this.clearHistory();
	}
}
