const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(20000)

describe('Review Stages APIs ', function () {
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

	it('List Review Stages', async () => {
		let res = await request.get('/scp/v1/review-stages/list?resource_type=project').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	it('Update Review Stages with invalid data', async () => {
		let res = await request.put('/scp/v1/review-stages/update/2?organization_code=1').send({
			level: 2,
			resource_type: 'observation',
		})
		expect(res.statusCode).toBe(400)
	})

	it('Update Review Stages with valid data', async () => {
		let res = await request.put('/scp/v1/review-stages/update/2?organization_code=1').send({
			role: 'reviewer',
			level: 2,
			resource_type: 'observation',
		})
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.updateSchema)
	})
})
