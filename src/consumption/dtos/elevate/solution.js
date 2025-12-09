/**
 * name : solution.js
 * author : Priyanka Pradeep
 * Date : 18-NOV-2025
 * Description : DTO for solution template data transformation
 */

const utils = require('@generics/utils')
const common = require('@constants/common')

/**
 * Format solution template object from resource and program details
 * @method
 * @name formatSolutionTemplate
 * @param {Object} resource - Resource data
 * @param {Object} programDetails - Program details
 * @returns {Object} - Formatted solution template object
 */
exports.formatSolutionTemplate = (resource, programDetails) => {
	try {
		const endDate = new Date(programDetails?.end_date)
		const startDate = new Date(programDetails?.start_date)

		const solutionTemplate = {
			resourceType: [common.SOLUTIONS_RESOURCE_TYPE[resource.type]],
			language: resource?.languages ? resource?.languages.map((language) => language.label) : [],
			keywords: resource?.keywords ? utils.formatKeywords(resource?.keywords) : [],
			concepts: resource?.concepts ? resource?.concepts : [],
			themes: resource?.themes ? resource?.themes : [],
			flattenedThemes: resource?.flattenedThemes ? resource?.flattenedThemes : [],
			entities: resource?.entities ? resource?.entities : [],
			registry: resource?.registry ? resource?.registry : [],
			isRubricDriven: resource?.isRubricDriven ? true : false,
			scp_reference_id: resource?.resource_id,
			enableQuestionReadOut: resource?.enableQuestionReadOut ? true : false,
			captureGpsLocationAtQuestionLevel: resource?.captureGpsLocationAtQuestionLevel ? true : false,
			isAPrivateProgram: false,
			allowMultipleAssessemts: resource?.allowMultipleAssessemts ? true : false,
			isDeleted: false,
			pageHeading: 'Domains',
			minNoOfSubmissionsRequired: resource?.minNoOfSubmissionsRequired ? resource?.minNoOfSubmissionsRequired : 1,
			rootOrganisations: resource?.organization
				? resource?.organization.map((organization) => organization.id)
				: [],
			createdFor: resource?.organization ? resource?.organization.map((organization) => organization.id) : [],
			deleted: false,
			name: resource?.title,
			programExternalId: programDetails.externalId,
			entityType: resource?.entityType ? resource?.entityType : null,
			type: common.SOLUTIONS_TYPE[resource.type] ? common.SOLUTIONS_TYPE[resource.type] : null,
			subType: common.SOLUTIONS_TYPE[resource.type] ? common.SOLUTIONS_TYPE[resource.type] : null,
			isReusable: false,
			externalId: utils.generateUniqueId(),
			programId: programDetails._id,
			programName: programDetails.name,
			programDescription: programDetails.description,
			description: resource?.description ? resource.description : programDetails.description,
			status: common.STATUS_ACTIVE.toLowerCase(),
			updatedAt: new Date(),
			createdAt: new Date(),
			scope: programDetails.scope,
			projectTemplateId: resource._id,
			updatedBy: programDetails.created_by,
			author: programDetails.created_by,
			endDate,
			startDate,
			creator: programDetails.created_by,
			orgId: programDetails.orgId,
			tenantId: programDetails.tenantId,
			referenceFrom: programDetails.referenceFrom ? programDetails.referenceFrom : '',
		}

		return {
			success: true,
			data: solutionTemplate,
		}
	} catch (error) {
		return {
			success: false,
			error: error.message || error,
		}
	}
}

/**
 * Format certificate document for insertion into database
 * @method
 * @name formatCertificateDocument
 * @param {Object} certificateData - Certificate data
 * @param {String} solutionId - Solution ID
 * @param {String} programId - Program ID
 * @param {Object} baseTemplate - Base template object with _id
 * @param {String} templateUrl - SVG template URL from file upload
 * @param {String} orgCode - Organization code
 * @param {String} tenantCode - Tenant code
 * @returns {Object} - Formatted certificate document
 */
exports.formatCertificateDocument = (
	certificateData,
	solutionId,
	programId,
	baseTemplate,
	templateUrl,
	orgCode,
	tenantCode
) => {
	try {
		const certificateDocument = {
			status: common.STATUS_ACTIVE.toLowerCase(),
			deleted: false,
			solutionId,
			programId,
			baseTemplateId: baseTemplate._id,
			createdAt: new Date(),
			updatedAt: new Date(),
			templateUrl,
			issuer: { name: certificateData.issuer },
			criteria: certificateData.criteria,
			tenantId: tenantCode,
			orgId: orgCode,
		}

		return {
			success: true,
			data: certificateDocument,
		}
	} catch (error) {
		return {
			success: false,
			error: error.message || error,
		}
	}
}

/**
 * Format certificate base template document for insertion into database
 * @method
 * @name formatCertificateBaseTemplateDocument
 * @param {Object} certificateData - Certificate base template data from query
 * @param {String} orgCode - Organization code
 * @param {String} tenantCode - Tenant code
 * @returns {Object} - Formatted certificate base template document
 */
exports.formatCertificateBaseTemplateDocument = (certificateData, orgCode, tenantCode) => {
	try {
		const certificateBaseTemplateDocument = {
			code: certificateData.code,
			name: certificateData.name,
			url: certificateData.url,
			tenantId: tenantCode,
			orgId: orgCode,
			createdAt: new Date(),
			updatedAt: new Date(),
			deleted: false,
		}

		return {
			success: true,
			data: certificateBaseTemplateDocument,
		}
	} catch (error) {
		return {
			success: false,
			error: error.message || error,
		}
	}
}
