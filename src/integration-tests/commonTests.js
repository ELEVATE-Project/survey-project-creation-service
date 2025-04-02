// Require necessary modules
var supertest = require('supertest')
var defaults = require('superagent-defaults')
const crypto = require('crypto')
const baseURL = 'http://localhost:6001'

// Global headers for authenticated requests
let defaultHeaders
const waitOn = require('wait-on')

// Improved waitForService function
const waitForService = async (url) => {
	console.log(`Waiting for service at: ${url}`)
	const opts = {
		resources: [url],
		delay: 5000, // Initial delay before checking
		interval: 1000, // Interval between checks
		timeout: 60000, // Max time to wait for service
	}
	try {
		await waitOn(opts)
		console.log(`Service is ready at: ${url}`)
	} catch (error) {
		console.error(`Error: ${error.message}`)
		throw new Error('Service not available')
	}
}

// Function to verify user roles and create them if necessary
const verifyUserRole = async () => {
	console.log('============>USER ROLE CHECK : ')

	// Define a separate request instance scoped to this function
	let request = defaults(supertest('http://localhost:5001'))

	// Wait for the service to be ready
	await waitForService(baseURL)

	jest.setTimeout(10000)

	// Create a new user
	let email = 'orgadmin' + crypto.randomBytes(5).toString('hex') + '@shikshalokam.com'
	let password = 'Welco@Me#123!'

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
			const [
				existingCreatorRole,
				existingReviewerRole,
				existingRolloutManagerRole,
				existingProgramDesignerRole,
				existingProgramManagerRole,
			] = await Promise.all([
				request.get('/user/v1/user-role/list').set(defaultHeaders).query({
					title: 'content_creator',
					organization_id: 1,
				}),
				request.get('/user/v1/user-role/list').set(defaultHeaders).query({
					title: 'reviewer',
					organization_id: 1,
				}),

				request.get('/user/v1/user-role/list').set(defaultHeaders).query({
					title: 'rollout_manager',
					organization_id: 1,
				}),

				request.get('/user/v1/user-role/list').set(defaultHeaders).query({
					title: 'program_designer',
					organization_id: 1,
				}),

				request.get('/user/v1/user-role/list').set(defaultHeaders).query({
					title: 'program_manager',
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

			// Add rollout_manager role creation promise
			if (
				existingRolloutManagerRole.statusCode === 400 ||
				!existingRolloutManagerRole.body.result?.data?.length
			) {
				const createRolloutManagerRole = request.post('/user/v1/user-role/create').set(defaultHeaders).send({
					title: 'rollout_manager',
					user_type: 0,
					organization_id: 1,
					label: 'Rollout Manager',
					visibility: 'PUBLIC',
				})
				roleCreationPromises.push(createRolloutManagerRole)
			}

			//add program_designer role
			if (
				existingProgramDesignerRole.statusCode === 400 ||
				!existingProgramDesignerRole.body.result?.data?.length
			) {
				const createProgramDesignerRole = request.post('/user/v1/user-role/create').set(defaultHeaders).send({
					title: 'program_designer',
					user_type: 0,
					organization_id: 1,
					label: 'Program Designer',
					visibility: 'PUBLIC',
				})
				roleCreationPromises.push(createProgramDesignerRole)
			}

			if (
				existingProgramManagerRole.statusCode === 400 ||
				!existingProgramManagerRole.body.result?.data?.length
			) {
				const createProgramManagerRole = request.post('/user/v1/user-role/create').set(defaultHeaders).send({
					title: 'program_manager',
					user_type: 0,
					organization_id: 1,
					label: 'Program Manager',
					visibility: 'PUBLIC',
				})
				roleCreationPromises.push(createProgramManagerRole)
			}

			// Wait for both role creation requests to complete
			if (roleCreationPromises.length > 0) {
				const res = await Promise.all(roleCreationPromises)
				console.log('ROLE CREATION : : : : =====> ', JSON.stringify(res.body, null, 2))
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
	console.log('PROCESS ENV VARIABLES : : ==> ', process.env.INTERNAL_ACCESS_TOKEN)
})()

// Function to log in and generate token
const logIn = async () => {
	try {
		console.log('============>ATTEMPTING LOGIN : ')

		// Define a separate request instance scoped to this function
		let request = defaults(supertest('http://localhost:5001'))

		await waitForService(baseURL)

		jest.setTimeout(10000)

		// Generate unique email for testing
		let email = 'adithya' + crypto.randomBytes(5).toString('hex') + '@shikshalokam.org'
		let password = 'Welco@Me#123!'

		// Create a new account
		let res = await request.post('/user/v1/account/create').send({
			name: 'adithya',
			email: email,
			password: password,
		})

		// console.log(' Create : -=-=-=-=-=>>  ', res.body)

		// Log in with the created account
		res = await request.post('/user/v1/account/login').send({
			email: email,
			password: password,
		})
		console.log('-=-=-=-=-=>> ', res.body)
		// Check if login was successful and return token details
		if (res.body?.result?.access_token && res.body.result.user.id) {
			console.log('============>LOGIN SUCCESSFUL', res.body?.result?.access_token)
			defaultHeaders = {
				'X-auth-token': 'bearer ' + res.body.result.access_token,
				Connection: 'keep-alive',
				'Content-Type': 'application/json',
			}

			global.request = defaults(supertest(baseURL))
			global.request.set(defaultHeaders)
			global.userId = res.body.result.user.id
			return {
				id: res.body.result.user.id,
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

// Function to build materialized view
const triggerViewRebuild = async () => {
	try {
		console.log('============>ATTEMPTING VIEW BUILD : ')

		// Define a separate request instance scoped to this function
		let request = defaults(supertest('http://localhost:5001'))
		defaultHeaders.internal_access_token = 'PKXBJ7kgwX5auvASmB3djL8jd0pzYADo'
		console.log('defaultHeaders : : : --->>> ', defaultHeaders)

		await waitForService(baseURL)
		jest.setTimeout(10000)

		let res = await request.get('/user/v1/admin/triggerPeriodicViewRefresh')
		console.log(JSON.stringify(res.body, null, 2), 'triggerViewRebuild---------')
		if (res.body.statusCode != 200) {
			return {
				success: false,
				error: res.body,
			}
		}
		return {
			success: true,
		}
	} catch (error) {
		console.error('Error triggering view rebuild:', error)
		return {
			success: false,
		}
	}
}

module.exports = {
	logIn,
	logError,
	verifyUserRole,
	triggerViewRebuild,
}
