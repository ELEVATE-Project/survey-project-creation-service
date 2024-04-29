const commonHelper = require('@commonTests')
const schema = require('./responseSchema')

describe('scp/v1/permissions ', function () {
	let userDetails
	beforeAll(async () => {
		userDetails = await commonHelper.logIn()
	})
	// it('/create', async () => {
	// 	let res = await request.post('/mentoring/v1/permissions/create').send({
	// 		code: 'edit_session',
	// 		module: 'session_edit',
	// 		request_type: ['WRITE'],
	// 		api_path: 'mentoring/session/edit',
	// 		status: 'ACTIVE',
	// 	})
	// 	//console.log(res.body)
	// 	expect(res.statusCode).toBe(201)
	// 	expect(res.body).toMatchSchema(schema.createSchema)
	// })

	// it('/update', async () => {
	// 	let res = await request.post('/mentoring/v1/permissions/update/19').send({
	// 		code: 'edit_session',
	// 		module: 'session_edit',
	// 		request_type: ['READ'],
	// 		api_path: 'mentoring/session/edit',
	// 		status: 'ACTIVE',
	// 	})
	// 	//console.log(res.body)
	// 	expect(res.statusCode).toBe(201)
	// 	expect(res.body).toMatchSchema(schema.updateSchema)
	// })

	it('/list', async () => {
		let res = await request.get('/scp/v1/permissions/list').query({ page: 1, limit: 10 })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})

	// it('/delete', async () => {
	// 	let res = await request.post('/mentoring/v1/permissions/delete/19')
	// 	//console.log(res.body)
	// 	expect(res.statusCode).toBe(202)
	// 	expect(res.body).toMatchSchema(schema.deleteSchema)
	// })
})
