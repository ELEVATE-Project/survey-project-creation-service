const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Certificate APIs ', function () {
	let userDetails
	beforeAll(async () => {
		try {
			userDetails = await commonHelper.logIn()
			// console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})
	it('List Certificate Templates', async () => {
		let res = await request.get('/scp/v1/certificates/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
