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
			},
			required: ['formsVersion'],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
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
				recommended_for: {
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
				languages: {
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
				categories: {
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
				learning_resources: {
					type: 'array',
					items: [
						{
							type: 'object',
							properties: {
								name: {
									type: 'string',
								},
								url: {
									type: 'string',
								},
							},
							required: ['name', 'url'],
						},
					],
				},
				tasks: {
					type: 'array',
					items: [
						{
							type: 'object',
							properties: {
								id: {
									type: 'string',
								},
								name: {
									type: 'string',
								},
								type: {
									type: 'string',
								},
								is_mandatory: {
									type: 'boolean',
								},
								sequence_no: {
									type: 'integer',
								},
								allow_evidences: {
									type: 'boolean',
								},
								learning_resources: {
									type: 'array',
									items: [
										{
											type: 'object',
											properties: {
												name: {
													type: 'string',
												},
												url: {
													type: 'string',
												},
											},
											required: ['name', 'url'],
										},
									],
								},
								children: {
									type: 'array',
									items: [
										{
											type: 'object',
											properties: {
												name: {
													type: 'string',
												},
												type: {
													type: 'string',
												},
												id: {
													type: 'string',
												},
												parent_id: {
													type: 'string',
												},
												sequence_no: {
													type: 'integer',
												},
											},
											required: ['name', 'type', 'id', 'parent_id', 'sequence_no'],
										},
									],
								},
							},
							required: [
								'id',
								'name',
								'type',
								'is_mandatory',
								'sequence_no',
								'allow_evidences',
								'learning_resources',
								'children',
							],
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
				meta: {
					type: 'object',
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
			required: ['formsVersion', 'correlation'],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

const reviewerListSchema = {
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
			required: ['formsVersion'],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

const emptyListSchema = {
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
				data: {
					type: 'array',
					items: [
						{
							type: 'object',
							properties: {
								id: {
									type: 'integer',
								},
								title: {
									type: 'string',
								},
								type: {
									type: 'string',
								},
								status: {
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
											type: ['integer', 'string'],
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
								creator: {
									type: 'string',
								},
								notes: {
									type: 'string',
								},
							},
							required: [
								'id',
								'title',
								'type',
								'status',
								'created_at',
								'updated_at',
								'organization',
								'creator',
								'notes',
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
							required: [],
						},
					],
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

const submitProjectSchema = {
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
			required: ['formsVersion'],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

module.exports = {
	createSchema,
	detailSchema,
	reviewerListSchema,
	listSchema,
	emptyListSchema,
	submitProjectSchema,
}
