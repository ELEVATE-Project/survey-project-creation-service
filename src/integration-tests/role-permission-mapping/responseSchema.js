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
				role_Title: {
					type: 'string',
				},
				permission_Id: {
					type: 'integer',
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
						{
							type: 'string',
						},
					],
				},
			},
			required: ['role_Title', 'permission_Id', 'module', 'request_type'],
		},
		meta: {
			type: 'object',
			properties: {
				formsVersion: {
					type: 'array',
					items: {},
				},
				correlation: {
					type: 'string',
				},
			},
			required: ['formsVersion', 'correlation'],
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
			type: 'object',
			properties: {
				permissions: {
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
									],
								},
							},
							required: ['module', 'request_type'],
						},
					],
				},
			},
			required: ['permissions'],
		},
	},
	required: ['responseCode', 'message', 'result'],
}

module.exports = {
	createSchema,
	listSchema,
}
