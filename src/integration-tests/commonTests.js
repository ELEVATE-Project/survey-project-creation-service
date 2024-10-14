// Require necessary modules
var supertest = require('supertest')
var defaults = require('superagent-defaults')
const crypto = require('crypto')
const baseURL = 'http://localhost:6001'
const userServiceURL = 'http://localhost:5001' // Add user service URL

// Global headers for authenticated requests
let defaultHeaders
const waitOn = require('wait-on')
let verifyUserRoleRetries = 0

// Improved waitForServices function to wait for both services
const waitForServices = async (urls) => {
	const opts = {
		resources: urls,
		delay: 5000, // Initial delay before checking
		interval: 1000, // Interval between checks
		timeout: 30000, // Max time to wait for service
	}
	try {
		await waitOn(opts)
		console.log(`Services are ready at: ${urls.join(', ')}`)
	} catch (error) {
		console.error(`Services not ready at: ${urls.join(', ')}. Error: ${error.message}`)
		throw new Error('Services not available')
	}
}

// Function to verify user roles and create them if necessary
const verifyUserRole = async () => {
	console.log('============>USER ROLE CHECK : ')
	verifyUserRoleRetries++

	// Define a separate request instance scoped to this function
	let request = defaults(supertest(userServiceURL))

	// Wait for both the base and user services to be ready
	await waitForServices([baseURL, userServiceURL])

	jest.setTimeout(5000)

	// Create a new user
	let email = 'orgadmin' + crypto.randomBytes(5).toString('hex') + '@shikshalokam.com'
	let password = 'Welcome@123'

	try {
		let res = await request.post('/user/v1/account/create').send({
			name: 'orgadmin',
			email: email,
			password: password,
		})

		// Check if the user was created successfully and access_token is available
		if (res.body?.result?.access_token && res.body.result.user.id) {
			defaultHeaders = {
				'X-auth-token': 'bearer ' + res.body.result.access_token,
				Connection: 'keep-alive',
				'Content-Type': 'application/json',
			}

			// Run role checks concurrently for content_creator and reviewer roles
			const [existingCreatorRole, existingReviewerRole] = await Promise.all([
				request.get('/user/v1/user-role/list').set(defaultHeaders).query({
					title: 'content_creator',
					organization_id: 1,
				}),
				request.get('/user/v1/user-role/list').set(defaultHeaders).query({
					title: 'reviewer',
					organization_id: 1,
				}),
			])

			// Create role creation promises
			let roleCreationPromises = []

			// Add content_creator role creation promise
			if (existingCreatorRole.statusCode === 400 || !existingCreatorRole.body.result?.data?.length) {
				const createCreatorRole = request.post('/user/v1/user-role/create').set(defaultHeaders).send({
					title: 'content_creator',
					user_type: 0,
					organization_id: 1,
					label: 'Content Creator',
					visibility: 'PUBLIC',
				})
				roleCreationPromises.push(createCreatorRole)
			}

			// Add reviewer role creation promise
			if (existingReviewerRole.statusCode === 400 || !existingReviewerRole.body.result?.data?.length) {
				const createReviewRole = request.post('/user/v1/user-role/create').set(defaultHeaders).send({
					title: 'reviewer',
					user_type: 0,
					organization_id: 1,
					label: 'Reviewer',
					visibility: 'PUBLIC',
				})
				roleCreationPromises.push(createReviewRole)
			}

			// Wait for both role creation requests to complete
			if (roleCreationPromises.length > 0) {
				const promiseResult = await Promise.all(roleCreationPromises)

				// Check if all the promises were successful
				promiseResult.forEach((res, index) => {
					if (res.statusCode >= 200 && res.statusCode < 300) {
						console.log(`Role creation for promise ${index + 1} was successful.`)
					} else {
						if (verifyUserRoleRetries <= 3) verifyUserRole()
					}
				})
				console.log('ROLE CREATION : : : : =====> ', JSON.stringify(resss.body, null, 2))
			}
		}
	} catch (error) {
		console.error('Error in verifyUserRole:', error)
		throw error
	}

	console.log('============>USER ROLE CHECK COMPLETED: ')
	return true
}

;(async () => {
	try {
		console.log(
			'PROCESS ENV VARIABLES : : ==> ',
			process.env.CLOUD_STORAGE_PROVIDER,
			process.env.CLOUD_STORAGE_ACCOUNTNAME,
			process.env.CLOUD_STORAGE_SECRET,
			process.env.CLOUD_STORAGE_BUCKETNAME,
			process.env.CLOUD_STORAGE_REGION,
			process.env.CLOUD_ENDPOINT
		)

		console.log('Calling verifyUserRole...')
		const result = await verifyUserRole()
	} catch (error) {
		console.error('Error while calling verifyUserRole:', error)
	}
})()

// Function to log in and generate token
const logIn = async () => {
	try {
		console.log('============>ATTEMPTING LOGIN : ')

		// Define a separate request instance scoped to this function
		let request = defaults(supertest(userServiceURL))

		await waitForServices([baseURL, userServiceURL])

		jest.setTimeout(10000)

		// Generate unique email for testing
		let email = 'adithya.d' + crypto.randomBytes(5).toString('hex') + '@pacewisdom.com'
		let password = 'Welcome@123'

		// Create a new account
		let res = await request.post('/user/v1/account/create').send({
			name: 'adithya',
			email: email,
			password: password,
		})

		// Log in with the created account
		res = await request.post('/user/v1/account/login').send({
			email: email,
			password: password,
		})

		// Check if login was successful and return token details
		if (res.body?.result?.access_token && res.body.result.user.id) {
			console.log('============>LOGIN SUCCESSFUL')
			defaultHeaders = {
				'X-auth-token': 'bearer ' + res.body.result.access_token,
				Connection: 'keep-alive',
				'Content-Type': 'application/json',
			}

			global.request = defaults(supertest(baseURL))
			global.request.set(defaultHeaders)
			global.userId = res.body.result.user.id
			return {
				token: res.body.result.access_token,
				email: email,
				password: password,
				name: res.body.result.user.name,
				roles: res.body.result.user.user_roles,
				organization_id: res.body.result.user.organization_id,
			}
		} else {
			console.error('LOGIN FAILED')
			return false
		}
	} catch (error) {
		console.error('ERROR : : :', error)
	}
}

// Function to log any errors if they occur
function logError(res) {
	let successCodes = [200, 201, 202]
	if (!successCodes.includes(res.statusCode)) {
		console.log('Response Body', res.body)
	}
}

module.exports = {
	logIn, //-- export if token is generated
	logError,
	verifyUserRole, // Uncomment if needed externally
}
