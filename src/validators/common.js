/**
 * Helper function to filter an object based on a blacklist.
 *
 * @param {object} reqBody - The object/array to filter.
 * @param {string[]} blacklist - An array of keys to exclude.
 * @returns {object} - A new object with the blacklisted keys removed.
 */
module.exports = function filterRequestBody(data, blacklist) {
	if (typeof data === 'object' && data !== null) {
		if (Array.isArray(data)) {
			// If it's an array, process each item only if it's an object
			return data.map((item) =>
				typeof item === 'object' && item !== null ? filterRequestBody(item, blacklist) : item
			)
		} else {
			// If it's an object, remove blacklisted keys but ignore arrays inside it
			const filteredObj = {}
			for (const key in data) {
				if (!blacklist.includes(key)) {
					let value = data[key]
					// Process recursively only if value is an object (and not an array)
					if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
						value = filterRequestBody(value, blacklist)
					}
					filteredObj[key] = value
				}
			}
			return filteredObj
		}
	}
	return data
}
