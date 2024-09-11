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
				Id: {
					type: 'integer',
				},
				status: {
					type: 'string',
				},
				module: {
					type: 'string',
				},
				request_type: {
					type: 'array',
					items: [
						{
							type: 'string',
						},
					],
				},
			},
			required: ['id', 'status', 'module', 'request_type'],
		},
		meta: {
			type: 'object',
			properties: {
				formsVersion: {
					type: 'array'
				}
			},
			required: ['formsVersion'],
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
			type: 'object',
			properties: {
				Id: {
					type: 'integer',
				},
				status: {
					type: 'string',
				},
				module: {
					type: 'string',
				},
				request_type: {
					type: 'array',
					items: [
						{
							type: 'string',
						},
					],
				},
			},
			required: ['Id', 'status', 'module', 'request_type'],
		},
		meta: {
			type: 'object',
			properties: {
				formsVersion: {
					type: 'array'
				}
			},
			required: ['formsVersion'],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

const deleteSchema = {
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
		},
		meta: {
			type: 'object',
			properties: {
				formsVersion: {
					type: 'array'
				}
			},
			required: ['formsVersion'],
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
						module: {
							type: 'string',
						},
						request_type: {
							type: 'array',
							items: [
								{
									type: 'string',
								},
								{
									type: 'string',
								},
							],
						},
					},
					required: ['module', 'request_type'],
				},
			],
		},
	},
	required: ['responseCode', 'message', 'result'],
}

const getPermissionSchema = {
	'type': 'object',
	'properties': {
		'responseCode': {
			'type': 'string'
		},
		'message': {
			'type': 'string'
		},
		'result': {
			'type': 'object',
			'properties': {
				'data': {
					'type': 'array',
					'items': [
						{
							'type': 'object',
							'properties': {
								'id': {
									'type': 'integer'
								},
								'code': {
									'type': 'string'
								},
								'module': {
									'type': 'string'
								},
								'request_type': {
									'type': 'array',
									'items': [
										{
											'type': 'string'
										},
										{
											'type': 'string'
										},
										{
											'type': 'string'
										}
									]
								},
								'api_path': {
									'type': 'string'
								},
								'status': {
									'type': 'string'
								}
							},
							'required': [
								'id',
								'code',
								'module',
								'request_type',
								'api_path',
								'status'
							]
						}
					]
				},
				'count': {
					'type': 'integer'
				}
			},
			'required': [
				'data',
				'count'
			]
		},
		'meta': {
			'type': 'object',
			'properties': {
				'formsVersion': {
					'type': 'array',
					'items': {}
				},
				'correlation': {
					'type': 'string'
				}
			},
			'required': [
				'formsVersion',
				'correlation'
			]
		}
	},
	'required': [
		'responseCode',
		'message',
		'result',
		'meta'
	]
}
module.exports = {
	createSchema,
	updateSchema,
	deleteSchema,
	listSchema,
	getPermissionSchema
}
