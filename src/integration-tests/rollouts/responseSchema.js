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
									type: ['null', 'string'],
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
								'organizations',
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
	required: ['responseCode', 'message', 'result'],
}
const listEmptyResponseSchema = {
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
const detailResponseSchema = {
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
				start_date: {
					type: 'string',
				},
				end_date: {
					type: 'string',
				},
				resource_id: {
					type: 'integer',
				},
				id: {
					type: 'integer',
				},
				resource_type: {
					type: 'string',
				},
				status: {
					type: 'string',
				},
				published_on: {
					type: 'null',
				},
				organization_id: {
					type: 'string',
				},
				user_id: {
					type: 'string',
				},
				published_id: {
					type: 'null',
				},
				parent_id: {
					type: 'integer',
				},
				type: {
					type: 'string',
				},
				template_id: {
					type: 'null',
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
				viewers: {
					type: 'array',
					items: {},
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
				'start_date',
				'end_date',
				'resource_id',
				'id',
				'resource_type',
				'status',
				'published_on',
				'organization_id',
				'user_id',
				'published_id',
				'parent_id',
				'type',
				'template_id',
				'created_by',
				'updated_by',
				'created_at',
				'updated_at',
				'deleted_at',
				'viewers',
				'organization',
			],
		},
	},
	required: ['responseCode', 'message', 'result'],
}

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
	},
	required: ['responseCode', 'message', 'result'],
}
module.exports = {
	getDataManagersSchema,
	getDataManagersEmptyResponseSchema,
	listSchema,
	listEmptyResponseSchema,
	detailResponseSchema,
	createSchema,
}
