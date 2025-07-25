import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { ValidationUtils, ErrorUtils } from "./utils.js";

export class AuthManager {
	constructor(auth, databaseManager) {
		this.auth = auth;
		this.databaseManager = databaseManager;
		this.currentUser = null;
		this.currentUsername = null;
		this.authStateListeners = [];
		this.isInitialized = false;
	}

	async initialize() {
		if (this.isInitialized) return this.currentUser;

		try {
			await this.signInAnonymously();

			const user = await this.waitForAuthState();

			await this.initializeUsername();

			this.isInitialized = true;
			return user;
		} catch (error) {
			ErrorUtils.logError("AuthManager.initialize", error);
			throw error;
		}
	}

	async signInAnonymously() {
		try {
			const result = await signInAnonymously(this.auth);
			console.log("Signed in anonymously:", result.user.uid);
			return result.user;
		} catch (error) {
			ErrorUtils.logError("AuthManager.signInAnonymously", error);
			throw new Error(`Authentication failed: ${error.message}`);
		}
	}

	waitForAuthState() {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("Authentication timeout"));
			}, 10000);

			const unsubscribe = onAuthStateChanged(
				this.auth,
				(user) => {
					clearTimeout(timeout);
					unsubscribe();

					if (user) {
						this.currentUser = user;
						this.databaseManager.setUserId(user.uid);
						this.notifyAuthStateListeners(user);
						resolve(user);
					} else {
						reject(new Error("User not authenticated"));
					}
				},
				(error) => {
					clearTimeout(timeout);
					unsubscribe();
					ErrorUtils.logError("AuthManager.waitForAuthState", error);
					reject(error);
				}
			);
		});
	}

	async initializeUsername() {
		if (!this.currentUser) {
			throw new Error("User not authenticated");
		}

		try {
			const userData = await this.databaseManager.getUser();

			if (userData && userData.username) {
				this.currentUsername = userData.username;
				console.log("Existing username found:", this.currentUsername);
				return this.currentUsername;
			}

			return null;
		} catch (error) {
			ErrorUtils.logError("AuthManager.initializeUsername", error);
			return null;
		}
	}

	async setupUsername(username) {
		if (!this.currentUser) {
			throw new Error("User not authenticated");
		}

		if (!ValidationUtils.isValidUsername(username)) {
			throw new Error("Invalid username: must be 2-20 characters");
		}

		try {
			await this.databaseManager.createUser(username);

			this.currentUsername = username;
			console.log("Username set:", username);

			return username;
		} catch (error) {
			ErrorUtils.logError("AuthManager.setupUsername", error, {
				username,
			});
			throw new Error(`Failed to save username: ${error.message}`);
		}
	}

	async updateUsername(newUsername) {
		if (!this.currentUser) {
			throw new Error("User not authenticated");
		}

		if (!ValidationUtils.isValidUsername(newUsername)) {
			throw new Error("Invalid username: must be 2-20 characters");
		}

		try {
			await this.databaseManager.updateUser({ username: newUsername });
			this.currentUsername = newUsername;
			console.log("Username updated:", newUsername);
			return newUsername;
		} catch (error) {
			ErrorUtils.logError("AuthManager.updateUsername", error, {
				newUsername,
			});
			throw new Error(`Failed to update username: ${error.message}`);
		}
	}

	getCurrentUser() {
		return {
			uid: this.currentUser?.uid || null,
			username: this.currentUsername,
			isAuthenticated: !!this.currentUser,
			isUsernameSet: !!this.currentUsername,
		};
	}

	getUserId() {
		return this.currentUser?.uid || null;
	}

	getUsername() {
		return this.currentUsername;
	}

	isAuthenticated() {
		return !!this.currentUser;
	}

	isUsernameSet() {
		return !!this.currentUsername;
	}

	async signOut() {
		try {
			await this.auth.signOut();
			this.currentUser = null;
			this.currentUsername = null;
			this.isInitialized = false;
			this.databaseManager.setUserId(null);
			this.notifyAuthStateListeners(null);
			console.log("Signed out");
		} catch (error) {
			ErrorUtils.logError("AuthManager.signOut", error);
			throw new Error(`Sign out failed: ${error.message}`);
		}
	}

	async refreshUserData() {
		if (!this.currentUser) {
			throw new Error("User not authenticated");
		}

		try {
			const userData = await this.databaseManager.getUser();
			if (userData && userData.username) {
				this.currentUsername = userData.username;
			}
			return userData;
		} catch (error) {
			ErrorUtils.logError("AuthManager.refreshUserData", error);
			throw error;
		}
	}

	addAuthStateListener(callback) {
		this.authStateListeners.push(callback);

		if (this.currentUser) {
			callback(this.currentUser);
		}

		return () => {
			const index = this.authStateListeners.indexOf(callback);
			if (index > -1) {
				this.authStateListeners.splice(index, 1);
			}
		};
	}

	notifyAuthStateListeners(user) {
		this.authStateListeners.forEach((callback) => {
			try {
				callback(user);
			} catch (error) {
				ErrorUtils.logError(
					"AuthManager.notifyAuthStateListeners",
					error
				);
			}
		});
	}

	async getUserProfile() {
		if (!this.currentUser) {
			throw new Error("User not authenticated");
		}

		try {
			const userData = await this.databaseManager.getUser();
			return {
				uid: this.currentUser.uid,
				username: this.currentUsername,
				createdAt: userData?.createdAt,
				joinedRooms: userData?.joinedRooms || [],
				...userData,
			};
		} catch (error) {
			ErrorUtils.logError("AuthManager.getUserProfile", error);
			throw error;
		}
	}

	async updateUserProfile(updates) {
		if (!this.currentUser) {
			throw new Error("User not authenticated");
		}

		try {
			if (updates.username && updates.username !== this.currentUsername) {
				await this.updateUsername(updates.username);
				delete updates.username;
			}

			if (Object.keys(updates).length > 0) {
				await this.databaseManager.updateUser(updates);
			}

			return await this.getUserProfile();
		} catch (error) {
			ErrorUtils.logError("AuthManager.updateUserProfile", error);
			throw error;
		}
	}

	async deleteAccount() {
		if (!this.currentUser) {
			throw new Error("User not authenticated");
		}

		try {
			await this.signOut();
			console.log("Account deleted (signed out)");
		} catch (error) {
			ErrorUtils.logError("AuthManager.deleteAccount", error);
			throw error;
		}
	}

	validateAuthState() {
		if (!this.isAuthenticated()) {
			throw new Error("User not authenticated");
		}

		if (!this.isUsernameSet()) {
			throw new Error("Username not set");
		}
	}

	async recoverFromAuthError() {
		try {
			console.log("Attempting auth recovery...");

			this.currentUser = null;
			this.currentUsername = null;
			this.isInitialized = false;

			await this.initialize();

			console.log("Auth recovery successful");
			return true;
		} catch (error) {
			ErrorUtils.logError("AuthManager.recoverFromAuthError", error);
			return false;
		}
	}

	getAuthStatus() {
		return {
			isInitialized: this.isInitialized,
			isAuthenticated: this.isAuthenticated(),
			isUsernameSet: this.isUsernameSet(),
			userId: this.getUserId(),
			username: this.getUsername(),
			listenersCount: this.authStateListeners.length,
		};
	}

	waitForUsername(timeout = 30000) {
		return new Promise((resolve, reject) => {
			if (this.isUsernameSet()) {
				resolve(this.currentUsername);
				return;
			}

			const timeoutId = setTimeout(() => {
				reject(new Error("Timeout waiting for username"));
			}, timeout);

			const checkUsername = () => {
				if (this.isUsernameSet()) {
					clearTimeout(timeoutId);
					resolve(this.currentUsername);
				} else {
					setTimeout(checkUsername, 100);
				}
			};

			checkUsername();
		});
	}

	cleanup() {
		this.authStateListeners = [];
		this.currentUser = null;
		this.currentUsername = null;
		this.isInitialized = false;
	}
}
