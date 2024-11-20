const commonHelper = require('@commonTests')
// const commonHelper = require('../commonTests')
const schema = require('./responseSchema')

jest.setTimeout(20000)
describe('Config APIs', function () {
	let userDetails
	beforeAll(async () => {
		try {
			userDetails = await commonHelper.verifyUserRole()
			userDetails = await commonHelper.logIn()
			console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})

	it('List Organization and Instance Configurations', async () => {
		let res = await request.get('/scp/v1/config/list')
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
