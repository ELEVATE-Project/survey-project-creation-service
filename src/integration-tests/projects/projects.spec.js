const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(200000)

describe('Project APIs ', function () {
	let userDetails
	beforeAll(async () => {
		try {
			jest.setTimeout(30000)
			await commonHelper.verifyUserRole()
			userDetails = await commonHelper.logIn()
			// console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})

	it('List Project with empty data', async () => {
		const res = await request.get('/scp/v1/resource/list?page=1&limit=5&listing=drafts&type=project')
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.emptyListSchema)
	})

	it('Create Project with invalid data', async () => {
		let res = await request.post('/scp/v1/projects/update').send({ objective: 'In the vibrant city of Metropolis' })
		expect(res.statusCode).toBe(400)
	})

	it('Create Project with valid data', async () => {
		let res = await request.post('/scp/v1/projects/update').send(insertProjectData())
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Project Details with valid project id', async () => {
		let createProject = await request.post('/scp/v1/projects/update').send(insertProjectData())
		const projectId = createProject.body?.result?.id
		let res = await request.get('/scp/v1/projects/details/' + projectId)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.detailSchema)
	})

	it('Project Details with invalid id', async () => {
		let res = await request.get('/scp/v1/projects/details/9999')
		expect(res.statusCode).toBe(400)
	})

	it('Reviewer List', async () => {
		const res = await request.get('/scp/v1/projects/reviewerList')
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.reviewerListSchema)
	})

	it('List Project with data', async () => {
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

	it('Submit Project for Review with invalid data ', async () => {
		//delete mandatory key from project req body
		let projectData = insertProjectData()
		delete projectData.categories

		let createProject = await request.post('/scp/v1/projects/update').send(projectData)
		const projectId = createProject.body?.result?.id
		//submit for review
		const res = await request.post('/scp/v1/projects/submitForReview/' + projectId)
		expect(res.statusCode).toBe(400)
	})

	it('Submit Project for Review with valid data ', async () => {
		//create project
		let createProject = await request.post('/scp/v1/projects/update').send(insertProjectData())
		const projectId = createProject.body?.result?.id
		//submit for review
		const res = await request.post('/scp/v1/projects/submitForReview/' + projectId)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.submitProjectSchema)
	})

	it('Delete Project with invalid id', async () => {
		const res = await request.delete('/scp/v1/projects/update/999999')
		expect(res.statusCode).toBe(400)
	})

	it('Delete Project with valid id', async () => {
		let createProject = await request.post('/scp/v1/projects/update').send(insertProjectData())
		const projectId = createProject.body?.result?.id
		const res = await request.delete(`/scp/v1/projects/update/${projectId}`)
		expect(res.statusCode).toBe(202)
	})

	it('Create and Submit 3 Projects for Review', async () => {
		for (let i = 0; i < 3; i++) {
			let createdProject = await request.post('/scp/v1/projects/update').send(insertProjectData())
			const projectResourceId = createdProject.body?.result?.id

			if (projectResourceId) {
				console.log(`Project ${i + 1} created with ID: ${projectResourceId}`)
				let res = await request.post('/scp/v1/projects/submitForReview/' + projectResourceId)
				expect(res.statusCode).toBe(200)
				console.log(`Project ${i + 1} submitted for review.`)
			} else {
				console.error(`Failed to create project ${i + 1}`)
			}
		}
	})
})

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
		recommended_duration: {
			number: '20',
			duration: 'days',
		},
		recommended_for: ['hm'],
		categories: ['teachers'],
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
			},
		],
	}
}
