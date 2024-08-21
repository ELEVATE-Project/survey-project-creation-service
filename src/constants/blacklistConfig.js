/**
 * name : common/blacklistConfig.js
 * author : Priyanka Pradeep
 * Date : 22-Aug-2024
 * Description : Details of keys needs to blacklist from request body
 */
const entityType = {
	create: [
		'id',
		'status',
		'created_by',
		'updated_by',
		'organization_id',
		'parent_id',
		'allow_filtering',
		'created_at',
		'updated_at',
	],
	update: ['id', 'created_by', 'updated_by', 'allow_filtering', 'organization_id', 'parent_id'],
}

const entity = {
	create: ['id', 'status', 'created_by', 'updated_by', 'created_at', 'updated_at'],
	update: ['id', 'entity_type_id', 'created_by', 'updated_by', 'created_at', 'updated_at'],
}

const form = {
	create: ['id', 'version', 'organization_id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
	update: ['id', 'version', 'organization_id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
}

const modules = {
	create: ['id', 'created_at', 'updated_at'],
	update: ['id', 'created_at', 'updated_at'],
}

const permissions = {
	create: ['id', 'created_at', 'updated_at'],
	update: ['id', 'created_at', 'updated_at'],
}

const rolePermissionMapping = {
	create: ['id', 'created_by'],
	delete: ['module', 'request_type', 'api_path', 'created_by'],
}

const comments = {
	update: ['id', 'user_id', 'resource_id', 'resolved_by', 'resolved_at'],
}

const organizationExtensions = {
	createConfig: ['id', 'organization_id'],
	updateConfig: ['id', 'organization_id'],
}

const projects = {
	update: [
		'id',
		'user_id',
		'organization_id',
		'created_by',
		'updated_by',
		'review_type',
		'type',
		'blob_path',
		'status',
		'last_reviewed_on',
		'published_on',
		'submitted_on',
		'published_id',
		'reference_id',
		'next_stage',
		'created_at',
		'updated_at',
	],
	submitForReview: [
		'id',
		'organization_id',
		'created_by',
		'updated_by',
		'review_type',
		'type',
		'blob_path',
		'status',
		'last_reviewed_on',
		'published_on',
		'submitted_on',
		'published_id',
		'reference_id',
		'next_stage',
		'created_at',
		'updated_at',
	],
}

const reviewStages = {
	update: ['id', 'organization_id', 'created_at', 'updated_at'],
}

const certificates = {
	update: ['id', 'organization_id', 'created_by', 'updated_by', 'created_at', 'updated_at'],
}

module.exports = {
	entityType,
	entity,
	form,
	modules,
	permissions,
	rolePermissionMapping,
	comments,
	organizationExtensions,
	projects,
	reviewStages,
	certificates,
}
