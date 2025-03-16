/**
 * name : utils.js
 * author : Priyanka Pradeep
 * Date : 22 - Feb - 2025
 * Description : Migration helper function.
 */

/**
 * Converts a duration object
 * @param {Object} duration - The duration object to convert.
 * @returns {Object} - The converted duration object.
 */
function convertDuration(duration) {
	let durationString

	// Check if duration is an object with a 'value' property or a direct string
	if (typeof duration === 'object' && duration !== null && 'value' in duration) {
		durationString = duration.value
	} else if (typeof duration === 'string') {
		durationString = duration
	} else if (typeof duration === 'object' && duration !== null && 'duration' in duration) {
		durationString = duration.duration
	} else {
		// Return empty if no valid duration is provided
		return {}
	}

	const durationMatch = durationString.match(/(\d+)\s*([A-Za-z]+)/)
	const durationNumber = durationMatch ? parseInt(durationMatch[1], 10) : 0
	const durationUnit = durationMatch ? durationMatch[2].toUpperCase() : ''

	// Map units to types
	const unitMapping = {
		W: 'weeks',
		D: 'days',
		M: 'months',
		MONTH: 'months',
		MONTHS: 'months',
		WEEKS: 'weeks',
		WEEK: 'weeks',
		DAY: 'days',
		DAYS: 'days',
	}

	const durationType = unitMapping[durationUnit] || ''

	return {
		duration: durationType,
		number: durationNumber,
	}
}

/**
 * Converts an array of resources to formatted name-url pairs.
 * @param {Array} resources - Array of resource objects.
 * @returns {Array} - Filtered and formatted resources.
 */
const convertResources = (resources) =>
	resources
		.filter(({ link }) => !!link)
		.map(({ name, link }) => ({
			name: name || 'Resource',
			url: link,
		}))

/**
 * Converts an array of keywords into a comma-separated string.
 * @param {string[]} keywords - Array of keywords.
 * @returns {string} - Comma-separated keywords or empty string.
 */
function convertKeywords(keywords) {
	if (Array.isArray(keywords) && keywords.length > 0) {
		return keywords.join(',')
	}

	return ''
}

/**
 * Formats an array of strings by removing special characters, trimming, lowercasing, and replacing spaces with underscores.
 * @param {string[]} arr - Array of strings to format.
 * @returns {string[]} - Array of formatted strings.
 */
function formatValues(arr) {
	const formatedArray = arr.map((value) => {
		return value
			.replace(/\s*\(.*?\)\s*/g, '')
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '_')
	})

	return formatedArray
}

/**
 * Formats a title by replacing underscores with spaces, trimming, and capitalizing each word.
 * @param {string} str - The input string to format.
 * @returns {string} - The formatted title.
 */
function formatTitle(str) {
	return str
		.replace(/_/g, ' ') // Replace underscores with a space
		.trim() // Trim any leading/trailing spaces
		.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
}

/**
 * Formats an entity value by removing parentheses, converting to lowercase, trimming, and replacing spaces with underscores.
 * @param {string} value - The input string to format.
 * @returns {string} - The formatted string.
 */
function formatEntityValue(value) {
	return value
		.replace(/\s*\(.*?\)\s*/g, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '_')
}

/**
 * Checks if a value is a valid MongoDB ObjectId or UUID.
 * @param {string} value - The value to validate.
 * @returns {boolean} - Returns true if valid ObjectId or UUID, false otherwise.
 */
function isValidObjectIdOrUUID(value) {
	const objectIdRegex = /^[a-f\d]{24}$/i // Mongo ObjectId pattern
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i // UUID pattern

	return objectIdRegex.test(value) || uuidRegex.test(value)
}

module.exports = {
	convertDuration,
	convertResources,
	convertKeywords,
	formatValues,
	formatTitle,
	formatEntityValue,
	isValidObjectIdOrUUID,
}
