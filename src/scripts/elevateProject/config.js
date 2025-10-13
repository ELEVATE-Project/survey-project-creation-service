/**
 * name : scripts/elevateProject/config.js
 * author : Priyanka Pradeep
 * Date : 30 - September - 2025
 * Description : Configuration constants for elevate migration script
 */

module.exports = {
	ALLOWED_ARG_PROGRAM_MIGRATION_SCRIPT: ['tenant_code', 'organization_code'],
	ENTITY_TYPE_KEYS: ['categories', 'recommended_for', 'languages'],
	BATCH_SIZE: 10,
	USER_CACHE_SIZE: 1000, // Cache up to 1000 users
	CURSOR_TIMEOUT: 30 * 60 * 1000, // 30 minutes cursor timeout
	ROLE_ENTITY_TYPES: ['professional_role', 'professional_subroles'],
	EXCLUDED_KEYS_IN_SCOPE: ['entityType', 'organizations', 'roles'],
	LOCATION_ENTITY_TYPE_HIERARCHY: ['state', 'district', 'block', 'cluster', 'school'],
}
