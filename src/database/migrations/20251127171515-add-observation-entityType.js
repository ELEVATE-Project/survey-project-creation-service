/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface) {
		try {
			const sequelize = queryInterface.sequelize

			// Fetch org-tenant pairs
			const orgConfigs = await sequelize.query(
				`SELECT DISTINCT organization_code, tenant_code
				 FROM organization_configs
				 WHERE organization_code IS NOT NULL
				   AND tenant_code IS NOT NULL`,
				{ type: sequelize.QueryTypes.SELECT }
			)

			if (!orgConfigs.length) {
				throw new Error('No organization-tenant pairs found in organization_configs.')
			}

			// Single entity type definition
			const baseEntity = {
				value: 'observation',
				label: 'Observation',
				data_type: 'ARRAY[STRING]',
				status: 'ACTIVE',
				validations: JSON.stringify([
					{
						type: 'required',
						value: true,
						message: 'External ID is required for the task',
					},
				]),
				has_entities: false,
				allow_custom_entities: false,
				allow_filtering: false,
				created_by: 0,
				updated_by: 0,
			}

			for (const { organization_code, tenant_code } of orgConfigs) {
				/** -----------------------------------------
				 * 1. Insert entity_types if not exists
				 * ----------------------------------------- */
				const existing = await sequelize.query(
					`SELECT value FROM entity_types
					 WHERE value = :value
					   AND organization_code = :orgCode
					   AND tenant_code = :tenantCode`,
					{
						type: sequelize.QueryTypes.SELECT,
						replacements: {
							value: baseEntity.value,
							orgCode: organization_code,
							tenantCode: tenant_code,
						},
					}
				)

				if (!existing.length) {
					await queryInterface.bulkInsert('entity_types', [
						{
							...baseEntity,
							organization_code,
							tenant_code,
							created_at: new Date(),
							updated_at: new Date(),
						},
					])
				}

				/** -----------------------------------------
				 * 2. Fetch entity type ID
				 * ----------------------------------------- */
				const [{ id: entityTypeId }] = await sequelize.query(
					`SELECT id FROM entity_types
					 WHERE value = :value
					   AND organization_code = :orgCode
					   AND tenant_code = :tenantCode`,
					{
						type: sequelize.QueryTypes.SELECT,
						replacements: {
							value: baseEntity.value,
							orgCode: organization_code,
							tenantCode: tenant_code,
						},
					}
				)

				/** -----------------------------------------
				 * 3. Insert mapping if not exists
				 * ----------------------------------------- */
				const existingMapping = await sequelize.query(
					`SELECT id FROM entities_model_mapping
					 WHERE entity_type_id = :id
					   AND model = 'tasks'
					   AND organization_code = :orgCode
					   AND tenant_code = :tenantCode`,
					{
						type: sequelize.QueryTypes.SELECT,
						replacements: {
							id: entityTypeId,
							orgCode: organization_code,
							tenantCode: tenant_code,
						},
					}
				)

				if (!existingMapping.length) {
					await queryInterface.bulkInsert('entities_model_mapping', [
						{
							entity_type_id: entityTypeId,
							model: 'tasks',
							organization_code,
							tenant_code,
							status: 'ACTIVE',
							created_at: new Date(),
							updated_at: new Date(),
						},
					])
				}
			}
		} catch (error) {
			throw error
		}
	},

	async down(queryInterface) {
		try {
			const sequelize = queryInterface.sequelize

			const orgConfigs = await sequelize.query(
				`SELECT DISTINCT organization_code, tenant_code
				 FROM organization_configs
				 WHERE organization_code IS NOT NULL
				   AND tenant_code IS NOT NULL`,
				{ type: sequelize.QueryTypes.SELECT }
			)

			const value = 'observation'

			for (const { organization_code, tenant_code } of orgConfigs) {
				// Fetch entity type IDs
				const rows = await sequelize.query(
					`SELECT id FROM entity_types
					 WHERE value = :value
					   AND organization_code = :orgCode
					   AND tenant_code = :tenantCode`,
					{
						type: sequelize.QueryTypes.SELECT,
						replacements: { value, orgCode: organization_code, tenantCode: tenant_code },
					}
				)

				if (!rows.length) continue
				const ids = rows.map((e) => e.id)

				// Delete mappings
				await queryInterface.bulkDelete(
					'entities_model_mapping',
					{
						entity_type_id: ids,
						organization_code,
						tenant_code,
					},
					{}
				)

				// Delete entity types
				await queryInterface.bulkDelete(
					'entity_types',
					{
						value,
						organization_code,
						tenant_code,
					},
					{}
				)
			}
		} catch (error) {
			throw error
		}
	},
}
