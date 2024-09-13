const createSchema = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
		},
		message: {
			type: 'string',
		},
		result: {
			type: 'object',
			properties: {
				Id: {
					type: 'integer',
				},
				status: {
					type: 'string',
				},
				module: {
					type: 'string',
				},
				request_type: {
					type: 'array',
					items: [
						{
							type: 'string',
						},
					],
				},
			},
			required: ['Id', 'status', 'module', 'request_type'],
		},
		meta: {
			type: 'object',
			properties: {
				correlation: {
					type: 'string',
				},
				meetingPlatform: {
					type: 'string',
				},
			},
			required: ['correlation', 'meetingPlatform'],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

const updateSchema = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
		},
		message: {
			type: 'string',
		},
		result: {
			type: 'object',
			properties: {
				Id: {
					type: 'integer',
				},
				status: {
					type: 'string',
				},
				module: {
					type: 'string',
				},
				request_type: {
					type: 'array',
					items: [
						{
							type: 'string',
						},
					],
				},
			},
			required: ['Id', 'status', 'module', 'request_type'],
		},
		meta: {
			type: 'object',
			properties: {
				correlation: {
					type: 'string',
				},
				meetingPlatform: {
					type: 'string',
				},
			},
			required: ['correlation', 'meetingPlatform'],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

const deleteSchema = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
		},
		message: {
			type: 'string',
		},
		result: {
			type: 'object',
		},
		meta: {
			type: 'object',
			properties: {
				correlation: {
					type: 'string',
				},
				meetingPlatform: {
					type: 'string',
				},
			},
			required: ['correlation', 'meetingPlatform'],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

const listSchema = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
		},
		message: {
			type: 'string',
		},
		result: {
			type: 'array',
			items: [
				{
					type: 'object',
					properties: {
						module: {
							type: 'string',
						},
						request_type: {
							type: 'array',
							items: [
								{
									type: 'string',
								},
								{
									type: 'string',
								},
							],
						},
					},
					required: ['module', 'request_type'],
				},
			],
		},
	},
	required: ['responseCode', 'message', 'result'],
}

module.exports = {
	createSchema,
	updateSchema,
	deleteSchema,
	listSchema,
}
