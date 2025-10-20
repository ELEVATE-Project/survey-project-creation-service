const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
const { faker } = require('@faker-js/faker')
jest.setTimeout(20000)

describe('Entity-Type APIs', function () {
	let userDetails
	let entityTypeId

	beforeAll(async () => {
		try {
			jest.setTimeout(30000)
			userDetails = await commonHelper.logIn()
			// console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})

	it('Read Entity-Type', async () => {
		const res = await request.post('/scp/v1/entity-types/read')
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	it('Create an Entity Type with valid data', async () => {
		const res = await request.post('/scp/v1/entity-types/create').send({
			value: faker.random.alpha(5),
			label: 'New Entity Type',
			type: 'SYSTEM',
			allow_filtering: false,
			data_type: 'STRING',
			has_entities: true,
		})
		expect(res.statusCode).toBe(201)
		entityTypeId = res?.body?.result?.id
		expect(entityTypeId).toBeDefined()
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Create an Entity Type with invalid data', async () => {
		const res = await request.post('/scp/v1/entity-types/create').send({
			label: 'New Entity Type',
			type: 'SYSTEM',
			allow_filtering: false,
			data_type: 'STRING',
			has_entities: true,
		})
		expect(res.statusCode).toBe(400)
	})

	it('Update Entity-Type using a valid ID', async () => {
		const res = await request.post('/scp/v1/entity-types/update/1').send({
			status: 'ACTIVE',
			data_type: 'STRING',
		})

		expect(res.statusCode).toBe(202)
		expect(res.body).toMatchSchema(schema.updateSchema)
	})

	it('Update an Entity Type with an invalid ID', async () => {
		const res = await request.post('/scp/v1/entity-types/update/9999').send({
			status: 'ACTIVE',
			data_type: 'STRING',
		})

		expect(res.statusCode).toBe(400)
	})

	it('Delete an Entity Type with an invalid ID', async () => {
		const res = await request.delete('/scp/v1/entity-types/delete/999')
		expect(res.statusCode).toBe(400)
	})

	it('Delete an Entity Type with a valid ID', async () => {
		expect(entityTypeId).toBeDefined() // Ensure it exists before using
		const res = await request.delete(`/scp/v1/entity-types/delete/${entityTypeId}`)
		expect(res.statusCode).toBe(202)
		console.log(`Successfully deleted entityTypeId: ${entityTypeId}`)
	})

	it('Get observable entityType', async () => {
		const res = await request.get(`/scp/v1/entity-types/getObservableEntityTypes`)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.observableSchema)
	})
})
