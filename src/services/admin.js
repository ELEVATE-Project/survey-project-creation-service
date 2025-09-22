/**
 * name : services/admin.js
 * author : PraveenDass
 * Date : 22-Sep-2025
 * Description : Admin Service
 */

const db = require('@database/models/index')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const common = require('@constants/common')

const entityTypeQueries = require('@database/queries/entityType')
const entitiesQueries = require('@database/queries/entities')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const formQueries = require('@database/queries/form')
const reviewStageQueries = require('@database/queries/reviewStage')
const organizationExtensionQueries = require('@database/queries/organizationExtensions')
const certificateQueries = require('@database/queries/certificateBaseTemplate')
const filesService = require('@services/files')
const request = require('request')
const path = require('path')
const fs = require('fs')

module.exports = class AdminHelper {
	/**
	 * Create tenant data
	 * @method
	 * @name create
	 * @param {String} bodyData - action creation data
	 * @returns {JSON} - action creation response
	 */
	static async create(bodyData) {
		try {
			if (!bodyData.code || !bodyData.org_code) {
				throw new Error(`Tenant or Organization code Missing `)
			}
			let tenant_code = bodyData?.code
			let organization_code = bodyData?.org_code

			// 1. Setup Entity Types and Entities
			await this.setupEntityTypes(tenant_code, organization_code)

			// 2, 3, 4. Setup Forms, Review Stages, and Organization Extensions in parallel
			await Promise.all([
				this.setupForms(tenant_code, organization_code),
				this.setupReviewStages(tenant_code, organization_code),
				this.setupOrganizationExtension(tenant_code, organization_code),
			])

			// 5. Setup Certificate Base Templates
			await this.setupCertificateBaseTemplates(tenant_code, organization_code)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'TENANT_SETUP_COMPLETED',
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	static async setupEntityTypes(newTenantCode, newOrgCode) {
		const transaction = await db.sequelize.transaction()
		try {
			// Fetch already existing entity types for target tenant/org in one go
			const defaultEntityTypes = await entityTypeQueries.findUserEntityTypeAndEntities({
				status: 'ACTIVE',
				tenant_code: process.env.DEFAULT_TENANT_CODE,
				organization_code: process.env.DEFAULT_ORGANIZATION_CODE,
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
				existingEntityTypes.flatMap((et) =>
					et.entities ? et.entities.map((e) => `${et.value}|||${e.value}`) : []
				)
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
				createdEntityTypes = await entityTypeQueries.bulkCreate(entityTypesToCreate, {
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
				await entitiesQueries.bulkCreate(entitiesToCreate, {
					transaction,
				})
				console.log(`Created ${entitiesToCreate.length} entities`)
			}

			// Handle entity model mappings
			const defaultMappings = await entityModelMappingQuery.findAll({
				tenant_code: process.env.DEFAULT_TENANT_CODE,
				organization_code: process.env.DEFAULT_ORGANIZATION_CODE,
				status: 'ACTIVE',
			})

			// Get existing mappings for target tenant/org
			const existingMappings = await entityModelMappingQuery.findAll({
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
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
				await entityModelMappingQuery.bulkCreate(mappingsToCreate, {
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

	static async setupForms(newTenantCode, newOrgCode) {
		console.log('--- Setting up Forms ---')
		// Fetch default forms
		const defaultForms = await formQueries.findAll({
			tenant_code: process.env.DEFAULT_TENANT_CODE,
			organization_code: process.env.DEFAULT_ORGANIZATION_CODE,
		})

		// Fetch existing forms for target tenant/org to avoid duplicates
		const existingForms = await formQueries.findAll({
			tenant_code: newTenantCode,
			organization_code: newOrgCode,
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
			await formQueries.bulkCreate(formsToCreate, {
				ignoreDuplicates: true,
			})
			console.log(`Created ${formsToCreate.length} forms`)
		} else {
			console.log('No new forms to create - all already exist')
		}
		console.log('--- Forms setup completed successfully ---')
	}

	static async setupReviewStages(newTenantCode, newOrgCode) {
		try {
			console.log('--- Setting up Review Stages ---')
			// Fetch default review stages
			const defaultReviewStages = await reviewStageQueries.findAll({
				tenant_code: process.env.DEFAULT_TENANT_CODE,
				organization_code: process.env.DEFAULT_ORGANIZATION_CODE,
			})

			// Fetch existing review stages for target tenant/org to avoid duplicates
			const existingReviewStages = await reviewStageQueries.findAll({
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
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
				await reviewStageQueries.bulkCreate(reviewStagesToCreate, {
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

	static async setupOrganizationExtension(newTenantCode, newOrgCode) {
		console.log('--- Setting up Organization Extension ---')
		try {
			// Fetch default organization extensions
			const defaultExtensions = await organizationExtensionQueries.findMany({
				tenant_code: process.env.DEFAULT_TENANT_CODE,
				organization_code: process.env.DEFAULT_ORGANIZATION_CODE,
			})

			// Fetch existing organization extensions for target tenant/org to avoid duplicates
			const existingExtensions = await organizationExtensionQueries.findMany({
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
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
				await organizationExtensionQueries.bulkCreate(extensionsToCreate, {
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

	static async setupCertificateBaseTemplates(newTenantCode, newOrgCode) {
		console.log('--- Setting up Certificate Base Templates ---')
		try {
			// First, check which default templates already exista
			const certificatesArray = await certificateQueries.findAll({
				tenant_code: process.env.DEFAULT_TENANT_CODE,
				organization_code: process.env.DEFAULT_ORGANIZATION_CODE,
			})

			// First, check which templates already exist to avoid duplicates
			const existingTemplates = await certificateQueries.findAll({
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
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
						const fileName = currentCertificate.code + newTenantCode + '.svg'
						const filePath = path.join(__dirname, '../public/assets/certificate/', fileName)
						const response = await filesService.getDownloadableUrl([currentCertificate.url])
						//Download and store it in local
						await downloadFile(response.result?.[0].url, filePath)

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
						const getSignedUrl = await filesService.getSignedUrl(
							payloadData,
							'BASE_TEMPLATE',
							'system',
							false
						)
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
						currentCertificate = _.omit(currentCertificate, ['id'])
						// Prepare certificate data for database insertion
						const certificateData = {
							...currentCertificate,
							url: uploadedFilePath,
							organization_code: newOrgCode,
							tenant_code: newTenantCode,
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
						removeFile(filePath)
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
			return certificatesCreated
		} catch (error) {
			console.error('Error during certificate templates setup:', error)

			throw error
		}
	}
}

async function downloadFile(url, filePath) {
	return new Promise((resolve, reject) => {
		const writer = fs.createWriteStream(filePath)
		request(url)
			.pipe(writer)
			.on('finish', () => resolve(filePath))
			.on('error', reject)
	})
}

function removeFile(filePath) {
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath)
		console.log(`Deleted: ${filePath}`)
	}
}
