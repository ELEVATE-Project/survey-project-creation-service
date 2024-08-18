'use strict'
const utils = require('@generics/utils')
const userRequests = require('@requests/user')
const common = require('@constants/common')
const _ = require('lodash')
const actionQueries = require('@database/queries/actions')
const { Op } = require('sequelize')

exports.activityDTO = async (activities = [], organization_id) => {
	try {
		let userIds = []
		let actionIds = []
		activities.map((activity) => {
			userIds.push(activity.user_id)
			actionIds.push(activity.action_id)
		})

		const uniqueUserIds = utils.getUniqueElements(userIds)
		const uniqueActionIds = utils.getUniqueElements(actionIds)

		let users = await userRequests.list(common.ALL_USER_ROLES, '', '', '', organization_id, {
			user_ids: uniqueUserIds,
		})
		if (!users.success) {
			throw new Error('Failed to fetch users')
		}

		if (!Array.isArray(users?.data?.result?.data) && !users.data.result.data.length > 0) {
			throw new Error('No users found')
		}

		const userIdMap = _.keyBy(users.data.result.data, 'id')

		let actions = await actionQueries.findAll({ id: { [Op.in]: uniqueActionIds } })
		if (!actions.length > 0) {
			throw new Error('No actions found')
		}

		const actionIdMap = _.keyBy(actions, 'id')
		let formattedActivities = activities.map((activity) => {
			const user = userIdMap[activity.user_id]
			const actionDescription = actionIdMap[activity.action_id].description
			const date = new Date(activity.created_at).toLocaleDateString('en-US', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
			})

			return {
				id: activity.id,
				action: `${actionDescription} by ${user.name} on ${date}`,
			}
		})

		return {
			data: formattedActivities,
			success: true,
		}
	} catch (error) {
		console.log(error, 'error')
		return {
			data: [],
			success: false,
		}
	}
}
