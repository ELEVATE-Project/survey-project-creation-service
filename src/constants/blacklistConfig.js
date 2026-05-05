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
		'organization_code',
		'parent_id',
		'allow_filtering',
		'created_at',
		'updated_at',
	],
	update: ['id', 'created_by', 'updated_by', 'allow_filtering', 'organization_code', 'parent_id'],
}

const entities = {
	create: ['id', 'status', 'created_by', 'updated_by', 'created_at', 'updated_at'],
	update: ['id', 'entity_type_id', 'created_by', 'updated_by', 'created_at', 'updated_at'],
}

const form = {
	create: ['id', 'version', 'organization_code', 'created_at', 'updated_at', 'created_by', 'updated_by'],
	update: ['id', 'version', 'organization_code', 'created_at', 'updated_at', 'created_by', 'updated_by'],
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
	update: ['user_id', 'resource_id', 'resolved_by', 'resolved_at'],
}

const organizationExtensions = {
	createConfig: ['id', 'organization_code'],
	updateConfig: ['id', 'organization_code'],
}

const projects = {
	update: [
		'id',
		'user_id',
		'organization_code',
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
		'source_resource_id',
		'next_stage',
		'created_at',
		'updated_at',
		'is_comments',
		'stage',
		'organizations',
	],
	submitForReview: [
		'id',
		'organization_code',
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
		'source_resource_id',
		'next_stage',
		'created_at',
		'updated_at',
		'stage',
		'organizations',
	],
}

const reviewStages = {
	update: ['id', 'organization_code', 'created_at', 'updated_at'],
}

const certificates = {
	update: ['id', 'organization_code', 'created_by', 'updated_by', 'created_at', 'updated_at'],
}

const rollouts = {
	update: [
		'id',
		'user_id',
		'organization_code',
		'created_by',
		'updated_by',
		'resource_type',
		'type',
		'blob_path',
		'status',
		'rollout_date',
		'published_id',
		'parent_id',
		'type',
		'duplicate_template_id',
		'organizations',
	],
}

const programs = {
	update: [
		'id',
		'user_id',
		'organization_code',
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
		'source_resource_id',
		'next_stage',
		'created_at',
		'updated_at',
		'is_under_edit',
		'deleted_at',
		'meta',
		'stage',
		'organizations',
		'is_comments',
	],
	resources: [
		'user_id',
		'organization_code',
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
		'source_resource_id',
		'next_stage',
		'created_at',
		'updated_at',
		'is_under_edit',
		'deleted_at',
		'meta',
		'is_comments',
		'stage',
		'organizations',
	],
}

const queryForbiddenPatterns = [
	// Injection/Bypass Tricks
	'--',
	';',
	'/*',
	'*/',
	'#',
	'\\',
	"'",
	'"',
	'char(',
	'chr(',
	'concat(',
	'||',

	// DML/DDL Commands
	'insert',
	'update',
	'delete',
	'drop',
	'truncate',
	'alter',
	'create',
	'replace',
	'rename',
	'merge',

	// Joins & Advanced Access Paths
	'cross join',
	'left join lateral',
	'right join lateral',
	'natural join',

	// Recursive & CTEs
	'with',
	'with recursive',

	// Union & Subquery Abuse
	'union',
	'intersect',
	'except',

	// System Info Access
	'information_schema',
	'pg_catalog',
	'pg_roles',
	'pg_user',
	'pg_shadow',
	'pg_authid',
	'pg_group',
	'pg_settings',
	'pg_stat',
	'pg_stat_activity',
	'pg_stat_user_tables',

	// Dangerous PostgreSQL Functions
	'pg_sleep',
	'pg_read_file',
	'pg_write_file',
	'pg_ls_dir',
	'pg_terminate_backend',
	'pg_cancel_backend',
	'pg_backend_pid',
	'pg_execute_server_program',
	'current_setting',
	'set_config',
	'dblink',
	'xml',
	'json_agg',
	'array_agg',
	'string_agg',

	// Privilege Escalation
	'set role',
	'set session authorization',
	'grant',
	'revoke',
	'owner to',

	// File/Blob Access
	'lo_import',
	'lo_export',
	'copy from',
	'copy to',

	// Unsafe Languages/Extensions
	'plperlu',
	'plpythonu',
	'pltclu',
	'untrusted',

	// Execution Abuse
	'execute',
	'do $$',
	'$$ language',
	'declare',
	'begin',
	'commit',
	'rollback',

	// Temp or Transactional Tables
	'temporary table',
	'temp table',
	'global temp',
	'unlogged',

	// Admin or App Tables (optional)
	'users',
	'admins',
	'passwords',
	'audit_logs',
]

module.exports = {
	entityType,
	entities,
	form,
	modules,
	permissions,
	rolePermissionMapping,
	comments,
	organizationExtensions,
	projects,
	reviewStages,
	certificates,
	rollouts,
	programs,
	queryForbiddenPatterns,
}
