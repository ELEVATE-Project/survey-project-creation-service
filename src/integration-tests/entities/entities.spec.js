const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Entity APIs', function () {
	let userDetails

	beforeAll(async () => {
		userDetails = await commonHelper.logIn()
	})

	it('Read Entity', async () => {
		const res = await request.post('/scp/v1/entities/read/5')

		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	it('Create Entity', async () => {
		//Get entity type id
		const readEntityType = await request.post('/scp/v1/entity-types/read')
		const entityTypeId = readEntityType?.body?.result[0]?.id
		let res = await request.post('/scp/v1/entities/create').send(createEntityData(entityTypeId))

		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Update Entity', async () => {
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

	it('Delete Entity', async () => {
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
