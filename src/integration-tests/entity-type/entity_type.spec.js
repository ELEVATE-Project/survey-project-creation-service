const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Entity-Type APIs', function () {
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

	it('Read Entity-Type', async () => {
		const res = await request.post('/scp/v1/entity-types/read')

		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	it('Create Entity Type', async () => {
		const res = await request.post('/scp/v1/entity-types/create').send({
			value: 'new_entity_type',
			label: 'New Entity Type',
			type: 'SYSTEM',
			allow_filtering: false,
			data_type: 'STRING',
			has_entities: true,
		})
		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Update Entity-Type', async () => {
		const res = await request.post('/scp/v1/entity-types/update/1').send({
			status: 'ACTIVE',
			data_type: 'STRING',
		})

		expect(res.statusCode).toBe(202)
		expect(res.body).toMatchSchema(schema.updateSchema)
	})

	it('Delete Entity-Type', async () => {
		const res = await request.delete('/scp/v1/entity-types/delete/999')
		expect(res.statusCode).toBe(400)
	})
})
