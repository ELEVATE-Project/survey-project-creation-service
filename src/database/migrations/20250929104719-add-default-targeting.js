'use strict'

require('module-alias/register')

const fs = require('fs')
const utils = require('@generics/utils')
const path = require('path')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const srcPath = `${utils.pathFinder(__dirname, 'src')}`
		const envPath = `${path.join(srcPath, '.env')}`
		require('dotenv').config({ path: envPath })

		const defaultTenantCode = process.env.DEFAULT_TENANT_CODE

		const defaultOrgCode = process.env.DEFAULT_ORGANIZATION_CODE

		if (!process?.env?.AUTH_CONFIG_FILE_PATH) throw new Error('AUTH_CONFIG_FILE_PATH is not defined in env')

		const readJsonFile = (filePath) => {
			try {
				const data = fs.readFileSync(filePath, 'utf8')
				const jsonData = JSON.parse(data)
				return jsonData
			} catch (error) {
				console.error('Error reading or parsing JSON file:', error)
				throw error
			}
		}

		let filePath = path.join(srcPath, process.env.AUTH_CONFIG_FILE_PATH)
		const config = readJsonFile(filePath)

		if (!config?.targeting_criteria) {
			throw new Error('targeting_criteria missing in auth config')
		}
		const targetingCriteria = { targeting_criteria: config.targeting_criteria }

		return queryInterface.sequelize.transaction(async (t) => {
			try {
				await queryInterface.bulkInsert(
					'organization_configs',
					[
						{
							organization_code: defaultOrgCode,
							tenant_code: defaultTenantCode,
							meta: targetingCriteria,
							created_at: new Date(),
							updated_at: new Date(),
						},
					],
					{ transaction: t },
					{ meta: { type: new Sequelize.JSONB() } }
				)
				console.log('Default Targeting added successfully')
			} catch (error) {
				if (error?.name && error.name.includes('UniqueConstraint')) {
					console.log('Default Targeting already exists; skipping')
					return
				}
				throw error
			}
		})
	},

	down: async (queryInterface, Sequelize) => {
		const srcPath = `${utils.pathFinder(__dirname, 'src')}`
		const envPath = `${path.join(srcPath, '.env')}`
		require('dotenv').config({ path: envPath })

		const defaultTenantCode = process.env.DEFAULT_TENANT_CODE

		const defaultOrgCode = process.env.DEFAULT_ORGANISATION_CODE

		return queryInterface.sequelize.transaction(async (t) => {
			await queryInterface.bulkDelete(
				'organization_configs',
				{
					organization_code: defaultOrgCode,
					tenant_code: defaultTenantCode,
				},
				{ transaction: t }
			)
		})
	},
}
