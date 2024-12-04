const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(20000)

describe('Rollout APIs', function () {
	let userDetails

	beforeAll(async () => {
		try {
			await commonHelper.verifyUserRole()
			userDetails = await commonHelper.logIn()
			console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})

	it('Get list of data managers list', async () => {
		let res = await request.get('/scp/v1/rollouts/getDataManagers').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		if (res.body?.result.length == 0) {
			expect(res.body).toMatchSchema(schema.getDataManagersEmptyResponseSchema)
		}
		expect(res.body).toMatchSchema(schema.getDataManagersSchema)
	})

	it('Get list of Rollouts', async () => {
		let res = await request.get('/scp/v1/rollouts/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		if (res.body?.result.length == 0) {
			expect(res.body).toMatchSchema(schema.getRolloutsListEmptyResponseSchema)
		}
		expect(res.body).toMatchSchema(schema.getRolloutsListSchema)
	})
})
