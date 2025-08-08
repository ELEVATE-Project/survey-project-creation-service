/**
 * name : middlewares/authenticator
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : Validating authorized requests
 */

const jwt = require('jsonwebtoken')
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const requests = require('@generics/requests')
const endpoints = require('@constants/endpoints')
const rolePermissionMappingQueries = require('@database/queries/role-permission-mapping')
const responses = require('@helpers/responses')
const { Op } = require('sequelize')
const fs = require('fs')
const path = require('path')
const utils = require('@generics/utils')

async function checkPermissions(roleTitle, requestPath, requestMethod) {
	const parts = requestPath.match(/[^/]+/g)
	const api_path = [`/${parts[0]}/${parts[1]}/${parts[2]}/*`]
	if (parts[4]) api_path.push(`/${parts[0]}/${parts[1]}/${parts[2]}/${parts[3]}*`)
	else
		api_path.push(
			`/${parts[0]}/${parts[1]}/${parts[2]}/${parts[3]}`,
			`/${parts[0]}/${parts[1]}/${parts[2]}/${parts[3]}*`
		)

	if (Array.isArray(roleTitle) && !roleTitle.includes(common.PUBLIC_ROLE)) {
		roleTitle.push(common.PUBLIC_ROLE)
	}
	const filter = { role_title: roleTitle, module: parts[2], api_path: { [Op.in]: api_path } }
	const attributes = ['request_type', 'api_path', 'module']
	const allowedPermissions = await rolePermissionMappingQueries.findAll(filter, attributes)
	const isPermissionValid = allowedPermissions.some((permission) => {
		return permission.request_type.includes(requestMethod)
	})
	return isPermissionValid
}

module.exports = async function (req, res, next) {
	try {
		const authHeader = req.get(process.env.AUTH_TOKEN_HEADER_NAME)

		const isInternalAccess = common.internalAccessUrls.some((path) => {
			if (req.path.includes(path)) {
				if (req.headers.internal_access_token === process.env.INTERNAL_ACCESS_TOKEN) return true
				// throw createUnauthorizedResponse()
			}
			return false
		})

		if (isInternalAccess && !authHeader) return next()
		if (!authHeader) {
			const isPermissionValid = await checkPermissions(common.PUBLIC_ROLE, req.path, req.method)
			if (isPermissionValid) return next()
			else throw createUnauthorizedResponse('PERMISSION_DENIED')
		}

		let [decodedToken, skipFurtherChecks] = await authenticateUser(authHeader, req)

		// --- config.json logic start ---
		// Path to config.json
		let configFilePath
		if (process.env.AUTH_CONFIG_FILE_PATH) {
			configFilePath = path.resolve(PROJECT_ROOT_DIRECTORY, process.env.AUTH_CONFIG_FILE_PATH)
		}

		let configData = {}
		let defaultTokenExtraction = false
		req.decodedToken = {}

		if (fs.existsSync(configFilePath)) {
			try {
				const rawData = fs.readFileSync(configFilePath)
				configData = JSON.parse(rawData)
				if (!configData.authTokenUserInformation) {
					defaultTokenExtraction = true
				}
				configData = configData.authTokenUserInformation
			} catch (error) {
				console.error('Error parsing config.json:', error)
				defaultTokenExtraction = true
			}
		} else {
			defaultTokenExtraction = true
		}

		let organizationKey = common.ORGANIZATION_KEY

		if (defaultTokenExtraction) {
			req.decodedToken = {
				...decodedToken.data,
			}
		} else {
			for (let key in configData) {
				if (configData.hasOwnProperty(key)) {
					let keyValue = getNestedValue(decodedToken, configData[key])
					if (key === 'id') {
						keyValue = keyValue?.toString()
					}
					if (key === organizationKey) {
						req.decodedToken[key] = getOrgId(req.headers, decodedToken, configData[key])
						continue
					}
					if (key === 'roles') {
						let orgId = getOrgId(req.headers, decodedToken, configData[organizationKey])
						decodedToken[organizationKey] = orgId
						const rolePathTemplate = configData['roles']
						const resolvedRolePath = resolvePathTemplate(rolePathTemplate, decodedToken)
						const roles = getNestedValue(decodedToken, resolvedRolePath) || []
						req.decodedToken[key] = roles
						continue
					}
					req.decodedToken[key] = keyValue
				}
			}
		}

		req.decodedToken.id =
			typeof req.decodedToken?.id === 'number' ? req.decodedToken?.id?.toString() : req.decodedToken?.id
		req.decodedToken.organization_code =
			typeof req.decodedToken?.organization_code === 'number'
				? req.decodedToken?.organization_code?.toString()
				: req.decodedToken?.organization_code

		if (!req.decodedToken[organizationKey]) {
			throw createUnauthorizedResponse()
		}

		req.decodedToken.token = authHeader
		const { tenantId, organizationId, orgTenantError } = utils._extractTenantAndOrgCodes(req)
		if (orgTenantError) {
			throw responses.failureResponse({
				message: 'TENANT_ORGANIZATION_HEADER_MISSING',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
		req.decodedToken.organization_code = organizationId.toString()
		req.decodedToken.tenant_code = tenantId.toString()

		if (!skipFurtherChecks) {
			if (process.env.SESSION_VERIFICATION_METHOD === common.SESSION_VERIFICATION_METHOD.USER_SERVICE)
				await validateSession(authHeader)

			const roleValidation = common.roleValidationPaths.some((path) => req.path.includes(path))

			if (roleValidation) {
				if (process.env.AUTH_METHOD === common.AUTH_METHOD.NATIVE)
					await nativeRoleValidation(decodedToken, authHeader)
				// else if (process.env.AUTH_METHOD === common.AUTH_METHOD.KEYCLOAK_PUBLIC_KEY)
				// 	await dbBasedRoleValidation(decodedToken)
			}

			const isPermissionValid = await checkPermissions(
				req.decodedToken.roles.map((role) => role.title),
				req.path,
				req.method
			)

			if (!isPermissionValid) throw createUnauthorizedResponse('PERMISSION_DENIED')
		}

		console.log('DECODED TOKEN:', req.decodedToken)
		next()
	} catch (err) {
		if (err.message === 'USER_SERVICE_DOWN') {
			err = responses.failureResponse({
				message: 'USER_SERVICE_DOWN',
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'SERVER_ERROR',
			})
		}
		console.error(err)
		next(err)
	}
}

/**
 * Creates a standardized unauthorized error response object.
 * @param {string} [message='UNAUTHORIZED_REQUEST'] - Custom message to include in the response.
 * @returns {Object} A formatted failure response indicating unauthorized access.
 */
function createUnauthorizedResponse(message = 'UNAUTHORIZED_REQUEST') {
	return responses.failureResponse({
		message,
		statusCode: httpStatusCode.unauthorized,
		responseCode: 'UNAUTHORIZED',
	})
}

/**
 * Verifies a JWT access token and returns the decoded payload.
 * @param {string} token - The JWT access token to verify.
 * @returns {Object} Decoded token payload if valid.
 * @throws Will throw an unauthorized response if the token is expired or invalid.
 */
async function verifyToken(token) {
	try {
		return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
	} catch (err) {
		if (err.name === 'TokenExpiredError') throw createUnauthorizedResponse('ACCESS_TOKEN_EXPIRED')
		console.log(err)
		throw createUnauthorizedResponse()
	}
}

/**
 * Checks if the given list of roles contains the admin role.
 * @param {Array<Object>} roles - Array of role objects to check.
 * @returns {boolean} True if at least one role has the admin title, otherwise false.
 */
function isAdminRole(roles) {
	return roles.some((role) => role.title === process.env.DEFAULT_ADMIN_ROLE)
}

/**
 * Validates the user's session token by calling the user service.
 * @param {string} authHeader - The access token extracted from the request header.
 */
async function validateSession(authHeader) {
	const userBaseUrl = `${process.env.USER_SERVICE_HOST}${process.env.USER_SERVICE_BASE_URL}`
	const validateSessionEndpoint = `${userBaseUrl}${endpoints.VALIDATE_SESSIONS}`
	const reqBody = { token: authHeader }

	const isSessionActive = await requests.post(validateSessionEndpoint, reqBody, '', true)

	if (isSessionActive?.data?.responseCode === 'UNAUTHORIZED') throw createUnauthorizedResponse('ACCESS_TOKEN_EXPIRED')
	if (!isSessionActive?.success || !isSessionActive?.data?.result?.data?.user_session_active)
		throw new Error('USER_SERVICE_DOWN')
}

/**
 * Fetches the user's profile details from user service.
 * @param {string} userId - The ID of the user whose profile needs to be fetched.
 * @returns {Object} The user's profile details if found and active.
 */
async function fetchUserProfile(authHeader) {
	const userBaseUrl = `${process.env.USER_SERVICE_HOST}${process.env.USER_SERVICE_BASE_URL}`
	const profileUrl = `${userBaseUrl}${endpoints.USER_PROFILE_DETAILS}`
	const user = await requests.get(profileUrl, authHeader, false)
	if (!user || !user.success) throw createUnauthorizedResponse('USER_NOT_FOUND')
	if (user.data.result.deleted_at !== null) throw createUnauthorizedResponse('USER_ROLE_UPDATED')
	return user.data.result
}

/**
 * Authenticates a user by validating the provided authentication token.
 * @param {string} authHeader - The authentication header containing the token.
 * @param {Object} req - The request object, used to attach the decoded token to the request.
 * @returns {Array} An array where the first element is the decoded token, and the second is a boolean indicating whether the user is an admin.
 */
async function authenticateUser(authHeader, req) {
	if (!authHeader) throw createUnauthorizedResponse()
	let token
	if (process.env.IS_AUTH_TOKEN_BEARER === 'true') {
		const [authType, extractedToken] = authHeader.split(' ')
		if (authType.toLowerCase() !== 'bearer') throw createUnauthorizedResponse()
		token = extractedToken.trim()
	} else token = authHeader.trim()

	let decodedToken = null
	if (process.env.AUTH_METHOD === common.AUTH_METHOD.NATIVE) {
		decodedToken = await verifyToken(token)
	} else if (process.env.AUTH_METHOD === common.AUTH_METHOD.KEYCLOAK_PUBLIC_KEY) {
		decodedToken = await keycloakPublicKeyAuthentication(token)
		if (!decodedToken) throw createUnauthorizedResponse()
		if (decodedToken) return [decodedToken, true]
	}

	if (!decodedToken) throw createUnauthorizedResponse()
	//assuming only one organization / the first organization in the token should be considered
	if (decodedToken.data.organizations[0].roles && isAdminRole(decodedToken.data.organizations[0].roles)) {
		req.decodedToken = decodedToken.data
		return [decodedToken, true]
	}

	return [decodedToken, false]
}

/**
 * Validates the user's roles and organization by fetching the user's profile.
 * @param {Object} decodedToken - The decoded JWT token containing user information.
 * @throws Will throw an error if the user profile cannot be fetched or if the profile is invalid.
 */
async function nativeRoleValidation(decodedToken, authHeader) {
	const userProfile = await fetchUserProfile(authHeader)
	decodedToken.data.roles = userProfile.user_roles
	decodedToken.data.organization_code = userProfile.organization_code
}

const keycloakPublicKeyPath = `${process.env.KEYCLOAK_PUBLIC_KEY_PATH}/`
const PEM_FILE_BEGIN_STRING = '-----BEGIN PUBLIC KEY-----'
const PEM_FILE_END_STRING = '-----END PUBLIC KEY-----'

/**
 * Authenticates a user by verifying their Keycloak JWT token using the public key.
 * @param {string} token - The Keycloak JWT token to authenticate.
 * @returns {Object} The user's verified data, including their external user ID, name, and organization ID.
 */
async function keycloakPublicKeyAuthentication(token) {
	try {
		const tokenClaims = jwt.decode(token, { complete: true })
		if (!tokenClaims || !tokenClaims.header) throw createUnauthorizedResponse()
		// Extract the key ID (kid) from the token header
		const kid = tokenClaims.header.kid
		// Construct the path to the public key file using the key ID
		const path = keycloakPublicKeyPath + kid.replace(/\.\.\//g, '')
		// Read the public key file from the resolved file path
		const accessKeyFile = await fs.promises.readFile(path, 'utf8')
		// Ensure the public key is properly formatted with BEGIN and END markers
		const cert = accessKeyFile.includes(PEM_FILE_BEGIN_STRING)
			? accessKeyFile
			: `${PEM_FILE_BEGIN_STRING}\n${accessKeyFile}\n${PEM_FILE_END_STRING}`

		const verifiedClaims = await verifyKeycloakToken(token, cert)
		// Extract the external user ID from the verified claims
		const externalUserId = verifiedClaims.sub.split(':').pop()

		//get user role
		const userBaseUrl = `${process.env.USER_SERVICE_HOST}${process.env.USER_SERVICE_BASE_URL}`
		const userReadAPIUrl = `${userBaseUrl}${endpoints.USER_PROFILE_DETAILS}` + '/' + externalUserId
		const userRes = await requests.get(userReadAPIUrl, token, false)

		let roles = []
		let organization_code = verifiedClaims.org

		if (userRes.data.responseCode === 'OK' && userRes?.data?.result) {
			userRes.result = userRes.data.result
			roles = userRes.result?.user_roles
			organization_code = userRes.result?.organization_code
		}

		return {
			data: {
				id: externalUserId,
				roles: roles || [],
				name: verifiedClaims.name,
				organization_code: organization_code || null,
			},
		}
	} catch (err) {
		if (err.message === 'USER_NOT_FOUND') throw createUnauthorizedResponse('USER_NOT_FOUND')
		else {
			console.error(err)
			throw createUnauthorizedResponse()
		}
	}
}

/**
 * Verifies the Keycloak JWT token using the provided public key certificate.
 * @param {string} token - The Keycloak JWT token to verify.
 * @param {string} cert - The public key certificate used to verify the token.
 * @returns {Object} The decoded token data if the token is valid.
 */
async function verifyKeycloakToken(token, cert) {
	try {
		let verifyTokenRes = jwt.verify(token, cert, { algorithms: ['sha1', 'RS256', 'HS256'] })
		return verifyTokenRes
	} catch (err) {
		if (err.name === 'TokenExpiredError') throw createUnauthorizedResponse('ACCESS_TOKEN_EXPIRED')
		console.error(err)
		throw createUnauthorizedResponse()
	}
}

function getOrgId(headers, decodedToken, orgConfigData) {
	if (headers['organization_code']) {
		return headers['organization_code'].toString()
	} else {
		const orgIdPath = orgConfigData
		return getNestedValue(decodedToken, orgIdPath)?.toString()
	}
}

function getNestedValue(obj, path) {
	const parts = path.split('.')
	let current = obj

	for (const part of parts) {
		if (!current) return undefined

		// Match conditional array access: key[?field=value]
		const conditionalMatch = part.match(/^(\w+)\[\?(\w+)=([^\]]+)\]$/)
		if (conditionalMatch) {
			const [, arrayKey, field, expected] = conditionalMatch
			const array = current[arrayKey]
			if (!Array.isArray(array)) return undefined
			current = array.find((item) => item[field]?.toString() === expected)
			continue
		}

		// Match array index: key[0]
		const indexMatch = part.match(/^(\w+)\[(\d+)\]$/)
		if (indexMatch) {
			const [, key, index] = indexMatch
			const array = current[key]
			if (!Array.isArray(array)) return undefined
			current = array[parseInt(index)]
			continue
		}

		// Simple object property
		current = current[part]
	}

	return current
}

function resolvePathTemplate(template, contextObject) {
	return template.replace(/\{\{(.*?)\}\}/g, (_, path) => {
		const value = getNestedValue(contextObject, path.trim())
		return value?.toString?.() ?? ''
	})
}
