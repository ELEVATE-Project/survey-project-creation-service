const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Organization APIs', function () {
	let userDetails

	beforeAll(async () => {
		userDetails = await commonHelper.logIn()
	})

	it('Create Organization Configurations', async () => {
		const res = await request.post('/scp/v1/organization-extensions/createConfig').send({
			show_reviewer_list: true,
			min_approval: 1,
			resource_type: faker.helpers.arrayElement(['project', 'observation', 'survey']),
			review_type: 'PARALLEL',
		})

		if (res.statusCode == 201) {
			expect(res.body).toMatchSchema(schema.createSchema)
		} else {
			expect(res.body).toMatchSchema(schema.failSchema)
		}
	})
})
