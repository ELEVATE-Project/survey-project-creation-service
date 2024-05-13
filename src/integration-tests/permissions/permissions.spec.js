const commonHelper = require('@commonTests')
const schema = require('./responseSchema')

describe('scp/v1/permissions ', function () {
	let userDetails
	beforeAll(async () => {
		console.log('============>', 1)
		userDetails = await commonHelper.logIn()
		console.log('============> 2 : ', userDetails)
		jest.setTimeout(10000)
	})

	it('/list', async () => {
		let res = await request.get('/scp/v1/permissions/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
