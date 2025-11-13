/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			//  Fetch all org-tenant pairs from organization_configs
			const orgConfigs = await queryInterface.sequelize.query(
				`SELECT DISTINCT organization_code, tenant_code
				 FROM organization_configs
				 WHERE organization_code IS NOT NULL
				   AND tenant_code IS NOT NULL`,
				{
					type: queryInterface.sequelize.QueryTypes.SELECT,
				}
			)

			if (!orgConfigs.length) {
				throw new Error('No organization-tenant pairs found in organization_configs.')
			}

			console.log(`Found ${orgConfigs.length} organization-tenant pairs.`)

			// Define the base entity types
			const baseEntityTypes = [
				{
					value: 'reflection',
					label: 'Reflection',
					data_type: 'ARRAY[STRING]',
					status: 'ACTIVE',
					validations: JSON.stringify([
						{
							type: 'regex',
							value: '^(https?:\\/\\/)?([\\w-]+\\.)+[\\w-]{2,}(\\/\\S*)*\\/?(#[\\w-]*)?(\\?.*)?$',
							message: 'Please add a valid link to reflection',
						},
						{
							type: 'required',
							value: false,
							message: 'Enter link to the reflection',
						},
					]),
					has_entities: false,
					allow_custom_entities: false,
					allow_filtering: false,
					created_by: 0,
					updated_by: 0,
				},
				{
					value: 'improvement_projects',
					label: 'Improvement Projects',
					data_type: 'ARRAY[STRING]',
					status: 'ACTIVE',
					validations: JSON.stringify([
						{
							type: 'required',
							value: true,
							message: 'Select Published Project for the task',
						},
					]),
					has_entities: false,
					allow_custom_entities: false,
					allow_filtering: false,
					created_by: 0,
					updated_by: 0,
				},
			]

			// Loop through org-tenant pairs and insert data
			for (const config of orgConfigs) {
				const { organization_code, tenant_code } = config

				const entityTypeData = baseEntityTypes.map((et) => ({
					...et,
					organization_code,
					tenant_code,
					created_at: new Date(),
					updated_at: new Date(),
				}))

				// Skip existing ones
				const existing = await queryInterface.sequelize.query(
					`SELECT value FROM entity_types 
					 WHERE value IN (:values)
					 AND organization_code = :orgCode
					 AND tenant_code = :tenantCode`,
					{
						type: queryInterface.sequelize.QueryTypes.SELECT,
						replacements: {
							values: baseEntityTypes.map((e) => e.value),
							orgCode: organization_code,
							tenantCode: tenant_code,
						},
					}
				)

				const existingValues = existing.map((e) => e.value)
				const toInsert = entityTypeData.filter((e) => !existingValues.includes(e.value))

				if (toInsert.length) {
					await queryInterface.bulkInsert('entity_types', toInsert, {})
					console.log(`✅ Inserted entity_types for org=${organization_code}, tenant=${tenant_code}`)
				}

				// Fetch the entity_type IDs for mapping
				const entityTypes = await queryInterface.sequelize.query(
					`SELECT id, value FROM entity_types 
					 WHERE value IN (:values)
					 AND organization_code = :orgCode
					 AND tenant_code = :tenantCode`,
					{
						type: queryInterface.sequelize.QueryTypes.SELECT,
						replacements: {
							values: baseEntityTypes.map((e) => e.value),
							orgCode: organization_code,
							tenantCode: tenant_code,
						},
					}
				)

				if (entityTypes.length) {
					const mappings = entityTypes.map((entityType) => ({
						entity_type_id: entityType.id,
						model: 'tasks',
						tenant_code,
						organization_code,
						status: 'ACTIVE',
						created_at: new Date(),
						updated_at: new Date(),
					}))

					await queryInterface.bulkInsert('entities_model_mapping', mappings, {})
					console.log(`➡️ Added model mappings for org=${organization_code}, tenant=${tenant_code}`)
				}
			}

			console.log('Migration completed for all organization-tenant pairs.')
		} catch (error) {
			console.error('Migration UP error:', error)
			throw error
		}
	},

	async down(queryInterface, Sequelize) {
		try {
			const orgConfigs = await queryInterface.sequelize.query(
				`SELECT DISTINCT organization_code, tenant_code
				 FROM organization_configs
				 WHERE organization_code IS NOT NULL
				   AND tenant_code IS NOT NULL`,
				{
					type: queryInterface.sequelize.QueryTypes.SELECT,
				}
			)

			const entityValues = ['reflection', 'improvement_projects']

			for (const config of orgConfigs) {
				const { organization_code, tenant_code } = config

				const entityTypes = await queryInterface.sequelize.query(
					`SELECT id FROM entity_types 
					 WHERE value IN (:values)
					 AND organization_code = :orgCode
					 AND tenant_code = :tenantCode`,
					{
						type: queryInterface.sequelize.QueryTypes.SELECT,
						replacements: {
							values: entityValues,
							orgCode: organization_code,
							tenantCode: tenant_code,
						},
					}
				)

				if (entityTypes.length) {
					const ids = entityTypes.map((e) => e.id)

					await queryInterface.bulkDelete(
						'entities_model_mapping',
						{
							entity_type_id: ids,
							organization_code,
							tenant_code,
						},
						{}
					)

					await queryInterface.bulkDelete(
						'entity_types',
						{
							value: entityValues,
							organization_code,
							tenant_code,
						},
						{}
					)

					console.log(`Rolled back for org=${organization_code}, tenant=${tenant_code}`)
				}
			}

			console.log('Rollback completed for all organization-tenant pairs.')
		} catch (error) {
			console.error('Migration DOWN error:', error)
			throw error
		}
	},
}
