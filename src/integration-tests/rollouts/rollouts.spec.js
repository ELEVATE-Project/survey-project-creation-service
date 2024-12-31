const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
const { faker } = require('@faker-js/faker')
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

	it('Create Rollout', async () => {
		let res = await request.post('/scp/v1/rollouts/update').send(insertRolloutData())
		expect(res.statusCode).toBe(400)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Get list of Rollouts', async () => {
		let res = await request.get('/scp/v1/rollouts/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		if (res.body?.result.length == 0) {
			expect(res.body).toMatchSchema(schema.listEmptyResponseSchema)
		}
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	it('Get Rollout Details', async () => {
		let res = await request.get('/scp/v1/rollouts/details/1')
		expect(res.statusCode).toBe(400)
		expect(res.body).toMatchSchema(schema.detailResponseSchema)
	})

	it('Delete Rollout', async () => {
		const res = await request.delete('/scp/v1/rollouts/update/999999')
		expect(res.statusCode).toBe(400)
	})

	it('Publish Rollout', async () => {
		let res = await request.get('/scp/v1/rollouts/publish/1').send()
		expect(res.statusCode).toBe(400)
		expect(res.body).toMatchSchema(schema.createSchema)
	})
})

function insertRolloutData(resource_id) {
	return {
		title: faker.random.alpha(5),
		resource_id: resource_id,
		start_date: '2024-11-29T11:36:31.117Z',
		end_date: '2024-12-30T11:36:31.117Z',
	}
}
