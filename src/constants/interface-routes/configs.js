{
	routes: [
		{
			sourceRoute: '/scp/v1/permissions/list',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/config/list',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/form/create',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/form/update',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/form/update/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/form/read',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/form/read/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entity-types/create',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entity-types/read',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entity-types/update',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entity-types/update/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entity-types/delete',
			type: 'DELETE',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entity-types/delete/:id',
			type: 'DELETE',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entities/create',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entities/read',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entities/read/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entities/update',
			type: 'PUT',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entities/update/:id',
			type: 'PUT',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entities/delete',
			type: 'DELETE',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/entities/delete/:id',
			type: 'DELETE',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/projects/details/',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/projects/details/:id',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/cloud-services/file/fetchJsonFromCloud',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/projects/reviewerList',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/projects/update',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/projects/update/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/projects/update/:id',
			type: 'DELETE',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/permissions/create',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/permissions/update/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/permissions/getPermissions',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/permissions/delete/:id',
			type: 'DELETE',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/permissions/list',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/modules/create',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/modules/update/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/modules/list',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/modules/delete/:id',
			type: 'DELETE',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/certificates/list',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/resource/list',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/resource/getPublishedResources',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/resource/upForReview',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/role-permission-mapping/create/:role_id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/role-permission-mapping/delete/:role_id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/role-permission-mapping/list',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/projects/submitForReview/:resource_id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/projects/submitForReview/',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/comments/list',
			type: 'GET',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/comments/update',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/comments/update/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/reviews/update/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/reviews/start/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/reviews/approve/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/reviews/rejectOrReport/:id',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/cloud-services/getSignedUrl',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: false,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
				},
			],
		},
		{
			sourceRoute: '/scp/v1/resource/browseExisting',
			type: 'POST',
			priority: 'MUST_HAVE',
			inSequence: false,
			orchestrated: true,
			targetPackages: [
				{
					basePackageName: 'self_creation_portal',
					packageName: 'elevate-self-creation-portal',
					targetBody: [],
					responseBody: [],
				},
			],
		},
	]
}
