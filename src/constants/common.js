/**
 * name : constants/common.js
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : All commonly used constants through out the service
 */

function getPaginationOffset(page, limit) {
	return (page - 1) * limit
}

module.exports = {
	pagination: {
		DEFAULT_PAGE_NO: 1,
		DEFAULT_PAGE_SIZE: 100,
	},
	getPaginationOffset,
	AUTH_METHOD: {
		JWT_ONLY: 'jwt_only',
		USER_SERVICE: 'user_service_authenticated',
	},
	internalAccessUrls: [process.env.APPLICATION_BASE_URL + 'v1/cloud-services/file/fetchJsonFromCloud'],
	SCP_SERVICE: 'scp',
	WRITE_ACCESS: 'w',
	READ_ACCESS: 'r',
	REVIEW_TYPE_SEQUENTIAL: 'SEQUENTIAL',
	REVIEW_TYPE_PARALLEL: 'PARALLEL',
	RESOURCES: 'resources',
	INSTANCE_LEVEL_CONFIG_ATTRIBUTES: [
		'review_required',
		'show_reviewer_list',
		'min_approval',
		'resource_type',
		'review_type',
	],
	MIN_APPROVAL: 1,
	CONTENT_CREATOR: 'content_creator',
	REVIEWER: 'reviewer',
	RESOURCE_CREATOR: 'resource_creator',
	ADMIN_ROLE: 'admin',
	ORG_ADMIN_ROLE: 'org_admin',
	CERTIFICATE_PATH: 'certificate/',
	LOGO_PATH: 'certificate_logo/',
	SIGNATURE_PATH: 'certfile_signature/',
	BASE_TEMPLATE_PATH: 'certfile_BASE_TEMPLATE/',
	RESOURCE_PATH: 'resource/',
	BASE_TEMPLATE: 'BASE_TEMPLATE',
	SIGNATURE: 'signature',
	LOGO: 'logo',
	CERTIFICATE: 'certificate',
	CLOUD_SERVICE_EXPIRY_TIME: 30,
	LINK_EXPIRY_TIME: 60,
	CLOUD_SERVICE: ['azure', 'gcloud'],
	STATUS_DRAFT: 'DRAFT',
	STATUS_ACTIVE: 'ACTIVE',
	CREATED_BY_SYSTEM: 0,
	PROJECT: 'project',
	FILTER_ALL: 'ALL',
	STATUS_ENUM: ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'],
}
