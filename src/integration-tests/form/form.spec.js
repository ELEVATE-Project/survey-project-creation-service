
const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(10000)

describe('Form APIs', function () {
	beforeAll(async () => {
		await commonHelper.logIn()
	})
	it('/create', async () => {
		let res = await request.post('/scp/v1/form/create').send({
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
		})
		console.log(JSON.stringify(res.body, null, 2))
		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.createSchema)


	})

	it('/read', async () => {
		let res = await request.get('/scp/v1/form/read/' + formId)

		//console.log(res.body)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.readSchema)
	})
	// it('/update', async () => {
	// 	let entityId = await formData.insertForm()
	// 	let res = await request.post('/mentoring/v1/form/update/' + entityId).send({
	// 		type: faker.random.alpha(5),
	// 		subType: faker.random.alpha(5),
	// 		action: faker.random.alpha(5),
	// 		data: {
	// 			templateName: 'defaultTemplate',
	// 			fields: {
	// 				controls: [
	// 					{
	// 						name: 'categories',
	// 						label: 'Select categories',
	// 						value: '',
	// 						class: 'ion-margin',
	// 						type: 'chip',
	// 						position: '',
	// 						disabled: false,
	// 						showSelectAll: true,
	// 						validators: {
	// 							required: true,
	// 						},
	// 					},
	// 				],
	// 			},
	// 		},
	// 	})
	// 	//console.log(res.body)
	// 	expect(res.statusCode).toBe(202)
	// 	expect(res.body).toMatchSchema(schema.updateSchema)
	// })
})
