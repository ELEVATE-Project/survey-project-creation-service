const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(200000)

describe('Review APIs ', function () {
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
	jest.setTimeout(100000)

	async function getResource(type) {
		const response = await request.get(
			`/scp/v1/resource/upForReview?page=1&limit=5&listing=up_for_review&type=${type}`
		)
		expect(response.statusCode).toBe(200)
		return response.body?.result?.data?.length > 0 ? response.body.result.data[0]?.id : null
	}

	it('Create Project', async () => {
		userDetails = await commonHelper.logIn()
		await request.post('/scp/v1/projects/update').send(insertProjectData())
	})

	it('Project Start Review', async () => {
		const projectId = await getResource('project')
		if (projectId) {
			const res = await request.post(`/scp/v1/reviews/start/${projectId}`)
			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.reviewResponse)
		}
	})

	it('Project Request Changes', async () => {
		const projectId = await getResource('project')
		if (projectId) {
			const res = await request.post(`/scp/v1/reviews/update/${projectId}`).send({
				comment: {
					text: 'Check spelling',
					context: 'page',
					page: 1,
				},
			})
			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.reviewResponse)
		}
	})

	it('Project Reject Review', async () => {
		const projectId = await getResource('project')
		if (projectId) {
			const res = await request.post(`/scp/v1/reviews/rejectOrReport/${projectId}`)
			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.reviewResponse)
		}
	})

	it('Create Program', async () => {
		userDetails = await commonHelper.logIn()
		await request.post('/scp/v1/programs/update').send(insertProgramData())
	})

	it('Program Start Review', async () => {
		const programId = await getResource('program')
		if (programId) {
			const res = await request.post(`/scp/v1/reviews/start/${programId}`)
			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.reviewResponse)
		}
	})

	it('Program Request Changes', async () => {
		const programId = await getResource('program')
		if (programId) {
			const res = await request.post('/scp/v1/reviews/update/' + programId).send({
				comment: {
					text: 'Check alignment',
					context: 'section',
					section: 2,
				},
			})

			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.reviewResponse)
		}
	})

	it('Program Reject Review', async () => {
		const programId = await getResource('program')
		if (programId) {
			const res = await request.post('/scp/v1/reviews/rejectOrReport/' + programId)

			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.reviewResponse)
		}
	})
})

function insertProgramData() {
	return {
		title: faker.random.alpha(5),
		objective: 'Education Leadership forum',
		licenses: ['cc_by_4.0'],
		start_date: '2024-10-29T11:35:08.694Z',
		end_date: '2024-11-29T11:36:31.117Z',
		keywords: ['teacher', 'leader'],
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
