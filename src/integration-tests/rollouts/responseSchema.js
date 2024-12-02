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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
								},
								image: {
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
									type: 'string',
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
module.exports = {
	getDataManagersSchema,
	getDataManagersEmptyResponseSchema,
}
