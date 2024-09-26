const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Form APIs', function () {
	beforeAll(async () => {
		await commonHelper.logIn()
	})

	it('Create Form', async () => {
		let res = await request.post('/scp/v1/form/create').send(insertFormData())

		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Read form', async () => {
		let res = await request.get('/scp/v1/form/read/')

		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.readSchema)
	})

	it('/update', async () => {
		let formData = await request.post('/scp/v1/form/create').send(insertFormData())
		if (formData.meta && formData.meta.formVersion && formData.meta.formVersion.length > 0) {
			let formId = formData.meta.formVersion[0].id
			let res = await request.post('/scp/v1/form/update/' + formId).send(insertFormData())

			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.updateSchema)
		}
	})
})

function insertFormData() {
	let formData = {
		type: faker.random.alpha(5),
		sub_type: faker.random.alpha(5),
		action: faker.random.alpha(5),
		data: {
			template_name: 'defaultTemplate',
			fields: {
				controls: [
					{
						name: 'categories',
						label: 'Select categories',
						value: '',
						class: 'ion-margin',
						type: 'chip',
						position: '',
						disabled: false,
						showSelectAll: true,
						validators: {
							required: true,
						},
					},
				],
			},
		},
	}

	return formData
}
