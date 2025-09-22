const common = require('@constants/common')

module.exports = (sequelize, DataTypes) => {
	const Resource = sequelize.define(
		'Resource',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			type: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			title: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			status: {
				allowNull: false,
				type: DataTypes.ENUM(
					'DRAFT',
					'SUBMITTED',
					'IN_REVIEW',
					'INPROGRESS',
					'APPROVED',
					'REJECTED',
					'PUBLISHED',
					'REJECTED_AND_REPORTED'
				),
				defaultValue: 'DRAFT',
			},
			stage: {
				allowNull: false,
				type: DataTypes.ENUM('CREATION', 'REVIEW', 'COMPLETION'),
				defaultValue: 'CREATION',
			},
			blob_path: {
				allowNull: true,
				type: DataTypes.STRING,
			},
			user_id: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			organization_code: {
				primaryKey: true,
				allowNull: false,
				type: DataTypes.STRING,
			},
			tenant_code: {
				primaryKey: true,
				allowNull: false,
				type: DataTypes.STRING,
			},
			next_stage: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 1,
			},
			review_type: {
				allowNull: false,
				type: DataTypes.ENUM('SEQUENTIAL', 'PARALLEL'),
				defaultValue: 'SEQUENTIAL',
			},
			reference_id: {
				type: DataTypes.INTEGER,
			},
			meta: {
				allowNull: true,
				type: DataTypes.JSONB,
			},
			published_id: {
				type: DataTypes.STRING,
			},
			created_by: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			updated_by: {
				type: DataTypes.STRING,
			},
			submitted_on: {
				type: DataTypes.DATE,
			},
			published_on: {
				type: DataTypes.DATE,
			},
			last_reviewed_on: {
				type: DataTypes.DATE,
			},
			is_under_edit: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
			},
			is_reusable: {
				type: DataTypes.BOOLEAN,
				defaultValue: true,
			},
			link: {
				type: DataTypes.STRING,
				defaultValue: null,
			},
		},
		{
			modelName: 'Resource',
			tableName: 'resources',
			freezeTableName: true,
			paranoid: true,
			indexes: [
				{
					name: 'title_index',
					fields: ['title'],
				},
			],
		}
	)

	// Define associations
	Resource.associate = (models) => {
		Resource.hasMany(models.Comment, {
			foreignKey: 'resource_id',
			sourceKey: 'id',
			as: 'comments',
			constraints: true,
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE',
		})
		Resource.hasMany(models.Review, {
			// Fix: Change from models.Comment to models.Review
			foreignKey: 'resource_id',
			sourceKey: 'id',
			as: 'reviews',
			constraints: true,
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE',
		})
		Resource.hasMany(models.ReviewResource, {
			// Fix: Change from models.Comment to models.Review
			foreignKey: 'resource_id',
			sourceKey: 'id',
			as: 'ReviewResource',
			constraints: true,
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE',
		})
		Resource.hasMany(models.Rollout, {
			foreignKey: 'resource_id',
			sourceKey: 'id',
			as: 'rollouts',
			constraints: true,
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE',
		})
		Resource.hasMany(models.ProgramResourceMapping, {
			foreignKey: 'resource_id',
			sourceKey: 'id',
			as: 'ProgramResources',
			constraints: true,
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE',
		})
		Resource.hasMany(models.ProgramResourceMapping, {
			foreignKey: 'program_id',
			sourceKey: 'id',
			as: 'Program',
			constraints: true,
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE',
		})
	}

	// Helper function to emit user actions with dynamic action types
	const emitUserAction = async (instance, actionType) => {
		try {
			if (actionType) {
				eventEmitter.emit(common.EVENT_ADD_USER_ACTION, {
					actionCode: common.USER_ACTIONS[instance.type][actionType],
					userId: instance.user_id,
					objectId: instance.id,
					objectType: common.MODEL_NAMES.RESOURCE,
					orgId: instance.organization_code,
				})
			}
		} catch (error) {
			console.error(`Error during ${actionType} hook:`, error)
			throw error
		}
	}

	Resource.addHook('afterCreate', (instance) => emitUserAction(instance, 'RESOURCE_CREATED'))
	Resource.addHook('afterDestroy', (instance) => emitUserAction(instance, 'RESOURCE_DELETED'))
	Resource.addHook('afterUpdate', (instance) => {
		const statusActionMap = {
			[common.RESOURCE_STATUS_PUBLISHED]: 'RESOURCE_PUBLISHED',
			[common.RESOURCE_STATUS_REJECTED_AND_REPORTED]: 'RESOURCE_REPORTED',
			[common.RESOURCE_STATUS_REJECTED]: 'RESOURCE_REJECTED',
		}

		const actionKey = statusActionMap[instance.status]
		if (actionKey) {
			emitUserAction(instance, actionKey)
		}
	})

	return Resource
}
