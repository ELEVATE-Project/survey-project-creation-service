/**
 * name : setupTenant.js
 * author : Priyanka Pradeep
 * created-date : 08-Aug-2025
 * Description : Script to set up a new tenant and organization with default configurations.
 */

require('module-alias/register')
require('dotenv').config({ path: '../.env' })

// Default tenant and organization codes
const DEFAULT_TENANT_CODE = process.env.DEFAULT_TENANT_CODE
const DEFAULT_ORGANIZATION_CODE = process.env.DEFAULT_ORGANIZATION_CODE

if (!DEFAULT_TENANT_CODE || !DEFAULT_ORGANIZATION_CODE) {
	console.error('Missing DEFAULT_TENANT_CODE or DEFAULT_ORGANIZATION_CODE in environment. Aborting.')
	process.exit(1)
}

const path = require('path')
const _ = require('lodash')
const fs = require('fs')

// Import queries
const entityTypeQueries = require('@database/queries/entityType')
const fileService = require('@services/files')
const request = require('request') // Use a more specific name to avoid confusion
const common = require('@constants/common')
const utils = require('@generics/utils')
const certificateQueries = require('../database/queries/certificateBaseTemplate')
const userRequest = require('@requests/user') // Import user request

const EntityType = require('@database/models/index').EntityType
const Entity = require('@database/models/index').Entity
const EntityModelMapping = require('@database/models/index').EntityModelMapping

const sequelize = require('@database/models/index').sequelize
const Form = require('@database/models/index').Form // Import the Form model
const ReviewStage = require('@database/models/index').ReviewStage // Import the ReviewStage model
const OrganizationExtension = require('@database/models/index').organizationExtension // Import the OrganizationExtension model
const OrganizationConfigs = require('@database/models/index').organizationConfig // Import the organizationConfig model

// Main setup function
;(async () => {
	const args = process.argv.slice(2).reduce((acc, arg) => {
		const [key, value] = arg.split('=')
		if (key && value) {
			acc[key.replace(/^--/, '')] = value
		}
		return acc
	}, {})

	const { tenant_code, organization_code } = args

	if (!tenant_code || !organization_code) {
		console.error(
			'Usage: node setupTenant.js --tenant_code=<new_tenant_code> --organization_code=<new_organization_code>'
		)
		process.exit(1)
	}

	try {
		console.log(`Starting setup for tenant: ${tenant_code}, organization: ${organization_code}`)

		// 0. Validate Tenant and Organization
		let validateTenantandOrg = await validateTenantAndOrganization(tenant_code, organization_code)
		if (!validateTenantandOrg.success) {
			throw new Error(`Tenant or Organization validation failed: ${validateTenantandOrg.message}`)
		}

		// 1. Setup Entity Types and Entities
		await setupEntityTypes(tenant_code, organization_code)

		// 2, 3, 4. Setup Forms, Review Stages, and Organization Extensions in parallel
		await Promise.all([
			setupForms(tenant_code, organization_code),
			setupReviewStages(tenant_code, organization_code),
			setupOrganizationExtension(tenant_code, organization_code),
			setupOrganizationConfigs(tenant_code, organization_code),
		])

		// 5. Setup Certificate Base Templates
		await setupCertificateBaseTemplates(tenant_code, organization_code)

		console.log('***********Tenant setup completed successfully!***********')
		process.exit(0)
	} catch (error) {
		console.error(`********Error during tenant setup: ${error.message || error}`)
		process.exit(1)
	}
})()

//commenting as of now we dont have tenant validation with internal access token
async function validateTenantAndOrganization(tenantCode, orgCode) {
	console.log('--- Validating Tenant and Organization ---')
	try {
		const orgDetails = await userRequest.fetchOrg(orgCode, tenantCode)
		if (!orgDetails.success || !orgDetails?.data?.result?.id) {
			throw new Error(`Organization validation failed for ${orgCode}: ${orgDetails.message || 'Not found'}`)
		}

		return {
			success: true,
		}
	} catch (error) {
		return {
			success: false,
			message: error.message || 'Organization or Tenant is not valid',
		}
	}
}

async function setupEntityTypes(newTenantCode, newOrgCode) {
	console.log('--- Setting up Entity Types and Entities ---')
	const transaction = await sequelize.transaction()
	try {
		// Fetch already existing entity types for target tenant/org in one go
		const defaultEntityTypes = await entityTypeQueries.findUserEntityTypeAndEntities({
			status: 'ACTIVE',
			tenant_code: DEFAULT_TENANT_CODE,
			organization_code: DEFAULT_ORGANIZATION_CODE,
		})

		// Fetch all entity types from the default organization
		const existingEntityTypes = await entityTypeQueries.findUserEntityTypeAndEntities({
			status: 'ACTIVE',
			tenant_code: newTenantCode,
			organization_code: newOrgCode,
		})

		// Build map of existing entity types
		const existingEntityTypeMap = new Map(existingEntityTypes.map((et) => [et.value, et]))
		const existingEntitiesSet = new Set(
			existingEntityTypes.flatMap((et) => (et.entities ? et.entities.map((e) => `${et.value}|||${e.value}`) : []))
		)

		// Prepare entity types for creation
		const entityTypesToCreate = defaultEntityTypes
			.filter((dt) => !existingEntityTypeMap.has(dt.value))
			.map((dt) => ({
				..._.omit(dt.toJSON ? dt.toJSON() : dt, [
					'id',
					'created_at',
					'updated_at',
					'deleted_at',
					'entities',
					'entity_model_mappings',
				]),
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
				created_by: '0',
				updated_by: '0',
			}))

		//  Create new entity types
		let createdEntityTypes = []
		if (entityTypesToCreate.length) {
			createdEntityTypes = await EntityType.bulkCreate(entityTypesToCreate, {
				transaction,
				returning: true,
				raw: true,
			})

			console.log(`Created ${entityTypesToCreate.length} new entity types`)
		}

		// Build complete entity type mapping (existing + newly created)
		const completeEntityTypeMap = new Map()
		// Add existing entity types
		existingEntityTypes.forEach((et) => {
			completeEntityTypeMap.set(et.value, et)
		})

		// Add newly created entity types
		createdEntityTypes.forEach((et) => {
			completeEntityTypeMap.set(et.value, et)
		})

		// Prepare entities for creation
		const entitiesToCreate = []
		defaultEntityTypes.forEach((defaultEntityType) => {
			if (defaultEntityType.entities && Array.isArray(defaultEntityType.entities)) {
				defaultEntityType.entities.forEach((entity) => {
					const entityKey = `${defaultEntityType.value}|||${entity.value}`

					// Only create if entity doesn't exist
					if (!existingEntitiesSet.has(entityKey)) {
						const targetEntityType = completeEntityTypeMap.get(defaultEntityType.value)

						if (targetEntityType) {
							entitiesToCreate.push({
								..._.omit(entity.toJSON ? entity.toJSON() : entity, [
									'id',
									'created_at',
									'updated_at',
									'deleted_at',
								]),
								entity_type_id: targetEntityType.id,
								tenant_code: newTenantCode,
								organization_code: newOrgCode,
								created_by: '0',
								updated_by: '0',
							})
						}
					}
				})
			}
		})

		// Create entities
		if (entitiesToCreate.length > 0) {
			await Entity.bulkCreate(entitiesToCreate, {
				transaction,
			})
			console.log(`Created ${entitiesToCreate.length} entities`)
		}

		// Handle entity model mappings
		const defaultMappings = await EntityModelMapping.findAll({
			where: {
				tenant_code: DEFAULT_TENANT_CODE,
				organization_code: DEFAULT_ORGANIZATION_CODE,
				status: 'ACTIVE',
			},
			raw: true,
		})

		// Get existing mappings for target tenant/org
		const existingMappings = await EntityModelMapping.findAll({
			where: {
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
			},
			raw: true,
		})

		// Build mapping from default entity_type_id to entity_type value
		const defaultEntityTypeIdToValueMap = new Map(defaultEntityTypes.map((et) => [et.id, et.value]))

		// Build set of existing mapping keys using model + entity_type_value
		const existingMappingKeys = new Set()
		existingMappings.forEach((mapping) => {
			// Find the entity type value for this mapping
			const entityType = [...completeEntityTypeMap.values()].find((et) => et.id === mapping.entity_type_id)
			if (entityType) {
				existingMappingKeys.add(`${mapping.model}|||${entityType.value}`)
			}
		})

		// Prepare model mappings for creation
		let mappingsToCreate = []
		defaultMappings.forEach((mapping) => {
			// Get the entity type value from default mapping
			const entityTypeValue = defaultEntityTypeIdToValueMap.get(mapping.entity_type_id)

			if (entityTypeValue) {
				const mappingKey = `${mapping.model}|||${entityTypeValue}`

				// Only create if mapping doesn't exist
				if (!existingMappingKeys.has(mappingKey)) {
					const targetEntityType = completeEntityTypeMap.get(entityTypeValue)

					if (targetEntityType) {
						mappingsToCreate.push({
							..._.omit(mapping, ['id', 'created_at', 'updated_at', 'deleted_at']),
							entity_type_id: targetEntityType.id,
							tenant_code: newTenantCode,
							organization_code: newOrgCode,
						})
					}
				}
			}
		})

		// Create model mappings
		if (mappingsToCreate.length > 0) {
			await EntityModelMapping.bulkCreate(mappingsToCreate, {
				transaction,
			})
			console.log(`Created ${mappingsToCreate.length} model mappings`)
		}

		// Commit transaction
		await transaction.commit()
		console.log('--- Entity Types and Entities setup completed successfully ---')
	} catch (error) {
		console.error('Error during entity types setup:', error)
		await transaction.rollback()
		throw error
	}
}

async function setupForms(newTenantCode, newOrgCode) {
	console.log('--- Setting up Forms ---')
	// Fetch default forms
	const defaultForms = await Form.findAll({
		where: {
			tenant_code: DEFAULT_TENANT_CODE,
			organization_code: DEFAULT_ORGANIZATION_CODE,
		},
		raw: true,
	})

	// Fetch existing forms for target tenant/org to avoid duplicates
	const existingForms = await Form.findAll({
		where: {
			tenant_code: newTenantCode,
			organization_code: newOrgCode,
		},
		raw: true,
	})

	// Build set of existing form identifiers
	const existingFormKeys = new Set(existingForms.map((form) => `${form.type}|||${form.sub_type}`))

	// Filter out forms that already exist
	const formsToCreate = defaultForms
		.filter((defaultForm) => {
			const formKey = `${defaultForm.type}|||${defaultForm.sub_type}`
			return !existingFormKeys.has(formKey)
		})
		.map((defaultForm) => ({
			..._.omit(defaultForm.toJSON ? defaultForm.toJSON() : defaultForm, [
				'id',
				'created_at',
				'updated_at',
				'deleted_at',
			]),
			tenant_code: newTenantCode,
			organization_code: newOrgCode,
			created_by: '0', // String instead of number for consistency
			updated_by: '0',
		}))
	// Create forms if any need to be created
	if (formsToCreate.length > 0) {
		await Form.bulkCreate(formsToCreate, {
			ignoreDuplicates: true,
		})
		console.log(`Created ${formsToCreate.length} forms`)
	} else {
		console.log('No new forms to create - all already exist')
	}
	console.log('--- Forms setup completed successfully ---')
}

async function setupReviewStages(newTenantCode, newOrgCode) {
	try {
		console.log('--- Setting up Review Stages ---')
		// Fetch default review stages
		const defaultReviewStages = await ReviewStage.findAll({
			where: { tenant_code: DEFAULT_TENANT_CODE, organization_code: DEFAULT_ORGANIZATION_CODE },
			raw: true,
		})

		// Fetch existing review stages for target tenant/org to avoid duplicates
		const existingReviewStages = await ReviewStage.findAll({
			where: {
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
			},
			raw: true,
		})

		// Adjust the key based on your ReviewStage model's unique identifier field
		const existingStageKeys = new Set(
			existingReviewStages.map((stage) => `${stage.resource_type}|||${stage.role}|||${stage.level}`)
		)

		// Filter out review stages that already exist
		const reviewStagesToCreate = defaultReviewStages
			.filter((defaultStage) => {
				const stageKey = `${defaultStage.resource_type}|||${defaultStage.role}|||${defaultStage.level}`
				return !existingStageKeys.has(stageKey)
			})
			.map((defaultStage) => ({
				..._.omit(defaultStage.toJSON ? defaultStage.toJSON() : defaultStage, [
					'id',
					'created_at',
					'updated_at',
					'deleted_at',
				]),
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
				created_by: '0', // String instead of number for consistency
				updated_by: '0',
			}))

		// Create review stages if any need to be created
		if (reviewStagesToCreate.length > 0) {
			await ReviewStage.bulkCreate(reviewStagesToCreate, {
				ignoreDuplicates: true,
			})
			console.log(`Created ${reviewStagesToCreate.length} review stages`)
		} else {
			console.log('No new review stages to create - all already exist')
		}
	} catch (error) {
		console.error('Error during review stages setup:', error)
		throw error
	}
}

async function setupOrganizationExtension(newTenantCode, newOrgCode) {
	console.log('--- Setting up Organization Extension ---')
	try {
		// Fetch default organization extensions
		const defaultExtensions = await OrganizationExtension.findAll({
			where: {
				tenant_code: DEFAULT_TENANT_CODE,
				organization_code: DEFAULT_ORGANIZATION_CODE,
			},
			raw: true,
		})

		// Fetch existing organization extensions for target tenant/org to avoid duplicates
		const existingExtensions = await OrganizationExtension.findAll({
			where: {
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
			},
			raw: true,
		})

		// Build set of existing extension identifiers
		const existingExtensionKeys = new Set(existingExtensions.map((ext) => ext.resource_type))

		// Filter out organization extensions that already exist
		const extensionsToCreate = defaultExtensions
			.filter((defaultExt) => {
				const extKey = defaultExt.resource_type
				return !existingExtensionKeys.has(extKey)
			})
			.map((defaultExt) => ({
				..._.omit(defaultExt.toJSON ? defaultExt.toJSON() : defaultExt, [
					'id',
					'created_at',
					'updated_at',
					'deleted_at',
				]),
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
			}))

		// Create organization extensions if any need to be created
		if (extensionsToCreate.length > 0) {
			await OrganizationExtension.bulkCreate(extensionsToCreate, {
				ignoreDuplicates: true,
			})
			console.log(`Created ${extensionsToCreate.length} organization extensions`)
		} else {
			console.log('No new organization extensions to create - all already exist')
		}

		console.log('--- Organization Extension setup completed successfully ---')
	} catch (error) {
		console.error('Error during organization extensions setup:', error)
		throw error
	}
}

async function setupOrganizationConfigs(newTenantCode, newOrgCode) {
	console.log('--- Setting up Organization Configs ---')
	try {
		// Fetch default organization Configs
		const defaultConfigs = await OrganizationConfigs.findAll({
			where: {
				tenant_code: DEFAULT_TENANT_CODE,
				organization_code: DEFAULT_ORGANIZATION_CODE,
			},
			raw: true,
		})

		// Fetch existing organization Configs for target tenant/org to avoid duplicates
		const existingConfigs = await OrganizationConfigs.findAll({
			where: {
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
			},
			raw: true,
		})

		// Check existing configs
		if (existingConfigs?.length > 0) {
			console.log(
				`Organization configs already exist for tenant=${newTenantCode}, org=${newOrgCode}. Skipping creation.`
			)
		}

		// Prepare organization configs to create
		const configToCreate = {
			..._.omit(defaultConfigs[0], ['id', 'created_at', 'updated_at', 'deleted_at']),
			tenant_code: newTenantCode,
			organization_code: newOrgCode,
			created_by: '0',
			updated_by: '0',
			created_at: new Date(),
			updated_at: new Date(),
		}

		// Create organization Configs if any need to be created
		await OrganizationConfigs.create(configToCreate)

		console.log(`Created ${configToCreate.length} organization config`)

		console.log('--- Organization config setup completed successfully ---')
	} catch (error) {
		console.error('Error during organization config setup:', error)
		throw error
	}
}

async function setupCertificateBaseTemplates(newTenantCode, newOrgCode) {
	console.log('--- Setting up Certificate Base Templates ---')
	try {
		const certificatesArray = [
			{
				code: 'onelogo_onesign',
				name: 'One Logo One Signature',
				meta: {
					logos: [
						{
							stateLogo: 'stateLogo1',
						},
					],
					signatures: [
						{
							signature: 'signatureImg1',
							signatureDesignation: 'signatureTitleDesignation1',
							signatureName: 'signatureTitleName1',
						},
					],
					QrCode: null,
				},
			},
			{
				code: 'onelogo_twosign',
				name: 'One Logo Two Signature',
				meta: {
					logos: [
						{
							stateLogo: 'stateLogo1',
						},
					],
					signatures: [
						{
							signature: 'signatureImg1',
							signatureDesignation: 'signatureTitleDesignation1',
							signatureName: 'signatureTitleName1',
						},
						{
							signature: 'signatureImg2',
							signatureDesignation: 'signatureTitleDesignation2',
							signatureName: 'signatureTitleName2',
						},
					],
					QrCode: null,
				},
			},
			{
				code: 'twologo_onesign',
				name: 'Two Logo One Signature',
				meta: {
					logos: [
						{
							stateLogo: 'stateLogo1',
						},
						{
							stateLogo: 'stateLogo2',
						},
					],
					signatures: [
						{
							signature: 'signatureImg1',
							signatureDesignation: 'signatureTitleDesignation1',
							signatureName: 'signatureTitleName1',
						},
					],
					QrCode: null,
				},
			},
			{
				code: 'twologo_twosign',
				name: 'Two Logo Two Signature',
				meta: {
					logos: [
						{
							stateLogo: 'stateLogo1',
						},
						{
							stateLogo: 'stateLogo2',
						},
					],
					signatures: [
						{
							signature: 'signatureImg1',
							signatureDesignation: 'signatureTitleDesignation1',
							signatureName: 'signatureTitleName1',
						},
						{
							signature: 'signatureImg2',
							signatureDesignation: 'signatureTitleName2',
							signatureName: 'signatureTitleDesignation2',
						},
					],
					QrCode: null,
				},
			},
		]

		// First, check which templates already exist to avoid duplicates
		const existingTemplates = await certificateQueries.findAll({
			tenant_code: utils.convertToString(newTenantCode),
			organization_code: utils.convertToString(newOrgCode),
			resource_type: common.PROJECT,
		})

		// Build set of existing template codes
		const existingTemplateCodes = new Set(existingTemplates.map((template) => template.code))

		// Filter out certificates that already exist
		const certificatesToProcess = certificatesArray.filter((cert) => !existingTemplateCodes.has(cert.code))

		if (certificatesToProcess.length === 0) {
			console.log('All certificate templates already exist. Skipping setup.')
			return
		}

		console.log(`Processing ${certificatesToProcess.length} new certificate templates`)

		// Process certificates in batches to avoid overwhelming the system
		const BATCH_SIZE = 2 // Process 2 certificates at a time
		const certificatesCreated = []

		for (let i = 0; i < certificatesToProcess.length; i += BATCH_SIZE) {
			const batch = certificatesToProcess.slice(i, i + BATCH_SIZE)

			const batchPromises = batch.map(async (currentCertificate) => {
				try {
					const fileName = currentCertificate.code + '.svg'
					const filePath = path.join(__dirname, '../public/assets/certificate/', fileName)

					// Check if file exists
					try {
						fs.accessSync(filePath, fs.constants.F_OK)
						console.log(`  File ${fileName} exists, processing...`)
					} catch (err) {
						console.warn(
							`  File ${fileName} does not exist. Skipping certificate "${currentCertificate.code}".`
						)
						return null // Skip this certificate
					}

					// Prepare file upload payload
					const payloadData = {
						cert: {
							files: [fileName],
						},
						ref: common.CERTIFICATE,
					}

					// Get signed URL for file upload
					const getSignedUrl = await fileService.getSignedUrl(payloadData, 'BASE_TEMPLATE', 'system', false)
					if (!getSignedUrl.result) {
						throw new Error(`Failed to generate signed URL for ${fileName}`)
					}

					const fileUploadUrl = getSignedUrl.result['cert']['files'][0].url
					const uploadedFilePath = getSignedUrl.result['cert']['files'][0].file
					const fileData = fs.readFileSync(filePath)

					// Upload file to cloud storage
					await request({
						url: fileUploadUrl,
						method: 'put',
						headers: {
							'Content-Type': 'application/multipart/form-data',
						},
						body: fileData,
					})

					// Prepare certificate data for database insertion
					const certificateData = {
						...currentCertificate,
						url: uploadedFilePath,
						organization_code: utils.convertToString(newOrgCode),
						tenant_code: utils.convertToString(newTenantCode),
						resource_type: common.PROJECT,
						created_by: common.CREATED_BY_SYSTEM,
						created_at: new Date(),
						updated_at: new Date(),
					}

					// Create certificate template in database
					const certificate = await certificateQueries.create(certificateData)
					if (!certificate.id) {
						throw new Error(`Failed to create certificate template: ${currentCertificate.code}`)
					}

					console.log(`  ✓ Certificate template "${currentCertificate.code}" created successfully`)
					return certificate
				} catch (error) {
					console.error(`  ✗ Error setting up certificate "${currentCertificate.code}":`, error.message)
					// Don't throw here - let other certificates in the batch continue
					return null
				}
			})

			// Wait for current batch to complete before processing next batch
			const batchResults = await Promise.all(batchPromises)
			const successfulResults = batchResults.filter((result) => result !== null)
			certificatesCreated.push(...successfulResults)

			// Small delay between batches to avoid overwhelming the system
			if (i + BATCH_SIZE < certificatesToProcess.length) {
				await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second delay
			}

			console.log(
				`--- Certificate Base Templates setup completed: ${certificatesCreated.length}/${certificatesToProcess.length} templates created successfully ---`
			)
		}
	} catch (error) {
		console.error('Error during certificate templates setup:', error)

		throw error
	}
}
