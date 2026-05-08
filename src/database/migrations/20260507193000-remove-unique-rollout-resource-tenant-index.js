'use strict'

/** @type {import('sequelize-cli').Migration} */
const INDEX_NAME = 'unique_rollout_resource_tenant'
const TABLE_NAME = 'rollouts'
const EXPECTED_DIST_COLUMN = 'tenant_code'

async function indexExists(queryInterface, tableName, indexName) {
	const [rows] = await queryInterface.sequelize.query(
		`SELECT 1
		 FROM pg_indexes
		 WHERE schemaname = current_schema()
		   AND tablename = :tableName
		   AND indexname = :indexName
		 LIMIT 1;`,
		{
			replacements: { tableName, indexName },
		}
	)

	return rows.length > 0
}

async function getCitusDistributionInfo(queryInterface, tableName) {
	const [extRows] = await queryInterface.sequelize.query(
		`SELECT extname FROM pg_extension WHERE extname = 'citus' LIMIT 1;`
	)

	if (extRows.length === 0) {
		return {
			citusEnabled: false,
			distributionColumn: null,
		}
	}

	try {
		const [distRows] = await queryInterface.sequelize.query(
			`SELECT column_to_column_name(logicalrelid, partkey) AS dist_col_name
			 FROM pg_dist_partition
			 WHERE logicalrelid = :tableName::regclass
			 LIMIT 1;`,
			{
				replacements: { tableName },
			}
		)

		return {
			citusEnabled: true,
			distributionColumn: distRows[0]?.dist_col_name || null,
		}
	} catch (error) {
		console.log(`⚠ Unable to read Citus distribution metadata for ${tableName}:`, error.message)
		return {
			citusEnabled: true,
			distributionColumn: null,
		}
	}
}

module.exports = {
	async up(queryInterface) {
		console.log(`Removing unique index ${INDEX_NAME} from ${TABLE_NAME} table...`)

		const citusInfo = await getCitusDistributionInfo(queryInterface, TABLE_NAME)
		console.log(
			`Citus status: ${citusInfo.citusEnabled ? 'enabled' : 'disabled'}${
				citusInfo.distributionColumn ? `, distribution column: ${citusInfo.distributionColumn}` : ''
			}`
		)

		const exists = await indexExists(queryInterface, TABLE_NAME, INDEX_NAME)
		if (!exists) {
			console.log(`✓ Index ${INDEX_NAME} does not exist, skipping drop`)
			return
		}

		try {
			await queryInterface.removeIndex(TABLE_NAME, INDEX_NAME)
			console.log(`✓ Removed ${INDEX_NAME}`)
		} catch (error) {
			console.log('⚠ removeIndex failed, trying raw SQL DROP INDEX IF EXISTS:', error.message)
			await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${INDEX_NAME};`)
			console.log(`✓ Ensured ${INDEX_NAME} is removed`)
		}
	},

	async down(queryInterface) {
		console.log(`Recreating unique index ${INDEX_NAME} on ${TABLE_NAME} table...`)

		const exists = await indexExists(queryInterface, TABLE_NAME, INDEX_NAME)
		if (exists) {
			console.log(`✓ Index ${INDEX_NAME} already exists, skipping create`)
			return
		}

		const citusInfo = await getCitusDistributionInfo(queryInterface, TABLE_NAME)
		console.log(
			`Citus status: ${citusInfo.citusEnabled ? 'enabled' : 'disabled'}${
				citusInfo.distributionColumn ? `, distribution column: ${citusInfo.distributionColumn}` : ''
			}`
		)

		if (
			citusInfo.citusEnabled &&
			citusInfo.distributionColumn &&
			citusInfo.distributionColumn !== EXPECTED_DIST_COLUMN
		) {
			console.log(
				`⚠ Skipping ${INDEX_NAME} recreation because distribution column is '${citusInfo.distributionColumn}', expected '${EXPECTED_DIST_COLUMN}'.`
			)
			return
		}

		const [duplicates] = await queryInterface.sequelize.query(
			`SELECT tenant_code, resource_type, resource_id, organization_code, COUNT(*) AS duplicate_count
			 FROM ${TABLE_NAME}
			 WHERE deleted_at IS NULL
			 GROUP BY tenant_code, resource_type, resource_id, organization_code
			 HAVING COUNT(*) > 1
			 LIMIT 1;`
		)

		if (duplicates.length > 0) {
			console.log(
				'⚠ Skipping unique_rollout_resource_tenant recreation because duplicate active rollouts already exist.'
			)
			console.log(
				`⚠ Example duplicate key: ${duplicates[0].tenant_code}/${duplicates[0].organization_code}/${duplicates[0].resource_type}/${duplicates[0].resource_id}`
			)
			return
		}

		await queryInterface.addIndex(
			TABLE_NAME,
			['tenant_code', 'resource_type', 'resource_id', 'organization_code'],
			{
				unique: true,
				name: INDEX_NAME,
				where: { deleted_at: null },
			}
		)

		console.log(`✓ Recreated ${INDEX_NAME}`)
	},
}
