'use strict'
const utils = require('@generics/utils')
const common = require('@constants/common')

class ProjectTemplateDTO {
	/**
	 * Public entry — accepts a single template object or an array of them.
	 * Mirrors the pattern used in UserDTO.transform from your example.
	 */
	static async transform(input = {}) {
		// If it's an array of templates
		if (Array.isArray(input)) {
			return Promise.all(input.map((t) => ProjectTemplateDTO.transformTemplate(t)))
		}

		// If it's a single template
		return ProjectTemplateDTO.transformTemplate(input)
	}

	/**
	 * Core conversion logic — preserved from your original function.
	 */
	static async transformTemplate(templateData = {}) {
		try {
			const concepts =
				templateData?.concepts && Array.isArray(templateData?.concepts)
					? templateData?.concepts
					: templateData?.concepts && typeof templateData?.concepts == common.STRING
					? templateData?.concepts.split(',').map((c) => c.trim())
					: [] || []

			let template = {
				title: templateData.title,
				description: templateData.objective || '',
				concepts,
				keywords: utils.formatKeywords(templateData.keywords),
				isDeleted: false,
				createdBy: templateData.user_id,
				updatedBy: templateData.user_id,
				learningResources: utils.convertResources(templateData.learning_resources || []),
				isReusable: true,
				deleted: false,
				status: common.PUBLISHED_STATUS,
				externalId: utils.generateExternalId(templateData.title),
				entityType: '',
				metaInformation: utils.formatProjectMetaInformation(templateData),
				averageRating: 5,
				noOfRatings: 1,
				ratings: {
					1: 0,
					2: 0,
					3: 0,
					4: 0,
					5: 1,
				},
				taskCreationForm: '',
				recommendedFor: [], //Initially empty
				categories: [], //Initially empty
				tasks: [], // Initially empty
				taskSequence: [], // Initially empty
				createdAt: new Date(),
				updatedAt: new Date(),
				__v: 0,
			}
			return { success: true, template }
		} catch (error) {
			console.error('Error in formatTemplate:', error.message)
			return { success: false, error: error.message }
		}
	}
}

/**
 * UserProgramMapping DTO
 * Normalizes a user-program mapping document into a predictable JS object.
 * Exported as `userProgramMapping` on the default export for backwards compatibility.
 */
class UserProgramMappingDTO {
	static async transform(input = {}) {
		if (Array.isArray(input)) {
			return Promise.all(input.map((i) => UserProgramMappingDTO.transformTemplate(i)))
		}
		return UserProgramMappingDTO.transformTemplate(input)
	}

	static async transformTemplate(data = {}) {
		try {
			const mapping = {}

			if (data?._id) mapping._id = data._id
			mapping.userId = data.userId || data.user_id || null
			mapping.externalId = data?.externalId || null
			mapping.status = data.status || null
			mapping.isDeleted = !!data.isDeleted
			mapping.deleted = !!data.deleted

			// roles and programRoles - preserve ids as-is (ObjectId) and include code
			mapping.roles = Array.isArray(data.roles)
				? data.roles.map((r) => ({
						entities: Array.isArray(r.entities) ? r.entities : [],
						roleId: r.roleId || r.role_id || null,
						code: r.code || null,
				  }))
				: []

			mapping.programRoles = Array.isArray(data.programRoles)
				? data.programRoles.map((r) => ({
						programs: Array.isArray(r.programs) ? r.programs : [],
						roleId: r.roleId || r.role_id || null,
						code: r.code || null,
				  }))
				: []

			mapping.devices = Array.isArray(data.devices)
				? data.devices.map((d) => ({
						deviceId: d.deviceId || d.device_id || null,
						os: d.os || null,
						app: d.app || null,
						appType: d.appType || d.app_type || null,
						status: d.status || null,
						activatedAt: d.activatedAt ? new Date(d.activatedAt) : null,
				  }))
				: []

			mapping.userProfileScreenVisitedTrack = data.userProfileScreenVisitedTrack || null

			mapping.createdBy = data.createdBy || data.created_by || 'SYSTEM'
			mapping.updatedBy = data.updatedBy || data.updated_by || 'SYSTEM'
			mapping.createdAt = data.createdAt ? new Date(data.createdAt) : null
			mapping.updatedAt = data.updatedAt ? new Date(data.updatedAt) : null
			mapping.__v = data.__v || 0

			mapping.state =
				data.state && typeof data.state === 'object'
					? {
							_id: data.state._id || data.state.id || null,
							name: data.state.name || null,
					  }
					: {}

			return { success: true, mapping }
		} catch (error) {
			return { success: false, error: error.message }
		}
	}
}

// default export remains the project DTO for backwards compatibility
module.exports = ProjectTemplateDTO
// attach the new DTO as a property so callers can access it without breaking existing requires
module.exports.userProgramMapping = UserProgramMappingDTO
