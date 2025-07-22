const commonHelper = require('@commonTests')
const { faker } = require('@faker-js/faker')
const schema = require('./responseSchema')
jest.setTimeout(200000)

describe('Review APIs ', function () {
	let userDetails

	beforeAll(async () => {
		try {
			jest.setTimeout(30000)
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

	it('Program Start Review with invalid program id', async () => {
		const res = await request.post('/scp/v1/reviews/start/9999')
		expect(res.statusCode).toBe(400)
	})

	it('Program Start Review with valid project id', async () => {
		const programId = await getResource('program')
		if (programId) {
			const res = await request.post(`/scp/v1/reviews/start/${programId}`)
			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.reviewResponse)
		}
	})

	it('Program Requested for a change with invalid program id', async () => {
		const res = await request.post('/scp/v1/reviews/start/9999')
		expect(res.statusCode).toBe(400)
	})

	it('Program Request Changes', async () => {
		const programId = await getResource('program')
		if (programId) {
			const res = await request.post(`/scp/v1/reviews/update/${programId}`).send({
				comment: {
					text: 'Check spelling',
					context: 'page',
					page: 1,
				},
			})
			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.reviewResponse)
		}
	})

	it('Reject Program with invalid program id', async () => {
		const res = await request.post('/scp/v1/reviews/rejectOrReport/9999')
		expect(res.statusCode).toBe(400)
	})

	it('Program Reject Review with valid data', async () => {
		const programId = await getResource('program')
		if (programId) {
			//start review
			const startRes = await request.post(`/scp/v1/reviews/start/${programId}`)
			//reject review
			const res = await request.post(`/scp/v1/reviews/rejectOrReport/${programId}`)
			expect(res.statusCode).toBe(200)
			expect(res.body).toMatchSchema(schema.reviewResponse)
		}
	})

	it('Program Approve with invalid project id', async () => {
		const res = await request.post('/scp/v1/reviews/rejectOrReport/9999')
		expect(res.statusCode).toBe(400)
	})

	it('Program Approve Review with valid data', async () => {
		const programId = await getResource('program')
		if (programId) {
			//start review
			const startReview = await request.post(`/scp/v1/reviews/start/${programId}`)
			//reject review
			const res = await request.post(`/scp/v1/reviews/approve/${programId}`)
			expect(res.statusCode).toBe(200)
		}
	})

	it('Program Publish with invalid data', async () => {
		const response = await request.get(
			'/scp/v1/resource/getPublishedResources?page=1&limit=5&type=program&listing=browse_existing'
		)
		let programId = response?.body?.result?.data[0]?.id || null
		if (programId) {
			let res = await request.get('/scp/v1/programs/publish/' + programId)
			expect(res.statusCode).toBe(200)
		}
	})
})

function insertProgramData() {
	const startDate = new Date() // Today's date
	const endDate = new Date()
	endDate.setDate(startDate.getDate() + 10) // Add 10 days
	return {
		title: faker.random.alpha(5),
		objective: 'Education Leadership forum',
		licenses: ['cc_by_4.0'],
		start_date: startDate.toISOString(), // Convert to ISO format
		end_date: endDate.toISOString(), // Convert to ISO format
		keywords: 'teacher',
		targeting_criteria: [
			{
				state: [
					{
						_id: '665d8df5c6892808846230e7',
						name: 'Karnataka',
						externalId: 'hsjj',
					},
				],
				entity_targeting: {
					_id: 'cluster',
					value: 'cluster',
					name: 'cluster',
				},
				roles: [
					{
						_id: '66b5ef9f3b7efb9f52488082',
						value: '18',
						label: 'Block Education Officer',
						code: 'block_education_officer',
					},
					{
						_id: '66b5efab7c530d9f5c8acb50',
						value: '19',
						label: 'Block Academic Coordinator',
						code: 'block_academic_coordinator',
					},
				],
				cluster: [
					{
						_id: '6682424ba845ef3e891daee1',
						externalId: 'enfffh3',
						cluster: 'Jayanagar',
						block: 'Bangalore South ',
						district: 'Chennai ',
					},
					{
						_id: '6682426ba845ef3e891daee4',
						externalId: 'enfflfh3',
						cluster: 'JP nagar',
						block: 'Bangalore South ',
						district: 'Chennai ',
					},
				],
				label: 'Karnataka - cluster (2)',
			},
		],
	}
}
