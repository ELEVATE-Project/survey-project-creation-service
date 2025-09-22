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
				data: {
					type: 'array',
					items: {},
				},
				count: {
					type: 'integer',
				},
			},
			required: ['data', 'count'],
		},
		meta: {
			type: 'object',
			properties: {
				formsVersion: {
					oneOf: [
						{
							type: 'object',
							properties: {},
							additionalProperties: true,
						},
						{
							type: 'array',
							items: {
								type: 'object',
								properties: {},
								additionalProperties: true,
							},
						},
					],
				},
				correlation: {
					type: 'string',
				},
			},
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

module.exports = {
	listSchema,
}
