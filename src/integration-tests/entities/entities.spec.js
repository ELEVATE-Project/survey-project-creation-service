const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Entity APIs', function () {
	let userDetails
	let entityId

	beforeAll(async () => {
		try {
			userDetails = await commonHelper.logIn()
			console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})

	it('Read Entity with valid entity id', async () => {
		const res = await request.post('/scp/v1/entities/read/5')

		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	it('Attempt to Read Entity with a Non-Existent Entity ID', async () => {
		const res = await request.post('/scp/v1/entities/read/9999')
		expect(res.statusCode).toBe(400)
	})

	it('Create Entity with valid data', async () => {
		//Get entity type id
		const readEntityType = await request.post('/scp/v1/entity-types/read')
		const entityTypeId = readEntityType?.body?.result[0]?.id
		let res = await request.post('/scp/v1/entities/create').send(createEntityData(entityTypeId))
		entityId = res.result.id
		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Create Entity with not existing entity type', async () => {
		const entityTypeId = 9999
		let res = await request.post('/scp/v1/entities/create').send(createEntityData(entityTypeId))
		expect(res.statusCode).toBe(400)
	})

	it('Update Entity with valid data', async () => {
		//Get entity type id
		const readEntityType = await request.post('/scp/v1/entity-types/read')
		const entityTypeId = readEntityType?.body?.result[0]?.id

		//Get Entity id
		let createdEntity = await request.post('/scp/v1/entities/create').send(createEntityData(entityTypeId))

		const entityId = createdEntity.body?.result?.id
		const res = await request.post('/scp/v1/entities/update/' + entityId).send({
			status: 'ACTIVE',
		})

		expect(res.statusCode).toBe(202)
		expect(res.body).toMatchSchema(schema.updateSchema)
	})

	it('Update Entity with invalid data', async () => {
		const res = await request.post('/scp/v1/entities/update/9999').send({
			status: 'ACTIVE',
		})

		expect(res.statusCode).toBe(400)
	})

	if (entityId) {
		it('Delete Entity with valid id ', async () => {
			const res = await request.delete('/scp/v1/entities/delete/' + entityId)
			expect(res.statusCode).toBe(200)
		})
	}
	it('Delete Entity with invalid entity id ', async () => {
		const res = await request.delete('/scp/v1/entities/delete/999')
		expect(res.statusCode).toBe(400)
	})
})

function createEntityData(entityTypeId) {
	return {
		value: faker.random.alpha(5),
		label: faker.random.alpha(5),
		type: 'SYSTEM',
		entity_type_id: entityTypeId,
	}
}
