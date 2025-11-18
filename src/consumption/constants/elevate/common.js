/**
 * name : common.js
 * author : Priyanka Pradeep
 * Date : 18-NOV-2025
 * Description : Common constants for elevate-project consumption service
 */

'use strict'

/**
 * Map of logical collection names to actual MongoDB collection names
 * Used across all elevate consumption modules
 * @constant {Map}
 */
const COLLECTIONS_MAP = new Map(
	Object.entries({
		CATEGORIES: 'projectCategories',
		TEMPLATES: 'projectTemplates',
		TASKS: 'projectTemplateTasks',
		PROGRAMS: 'programs',
		SOLUTIONS: 'solutions',
		CERTIFICATE_TEMPLATE: 'certificateTemplates',
		CERTIFICATE_BASE_TEMPLATE: 'certificateBaseTemplates',
		USER_EXTENSIONS: 'userExtensions',
		ORGANIZATION_EXTENSION: 'organizationExtension',
	})
)

module.exports = {
	COLLECTIONS_MAP,
	CREATED_BY_SYSTEM: 'SYSTEM',
	STATUS_ACTIVE: 'active',
}
