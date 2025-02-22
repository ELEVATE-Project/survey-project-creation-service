/**
 * name : utils.js
 * author : Priyanka Pradeep
 * Date : 22 - Feb - 2025
 * Description : Utils helper function.
 */

const _ = require('lodash')

const composeEmailBody = (body, params) => {
	return body.replace(/{([^{}]*)}/g, (a, b) => {
		var r = params[b]
		return typeof r === 'string' || typeof r === 'number' ? r : a
	})
}

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

const convertResources = (resources) =>
	resources
		.filter(({ link }) => !!link)
		.map(({ name, link }) => ({
			name: name || 'Resource',
			url: link,
		}))

function convertKeywords(keywords) {
	if (Array.isArray(keywords) && keywords.length > 0) {
		return keywords.join(',')
	}

	return ''
}

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

function formatTitle(str) {
	return str
		.replace(/_/g, ' ') // Replace underscores with a space
		.trim() // Trim any leading/trailing spaces
		.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
}

function formatEntityValue(value) {
	return value
		.replace(/\s*\(.*?\)\s*/g, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '_')
}

module.exports = {
	composeEmailBody,
	convertDuration,
	convertResources,
	convertKeywords,
	formatValues,
	formatTitle,
	formatEntityValue,
}
