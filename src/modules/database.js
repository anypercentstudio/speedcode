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

import {
	retryOperation,
	generateRoomId,
	TimeUtils,
	ErrorUtils,
} from "./utils.js";

export class DatabaseManager {
	constructor(db, userId) {
		this.db = db;
		this.userId = userId;
		this.listeners = new Map();
	}

	setUserId(userId) {
		this.userId = userId;
	}

	async createUser(username) {
		if (!this.userId) throw new Error("User ID not set");

		return await retryOperation(async () => {
			await setDoc(
				doc(this.db, `users/${this.userId}`),
				{
					username: username,
					createdAt: TimeUtils.now(),
					joinedRooms: [],
				},
				{ merge: true }
			);
		});
	}

	async getUser() {
		if (!this.userId) throw new Error("User ID not set");

		return await retryOperation(async () => {
			const userDoc = await getDoc(doc(this.db, `users/${this.userId}`));
			return userDoc.exists() ? userDoc.data() : null;
		});
	}

	async updateUser(data) {
		if (!this.userId) throw new Error("User ID not set");

		return await retryOperation(async () => {
			await updateDoc(doc(this.db, `users/${this.userId}`), data);
		});
	}

	async createRoom(roomName, createdBy) {
		const roomId = generateRoomId();

		return await retryOperation(async () => {
			await setDoc(doc(this.db, `sharedBuckets/${roomId}`), {
				name: roomName,
				createdBy: createdBy,
				createdAt: TimeUtils.now(),
				problems: [],
				members: [createdBy],
			});

			await this.addRoomToUser(roomId);

			return roomId;
		});
	}

	async joinRoom(roomId, username) {
		return await retryOperation(async () => {
			const roomDoc = await getDoc(
				doc(this.db, `sharedBuckets/${roomId}`)
			);
			if (!roomDoc.exists()) {
				throw new Error("Room not found");
			}

			await updateDoc(doc(this.db, `sharedBuckets/${roomId}`), {
				members: arrayUnion(username),
			});

			await this.addRoomToUser(roomId);

			return roomId;
		});
	}

	async addRoomToUser(roomId) {
		if (!this.userId) throw new Error("User ID not set");

		await updateDoc(doc(this.db, `users/${this.userId}`), {
			joinedRooms: arrayUnion(roomId),
		});
	}

	async getRoom(roomId) {
		return await retryOperation(async () => {
			const roomDoc = await getDoc(
				doc(this.db, `sharedBuckets/${roomId}`)
			);
			return roomDoc.exists() ? roomDoc.data() : null;
		});
	}

	async getUserRooms() {
		const user = await this.getUser();
		if (!user || !user.joinedRooms) return [];

		const roomPromises = user.joinedRooms.map(async (roomId) => {
			try {
				const roomData = await this.getRoom(roomId);
				return roomData ? { id: roomId, ...roomData } : null;
			} catch (error) {
				ErrorUtils.logError("getUserRooms", error, { roomId });
				return null;
			}
		});

		const rooms = await Promise.all(roomPromises);
		return rooms.filter((room) => room !== null);
	}

	getBucketRef(roomId = null) {
		if (roomId) {
			return doc(this.db, `sharedBuckets/${roomId}`);
		} else {
			if (!this.userId) throw new Error("User ID not set");
			return doc(this.db, `users/${this.userId}/buckets/default`);
		}
	}

	async getBucketProblems(roomId = null) {
		return await retryOperation(async () => {
			const bucketRef = this.getBucketRef(roomId);
			const docSnap = await getDoc(bucketRef);

			if (docSnap.exists()) {
				return docSnap.data().problems || [];
			}
			return [];
		});
	}

	async addProblemToBucket(problemData, roomId = null, addedBy) {
		return await retryOperation(async () => {
			const bucketRef = this.getBucketRef(roomId);
			const docSnap = await getDoc(bucketRef);
			const currentProblems = docSnap.exists()
				? docSnap.data().problems || []
				: [];

			const alreadyExists = currentProblems.some(
				(p) => (p.url.match(/\/problems\/[^/]+/i)?.[0].replace(/\/$/, "").toLowerCase() ||
					p.url.toLowerCase()) ===
					(problemData.url.match(/\/problems\/[^/]+/i)?.[0].replace(/\/$/, "").toLowerCase() ||
					problemData.url.toLowerCase())
			);

			if (alreadyExists) {
				return { alreadyExists: true };
			}

			const problemToAdd = {
				problemNumber: problemData.problemNumber || "Unknown",
				problemTitle: problemData.problemTitle || "Unknown Problem",
				difficulty: problemData.difficulty || "Unknown",
				url: problemData.url,
				addedAt: TimeUtils.now(),
				addedBy: addedBy,
				times: [],
			};

			currentProblems.push(problemToAdd);

			if (roomId) {
				await updateDoc(bucketRef, { problems: currentProblems });
			} else {
				await setDoc(
					bucketRef,
					{ problems: currentProblems },
					{ merge: true }
				);
			}

			return { alreadyExists: false, problem: problemToAdd };
		});
	}

	async removeProblemFromBucket(problemIndex, roomId = null) {
		return await retryOperation(async () => {
			const bucketRef = this.getBucketRef(roomId);
			const docSnap = await getDoc(bucketRef);

			if (!docSnap.exists()) return;

			const currentProblems = docSnap.data().problems || [];
			if (problemIndex >= 0 && problemIndex < currentProblems.length) {
				currentProblems.splice(problemIndex, 1);

				if (roomId) {
					await updateDoc(bucketRef, { problems: currentProblems });
				} else {
					await setDoc(
						bucketRef,
						{ problems: currentProblems },
						{ merge: true }
					);
				}
			}
		});
	}

	async addProblemTime(problemTitle, timeData, roomId = null) {
		return await retryOperation(async () => {
			const bucketRef = this.getBucketRef(roomId);
			const docSnap = await getDoc(bucketRef);

			if (!docSnap.exists()) return;

			const currentProblems = docSnap.data().problems || [];
			const problemIndex = currentProblems.findIndex(
				(p) => p.problemTitle === problemTitle
			);

			if (problemIndex === -1) return;

			if (!Array.isArray(currentProblems[problemIndex].times)) {
				currentProblems[problemIndex].times = [];
			}

			currentProblems[problemIndex].times.push({
				time: timeData.time,
				username: timeData.username,
				timestamp: TimeUtils.now(),
			});

			if (roomId) {
				await updateDoc(bucketRef, { problems: currentProblems });
			} else {
				await setDoc(
					bucketRef,
					{ problems: currentProblems },
					{ merge: true }
				);
			}
		});
	}

	listenToBucket(roomId, callback) {
		if (!roomId) return null; // Personal buckets don't need real-time updates

		const bucketRef = this.getBucketRef(roomId);
		const listenerKey = `bucket_${roomId}`;

		this.removeListener(listenerKey);

		const unsubscribe = onSnapshot(
			bucketRef,
			(doc) => {
				if (doc.exists()) {
					const data = doc.data();
					callback(data.problems || [], data);
				} else {
					callback([], null);
				}
			},
			(error) => {
				ErrorUtils.logError("listenToBucket", error, { roomId });
				callback([], null);
			}
		);

		this.listeners.set(listenerKey, unsubscribe);
		return unsubscribe;
	}

	listenToUser(callback) {
		if (!this.userId) throw new Error("User ID not set");

		const userRef = doc(this.db, `users/${this.userId}`);
		const listenerKey = `user_${this.userId}`;

		this.removeListener(listenerKey);

		const unsubscribe = onSnapshot(
			userRef,
			(doc) => {
				if (doc.exists()) {
					callback(doc.data());
				} else {
					callback(null);
				}
			},
			(error) => {
				ErrorUtils.logError("listenToUser", error, {
					userId: this.userId,
				});
				callback(null);
			}
		);

		this.listeners.set(listenerKey, unsubscribe);
		return unsubscribe;
	}

	removeListener(key) {
		const listener = this.listeners.get(key);
		if (listener) {
			listener();
			this.listeners.delete(key);
		}
	}

	removeAllListeners() {
		this.listeners.forEach((unsubscribe) => {
			unsubscribe();
		});
		this.listeners.clear();
	}

	async problemExistsInBucket(problemUrl, roomId = null) {
		const problems = await this.getBucketProblems(roomId);
		return problems.some(
			(p) => p.url.toLowerCase() === problemUrl.toLowerCase()
		);
	}

	async getProblemByTitle(problemTitle, roomId = null) {
		const problems = await this.getBucketProblems(roomId);
		return problems.find((p) => p.problemTitle === problemTitle);
	}

	async getBucketStats(roomId = null) {
		const problems = await this.getBucketProblems(roomId);

		const stats = {
			total: problems.length,
			easy: 0,
			medium: 0,
			hard: 0,
			withTimes: 0,
			totalTimes: 0,
		};

		problems.forEach((problem) => {
			const difficulty = (problem.difficulty || "").toLowerCase();
			if (difficulty === "easy") stats.easy++;
			else if (difficulty === "medium") stats.medium++;
			else if (difficulty === "hard") stats.hard++;

			if (problem.times && problem.times.length > 0) {
				stats.withTimes++;
				stats.totalTimes += problem.times.length;
			}
		});

		return stats;
	}

	async searchProblems(query, roomId = null) {
		const problems = await this.getBucketProblems(roomId);
		const lowercaseQuery = query.toLowerCase();

		return problems.filter(
			(problem) =>
				problem.problemTitle.toLowerCase().includes(lowercaseQuery) ||
				problem.problemNumber.toString().includes(query) ||
				(problem.difficulty || "")
					.toLowerCase()
					.includes(lowercaseQuery)
		);
	}

	async getRecentProblems(limit = 5, roomId = null) {
		const problems = await this.getBucketProblems(roomId);

		return problems
			.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
			.slice(0, limit);
	}

	async addMultipleProblems(problemsData, roomId = null, addedBy) {
		const results = [];

		for (const problemData of problemsData) {
			try {
				const result = await this.addProblemToBucket(
					problemData,
					roomId,
					addedBy
				);
				results.push({ success: true, problem: problemData, result });
			} catch (error) {
				ErrorUtils.logError("addMultipleProblems", error, {
					problemData,
				});
				results.push({
					success: false,
					problem: problemData,
					error: error.message,
				});
			}
		}

		return results;
	}

	async exportBucket(roomId = null) {
		const problems = await this.getBucketProblems(roomId);
		const stats = await this.getBucketStats(roomId);

		let bucketInfo = { type: "personal", userId: this.userId };
		if (roomId) {
			const roomData = await this.getRoom(roomId);
			bucketInfo = { type: "shared", roomId, roomData };
		}

		return {
			exportedAt: TimeUtils.now(),
			bucket: bucketInfo,
			stats,
			problems,
		};
	}

	async verifyBucketStructure(roomId = null) {
		try {
			const bucketRef = this.getBucketRef(roomId);
			const docSnap = await getDoc(bucketRef);

			if (docSnap.exists()) {
				const data = docSnap.data();
				const problems = data.problems || [];

				const fixedProblems = problems.map((problem) => ({
					problemNumber: problem.problemNumber || "Unknown",
					problemTitle: problem.problemTitle || "Unknown Problem",
					difficulty: problem.difficulty || "Unknown",
					url: problem.url || "#",
					addedAt: problem.addedAt || TimeUtils.now(),
					addedBy: problem.addedBy || "Unknown",
					times: Array.isArray(problem.times) ? problem.times : [],
				}));

				if (
					JSON.stringify(problems) !== JSON.stringify(fixedProblems)
				) {
					if (roomId) {
						await updateDoc(bucketRef, { problems: fixedProblems });
					} else {
						await setDoc(
							bucketRef,
							{ problems: fixedProblems },
							{ merge: true }
						);
					}
					return {
						fixed: true,
						changes: problems.length - fixedProblems.length,
					};
				}
			}

			return { fixed: false, changes: 0 };
		} catch (error) {
			ErrorUtils.logError("verifyBucketStructure", error, { roomId });
			throw error;
		}
	}

	async cleanup() {
		this.removeAllListeners();
	}

	getStatus() {
		return {
			userId: this.userId,
			activeListeners: this.listeners.size,
			listenerKeys: Array.from(this.listeners.keys()),
		};
	}
}
