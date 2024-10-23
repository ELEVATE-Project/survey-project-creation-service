/**
 * name : constants/common.js
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : All commonly used constants through out the service
 */

function getPaginationOffset(page, limit) {
	return (page - 1) * limit
}

function getResourceActions(resource) {
	return {
		RESOURCE_CREATED: `CREATE_${resource}`,
		RESOURCE_DELETED: `DELETE_${resource}`,
		RESOURCE_SUBMITTED: `${resource}_SUBMITTED`,
		REVIEW_STARTED: `${resource}_REVIEW_STARTED`,
		REVIEW_CHANGES_REQUESTED: `${resource}_REVIEW_CHANGES_REQUESTED`,
		REVIEW_APPROVED: `${resource}_APPROVED`,
		RESOURCE_PUBLISHED: `${resource}_PUBLISHED`,
		RESOURCE_REPORTED: `${resource}_REJECTED_AND_REPORTED`,
		RESOURCE_REJECTED: `${resource}_REJECTED`,
		REVIEW_INPROGRESS: `${resource}_REVIEW_INPROGRESS`,
	}
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
	internalAccessUrls: [process.env.APPLICATION_BASE_URL + 'v1/resource/publishCallback'],
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
	STATUS_ACTIVE: 'ACTIVE',
	CREATED_BY_SYSTEM: '0',
	PROJECT: 'project',
	FILTER_ALL: 'ALL',
	SORT_DESC: 'DESC',
	SORT_ASC: 'ASC',
	CREATED_AT: 'created_at',
	UPDATED_AT: 'updated_at',
	FILTER: 'filter',
	TYPE: 'type',
	STATUS: 'status',
	SEARCH: 'search',
	SORT_BY: 'sort_by',
	SORT_ORDER: 'sort_order',
	URL: 'url',
	FILE_PATH: 'filePath',
	LISTING: 'listing',
	PAGE_STATUS_VALUES: {
		drafts: ['DRAFT'],
		submitted_for_review: [
			'IN_REVIEW',
			'SUBMITTED',
			'PUBLISHED',
			'REJECTED',
			'REJECTED_AND_REPORTED',
			'REQUESTED_FOR_CHANGES',
		],
	},
	REVIEW_STATUS_UP_FOR_REVIEW: ['INPROGRESS', 'NOT_STARTED', 'CHANGES_UPDATED', 'STARTED'],
	PAGE_STATUS_DRAFTS: 'drafts',
	PAGE_STATUS_SUBMITTED_FOR_REVIEW: 'submitted_for_review',
	RESOURCE_STATUS_DRAFT: 'DRAFT',
	RESOURCE_STATUS_PUBLISHED: 'PUBLISHED',
	RESOURCE_STATUS_STARTED: 'STARTED',
	RESOURCE_STATUS_REJECTED: 'REJECTED',
	RESOURCE_STATUS_IN_REVIEW: 'IN_REVIEW',
	RESOURCE_STATUS_SUBMITTED: 'SUBMITTED',
	RESOURCE_STATUS_REJECTED_AND_REPORTED: 'REJECTED_AND_REPORTED',
	STATUS_RESOLVED: 'RESOLVED',
	ALL_USER_ROLES: 'all',
	LIMIT: 100,
	CONTENT: 'content',
	REVIEW_STATUS_NOT_STARTED: 'NOT_STARTED',
	REVIEW_STATUS_STARTED: 'STARTED',
	REVIEW_STATUS_INPROGRESS: 'INPROGRESS',
	REVIEW_STATUS_REQUESTED_FOR_CHANGES: 'REQUESTED_FOR_CHANGES',
	REVIEW_STATUS_REJECTED: 'REJECTED',
	REVIEW_STATUS_REJECTED_AND_REPORTED: 'REJECTED_AND_REPORTED',
	REVIEW_STATUS_APPROVED: 'APPROVED',
	REVIEW_STATUS_CHANGES_UPDATED: 'CHANGES_UPDATED',
	TRUE: true,
	FALSE: false,
	TASKS: 'tasks',
	COMMENT: 'comment',
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
	TASK_EVIDENCE: 'evidence_details',
	REQUEST_METHOD_DELETE: 'DELETE',
	FILE_TYPE: 'file_types',
	CHILDREN: 'children',
	SELF: 'self',
	RESOURCE_TYPE_PROGRAM: 'program',
	COMMENT_STATUS_DRAFT: 'DRAFT',
	REVIEW_COLUMN_REJECTED_AT: 'rejected_at',
	REVIEW_STATUS: 'review_status',
	COMMENT_STATUS_OPEN: 'OPEN',
	LEARNING_RESOURCE: 'learning_resources',
	SOLUTION_DETAILS: 'solution_details',
	TASK_ALLOWED_FILE_TYPES: 'file_types',
	ALLOWED_FILE_TYPES: {
		images: ['jpg', 'png', 'jpeg', 'bmp', 'gif', 'tiff', 'heif'],
		document: ['pdf'],
		videos: ['mp4', '3gp', 'm4v', 'mov', 'mkv', 'mpeg', 'ogg', 'webm', '3gpp', 'wmv', 'avi', 'flv'],
		audio: ['mp3', 'mp4', 'acc', 'flac', 'wav', 'midi', 'aiff'],
	},
	MAX_CHARACTER_LIMIT: 'max_char_limit',
	DATA_TYPE_NUMBER: 'number',
	SUB_TASK: 'subtask',
	MIN_NO_OF_EVIDENCES: 'min_no_of_evidences',
	NAME: 'name',
	DATA_TYPE_BOOLEAN: 'boolean',
	KAFKA_ON: 'ON',
	ENTITY_TYPE_MODELS: {
		project: ['project', 'tasks', 'subTasks'],
	},
	MODEL_NAMES: {
		RESOURCE: 'Resource',
	},
	USER_ACTIONS: {
		project: getResourceActions('PROJECT'),
	},
	EVENT_ADD_USER_ACTION: 'addUserAction',
	REQUEST_TIMEOUT_MS: 3000,
	CURRENT_USER: 'You',
	ACTIVITY_DATE_TIME_OPTIONS: {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
		hour12: true, // Use 12-hour clock with AM/PM
	},
	RESOURCE_STAGE_CREATION: 'CREATION',
	RESOURCE_STAGE_REVIEW: 'REVIEW',
	RESOURCE_STAGE_COMPLETION: 'COMPLETION',
}
