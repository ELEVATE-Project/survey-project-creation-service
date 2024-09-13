const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Certificate APIs ', function () {
	let userDetails
	beforeAll(async () => {
		userDetails = await commonHelper.logIn()
	})

	it('List Certificate Templates', async () => {
		let res = await request.get('/scp/v1/certificates/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
