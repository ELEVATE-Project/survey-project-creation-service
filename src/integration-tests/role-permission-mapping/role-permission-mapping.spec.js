const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(20000)

describe('Role permission Mapping APIs', function () {
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

	it('Get list of role permissions', async () => {
		let res = await request.get('/scp/v1/role-permission-mapping/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	it('/create', async () => {
		let res = await request.post('/scp/v1/role-permission-mapping/create').send({
			role_title: 'reviewer',
			permission_id: 1,
		})
		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('/delete', async () => {
		let res = await request.post('/scp/v1/role-permission-mapping/delete/500').send({
			permission_id: 1,
		})
		expect(res.statusCode).toBe(400)
	})
})
