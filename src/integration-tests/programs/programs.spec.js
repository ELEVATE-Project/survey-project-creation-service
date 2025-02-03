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
			console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})

	it('Create Program', async () => {
		let res = await request.post('/scp/v1/programs/update').send(insertProgramData())
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Program Details', async () => {
		let createProgram = await request.post('/scp/v1/programs/update').send(insertProgramData())
		const programId = createProgram.body?.result?.id
		let res = await request.get('/scp/v1/programs/details/' + programId)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.detailSchema)
	})

	it('Add Resource to program', async () => {
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

	it('Remove Resource from program', async () => {
		let res = await request.post('/scp/v1/programs/removeResources/2').send({
			resource_ids: [5],
		})
		console.log(res.body, 'response remove')
		expect(res.statusCode).toBe(400)
		expect(res.body).toMatchSchema(schema.addOrRemoveResourceFailtureSchema)
	})

	it('Get list of program managers', async () => {
		let res = await request.get('/scp/v1/programs/getProgramManagers').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		if (res.body?.result.length == 0) {
			expect(res.body).toMatchSchema(schema.getProgramManagersEmptyResponseSchema)
		}
		expect(res.body).toMatchSchema(schema.getProgramManagersSchema)
	})

	it('Program Send For Review', async () => {
		let createProgram = await request.post('/scp/v1/programs/update').send(insertProgramData())
		const programId = createProgram.body?.result?.id
		let res = await request.post('/scp/v1/programs/submitForReview/' + programId).send({
			reviewer_ids: [5],
		})
		expect(res.statusCode).toBe(400)
		expect(res.body).toMatchSchema(schema.programSubmitForReview)
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
