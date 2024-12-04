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
		const createProject = await request.post('/scp/v1/projects/update').send(insertProjectData())
		const projectId = createProject.result
		await request.post('/scp/v1/projects/submitForReview/' + projectId)
		reviewUser = await commonHelper.logIn()
		await request.post('/scp/v1/reviews/start/' + projectId)
		await request.post('/scp/v1/reviews/approve/' + projectId)
		const createRollout = await request.post('/scp/v1/rollouts/update').send(insertRolloutData(projectId))
		let res = await request.get('/scp/v1/rollouts/details/' + createRollout?.result?.id)
		console.log('-=-=-=-=-=-=-=-=-=-=>> ', res.body)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.rolloutDetailResponseSchema)
	})
})

function insertRolloutData(projectId) {
	return {
		title: faker.random.alpha(5),
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
		title: faker.random.alpha(5),
		objective: 'In the vibrant city of Metropolis',
		languages: 'en',
		licenses: ['cc_by_4.0'],
		learning_resources: [
			{
				name: 'sample doc',
				url: 'http://test.com',
			},
		],
		tasks: [
			{
				id: '7a8b13fb-c9e1-4296-8abd-8b64b357a128',
				name: 'task with child',
				type: 'content',
				is_mandatory: true,
				sequence_no: 1,
				allow_evidences: false,
				learning_resources: [
					{
						name: 'sample doc',
						url: 'http://test.com',
					},
				],
				children: [
					{
						name: 'child task',
						type: 'simple',
						id: '7a8b13fb-c9e1-4296-aa37-d95f58b1bf1a',
						parent_id: '8f63493a-42aa-4137-aa37-d95f58b1bf1a',
						sequence_no: 1,
					},
				],
			},
			{
				id: 'db3ecd06-29d6-4d7e-b720-e8a85385e10a',
				name: 'task without observation solution',
				type: 'content',
				is_mandatory: true,
				sequence_no: 1,
				allow_evidences: false,
				learning_resources: [
					{
						name: 'sample doc',
						url: 'http://test.com',
					},
				],
				solution_details: {
					name: 'sample observation',
					min_no_of_submissions_required: 2,
					type: 'observation',
					link: 'https://dev.elevate-ml.shikshalokam.org/view/observation/beb6e72ad73a097b9d7910e45a613431',
				},
			},
		],
	}
}
