module.exports = {
	USERS_LIST: process.env.USER_LIST_ENDPOINT ? process.env.USER_LIST_ENDPOINT : 'v1/account/search',
	ORGANIZATION_READ: process.env.ORGANIZATION_READ_ENDPOINT
		? process.env.ORGANIZATION_READ_ENDPOINT
		: 'v1/organization/read',
	ORGANIZATION_LIST: process.env.ORGANIZATION_LIST_ENDPOINT
		? process.env.ORGANIZATION_LIST_ENDPOINT
		: 'v1/organization/list',
	USER_PROFILE_DETAILS: process.env.USER_PROFILE_DETAILS_ENDPOINT
		? process.env.USER_PROFILE_DETAILS_ENDPOINT
		: 'v1/user/read',
	VALIDATE_SESSIONS: 'v1/account/validateUserSession',
	BROWSE_EXISTING_END_POINT: '/scp/v1/resource/browseExisting',
	CALLBACK_URL_FOR_RESOURCE_PUBLISH: 'v1/resource/publishCallback',
	TENANT_READ: process.env.TENANT_READ_ENDPOINT ? process.env.TENANT_READ_ENDPOINT : 'v1/tenant/read',
	PUBLIC_TENANT_DETAILS: process.env.PUBLIC_TENANT_DETAIL_ENDPOINT
		? process.env.PUBLIC_TENANT_DETAIL_ENDPOINT
		: 'v1/public/branding',
	FIND_ENTITIES_BY_QUERY: process.env.FIND_ENTITIES_BY_QUERY_ENDPOINT
		? process.env.FIND_ENTITIES_BY_QUERY_ENDPOINT
		: 'v1/entities/find',
	ENTITY_TYPES_FIND_BY_QUERY: process.env.ENTITY_TYPES_FIND_BY_QUERY_ENDPOINT
		? process.env.ENTITY_TYPES_FIND_BY_QUERY_ENDPOINT
		: 'v1/entityTypes/find',
	MAP_USER_AND_PROGRAM: process.env.MAP_USER_AND_PROGRAM_ENDPOINT
		? process.env.MAP_USER_AND_PROGRAM_ENDPOINT
		: 'v1/userExtension/update',
}
