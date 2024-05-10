const commonHelper = require('@commonTests')
const schema = require('./responseSchema')

describe('scp/v1/permissions ', function () {
	let userDetails
	beforeAll(async () => {
		let request = defaults(supertest('http://localhost:5001'))
		let opts = {
			resources: [baseURL],
			delay: 10000, // initial delay in ms, default 0
			interval: 1000, // poll interval in ms, default 250ms
			timeout: 80000,
		}
		await waitOn(opts)
		userDetails = await commonHelper.logIn()
	})

	it('/list', async () => {
		let res = await request.get('/scp/v1/permissions/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
