const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
// let baseURL = 'http://localhost:5001';
jest.setTimeout(10000)

describe('scp/v1/permissions', function () {
	let userDetails
	beforeAll(async () => {
		userDetails = await commonHelper.logIn()
		console.log('============> 2 : ', userDetails)
	})

	it('/list', async () => {
		let res = await request.get('/scp/v1/permissions/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
