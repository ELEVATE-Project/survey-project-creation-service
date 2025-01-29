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
