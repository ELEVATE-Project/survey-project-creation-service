const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(200000)

describe('Program APIs ', function () {
	let userDetails
	beforeAll(async () => {
		try {
			await commonHelper.verifyUserRole()
			userDetails = await commonHelper.logIn()
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
		console.log(response.body, 'getResource line no 24')
		return response.body?.result?.data?.length > 0 ? response.body.result.data[0]?.id : null
	}

	it('Create Program with invalid data', async () => {
		let res = await request.post('/scp/v1/programs/update').send({
			objective: 'Education Leadership forum',
		})
		expect(res.statusCode).toBe(400)
	})

	it('Create Program with valid data', async () => {
		let res = await request.post('/scp/v1/programs/update').send(insertProgramData())
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Program Details with invalid program id', async () => {
		let res = await request.get('/scp/v1/programs/details/9999')
		expect(res.statusCode).toBe(400)
	})

	it('Program Details with valid program id', async () => {
		let createProgram = await request.post('/scp/v1/programs/update').send(insertProgramData())
		const programId = createProgram.body?.result?.id
		let res = await request.get('/scp/v1/programs/details/' + programId)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.detailSchema)
	})

	it('Add Resource to program with invalid data', async () => {
		let addResourceRes = await request.post('/scp/v1/programs/addResources/9999').send({
			resource_ids: [999],
		})
		expect(addResourceRes.statusCode).toBe(400)
	})

	it('Add Resource to program with valid data', async () => {
		const res = await request.get('/scp/v1/resource/getPublishedResources?page=1&limit=5')
		if (res?.body?.result?.data?.length > 0) {
			let createProgram = await request.post('/scp/v1/programs/update').send(insertProgramData())
			const programId = createProgram.body?.result?.id
			let addResourceRes = await request.post('/scp/v1/programs/addResources/' + programId).send({
				resource_ids: [res.body.result.data[0]],
			})
			expect(addResourceRes.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.addOrRemoveResourceSchema)
		}
	})

	it('Remove Resource from program with invalid data', async () => {
		let addResourceRes = await request.post('/scp/v1/programs/removeResources/9999').send({
			resource_ids: [999],
		})
		expect(addResourceRes.statusCode).toBe(400)
	})

	it('Remove Resource from program with valid data', async () => {
		let createProgram = await request.post('/scp/v1/programs/update').send(insertProgramData())
		const programId = createProgram.body?.result?.id
		let removeResources = await request.post('/scp/v1/programs/removeResources/' + programId).send({
			resource_ids: [programId],
		})

		expect(removeResources.statusCode).toBe(400)
		expect(removeResources.body).toMatchSchema(schema.addOrRemoveResourceFailtureSchema)
	})

	it('Delete Program with invalid program id', async () => {
		const deleteRes = await request.delete('/scp/v1/programs/update/9999')
		expect(deleteRes.statusCode).toBe(400)
	})

	it('Delete Program with valid program id', async () => {
		let createProgram = await request.post('/scp/v1/programs/update').send(insertProgramData())
		const programId = createProgram.body?.result?.id
		const deleteRes = await request.delete('/scp/v1/programs/update/' + programId)
		expect(deleteRes.statusCode).toBe(202)
	})

	it('Get list of program managers', async () => {
		let res = await request.get('/scp/v1/programs/getProgramManagers').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		if (res.body?.result.length == 0) {
			expect(res.body).toMatchSchema(schema.getProgramManagersEmptyResponseSchema)
		}
		expect(res.body).toMatchSchema(schema.getProgramManagersSchema)
	})

	it('Reviewer List', async () => {
		const res = await request.get('/scp/v1/programs/reviewerList')
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.reviewerListSchema)
	})

	it('Program Send For Review with invalid data', async () => {
		let programData = insertProgramData()
		delete programData.objective

		let createProgram = await request.post('/scp/v1/programs/update').send(programData)
		const programId = createProgram.body?.result?.id
		let res = await request.post('/scp/v1/programs/submitForReview/' + programId).send({})
		expect(res.statusCode).toBe(400)
	})

	jest.setTimeout(120000)
	it('Program Send For Review with valid data', async () => {
		let viewersRes = await request.get('/scp/v1/programs/getProgramManagers').query({ page: 1, limit: 10 })
		let viewers = [viewersRes?.body?.result?.data[0]?.id] || []
		if (viewers.length === 0) throw new Error('No viewers found')

		await new Promise((resolve) => setTimeout(resolve, 2000)) // Add delay

		let programData = insertProgramData()
		programData.viewers = viewers

		let createProgram = await request.post('/scp/v1/programs/update').send(programData)
		const programId = createProgram.body?.result?.id || null
		if (!programId) throw new Error('Failed to create program')

		let resourceId = await getResource()
		if (!resourceId) throw new Error('Failed to get resource')

		await new Promise((resolve) => setTimeout(resolve, 2000)) // Add delay

		let addResourceRes = await request.post(`/scp/v1/programs/addResources/${programId}`).send({
			resource_ids: [resourceId],
		})

		await new Promise((resolve) => setTimeout(resolve, 5000)) // Add delay

		let res = await request.post(`/scp/v1/programs/submitForReview/${programId}`).send({})
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.programSubmitForReview)
	})
})

function insertProgramData() {
	const startDate = new Date() // Today's date
	const endDate = new Date()
	endDate.setDate(startDate.getDate() + 10) // Add 10 days
	return {
		title: faker.random.alpha(5),
		objective: 'Education Leadership forum',
		licenses: ['cc_by_4.0'],
		start_date: startDate.toISOString(), // Convert to ISO format
		end_date: endDate.toISOString(), // Convert to ISO format
		keywords: 'teacher',
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
