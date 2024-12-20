'use strict'

/** @type {import('sequelize-cli').Migration} */
require('module-alias/register')
const Modules = require('@database/models/index').Module
const EntityType = require('@database/models/index').EntityType
const common = require('@constants/common')
module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			const module = await Modules.findOne({
				where: { code: common.ROLL_OUT_MODULE, status: common.STATUS_ACTIVE },
			})

			if (!module) throw module

			const entityType = await EntityType.findOne({
				where: { value: common.ROLLOUT_TITLE, status: common.STATUS_ACTIVE },
			})
			if (!entityType) throw entityType
			const entityModelMapping = [
				{
					entity_type_id: entityType.id,
					model: module.code,
					status: 'ACTIVE',
					updated_at: new Date(),
					created_at: new Date(),
				},
			]
			await queryInterface.bulkInsert('entities_model_mapping', entityModelMapping, {})
		} catch (error) {
			console.log('ERROR : ', error)
			throw error
		}
	},

	async down(queryInterface, Sequelize) {
		try {
			await queryInterface.bulkDelete(
				'entities_model_mapping',
				{
					model: common.ROLL_OUT_MODULE,
				},
				{}
			)
		} catch (error) {
			console.log('Error : ', error)
			throw error
		}
	},
}
