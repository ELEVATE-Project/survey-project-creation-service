'use strict'
const utils = require('@generics/utils')
const common = require('@constants/common')

exports.projectTemplateDTO = async (templateData = {}) => {
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
