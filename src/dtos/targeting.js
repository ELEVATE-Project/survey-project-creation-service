'use strict'

/**
 * Transforms entity response into a map where each group key maps to an array of its associated IDs
 * @method
 * @name transformEntityDTO
 * @param {Object} response - The response object from entity service
 * @param {Object} response.data - The data object containing results
 * @param {Array} response.data.result - Array of entity items with groups
 * @returns {Object} entitySubEntityMap - Map of group keys to arrays of entity IDs
 */
exports.transformEntityDTO = (response) => {
	// Check for valid input structure
	if (!response || !response.data || !Array.isArray(response.data.result)) {
		console.error('Invalid input structure. Expected response.data.result to be an array.')
		return {}
	}

	// Use reduce to build the final map (our accumulator 'acc')
	const entitySubEntityMap = response.data.result.reduce((acc, currentItem) => {
		// Ensure the 'groups' object exists and is not null
		if (currentItem && typeof currentItem.groups === 'object' && currentItem.groups !== null) {
			// Iterate over each key in the 'groups' object (e.g., "professional_subroles", "subEntity")
			for (const groupKey in currentItem.groups) {
				// Check if the key is a direct property and its value is an array
				if (
					Object.hasOwnProperty.call(currentItem.groups, groupKey) &&
					Array.isArray(currentItem.groups[groupKey])
				) {
					// Get the array of IDs
					const idArray = currentItem.groups[groupKey]

					// If this groupKey isn't in our accumulator map yet, initialize it as an empty array
					if (!acc[groupKey]) {
						acc[groupKey] = []
					}

					// Add the items from the current idArray to the main array for that groupKey
					// Using push with spread operator (...) is efficient
					acc[groupKey].push(...idArray)
				}
			}
		}

		// Return the updated accumulator for the next iteration
		return acc
	}, {}) // Start with an empty object {} as the initial value for the accumulator

	return entitySubEntityMap
}
