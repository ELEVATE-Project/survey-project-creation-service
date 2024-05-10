var supertest = require('supertest') //require supertest
var defaults = require('superagent-defaults')
const { faker } = require('@faker-js/faker')
const crypto = require('crypto')
const common = require('@constants/common')
let baseURL = 'http://localhost:6001'
//supertest hits the HTTP server (your app)
let defaultHeaders

const logIn = async () => {
	try {
		let request = defaults(supertest('http://localhost:5001'))
		let waitOn = require('wait-on')
		let opts = {
			resources: [baseURL],
			delay: 1000, // initial delay in ms, default 0
			interval: 2500, // poll interval in ms, default 250ms
			timeout: 100000,
		}
		await waitOn(opts)
		let email = 'adithya.d' + crypto.randomBytes(5).toString('hex') + '@pacewisdom.com'
		let password = 'WWWWWelcome@@@123'
		let res = await request.post('/user/v1/account/create').send({
			name: 'adithya',
			email: email,
			password: password,
		})
		res = await request.post('/user/v1/account/login').send({
			email: email,
			password: password,
		})
		if (res.body.result.access_token && res.body.result.user.id) {
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
				refreshToken: res.body.result.refresh_token,
				userId: res.body.result.user.id,
				email: email,
				password: password,
				name: res.body.result.user.name,
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
