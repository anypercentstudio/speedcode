console.log("SpeedCode content script loaded");

const EXTRACTION_TIMEOUT = 5000; // 5 sec max for extraction
const RETRY_DELAY = 500;
const MAX_EXTRACTION_RETRIES = 3;

let lastUrl = window.location.href; //state tracking
let extractionAttempts = 0;
let isExtracting = false;

function waitForElement(selector, timeout = 3000) {
	return new Promise((resolve, reject) => {
		const element = document.querySelector(selector);
		if (element) {
			resolve(element);
			return;
		}

		const observer = new MutationObserver((mutations, obs) => {
			const element = document.querySelector(selector);
			if (element) {
				obs.disconnect();
				resolve(element);
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		setTimeout(() => {
			observer.disconnect();
			reject(
				new Error(`Element ${selector} not found within ${timeout}ms`)
			);
		}, timeout);
	});
}

function extractProblemInfo() {
	try {
		console.log("Starting problem extraction for:", window.location.href);

		const urlPattern = /\/problems\/([^\/]+)/; //pattern match to see if we're on problem page
		const match = window.location.pathname.match(urlPattern);

		if (!match) {
			console.log("Not on a problem page");
			return { onProblem: false };
		}

		let problemNumber = null;
		let problemTitle = null;
		let difficulty = null;

		const titleSelectors = [
			'[data-cy="question-title"]',
			".text-title-large",
			".css-v3d350",
			'[class*="question-title"]',
			'div[data-cy="question-detail-main-tabs"] h1',
			'div[class*="question"] h1:first-of-type',
			"h1", //fallback to any h1
		];

		let titleElement = null;
		for (const selector of titleSelectors) {
			try {
				const elements = document.querySelectorAll(selector);
				for (const element of elements) {
					if (element && element.textContent.trim()) {
						//avoid titles that are in discussion/comment areas
						const discussionArea =
							element.closest('[class*="discuss"]') ||
							element.closest('[class*="comment"]') ||
							element.closest('[data-cy="discussion"]') ||
							element.closest('[class*="tab"]');

						if (!discussionArea) {
							titleElement = element;
							console.log(
								"Found valid title element with selector:",
								selector
							);
							break;
						}
					}
				}
				if (titleElement) break;
			} catch (e) {
				console.log("Error with selector", selector, ":", e);
				continue;
			}
		}

		if (titleElement) {
			const titleText = titleElement.textContent.trim();
			console.log("Found title text:", titleText);

			const numberMatch = titleText.match(/^(\d+)\.\s*(.+)/);
			if (numberMatch) {
				problemNumber = numberMatch[1];
				problemTitle = numberMatch[2];
			} else {
				problemTitle = titleText;
			}
		}

		if (!problemNumber) {
			console.log("Attempting enhanced problem number extraction");

			// 1 - no. in page elements
			const numberSelectors = [
				'[data-cy="question-title"]',
				".text-title-large",
				"h1",
				".css-v3d350",
				'[class*="question-title"]',
				".text-lg",
				'[class*="text-title"]',
				'div[data-track-load="description_content"] h1',
			];

			for (const selector of numberSelectors) {
				try {
					const elements = document.querySelectorAll(selector);
					for (const element of elements) {
						if (element && element.textContent) {
							const text = element.textContent.trim();
							const match = text.match(/(\d+)\.\s*/);
							if (match && match[1]) {
								problemNumber = match[1];
								console.log(
									"Found problem number in element:",
									text,
									"-> Number:",
									problemNumber
								);
								break;
							}
						}
					}
					if (problemNumber) break;
				} catch (e) {
					continue;
				}
			}
		}

		// 2 - url pattern
		if (!problemNumber && match[1]) {
			const slug = match[1];

			const urlPatterns = [
				/^(\d+)-/, // "123-problem-name"
				/^(\d+)\./, // "123.problem-name"
				/(\d+)/, // any number in the slug
			];

			for (const pattern of urlPatterns) {
				const urlMatch = slug.match(pattern);
				if (urlMatch && urlMatch[1]) {
					problemNumber = urlMatch[1];
					console.log(
						"Found problem number in URL:",
						slug,
						"-> Number:",
						problemNumber
					);
					break;
				}
			}
		}

		// 3: full page search
		if (!problemNumber) {
			console.log("Searching entire page for problem number");
			try {
				const pageText = document.body.textContent;
				const patterns = [
					/(?:Problem|Question)\s+(\d+)/i,
					/#(\d+)[\s\.\-:]/,
					/(\d+)\.\s*[A-Z][a-z]/, // "123. this is a title"
				];

				for (const pattern of patterns) {
					const match = pageText.match(pattern);
					if (
						match &&
						match[1] &&
						parseInt(match[1]) > 0 &&
						parseInt(match[1]) < 10000
					) {
						problemNumber = match[1];
						console.log(
							"Found problem number in page text with pattern:",
							pattern,
							"-> Number:",
							problemNumber
						);
						break;
					}
				}
			} catch (e) {
				console.log("Error searching page text:", e);
			}
		}

		//fallback to url
		if (!problemTitle && match[1]) {
			console.log("Falling back to URL extraction for title");
			const slug = match[1];
			problemTitle = slug
				.split("-")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ");
		}

		const difficultySelectors = [
			'[diff="Easy"]',
			'[diff="Medium"]',
			'[diff="Hard"]',
			'[data-difficulty="Easy"]',
			'[data-difficulty="Medium"]',
			'[data-difficulty="Hard"]',
			".text-difficulty-easy",
			".text-difficulty-medium",
			".text-difficulty-hard",
			'[class*="difficulty"]',
			'[data-degree="Easy"]',
			'[data-degree="Medium"]',
			'[data-degree="Hard"]',
			".text-olive",
			".text-yellow",
			".text-pink",
		];

		let difficultyElement = null;
		for (const selector of difficultySelectors) {
			try {
				difficultyElement = document.querySelector(selector);
				if (difficultyElement) {
					console.log(
						"Found difficulty element with selector:",
						selector
					);
					break;
				}
			} catch (e) {
				console.log("Error with difficulty selector", selector, ":", e);
				continue;
			}
		}

		if (difficultyElement) {
			const diffText = difficultyElement.textContent.trim().toLowerCase();
			console.log("Difficulty text:", diffText);

			if (diffText.includes("easy")) {
				difficulty = "Easy";
			} else if (diffText.includes("medium")) {
				difficulty = "Medium";
			} else if (diffText.includes("hard")) {
				difficulty = "Hard";
			}

			const diffAttr =
				difficultyElement.getAttribute("diff") ||
				difficultyElement.getAttribute("data-degree") ||
				difficultyElement.getAttribute("data-difficulty");
			if (diffAttr) {
				difficulty = diffAttr;
			}

			const classList = difficultyElement.className.toLowerCase();
			if (classList.includes("easy")) difficulty = "Easy";
			else if (classList.includes("medium")) difficulty = "Medium";
			else if (classList.includes("hard")) difficulty = "Hard";
		}

		if (!difficulty) {
			console.log("Fallback difficulty detection");
			try {
				const pageText = document.body.textContent.toLowerCase();
				const difficultyRegex = /\b(easy|medium|hard)\b/i;
				const match = pageText.match(difficultyRegex);
				if (match) {
					difficulty =
						match[1].charAt(0).toUpperCase() + match[1].slice(1);
				}
			} catch (e) {
				console.log("Error in fallback difficulty detection:", e);
			}
		}

		const result = {
			onProblem: true,
			problemNumber: problemNumber,
			problemTitle: problemTitle,
			difficulty: difficulty,
			url: window.location.href,
			extractedAt: new Date().toISOString(),
		};

		console.log("Extraction result:", result);

		if (!problemTitle || problemTitle.length < 2) {
			console.warn("Problem title seems invalid, retrying...");
			return { onProblem: false, error: "Invalid title extracted" };
		}

		return result;
	} catch (error) {
		console.error("Error in extractProblemInfo:", error);
		return { onProblem: false, error: error.message };
	}
}

async function extractWithRetry() {
	if (isExtracting) {
		console.log("Extraction already in progress");
		return { onProblem: false, error: "Extraction in progress" };
	}

	isExtracting = true;
	extractionAttempts = 0;

	try {
		for (let attempt = 1; attempt <= MAX_EXTRACTION_RETRIES; attempt++) {
			extractionAttempts = attempt;
			console.log(
				`Extraction attempt ${attempt}/${MAX_EXTRACTION_RETRIES}`
			);

			const result = extractProblemInfo();

			if (result.onProblem && result.problemTitle) {
				console.log("Successful extraction on attempt", attempt);
				return result;
			}

			if (attempt < MAX_EXTRACTION_RETRIES) {
				console.log(
					`Attempt ${attempt} failed, retrying in ${RETRY_DELAY}ms...`
				);
				await new Promise((resolve) =>
					setTimeout(resolve, RETRY_DELAY)
				);
			}
		}

		console.log("All extraction attempts failed");
		return { onProblem: false, error: "Failed to extract after retries" };
	} finally {
		isExtracting = false;
	}
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "getProblemInfo") {
		console.log("Received getProblemInfo request");

		const timeout = setTimeout(() => {
			console.error("Extraction timeout");
			sendResponse({ onProblem: false, error: "Extraction timeout" });
		}, EXTRACTION_TIMEOUT);

		// Perform extraction
		extractWithRetry()
			.then((result) => {
				clearTimeout(timeout);
				console.log("Sending response:", result);
				sendResponse(result);
			})
			.catch((error) => {
				clearTimeout(timeout);
				console.error("Extraction error:", error);
				sendResponse({ onProblem: false, error: error.message });
			});

		return true;
	}
});

function checkForChanges() {
	if (window.location.href !== lastUrl) {
		console.log("URL changed from", lastUrl, "to", window.location.href);
		lastUrl = window.location.href;

		extractionAttempts = 0;
		isExtracting = false;

		setTimeout(() => {
			if (window.location.pathname.includes("/problems/")) {
				console.log("Pre-extracting problem info for faster popup");
				extractProblemInfo();
			}
		}, 1000);
	}
}

const observer = new MutationObserver((mutations) => {
	checkForChanges();

	const significantChange = mutations.some((mutation) => {
		return (
			mutation.type === "childList" &&
			mutation.addedNodes.length > 0 &&
			Array.from(mutation.addedNodes).some(
				(node) =>
					node.nodeType === Node.ELEMENT_NODE &&
					(node.classList?.contains("question") ||
						node.querySelector?.('[class*="question"]'))
			)
		);
	});

	if (significantChange && window.location.pathname.includes("/problems/")) {
		console.log(
			"Significant content change detected, resetting extraction state"
		);
		extractionAttempts = 0;
		isExtracting = false;
	}
});

observer.observe(document.body, {
	childList: true,
	subtree: true,
	attributes: false,
	characterData: false,
});

setTimeout(() => {
	if (window.location.pathname.includes("/problems/")) {
		console.log("Initial problem info extraction");
		extractProblemInfo();
	}
}, 1500);

window.addEventListener("beforeunload", () => {
	observer.disconnect();
	isExtracting = false;
});

// global scope for testing whenever needed
window.speedCodeDebug = {
	extractProblemInfo,
	extractWithRetry,
	getState: () => ({
		lastUrl,
		extractionAttempts,
		isExtracting,
		currentUrl: window.location.href,
	}),
};
