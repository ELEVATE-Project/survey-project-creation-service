const common = require('../../constants/common')
const eventEmitter = require('../../configs/events')

module.exports = (sequelize, DataTypes) => {
	const Review = sequelize.define(
		'Review',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				type: DataTypes.INTEGER,
				primaryKey: true,
			},
			resource_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
			reviewer_id: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			status: {
				type: DataTypes.ENUM(
					'NOT_STARTED',
					'STARTED',
					'INPROGRESS',
					'REQUESTED_FOR_CHANGES',
					'APPROVED',
					'REJECTED',
					'PUBLISHED',
					'REJECTED_AND_REPORTED',
					'CHANGES_UPDATED'
				),
				defaultValue: 'NOT_STARTED',
			},
			organization_id: {
				allowNull: false,
				type: DataTypes.STRING,
				primaryKey: true,
			},
			notes: {
				allowNull: true,
				type: DataTypes.STRING,
			},
		},
		{
			modelName: 'Review',
			tableName: 'reviews',
			freezeTableName: true,
			paranoid: true,
			indexes: [
				{
					unique: true,
					fields: ['resource_id', 'reviewer_id', 'organization_id'],
					name: 'unique_resource_reviewer',
				},
			],
		}
	)

	Review.addHook('afterSave', async (instance, options) => {
		try {
			// 		console.log(instance.resource_id, instance.reviewer_id, instance.organization_id, 'instance')

			//get resource type
			const resource = await sequelize.models.Resource.findOne(
				{
					where: { id: instance.resource_id }, // Ensure you're querying the resource by its ID
					attributes: ['id', 'organization_id', 'type'], // Fetch necessary attributes
				},
				{ raw: true }
			)

			if (resource?.id) {
				console.log(resource.id, 'resourceId')
				const statusActionMap = {
					[common.REVIEW_STATUS_INPROGRESS]: common.USER_ACTIONS?.[resource?.type]?.REVIEW_STARTED,
					[common.REVIEW_STATUS_REQUESTED_FOR_CHANGES]:
						common.USER_ACTIONS?.[resource?.type]?.REVIEW_CHANGES_REQUESTED,
					[common.REVIEW_STATUS_APPROVED]: common.USER_ACTIONS?.[resource?.type]?.REVIEW_APPROVED,
					[common.REVIEW_STATUS_REJECTED]: common.USER_ACTIONS?.[resource?.type]?.RESOURCE_REJECTED,
					[common.REVIEW_STATUS_REJECTED_AND_REPORTED]:
						common.USER_ACTIONS?.[resource?.type]?.RESOURCE_REPORTED,
				}

				const actionCode = statusActionMap[instance.status]
				// const actionCode = 'PROJECT_REVIEW_STARTED'
				// 			console.log(actionCode,"actionCode")
				if (actionCode) {
					// After creating an activity, trigger the event
					eventEmitter.emit('addUserAction', {
						actionCode,
						userId: instance.reviewer_id,
						objectId: instance.resource_id,
						objectType: 'RESOURCE',
						orgId: instance.organization_id,
					})
				}
			}
		} catch (error) {
			console.error('Error during afterSave hook:', error)
			throw error
		}
	})

	return Review
}
