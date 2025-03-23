const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Form APIs', function () {
	let userDetails

	beforeAll(async () => {
		try {
			userDetails = await commonHelper.logIn()
			// console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})

	it('Create Form with valid data', async () => {
		let res = await request.post('/scp/v1/form/create').send(insertFormData())
		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('Create Form with invalid data', async () => {
		let formData = insertFormData()
		delete formData.type
		let res = await request.post('/scp/v1/form/create').send(formData)
		expect(res.statusCode).toBe(400)
	})

	it('Read All form', async () => {
		let res = await request.get('/scp/v1/form/read/')
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.readSchema)
	})

	it('Read Form with valid form id', async () => {
		let res = await request.get('/scp/v1/form/read/')
		expect(res.statusCode).toBe(200)
		if (res.meta && res.meta.formVersion && res.meta.formVersion.length > 0) {
			let formId = res.meta.formVersion[0].id
			let res = await request.get(`/scp/v1/form/read/${formId}`)
			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.readSchema)
		}
	})

	it('Read form with invalid form id', async () => {
		let res = await request.get('/scp/v1/form/read/9999')
		expect(res.statusCode).toBe(400)
	})

	it('Update form with valid data', async () => {
		let formData = await request.post('/scp/v1/form/create').send(insertFormData())
		if (formData.meta && formData.meta.formVersion && formData.meta.formVersion.length > 0) {
			let formId = formData.meta.formVersion[0].id
			let res = await request.post('/scp/v1/form/update/' + formId).send(insertFormData())

			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.updateSchema)
		}
	})

	it('Update form with invalid form id', async () => {
		let res = await request.post('/scp/v1/form/update/9999').send(insertFormData())
		expect(res.statusCode).toBe(400)
	})

	it('Update form with invalid data', async () => {
		let formData = insertFormData()
		delete formData.type
		let res = await request.post('/scp/v1/form/update/9999').send(formData)
		expect(res.statusCode).toBe(400)
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
