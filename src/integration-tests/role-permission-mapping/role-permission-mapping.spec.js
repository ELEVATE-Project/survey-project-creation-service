const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(20000)

describe('Role permission Mapping APIs', function () {
	let userDetails
	let rolePermissionMappingId

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

	it('Get list of role permissions', async () => {
		let res = await request.get('/scp/v1/role-permission-mapping/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	it('Create role permission mapping with valid data', async () => {
		let res = await request.post('/scp/v1/role-permission-mapping/create').send({
			role_title: 'reviewer',
			permission_id: 1,
		})
		expect(res.statusCode).toBe(201)
		rolePermissionMappingId = res?.body?.result?.id
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Create role permission mapping with invalid data', async () => {
		let res = await request.post('/scp/v1/role-permission-mapping/create').send({
			role_title: 'reviewer',
		})
		expect(res.statusCode).toBe(400)
	})

	it('Delete role permission with invalid data', async () => {
		let res = await request.post('/scp/v1/role-permission-mapping/delete/500').send({
			permission_id: 9999,
		})
		expect(res.statusCode).toBe(400)
	})

	it('Delete role permission with valid data', async () => {
		let res = await request.post(`/scp/v1/role-permission-mapping/delete/${rolePermissionMappingId}`).send({
			permission_id: 1,
			role_title: 'reviewer',
		})
		expect(res.statusCode).toBe(200)
	})
})
