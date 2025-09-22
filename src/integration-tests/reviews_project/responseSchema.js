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
				id: {
					type: 'integer',
				},
			},
			required: ['id'],
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

const reviewResponse = {
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
			items: {},
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
	createSchema,
	reviewResponse,
}
