const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(10000)

let projectId
describe('Review APIs ', function () {
	let userDetails
	beforeAll(async () => {
		userDetails = await commonHelper.logIn()
	})

	it('Start Review', async () => {
		const projects = await request.get('/scp/v1/resource/upForReview?page=1&limit=5&listing=up_for_review')
		expect(projects.statusCode).toBe(200)

		if (projects.body?.result?.count > 0) {
			projectId = projects.body.result.data[0].id
			const res = await request.post('/scp/v1/reviews/start/' + projectId)

			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.reviewResponse)
		}
	})

	it('Request Changes', async () => {
		const res = await request.post('/scp/v1/reviews/update/' + projectId).send({
			comment: {
				text: 'Check spelling',
				context: 'page',
				page: 1
			}
		})

		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.reviewResponse)
	})

	it('Reject Review', async () => {
		const res = await request.post('/scp/v1/reviews/rejectOrReport/' + projectId)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.reviewResponse)
	})


})
