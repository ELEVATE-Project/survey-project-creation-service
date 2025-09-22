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
	required: ['responseCode', 'message', 'result'],
}
const readSchema = {
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
						id: {
							type: 'integer',
						},
						type: {
							type: 'string',
						},
						version: {
							type: 'integer',
						},
					},
					required: ['id', 'type', 'version'],
				},
			],
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
			required: ['formsVersion', 'correlation'],
		},
	},
	required: ['responseCode', 'message', 'result'],
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
			},
		},
	},
	required: ['responseCode', 'message', 'result'],
}

module.exports = {
	createSchema,
	readSchema,
	updateSchema,
}
