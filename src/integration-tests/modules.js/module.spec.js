const commonHelper = require('@commonTests')
const schema = require('./responseSchema')
jest.setTimeout(20000)

describe('Module APIs ', function () {
	let userDetails
	beforeAll(async () => {
		userDetails = await commonHelper.logIn()
	})
	it('/create', async () => {
		let res = await request.post('/scp/v1/modules/create').send({
			code: 'observation_specific',
		})
		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.createSchema)
	})

	it('/update', async () => {
		let res = await request.post('/scp/v1/modules/update/3').send({
			code: 'modules',
		})
		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.updateSchema)
	})

	it('/delete', async () => {
		let res = await request.post('/scp/v1/modules/delete/40')
		expect(res.statusCode).toBe(400)
	})

	it('/list', async () => {
		let res = await request.get('/scp/v1/modules/list').query({ page: 1, limit: 10, code: 'cw==' })
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.listSchema)
	})
})
