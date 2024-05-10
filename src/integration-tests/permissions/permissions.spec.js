const commonHelper = require('@commonTests')
const schema = require('./responseSchema')

describe('scp/v1/permissions ', function () {
	let userDetails
	beforeAll(async () => {
		jest.setTimeout(10000)
		userDetails = await commonHelper.logIn()
	})

	it('/list', async () => {
		let res = await request.get('/scp/v1/permissions/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
