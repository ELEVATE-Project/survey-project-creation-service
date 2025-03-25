const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
const { faker } = require('@faker-js/faker')
jest.setTimeout(10000)

describe('Module APIs ', function () {
	let userDetails
	let moduleId
	beforeAll(async () => {
		try {
			userDetails = await commonHelper.logIn()
			// console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})
	it('Create module with valid data', async () => {
		let res = await request.post('/scp/v1/modules/create').send({
			code: faker.random.alpha(5),
		})
		expect(res.statusCode).toBe(201)
		moduleId = res?.body?.result?.id
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Create module with invalid data', async () => {
		let res = await request.post('/scp/v1/modules/create').send({
			code: 'observation specific',
		})
		expect(res.statusCode).toBe(400)
	})

	it('Update module with valid id', async () => {
		let res = await request.post('/scp/v1/modules/update/3').send({
			code: 'modules',
		})
		expect(res.statusCode).toBe(202)
		expect(res.body).toMatchSchema(schema.updateSchema)
	})

	it('Update module with invalid id', async () => {
		let res = await request.post('/scp/v1/modules/update/9999').send({
			code: 'modules',
		})

		expect(res.statusCode).toBe(400)
	})

	it('Delete module with invalid id', async () => {
		let res = await request.post('/scp/v1/modules/delete/40')
		expect(res.statusCode).toBe(400)
	})

	it('Delete module with valid id', async () => {
		expect(moduleId).toBeDefined()
		let res = await request.post(`/scp/v1/modules/delete/${moduleId}`)
		expect(res.statusCode).toBe(200)
	})

	it('List modules', async () => {
		let res = await request.get('/scp/v1/modules/list').query({ page: 1, limit: 10, code: 'cw==' })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
