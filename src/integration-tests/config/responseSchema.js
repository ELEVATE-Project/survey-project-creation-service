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
				resource: {
					type: 'array',
					items: [
						{
							type: 'object',
							properties: {
								review_required: {
									type: 'boolean',
								},
								show_reviewer_list: {
									type: 'boolean',
								},
								min_approval: {
									type: 'integer',
								},
								review_type: {
									type: 'string',
								},
								resource_type: {
									type: 'string',
								},
								max_task_count: {
									type: 'integer',
								},
								review_required_after_publish: {
									type: 'boolean',
								},
							},
							required: [
								'review_required',
								'show_reviewer_list',
								'min_approval',
								'review_type',
								'resource_type',
								'review_required_after_publish',
							],
						},
					],
				},
				instance: {
					type: 'object',
					properties: {
						auto_save_interval: {
							type: 'integer',
						},
						note_length: {
							type: 'integer',
						},
					},
					required: ['auto_save_interval', 'note_length'],
				},
			},
			required: ['resource', 'instance'],
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
