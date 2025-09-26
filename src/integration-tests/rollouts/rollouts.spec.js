const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
const { faker } = require('@faker-js/faker')
jest.setTimeout(30000)

describe('Rollout APIs', function () {
	let userDetails

	beforeAll(async () => {
		try {
			jest.setTimeout(30000)
			await commonHelper.verifyUserRole()
			userDetails = await commonHelper.logIn()
			// await commonHelper.triggerViewRebuild() // view is not using in user service now

			// console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})

	async function getResource() {
		const response = await request.get(
			'/scp/v1/resource/getPublishedResources?page=1&limit=5&type=project&listing=browse_existing'
		)
		expect(response.statusCode).toBe(200)
		return response.body?.result?.data?.length > 0 ? response.body.result.data[0]?.id : null
	}

	/** Create a rollout */
	async function createRollout() {
		const resourceId = await getResource()
		if (!resourceId) throw new Error('Failed to get resource')

		const rolloutData = { ...insertRolloutData(), resource_id: resourceId }
		const response = await request.post('/scp/v1/rollouts/update').send(rolloutData)

		expect(response.statusCode).toBe(200)
		expect(response.body).toMatchSchema(schema.createSchema)
		return response.body?.result?.id
	}

	it('Get list of data managers list', async () => {
		let res = await request.get('/scp/v1/rollouts/getDataManagers').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		if (res.body?.result.length == 0) {
			expect(res.body).toMatchSchema(schema.getDataManagersEmptyResponseSchema)
		}
		expect(res.body).toMatchSchema(schema.getDataManagersSchema)
	})

	it('Create Rollout with invalid data', async () => {
		let res = await request.post('/scp/v1/rollouts/update').send({
			targeting_criteria: [],
		})
		expect(res.body.responseCode).toBe('CLIENT_ERROR')
	})

	it('Create Rollout with valid data', async () => {
		await createRollout()
	})

	it('Get list of Rollouts', async () => {
		let res = await request.get('/scp/v1/rollouts/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(res.body?.result.length ? schema.listSchema : schema.listEmptyResponseSchema)
	})

	it('Get Rollout Details with invalid id', async () => {
		let res = await request.get('/scp/v1/rollouts/details/999')
		expect(res.statusCode).toBe(400)
	})

	it('Get Rollout Details with valid id', async () => {
		const rolloutId = await createRollout()
		const res = await request.get(`/scp/v1/rollouts/details/${rolloutId}`)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.detailResponseSchema)
	})

	it('Delete Rollout with invalid rollout id', async () => {
		const res = await request.delete('/scp/v1/rollouts/update/999999')
		expect(res.statusCode).toBe(400)
	})

	it('Delete Rollout with valid rollout id', async () => {
		const rolloutId = await createRollout()
		const res = await request.delete(`/scp/v1/rollouts/update/${rolloutId}`)
		expect(res.statusCode).toBe(202)
	})

	it('Publish Rollout with invalid rollout id', async () => {
		let res = await request.get('/scp/v1/rollouts/publish/9999').send()
		expect(res.statusCode).toBe(400)
	})

	it('Publish Rollout with valid rollout id', async () => {
		// let viewBuildRes = await commonHelper.triggerViewRebuild()
		// if (!viewBuildRes.success) {
		// 	console.warn(JSON.stringify(viewBuildRes.error, null, 2), 'View rebuild failed')
		// }

		const rolloutId = await createRollout()
		if (rolloutId) {
			const res = await request.get(`/scp/v1/rollouts/publish/${rolloutId}`)
			// console.log(JSON.stringify(res.body, null, 2), 'res')
			expect(res.statusCode).toBe(202)
		} else {
			console.warn('No rollout found to publish')
		}
	})
})

function insertRolloutData() {
	const startDate = new Date() // Today's date
	const endDate = new Date()
	endDate.setDate(startDate.getDate() + 10) // Add 10 days
	return {
		title: faker.random.alpha(5),
		start_date: startDate.toISOString(), // Convert to ISO format
		end_date: endDate.toISOString(), // Convert to ISO format
		viewers: [5],
		targeting_criteria: [
			{
				state: [
					{
						_id: '665d8df5c6892808846230e7',
						name: 'Karnataka',
						externalId: 'hsjj',
					},
				],
				entity_targeting: {
					_id: 'cluster',
					value: 'cluster',
					name: 'cluster',
				},
				roles: [
					{
						_id: '66b5ef9f3b7efb9f52488082',
						value: '18',
						label: 'Block Education Officer',
						code: 'block_education_officer',
					},
					{
						_id: '66b5efab7c530d9f5c8acb50',
						value: '19',
						label: 'Block Academic Coordinator',
						code: 'block_academic_coordinator',
					},
				],
				cluster: [
					{
						_id: '6682424ba845ef3e891daee1',
						externalId: 'enfffh3',
						cluster: 'Jayanagar',
						block: 'Bangalore South ',
						district: 'Chennai ',
					},
					{
						_id: '6682426ba845ef3e891daee4',
						externalId: 'enfflfh3',
						cluster: 'JP nagar',
						block: 'Bangalore South ',
						district: 'Chennai ',
					},
				],
				label: 'Karnataka - cluster (2)',
			},
		],
	}
}
