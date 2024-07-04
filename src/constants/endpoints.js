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
}
