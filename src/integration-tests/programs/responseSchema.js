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
					type: 'array',
					items: {},
				},
				correlation: {
					type: 'string',
				},
			},
		},
	},
	required: ['responseCode', 'message', 'result'],
}

const detailSchema = {
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
				organization: {
					type: 'object',
					properties: {
						id: {
							type: 'integer',
						},
						name: {
							type: 'string',
						},
						code: {
							type: 'string',
						},
					},
					required: ['id', 'name', 'code'],
				},
				title: {
					type: 'string',
				},
				objective: {
					type: 'string',
				},
				licenses: {
					type: 'array',
					items: [
						{
							type: 'object',
							properties: {
								label: {
									type: 'string',
								},
								value: {
									type: 'string',
								},
							},
							required: ['label', 'value'],
						},
					],
				},
				id: {
					type: 'integer',
				},
				type: {
					type: 'string',
				},
				status: {
					type: 'string',
				},
				user_id: {
					type: 'string',
				},
				organization_id: {
					type: 'string',
				},
				created_by: {
					type: 'string',
				},
				updated_by: {
					type: 'string',
				},
				submitted_on: {
					type: 'null',
				},
				published_on: {
					type: 'null',
				},
				last_reviewed_on: {
					type: 'null',
				},
				is_under_edit: {
					type: 'boolean',
				},
				created_at: {
					type: 'string',
				},
				updated_at: {
					type: 'string',
				},
				deleted_at: {
					type: 'null',
				},
			},
			required: [
				'organization',
				'title',
				'id',
				'type',
				'status',
				'user_id',
				'organization_id',
				'created_by',
				'updated_by',
				'submitted_on',
				'published_on',
				'last_reviewed_on',
				'is_under_edit',
				'created_at',
				'updated_at',
				'deleted_at',
			],
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
		},
	},
	required: ['responseCode', 'message', 'result'],
}

const addOrRemoveResourceFailtureSchema = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
		},
		error: {
			type: 'array',
			items: {},
		},
		meta: {
			type: 'object',
			properties: {
				correlation: {
					type: 'string',
				},
			},
			required: ['correlation'],
		},
		message: {
			type: 'string',
		},
	},
	required: ['responseCode', 'error', 'message'],
}

const addOrRemoveResourceSchema = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
		},
		message: {
			type: 'string',
		},
	},
	required: ['responseCode', 'error', 'message'],
}
const programSubmitForReview = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
		},
		error: {
			type: 'array',
			items: {},
		},
		meta: {
			type: 'object',
			properties: {
				correlation: {
					type: 'string',
				},
			},
			required: ['correlation'],
		},
		message: {
			type: 'string',
		},
	},
	required: ['responseCode', 'error', 'message'],
}
module.exports = {
	createSchema,
	detailSchema,
	addOrRemoveResourceFailtureSchema,
	addOrRemoveResourceSchema,
	programSubmitForReview,
}
