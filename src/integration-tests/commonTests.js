var supertest = require('supertest') //require supertest
var defaults = require('superagent-defaults')
const crypto = require('crypto')
let baseURL = 'http://localhost:6001'
const waitOn = require('wait-on')
//supertest hits the HTTP server (your app)
let defaultHeaders

// Utility function to wait for services to be ready
const waitForService = async (url) => {
	const opts = {
		resources: [url],
		delay: 5000,
		interval: 2500,
		timeout: 100000,
	}
	await waitOn(opts)
}

const verifyUserRole = async () => {
	console.log('============>USER ROLE CHECK : ')
	let request = defaults(supertest('http://localhost:5001'))
	await waitForService(baseURL)
	jest.setTimeout(20000)

	let email = 'orgadmin' + crypto.randomBytes(5).toString('hex') + '@shikshalokam.com'
	let password = 'Welcome@123'
	let res = await request.post('/user/v1/account/create').send({
		name: 'orgadmin',
		email: email,
		password: password,
	})

	if (res.body && res.body.result && res.body.result.access_token && res.body.result.user.id) {
		defaultHeaders = {
			'X-auth-token': 'bearer ' + res.body.result.access_token,
			Connection: 'keep-alive',
			'Content-Type': 'application/json',
		}

		let existingCreatorRole = await request.get('/user/v1/user-role/list').set(defaultHeaders).query({
			title: 'content_creator',
			organization_id: 1,
		})

		if (existingCreatorRole.statusCode == 400 || existingCreatorRole.body.result?.data?.length == 0) {
			let createCreatorRole = await request.post('/user/v1/user-role/create').set(defaultHeaders).send({
				title: 'content_creator',
				user_type: 0,
				organization_id: 1,
				label: 'Content Creator',
				visibility: 'PUBLIC',
			})

			if (createCreatorRole.statusCode != 201) {
				console.log('Content Creator Role Creation Failed')
			}
		}

		let existingReviewerRole = await request.get('/user/v1/user-role/list').set(defaultHeaders).query({
			title: 'reviewer',
			organization_id: 1,
		})

		if (existingReviewerRole.statusCode == 400 || existingReviewerRole.body.result?.data?.length == 0) {
			let createReviewRole = await request.post('/user/v1/user-role/create').set(defaultHeaders).send({
				title: 'reviewer',
				user_type: 0,
				organization_id: 1,
				label: 'Reviewer',
				visibility: 'PUBLIC',
			})

			if (createReviewRole.statusCode != 201) {
				console.log('Reviewer Role Creation Failed')
			}
		}
	}
	console.log('============>USER ROLE CHECK COMPLETED: ')
}

// ;(async () => {
// 	await createUserRoles()
// })()

const logIn = async () => {
	try {
		console.log('============>ATTEMPTING LOGIN : ')
		let request = defaults(supertest('http://localhost:5001'))
		await waitForService(baseURL)
		jest.setTimeout(20000)

		let email = 'adithya.d' + crypto.randomBytes(5).toString('hex') + '@pacewisdom.com'
		let password = 'Welcome@123'
		let res = await request.post('/user/v1/account/create').send({
			name: 'adithya',
			email: email,
			password: password,
		})

		res = await request.post('/user/v1/account/login').send({
			email: email,
			password: password,
		})

		if (res.body && res.body.result && res.body.result.access_token && res.body.result.user.id) {
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
				id: res.body.result.user.id,
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

function logError(res) {
	let successCodes = [200, 201, 202]
	if (!successCodes.includes(res.statusCode)) {
		console.log('Response Body', res.body)
	}
}

module.exports = {
	logIn, //-- export if token is generated
	logError,
	verifyUserRole,
}
