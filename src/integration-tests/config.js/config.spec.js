const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Config APIs ', function () {
	let userDetails
	beforeAll(async () => {
		// await commonHelper.verifyUserRole()
		userDetails = await commonHelper.logIn()
	})

	it('List Organization and Instance Configurations', async () => {
		let res = await request.get('/scp/v1/config/list')
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
