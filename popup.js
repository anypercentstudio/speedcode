document.addEventListener("DOMContentLoaded", async () => {
	const statusImage = document.getElementById("statusImage");
	const statusText = document.getElementById("statusText");
	const statusCard = document.querySelector(".status-card");

	statusCard.classList.add("loading"); //add loading state

	try {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		}); // curr active tab

		if (!tab || !tab.url) {
			throw new Error("Unable to get current tab");
		}

		const isOnLeetCode = tab.url.toLowerCase().includes("leetcode.com"); //url checking

		statusCard.classList.remove("loading"); //remove state

		if (isOnLeetCode) {
			statusImage.src = "onLC.png";
			statusImage.alt = "On LeetCode";
			statusText.textContent = "ok lock in";
			statusCard.classList.add("on-leetcode");
			statusCard.classList.remove("off-leetcode");
		} else {
			statusImage.src = "offLC.png";
			statusImage.alt = "Not on LeetCode";
			statusText.textContent = "get on da grind bro";
			statusCard.classList.add("off-leetcode");
			statusCard.classList.remove("on-leetcode");
		}

		statusImage.onload = () => {
			statusImage.style.opacity = "0";
			statusImage.style.transform = "scale(0.8)";

			setTimeout(() => {
				statusImage.style.transition =
					"opacity 0.4s ease, transform 0.4s ease";
				statusImage.style.opacity = "1";
				statusImage.style.transform = "scale(1)";
			}, 50);
		}; //image loading animations
	} catch (error) {
		console.error("Error checking LeetCode status:", error);

		statusCard.classList.remove("loading");
		statusImage.src = "offLC.png";
		statusImage.alt = "Error";
		statusText.textContent = "Unable to check status";
		statusCard.classList.add("off-leetcode");
	}
});
