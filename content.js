function extractProblemInfo() {
	const urlPattern = /\/problems\/([^\/]+)/; //pattern match to see if we're on problem page
	const match = window.location.pathname.match(urlPattern);

	if (!match) {
		return { onProblem: false };
	}

	let problemNumber = null;
	let problemTitle = null;
	let difficulty = null;

	const titleSelectors = [
		'[data-cy="question-title"]', //more specific problem title selectors
		".text-title-large",
		".css-v3d350",
		'[class*="question-title"]',
		'div[data-cy="question-detail-main-tabs"] h1', //only use h1 if it's in the problem area, not discussion
		'div[class*="question"] h1:first-of-type',
	];

	let titleElement = null;
	for (const selector of titleSelectors) {
		titleElement = document.querySelector(selector);
		if (titleElement && titleElement.textContent.trim()) {
			const discussionArea =
				titleElement.closest('[class*="discuss"]') ||
				titleElement.closest('[class*="comment"]') ||
				titleElement.closest('[data-cy="discussion"]');

			if (!discussionArea) {
				console.log("Found valid title element:", titleElement);
				break;
			} else {
				console.log(
					"Skipping discussion title:",
					titleElement.textContent.trim()
				);
				titleElement = null;
			} //avoid titles that are in discussion/comment areas
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
			const urlMatch = match[1].match(/^(\d+)/);
			if (urlMatch) {
				problemNumber = urlMatch[1];
			}
			problemTitle = titleText;
		}
	}

	if (!problemTitle && match[1]) {
		const slug = match[1];
		problemTitle = slug
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");

		const urlMatch = slug.match(/^(\d+)/);
		if (urlMatch) {
			problemNumber = urlMatch[1];
		}
	} //extract from URL if title not found

	const difficultySelectors = [
		'[diff="Easy"]',
		'[diff="Medium"]',
		'[diff="Hard"]',
		".text-difficulty-easy",
		".text-difficulty-medium",
		".text-difficulty-hard",
		'[class*="difficulty"]',
		'[data-degree="Easy"]',
		'[data-degree="Medium"]',
		'[data-degree="Hard"]',
	];

	let difficultyElement = null;
	for (const selector of difficultySelectors) {
		difficultyElement = document.querySelector(selector);
		if (difficultyElement) {
			console.log("Found difficulty element:", difficultyElement);
			break;
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
			difficultyElement.getAttribute("data-degree");
		if (diffAttr) {
			difficulty = diffAttr;
		}
	}

	if (!difficulty) {
		const allText = document.body.textContent.toLowerCase();
		if (allText.includes("easy")) difficulty = "Easy";
		else if (allText.includes("medium")) difficulty = "Medium";
		else if (allText.includes("hard")) difficulty = "Hard";
	}

	console.log("Extracted info:", { problemNumber, problemTitle, difficulty });

	return {
		onProblem: true,
		problemNumber: problemNumber,
		problemTitle: problemTitle,
		difficulty: difficulty,
		url: window.location.href,
	};
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "getProblemInfo") {
		const problemInfo = extractProblemInfo();
		sendResponse(problemInfo);
	}
});

let lastUrl = window.location.href;
function checkForChanges() {
	if (window.location.href !== lastUrl) {
		lastUrl = window.location.href;
	}
}

const observer = new MutationObserver(checkForChanges);
observer.observe(document.body, { childList: true, subtree: true });

setTimeout(() => {
	extractProblemInfo();
}, 1000);
