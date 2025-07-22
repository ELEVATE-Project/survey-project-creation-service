const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(15000)

describe('Organization APIs', function () {
	let userDetails
	let orgExtensionId
	let resourceType

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

	it('Create Organization Configurations with invalid data', async () => {
		const res = await request.post('/scp/v1/organization-extensions/createConfig').send({
			show_reviewer_list: true,
			min_approval: 2,
			review_type: 'PARALLEL',
		})

		expect(res.statusCode).toBe(400)
	})

	it('Create Organization Configurations with valid data', async () => {
		const res = await request.post('/scp/v1/organization-extensions/createConfig').send({
			show_reviewer_list: true,
			min_approval: 2,
			resource_type: faker.helpers.arrayElement(['project', 'observation', 'survey']),
			review_type: 'PARALLEL',
		})

		if (res.statusCode == 201) {
			orgExtensionId = res?.body?.result?.id
			resourceType = res?.body?.result?.resource_type
			expect(res.body).toMatchSchema(schema.createSchema)
		} else {
			expect(res.body).toMatchSchema(schema.failSchema)
		}
	})

	it('Update Organization Configurations with invalid data', async () => {
		const res = await request.post('/scp/v1/organization-extensions/updateConfig/100').send({
			review_type: 'PARALLEL',
		})

		expect(res.statusCode).toBe(400)
	})

	it('Update Organization Configurations with valid data', async () => {
		expect(orgExtensionId).toBeDefined()
		expect(resourceType).toBeDefined()

		const res = await request
			.post(`/scp/v1/organization-extensions/updateConfig/${orgExtensionId}?resource_type=${resourceType}`)
			.send({
				review_type: 'PARALLEL',
				min_approval: 1,
			})

		expect(res.statusCode).toBe(200)
	})
})
