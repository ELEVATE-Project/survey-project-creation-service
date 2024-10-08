const commonHelper = require('@commonTests')
// const commonHelper = require('../commonTests')
const schema = require('./responseSchema')
const timeOutValue = 20000

describe('Config APIs', function () {
	let userDetails

	beforeAll(async () => {
		// Uncomment this if you need to verify user roles before logging in
		// await commonHelper.verifyUserRole();
		console.log('before login....')
		userDetails = await commonHelper.logIn()
		console.log('after login....') // Log userDetails here
	}, timeOutValue) // Define timeOutValue properly before using it
	jest.setTimeout(timeOutValue)

	it('List Organization and Instance Configurations', async () => {
		let res = await request.get('/scp/v1/config/list')
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
