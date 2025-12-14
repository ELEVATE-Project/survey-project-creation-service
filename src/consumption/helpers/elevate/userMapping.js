/**
 * name : userMapping.js
 * author : Priyanka Pradeep
 * Date : 18-NOV-2025
 * Description : Helper for user-program mapping operations
 */

'use strict'

const common = require('@constants/common')
const interfaceRequests = require('@requests/interface')
const { COLLECTIONS_MAP } = require('@consumption/constants/elevate/common')

/**
 * Maps users to a program by creating or updating user-program mappings
 * @method
 * @name createOrUpdateUserProgramMapping
 * @param {Array} viewers - Array of user IDs who should have access to the program
 * @param {String|ObjectId} programId - Program ID (will be converted to string)
 * @param {String} orgCode - Organization code
 * @param {String} tenantCode - Tenant code
 * @param {Object} projectsMongoConnection - MongoDB connection instance
 * @param {String|null} userId - User ID performing the mapping (optional)
 * @returns {Promise<Boolean>} - Returns true if successful, throws error otherwise
 */
exports.createOrUpdateUserProgramMapping = async (
	viewers,
	programId,
	orgCode,
	tenantCode,
	projectsMongoConnection,
	userId = null
) => {
	return new Promise(async (resolve, reject) => {
		try {
			// Validate required parameters
			if (!viewers || !Array.isArray(viewers) || viewers.length === 0) {
				throw new Error('Viewers must be a non-empty array')
			}

			if (!programId) {
				throw new Error('Program ID is required')
			}

			if (!orgCode || !tenantCode) {
				throw new Error('Organization code and tenant code are required')
			}

			if (!projectsMongoConnection) {
				throw new Error('MongoDB connection is required')
			}

			// Get roles from environment variable
			const roles = (process.env.DEFAULT_PROGRAM_MANAGERS || '')
				.split(',')
				.map((role) => role.trim())
				.filter(Boolean)

			// If no roles configured, log a warning and treat as a no-op (resolve true).
			if (roles.length === 0) {
				console.warn(
					`DEFAULT_PROGRAM_MANAGERS is empty; skipping user->program mapping for program=${String(
						programId
					)}, org=${orgCode}, tenant=${tenantCode}`
				)
				return resolve(true)
			}

			// Get user extensions collection
			const userProgramCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('USER_EXTENSIONS'))

			// Fetch all userExtensions for viewers
			const userExtensions = await userProgramCollection.find({ userId: { $in: viewers } }).toArray()

			// Find all userExtensions mapped to this program
			const mappedUserExtensions = await userProgramCollection
				.find({
					'programRoleMapping.programId': programId,
				})
				.toArray()

			// Users already mapped to this program
			const alreadyMappedUserIds = mappedUserExtensions.map((userExt) => userExt.userId)

			// Users in viewers but not mapped to program (need append)
			const toAppend = viewers.filter((viewerUserId) => {
				const ext = userExtensions.find((userExt) => userExt.userId === viewerUserId)
				// If userExtension not present, need append
				if (!ext) return true
				// If userExtension present but programId not present, need append
				const hasProgram = ext.programRoleMapping?.some((prm) => String(prm.programId) === String(programId))
				return !hasProgram
			})

			// Users mapped to program but not in viewers (need remove)
			const toRemove = alreadyMappedUserIds.filter((mappedUserId) => !viewers.includes(mappedUserId))

			// Prepare data for API call
			const requestBody = []

			// Convert programId to string for API
			const programIdString = programId.toString()

			// Add users who need to be mapped
			if (toAppend.length > 0) {
				for (const viewerUserId of toAppend) {
					requestBody.push({
						userId: viewerUserId,
						programId: programIdString,
						operation: common.OPERATION_APPEND,
						roles: roles,
					})
				}
			}

			// Remove users who should no longer have access
			if (toRemove.length > 0) {
				for (const mappedUserId of toRemove) {
					requestBody.push({
						userId: mappedUserId,
						programId: programIdString,
						operation: common.OPERATION_REMOVE,
						roles: roles,
					})
				}
			}

			// If no changes needed, return success
			if (requestBody.length === 0) {
				console.log('No user mapping changes required for program:', programIdString)
				return resolve(true)
			}

			// Call the interface service to update mappings
			await interfaceRequests.mapUserAndProgram(requestBody, orgCode, tenantCode, userId)

			console.log('Successfully updated user extensions for program:', programIdString)
			return resolve(true)
		} catch (error) {
			console.error('Error in createOrUpdateUserProgramMapping:', error)
			return reject(error)
		}
	})
}
