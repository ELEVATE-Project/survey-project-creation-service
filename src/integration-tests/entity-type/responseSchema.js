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
				status: {
					type: 'string',
				},
				allow_filtering: {
					type: 'boolean',
				},
				allow_custom_entities: {
					type: 'boolean',
				},
				id: {
					type: 'integer',
				},
				value: {
					type: 'string',
				},
				label: {
					type: 'string',
				},
				data_type: {
					type: 'string',
				},
				has_entities: {
					type: 'boolean',
				},
				created_by: {
					type: 'string',
				},
				updated_by: {
					type: 'string',
				},
				organization_code: {
					type: 'string',
				},
				updated_at: {
					type: 'string',
				},
				created_at: {
					type: 'string',
				},
				parent_id: {
					type: 'null',
				},
				validations: {
					type: 'null',
				},
				deleted_at: {
					type: 'null',
				},
			},
			required: [
				'status',
				'allow_filtering',
				'allow_custom_entities',
				'id',
				'value',
				'label',
				'data_type',
				'has_entities',
				'created_by',
				'updated_by',
				'organization_code',
				'updated_at',
				'created_at',
				'parent_id',
				'validations',
				'deleted_at',
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
			type: 'array',
			items: [
				{
					type: 'object',
					properties: {
						id: {
							type: 'integer',
						},
						value: {
							type: 'string',
						},
						label: {
							type: 'string',
						},
						status: {
							type: 'string',
						},
						allow_filtering: {
							type: 'boolean',
						},
						data_type: {
							type: 'string',
						},
						organization_code: {
							type: 'string',
						},
						parent_id: {
							type: 'null',
						},
						allow_custom_entities: {
							type: 'boolean',
						},
						has_entities: {
							type: 'boolean',
						},
						validations: {
							type: 'array',
							items: [
								{
									type: 'object',
									properties: {
										type: {
											type: 'string',
										},
										value: {
											type: 'string',
										},
										message: {
											type: 'string',
										},
									},
									required: ['type', 'value', 'message'],
								},
								{
									type: 'object',
									properties: {
										type: {
											type: 'string',
										},
										value: {
											type: 'boolean',
										},
										message: {
											type: 'string',
										},
									},
									required: ['type', 'value', 'message'],
								},
								{
									type: 'object',
									properties: {
										type: {
											type: 'string',
										},
										value: {
											type: 'integer',
										},
										message: {
											type: 'string',
										},
									},
									required: ['type', 'value', 'message'],
								},
							],
						},
						created_by: {
							type: 'string',
						},
						updated_by: {
							type: 'string',
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
						'id',
						'value',
						'label',
						'status',
						'allow_filtering',
						'data_type',
						'organization_code',
						'parent_id',
						'allow_custom_entities',
						'has_entities',
						'validations',
						'created_by',
						'updated_by',
						'created_at',
						'updated_at',
						'deleted_at',
					],
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
		},
	},
	required: ['responseCode', 'message', 'result'],
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
						value: {
							type: 'string',
						},
						label: {
							type: 'string',
						},
						id: {
							type: 'integer',
						},
					},
					required: ['value', 'label', 'id'],
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
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

const observableSchema = {
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

module.exports = {
	createSchema,
	updateSchema,
	listSchema,
	observableSchema,
}
