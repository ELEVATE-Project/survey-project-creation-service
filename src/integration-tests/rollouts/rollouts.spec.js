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

	it('Get list of Rollouts', async () => {
		let res = await request.get('/scp/v1/rollouts/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		if (res.body?.result.length == 0) {
			expect(res.body).toMatchSchema(schema.getRolloutsListEmptyResponseSchema)
		}
		expect(res.body).toMatchSchema(schema.getRolloutsListSchema)
	})
	it('Get Rollout Details', async () => {
		let res = await request.get('/scp/v1/rollouts/details/1')
		expect(res.statusCode).toBe(400)
		expect(res.body).toMatchSchema(schema.rolloutDetailResponseSchema)
	})
})

function insertRolloutData(projectId) {
	return {
		title: 'Title',
		resource_id: projectId,
		targeting_criteria: [
			{
				state: '6687b8d38ead9320cf997c65',
				entity_targeting: 'district',
				district: ['671097d667b6747799a761a4'],
				block: ['6710d01167b6747799a7671d'],
				gender: ['male'],
				roles: ['deo'],
			},
		],
		viewers: [23],
		start_date: '2024-10-29T11:35:08.694Z',
		end_date: '2024-11-29T11:36:31.117Z',
	}
}

function insertProjectData() {
	return {
		title: 'Title',
		objective: 'In the vibrant city of Metropolis',
		languages: 'en',
		licenses: ['cc_by_4.0'],
		learning_resources: [],
		categories: ['teachers'],
		recommended_for: ['teachers'],
		tasks: [
			{
				id: '7a8b13fb-c9e1-4296-8abd-8b64b357a128',
				name: 'task with child',
				type: 'content',
				is_mandatory: true,
				sequence_no: 1,
				allow_evidences: false,
				learning_resources: [],
				children: [],
			},
		],
	}
}
