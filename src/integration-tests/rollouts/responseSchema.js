const getDataManagersSchema = {
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
								name: {
									type: 'string',
								},
								email: {
									type: 'string',
								},
								about: {
									type: 'null',
								},
								image: {
									type: 'null',
								},
								organization: {
									type: 'object',
									properties: {
										id: {
											type: 'integer',
										},
										code: {
											type: 'string',
										},
										name: {
											type: 'string',
										},
									},
									required: ['id', 'code', 'name'],
								},
							},
							required: ['id', 'name', 'email', 'about', 'image', 'organization'],
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
const getDataManagersEmptyResponseSchema = {
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
module.exports = {
	getDataManagersSchema,
	getDataManagersEmptyResponseSchema,
	getRolloutsListSchema,
	getRolloutsListEmptyResponseSchema,
}
