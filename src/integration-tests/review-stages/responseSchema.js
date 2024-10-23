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
				id: {
					type: 'integer',
				},
				role: {
					type: 'string',
				},
				level: {
					type: 'integer',
				},
				organization_id: {
					type: 'string',
				},
				resource_type: {
					type: 'string',
				},
			},
			required: ['id', 'role', 'level', 'organization_id', 'resource_type'],
		},
		meta: {
			type: 'object',
			properties: {
				formsVersion: {
					type: 'array',
					items: {},
				},
			},
			required: ['formsVersion'],
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
				results: {
					type: 'object',
					properties: {
						data: {
							type: 'array',
							items: [
								{
									type: 'object',
									properties: {
										id: {
											type: 'integer',
										},
										role: {
											type: 'string',
										},
										level: {
											type: 'integer',
										},
										resource_type: {
											type: 'string',
										},
										organization_id: {
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
										'role',
										'level',
										'resource_type',
										'organization_id',
										'created_at',
										'updated_at',
										'deleted_at',
									],
								},
							],
						},
						count: {
							type: 'integer',
						},
					},
					required: ['data', 'count'],
				},
			},
			required: ['results'],
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
			required: ['formsVersion'],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

module.exports = {
	updateSchema,
	listSchema,
}
