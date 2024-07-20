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
	CREATED_BY_SYSTEM: '0',
	PROJECT: 'projects',
	FILTER_ALL: 'ALL',
	SORT_DESC: 'DESC',
	SORT_ASC: 'ASC',
	CREATED_AT: 'created_at',
	FILTER: 'filter',
	TYPE: 'type',
	STATUS: 'status',
	SEARCH: 'search',
	SORT_BY: 'sort_by',
	SORT_ORDER: 'sort_order',
	URL: 'url',
	FILE_PATH: 'filePath',
	PAGE_STATUS: 'page_status',
	PAGE_STATUS_VALUES: {
		drafts: ['DRAFT'],
		up_for_review: ['INPROGRESS', 'NOT_STARTED', 'CHANGES_UPDATED', 'REQUESTED_FOR_CHANGES'],
		submitted_for_review: ['IN_REVIEW', 'SUBMITTED', 'PUBLISHED', 'REJECTED', 'REJECTED_AND_REPORTED', 'APPROVED'],
	},
	PAGE_STATUS_DRAFTS: 'drafts',
	PAGE_STATUS_UP_FOR_REVIEW: 'up_for_review',
	PAGE_STATUS_SUBMITTED_FOR_REVIEW: 'submitted_for_review',
	REVIEW_STATUS_REQUESTED_FOR_CHANGES: 'REQUESTED_FOR_CHANGES',
	RESOURCE_STATUS_PUBLISHED: 'PUBLISHED',
	RESOURCE_STATUS_REJECTED: 'REJECTED',
	RESOURCE_STATUS_IN_REVIEW: 'IN_REVIEW',
	RESOURCE_STATUS_SUBMITTED: 'SUBMITTED',
	RESOURCE_STATUS_APPROVED: 'APPROVED',
	RESOURCE_STATUS_REJECTED_AND_REPORTED: 'REJECTED_AND_REPORTED',
	STATUS_RESOLVED: 'RESOLVED',
	ALL_USER_ROLES: 'all',
	LIMIT: 100,
	CONTENT: 'content',
	REVIEW_STATUS_NOT_STARTED: 'NOT_STARTED',
	TRUE: true,
	FALSE: false,
	TASKS: 'tasks',
	SUBTASKS: 'subTasks',
	OBJECT: 'object',
	roleValidationPaths: [
		'/scp/v1/resource/list',
		'/scp/v1/projects/reviewerList',
		'/scp/v1/projects/update',
		'/scp/v1/projects/details/',
		'/scp/v1/certificate/list',
		'/scp/v1/resource/list',
		'/scp/v1/certificate/list',
		'/scp/v1/certificate/update',
		'/scp/v1/comment/update',
		'/scp/v1/comment/list',
	],
	PUBLIC_ROLE: 'public',
	RESOURCE_TITLE: 'title',
	BODY: 'body',
	REQUEST_METHOD_DELETE: 'DELETE',
	FILE_TYPE: 'file_types',
	CHILDREN: 'children',
	REVIEW_STATUS_INPROGRESS: 'INPROGRESS',
	REVIEW_STATUS_CHANGES_UPDATED: 'CHANGES_UPDATED',
	REVIEW_STATUS_REQUESTED_FOR_CHANGES: 'REQUESTED_FOR_CHANGES',
	REVIEW_STATUS_REJECTED: 'REJECTED',
	REVIEW_STATUS_REJECTED_AND_REPORTED: 'REJECTED_AND_REPORTED',
	REVIEW_STATUS_REJECTED_AT: 'rejected_at',
	REVIEW_STATUS: 'review_status',
}
