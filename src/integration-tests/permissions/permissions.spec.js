const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Permission Apis', function () {
	let userDetails

	beforeAll(async () => {
		try {
			userDetails = await commonHelper.logIn()
			console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})

	it('List user permissions', async () => {
		let res = await request.get('/scp/v1/permissions/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	it('Get list of all permissions', async () => {
		let res = await request.get('/scp/v1/permissions/getPermissions').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.getPermissionSchema)
	})

	it('Create permission', async () => {
		let res = await request.post('/scp/v1/permissions/create').send({
			code: 'create_observations',
			module: 'observation_specific',
			request_type: ['POST'],
			api_path: '/scp/v1/observation/create',
			status: 'ACTIVE',
		})
		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Update permission', async () => {
		let res = await request.post('/scp/v1/permissions/update/1').send({
			code: 'get_signedurl_permissions',
			module: 'cloud-services',
			request_type: ['POST', 'GET'],
			api_path: '/scp/v1/cloud-services/getSignedUrl',
			status: 'ACTIVE',
		})
		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.updateSchema)
	})

	it('Delete permission', async () => {
		let res = await request.post('/scp/v1/permissions/delete/100')
		expect(res.statusCode).toBe(500)
	})
})
