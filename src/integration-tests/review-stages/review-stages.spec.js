const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(20000)

describe('Review Stages APIs ', function () {
	let userDetails
	beforeAll(async () => {
		await commonHelper.verifyUserRole()
		userDetails = await commonHelper.logIn()
	})

	it('List Review Stages', async () => {
		let res = await request.get('/scp/v1/review-stages/list?resource_type=project').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	it('Update Review Stages', async () => {
		let res = await request.put('/scp/v1/review-stages/update/2?organization_id=1').send({
			role: 'reviewer',
			level: 2,
			resource_type: 'observation',
		})
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.updateSchema)
	})
})
