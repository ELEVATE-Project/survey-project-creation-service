const getRolloutsListSchema = {
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
								resource_type: {
									type: 'string',
								},
								resource_id: {
									type: 'integer',
								},
								title: {
									type: 'string',
								},
								status: {
									type: 'string',
								},
								start_date: {
									type: 'string',
								},
								end_date: {
									type: 'string',
								},
								created_at: {
									type: 'string',
								},
								updated_at: {
									type: 'string',
								},
								creator: {
									type: 'string',
								},
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
										description: {
											type: 'string',
										},
									},
									required: ['id', 'name', 'code', 'description'],
								},
							},
							required: [
								'id',
								'type',
								'resource_type',
								'resource_id',
								'title',
								'status',
								'start_date',
								'end_date',
								'created_at',
								'updated_at',
								'creator',
								'organization',
							],
						},
						{
							type: 'object',
							properties: {
								id: {
									type: 'integer',
								},
								type: {
									type: 'string',
								},
								resource_type: {
									type: 'string',
								},
								resource_id: {
									type: 'integer',
								},
								title: {
									type: 'string',
								},
								status: {
									type: 'string',
								},
								start_date: {
									type: 'string',
								},
								end_date: {
									type: 'string',
								},
								created_at: {
									type: 'string',
								},
								updated_at: {
									type: 'string',
								},
								creator: {
									type: 'string',
								},
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
										description: {
											type: 'string',
										},
									},
									required: ['id', 'name', 'code', 'description'],
								},
							},
							required: [
								'id',
								'type',
								'resource_type',
								'resource_id',
								'title',
								'status',
								'start_date',
								'end_date',
								'created_at',
								'updated_at',
								'creator',
								'organization',
							],
						},
						{
							type: 'object',
							properties: {
								id: {
									type: 'integer',
								},
								type: {
									type: 'string',
								},
								resource_type: {
									type: 'string',
								},
								resource_id: {
									type: 'integer',
								},
								title: {
									type: 'string',
								},
								status: {
									type: 'string',
								},
								start_date: {
									type: 'string',
								},
								end_date: {
									type: 'string',
								},
								created_at: {
									type: 'string',
								},
								updated_at: {
									type: 'string',
								},
								creator: {
									type: 'string',
								},
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
										description: {
											type: 'string',
										},
									},
									required: ['id', 'name', 'code', 'description'],
								},
							},
							required: [
								'id',
								'type',
								'resource_type',
								'resource_id',
								'title',
								'status',
								'start_date',
								'end_date',
								'created_at',
								'updated_at',
								'creator',
								'organization',
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
			required: [],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}
const getRolloutsListEmptyResponseSchema = {
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
					type: 'array',
					items: {},
				},
				correlation: {
					type: 'string',
				},
			},
			required: [],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}
const rolloutDetailResponseSchema = {
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
				title: {
					type: 'string',
				},
				resource_id: {
					type: 'integer',
				},
				targeting_criteria: {
					type: 'array',
					items: [
						{
							type: 'object',
							properties: {
								state: {
									type: 'string',
								},
								entity_targeting: {
									type: 'string',
								},
								district: {
									type: 'array',
									items: [
										{
											type: 'string',
										},
									],
								},
								block: {
									type: 'array',
									items: [
										{
											type: 'string',
										},
									],
								},
								gender: {
									type: 'array',
									items: [
										{
											type: 'string',
										},
									],
								},
								roles: {
									type: 'array',
									items: [
										{
											type: 'string',
										},
									],
								},
							},
							required: ['state', 'entity_targeting', 'district', 'block', 'gender', 'roles'],
						},
					],
				},
				viewers: {
					type: 'array',
					items: [
						{
							type: 'null',
						},
					],
				},
				start_date: {
					type: 'string',
				},
				end_date: {
					type: 'string',
				},
				created_at: {
					type: 'string',
				},
				updated_at: {
					type: 'string',
				},
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
			},
			required: [
				'title',
				'resource_id',
				'targeting_criteria',
				'viewers',
				'start_date',
				'end_date',
				'created_at',
				'updated_at',
				'organization',
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
			required: [],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}
module.exports = {
	getRolloutsListSchema,
	getRolloutsListEmptyResponseSchema,
	rolloutDetailResponseSchema,
}
