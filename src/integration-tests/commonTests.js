var supertest = require('supertest') //require supertest
var defaults = require('superagent-defaults')
const crypto = require('crypto')
let baseURL = 'http://localhost:6001'
//supertest hits the HTTP server (your app)
let defaultHeaders

const logIn = async () => {
	try {
		console.log('============>LOGIN 1 : ')
		let request = defaults(supertest('http://localhost:5001'))
		let waitOn = require('wait-on')
		let opts = {
			resources: [baseURL],
			delay: 5000, // initial delay in ms, default 0
			interval: 2500, // poll interval in ms, default 250ms
			timeout: 100000,
		}
		await waitOn(opts)
		jest.setTimeout(10000)
		let email = 'adithya.d' + crypto.randomBytes(5).toString('hex') + '@pacewisdom.com'
		let password = 'Welcome@123'
		let res = await request.post('/user/v1/account/create').send({
			name: 'adithya',
			email: email,
			password: password,
		})
		// console.log('============>LOGIN 5 : ', res.body, res.statusCode)
		res = await request.post('/user/v1/account/login').send({
			email: email,
			password: password,
		})
		console.log('============>LOGIN 6 : ')
		if (res.body && res.body.result && res.body.result.access_token && res.body.result.user.id) {
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
			console.error('Error while getting access token')
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
}
