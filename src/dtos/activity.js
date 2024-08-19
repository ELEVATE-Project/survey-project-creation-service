'use strict'
const utils = require('@generics/utils')
const userRequests = require('@requests/user')
const common = require('@constants/common')
const _ = require('lodash')
const actionQueries = require('@database/queries/actions')
const { Op } = require('sequelize')

exports.activityDTO = async (activities = [], organization_id) => {
	try {
		//get userId and actionIds
		const userIds = utils.getUniqueElements(activities.map((activity) => activity.user_id))
		const actionIds = utils.getUniqueElements(activities.map((activity) => activity.action_id))

		// Fetch users and actions
		const [usersResponse, actions] = await Promise.all([
			userRequests.list(common.ALL_USER_ROLES, '', '', '', organization_id, { user_ids: userIds }),
			actionQueries.findAll({ id: { [Op.in]: actionIds } }),
		])

		if (!usersResponse.success) {
			throw new Error('Failed to fetch users')
		}

		if (!Array.isArray(usersResponse?.data?.result?.data) && !usersResponse.data.result.data.length > 0) {
			throw new Error('No users found')
		}

		const userIdMap = _.keyBy(usersResponse.data.result.data, 'id')

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
				action: `${user.name} ${actionDescription} id ${activity.object_id} on ${date}`,
			}
		})

		return {
			data: formattedActivities,
			success: true,
		}
	} catch (error) {
		console.error('Error in activityDTO:', error)
		return {
			data: [],
			success: false,
		}
	}
}
