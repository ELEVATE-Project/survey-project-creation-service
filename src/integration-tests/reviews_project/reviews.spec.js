const commonHelper = require('@commonTests')
// const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(200000)

describe('Review APIs ', function () {
	let userDetails

	beforeAll(async () => {
		try {
			await commonHelper.verifyUserRole()
			userDetails = await commonHelper.logIn()
			// console.log('Logged in User:', userDetails.id, userDetails.roles)
		} catch (error) {
			console.error('Error in beforeAll setup:', error)
			throw error // Ensure the error is thrown to fail the tests
		}
	})
	jest.setTimeout(100000)

	async function getResource(type) {
		const response = await request.get(
			`/scp/v1/resource/upForReview?page=1&limit=5&listing=up_for_review&type=${type}`
		)
		expect(response.statusCode).toBe(200)
		return response.body?.result?.data?.length > 0 ? response.body.result.data[0]?.id : null
	}

	// it('Project Start Review with invalid project id', async () => {
	// 	const res = await request.post('/scp/v1/reviews/start/9999')
	// 	expect(res.statusCode).toBe(400)
	// })

	// it('Project Start Review with valid project id', async () => {
	// 	const projectId = await getResource('project')
	// 	if (projectId) {
	// 		const res = await request.post(`/scp/v1/reviews/start/${projectId}`)
	// 		expect(res.statusCode).toBe(200)
	// 		expect(res.body).toMatchSchema(schema.reviewResponse)
	// 	}
	// })

	// it('Project Requested for a change with invalid project id', async () => {
	// 	const res = await request.post('/scp/v1/reviews/start/9999')
	// 	expect(res.statusCode).toBe(400)
	// })

	// it('Project Request Changes', async () => {
	// 	const projectId = await getResource('project')
	// 	if (projectId) {
	// 		const res = await request.post(`/scp/v1/reviews/update/${projectId}`).send({
	// 			comment: {
	// 				text: 'Check spelling',
	// 				context: 'page',
	// 				page: 1,
	// 			},
	// 		})
	// 		expect(res.statusCode).toBe(200)
	// 		expect(res.body).toMatchSchema(schema.reviewResponse)
	// 	}
	// })

	// it('Reject Project with invalid project id', async () => {
	// 	const res = await request.post('/scp/v1/reviews/rejectOrReport/9999')
	// 	expect(res.statusCode).toBe(400)
	// })

	// it('Project Reject Review', async () => {
	// 	const projectId = await getResource('project')
	// 	if (projectId) {
	// 		//start review
	// 		const startRes = await request.post(`/scp/v1/reviews/start/${projectId}`)
	// 		//reject review
	// 		const res = await request.post(`/scp/v1/reviews/rejectOrReport/${projectId}`)
	// 		expect(res.statusCode).toBe(200)
	// 		expect(res.body).toMatchSchema(schema.reviewResponse)
	// 	}
	// })

	it('Project Approve with invalid project id', async () => {
		const res = await request.post('/scp/v1/reviews/rejectOrReport/9999')
		expect(res.statusCode).toBe(400)
	})

	// it('Project Approve Review with valid data', async () => {
	// 	const projectId = await getResource('project')
	// 	if (projectId) {
	// 		//start review
	// 		const startReview = await request.post(`/scp/v1/reviews/start/${projectId}`)
	// 		//reject review
	// 		const res = await request.post(`/scp/v1/reviews/approve/${projectId}`)
	// 		expect(res.statusCode).toBe(200)
	// 	}
	// })
})
