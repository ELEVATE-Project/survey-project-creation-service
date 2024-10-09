const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(200000)

describe('Project APIs ', function () {
	let userDetails
	beforeAll(async () => {
		// await commonHelper.verifyUserRole()
		userDetails = await commonHelper.logIn()
		console.log(userDetails)
	})

	it('Create Project', async () => {
		let res = await request.post('/scp/v1/projects/update').send(insertProjectData())
		console.log('-=-=-=-=-=-=-=-=====>> ', res.body)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Delete Project', async () => {
		const res = await request.delete('/scp/v1/projects/update/999999')
		expect(res.statusCode).toBe(400)
	})

	it('Project Details', async () => {
		let createProject = await request.post('/scp/v1/projects/update').send(insertProjectData())
		const projectId = createProject.body?.result?.id
		let res = await request.get('/scp/v1/projects/details/' + projectId)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.detailSchema)
	})

	it('Reviewer List', async () => {
		const res = await request.get('/scp/v1/projects/reviewerList')
		expect(res.statusCode).toBe(200)
	})

	it('List Project', async () => {
		//create project
		let createProject = await request.post('/scp/v1/projects/update').send(insertProjectData())
		const res = await request.get('/scp/v1/resource/list?page=1&limit=5&listing=drafts')
		expect(res.statusCode).toBe(200)
		if (createProject.body?.result?.id) {
			expect(res.body).toMatchSchema(schema.listSchema)
		} else {
			expect(res.body).toMatchSchema(schema.emptyListSchema)
		}
	})

	it('Submit Project for Review', async () => {
		//create project
		let createProject = await request.post('/scp/v1/projects/update').send(insertProjectData())
		const projectId = createProject.body?.result?.id
		const res = await request.post('/scp/v1/projects/submitForReview/' + projectId)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.submitProjectSchema)
	})
})

function insertProjectData() {
	return {
		title: faker.random.alpha(5),
		objective: 'In the vibrant city of Metropolis',
		recommended_for: ['teachers', 'ht'],
		languages: 'en',
		categories: 'school_process',
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
