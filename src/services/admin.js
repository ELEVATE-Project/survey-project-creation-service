/**
 * name : admin.js
 * author : Priyanka Pradeep
 * created-date : 08-Sep-2025
 * Description : Admin service helper
 */

const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const { sequelize } = require('@database/models')
const { queryForbiddenPatterns } = require('@constants/blacklistConfig')

const db = require('@database/models/index')
const common = require('@constants/common')
const entityTypeQueries = require('@database/queries/entityType')
const entitiesQueries = require('@database/queries/entities')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const formQueries = require('@database/queries/form')
const reviewStageQueries = require('@database/queries/reviewStage')
const organizationExtensionQueries = require('@database/queries/organizationExtensions')
const certificateQueries = require('@database/queries/certificateBaseTemplate')
const organizationConfigQueries = require('@database/queries/organizationConfig')
const filesService = require('@services/files')
const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const requests = require('@generics/requests')
const utils = require('@generics/utils')
// Global regex cache for performance (moved outside function)
const regexCache = new Map()
const DEFAULT_TENANT_CODE = process.env.DEFAULT_TENANT_CODE
const DEFAULT_ORGANIZATION_CODE = process.env.DEFAULT_ORGANIZATION_CODE

module.exports = class AdminService {
	/**
	 * Execute a raw SELECT SQL query passed by the user.
	 * ⚠️ Only SELECT queries are allowed.
	 * @param {Object} data - The input object.
	 * @param {string} data.query - The raw SQL SELECT query string to execute.
	 * @param {number} pageNo - Page number for pagination.
	 * @param {number} pageSize - Page size for pagination.
	 * @returns {Promise<Object>} - Success response with query result.
	 * @throws {Error} - If the query is invalid, non-SELECT, or execution fails.
	 */
	static async dbFind(data, pageNo, pageSize) {
		try {
			// Validate input
			const query = validateQueryInput(data)

			// Security validation
			validateQuerySecurity(query)

			// Get pagination parameters
			const { limit, offset } = getPaginationParams(pageNo, pageSize)

			// Execute query
			const results = await executeQuery(query, limit, offset)

			// Return success response
			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'DATA_FETCHED',
				result: { data: results },
			})
		} catch (error) {
			console.error('Query execution error:', error)
			return responses.failureResponse({
				statusCode: httpStatusCode.bad_request,
				message: error.message || 'Invalid query',
			})
		}
	}

	/**
	 * Create tenant Dependencies data
	 * @method
	 * @name createTenantDependencies
	 * @param {String} tenant_code - tenant code
	 * @param {String} organization_code - organization_code
	 * @param {String} userId - userId
	 * @returns {JSON} - action creation response
	 */
	static async createTenantDependencies(tenant_code, organization_code, userId) {
		try {
			if (!tenant_code || !organization_code) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: `Tenant or Organization code Missing `,
				})
			}

			// 1. Setup Entity Types and Entities
			await this.setupEntityTypes(tenant_code, organization_code, userId)

			// 2, 3, 4. Setup Forms, Review Stages, and Organization Extensions in parallel
			await Promise.all([
				this.setupForms(tenant_code, organization_code, userId),
				this.setupReviewStages(tenant_code, organization_code, userId),
				this.setupOrganizationExtension(tenant_code, organization_code, userId),
				this.setupOrganizationConfigs(tenant_code, organization_code, userId),
			])

			// 5. Setup Certificate Base Templates
			await this.setupCertificateBaseTemplates(tenant_code, organization_code, userId)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'TENANT_SETUP_COMPLETED',
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Create entityType and mapping for new tenant
	 * @method
	 * @name setupEntityTypes
	 * @param {String} newTenantCode - tenantCode
	 * @param {String} newOrgCode - orgCode
	 * @param {String} userId -UserId
	 * @returns {JSON}
	 */
	static async setupEntityTypes(newTenantCode, newOrgCode, userId) {
		const transaction = await db.sequelize.transaction()
		try {
			// Fetch already existing entity types for target tenant/org in one go
			const defaultEntityTypes = await entityTypeQueries.findUserEntityTypeAndEntities({
				status: common.STATUS_ACTIVE,
				tenant_code: DEFAULT_TENANT_CODE,
				organization_code: DEFAULT_ORGANIZATION_CODE,
			})
			// Fetch all entity types from the default organization
			const existingEntityTypes = await entityTypeQueries.findUserEntityTypeAndEntities({
				status: common.STATUS_ACTIVE,
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
			})

			// Build map of existing entity types
			const existingEntityTypeMap = new Map(
				existingEntityTypes.map((entityType) => [entityType.value, entityType])
			)
			const existingEntitiesSet = new Set(
				existingEntityTypes.flatMap((entityType) =>
					entityType.entities
						? entityType.entities.map((entity) => `${entityType.value}|||${entity.value}`)
						: []
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
					created_by: userId,
					updated_by: userId,
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
			existingEntityTypes.forEach((entityType) => {
				completeEntityTypeMap.set(entityType.value, entityType)
			})

			// Add newly created entity types
			createdEntityTypes.forEach((entityType) => {
				completeEntityTypeMap.set(entityType.value, entityType)
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
									created_by: userId,
									updated_by: userId,
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
				tenant_code: DEFAULT_TENANT_CODE,
				organization_code: DEFAULT_ORGANIZATION_CODE,
				status: common.STATUS_ACTIVE,
			})

			// Get existing mappings for target tenant/org
			const existingMappings = await entityModelMappingQuery.findAll({
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
			})

			// Build mapping from default entity_type_id to entity_type value
			const defaultEntityTypeIdToValueMap = new Map(
				defaultEntityTypes.map((entityType) => [entityType.id, entityType.value])
			)

			// Build set of existing mapping keys using model + entity_type_value
			const existingMappingKeys = new Set()
			existingMappings.forEach((mapping) => {
				// Find the entity type value for this mapping
				const entityType = [...completeEntityTypeMap.values()].find(
					(entityType) => entityType.id === mapping.entity_type_id
				)
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

	/**
	 * Create forms  for new tenant
	 * @method
	 * @name setupForms
	 * @param {String} newTenantCode - tenantCode
	 * @param {String} newOrgCode - orgCode
	 * @param {String} userId -UserId
	 * @returns {JSON}
	 */
	static async setupForms(newTenantCode, newOrgCode, userId) {
		try {
			console.log('--- Setting up Forms ---')
			// Fetch default forms
			const defaultForms = await formQueries.findAll({
				tenant_code: DEFAULT_TENANT_CODE,
				organization_code: DEFAULT_ORGANIZATION_CODE,
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
					created_by: userId, // String instead of number for consistency
					updated_by: userId,
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
		} catch (error) {
			console.error('Error during form setup:', error)
			throw error
		}
	}

	/**
	 * Create reviewStages  for new tenant
	 * @method
	 * @name setupForms
	 * @param {String} newTenantCode - tenantCode
	 * @param {String} newOrgCode - orgCode
	 * @param {String} userId -UserId
	 * @returns {JSON}
	 */
	static async setupReviewStages(newTenantCode, newOrgCode, userId) {
		try {
			console.log('--- Setting up Review Stages ---')
			// Fetch default review stages
			const defaultReviewStages = await reviewStageQueries.findAll({
				tenant_code: DEFAULT_TENANT_CODE,
				organization_code: DEFAULT_ORGANIZATION_CODE,
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
					created_by: userId, // String instead of number for consistency
					updated_by: userId,
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

	/**
	 * Create orgExtension for new tenant
	 * @method
	 * @name setupOrganizationExtension
	 * @param {String} newTenantCode - tenantCode
	 * @param {String} newOrgCode - orgCode
	 * @param {String} userId -UserId
	 * @returns {JSON}
	 */
	static async setupOrganizationExtension(newTenantCode, newOrgCode, userId) {
		console.log('--- Setting up Organization Extension ---')
		try {
			// Fetch default organization extensions
			const defaultExtensions = await organizationExtensionQueries.findMany({
				tenant_code: DEFAULT_TENANT_CODE,
				organization_code: DEFAULT_ORGANIZATION_CODE,
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

	/**
	 * Create orgConfigs for new tenant
	 * @method
	 * @name setupOrganizationConfigs
	 * @param {String} newTenantCode - tenantCode
	 * @param {String} newOrgCode - orgCode
	 * @param {String} userId -UserId
	 * @returns {JSON}
	 */
	static async setupOrganizationConfigs(newTenantCode, newOrgCode, userId) {
		console.log('--- Setting up Organization Configs ---')
		try {
			// Fetch default organization extensions
			const defaultConfigs = await organizationConfigQueries.findMany({
				tenant_code: DEFAULT_TENANT_CODE,
				organization_code: DEFAULT_ORGANIZATION_CODE,
			})

			// Fetch existing organization extensions for target tenant/org to avoid duplicates
			const existingConfigs = await organizationConfigQueries.findMany({
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
			})

			// Check  existing configs
			if (existingConfigs?.length > 0) {
				console.log(
					`Organization configs already exist for tenant=${newTenantCode}, org=${newOrgCode}. Skipping creation.`
				)
				return {
					statusCode: httpStatusCode.internal_server_error,
					message: 'Configs already exist for target tenant/org.',
				}
			}

			//  organization config  create

			const configsToCreate = defaultConfigs.map((configs) => {
				const plain = configs.toJSON ? configs.toJSON() : configs

				return {
					..._.omit(plain, ['id', 'created_at', 'updated_at', 'deleted_at']),
					tenant_code: newTenantCode,
					organization_code: newOrgCode,
					created_by: userId,
					updated_by: userId,
					created_at: new Date(),
					updated_at: new Date(),
				}
			})

			// Create organization configs if any need to be created
			if (configsToCreate.length > 0) {
				await organizationConfigQueries.bulkCreate(configsToCreate, {
					ignoreDuplicates: true,
				})
				console.log(`Created ${configsToCreate.length} organization Configs`)
			} else {
				console.log('No new organization Configs to create - all already exist')
			}

			console.log('--- Organization Configs setup completed successfully ---')
		} catch (error) {
			console.error('Error during organization Configs setup:', error)
			throw error
		}
	}

	/**
	 * Create certificatesBaseTemplates for new tenant
	 * @method
	 * @name setupCertificateBaseTemplates
	 * @param {String} newTenantCode - tenantCode
	 * @param {String} newOrgCode - orgCode
	 * @param {String} userId -UserId
	 * @returns {JSON}
	 */
	static async setupCertificateBaseTemplates(newTenantCode, newOrgCode, userId) {
		console.log('--- Setting up Certificate Base Templates ---')
		try {
			// First, check which default templates already exist
			const certificatesArray = await certificateQueries.findAll({
				tenant_code: DEFAULT_TENANT_CODE,
				organization_code: DEFAULT_ORGANIZATION_CODE,
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
					const fileName = currentCertificate.code + newTenantCode + '.svg'
					const filePath = path.join(__dirname, '../public/assets/certificate/', fileName)
					try {
						const response = await filesService.getDownloadableUrl([currentCertificate.url])
						//Download and store it in local
						await utils.downloadFile(response.result?.[0].url, filePath)

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
							common.BASE_TEMPLATE,
							'system',
							false
						)
						if (
							!getSignedUrl.result ||
							!getSignedUrl.result.cert ||
							!Array.isArray(getSignedUrl.result.cert.files) ||
							getSignedUrl.result.cert.files.length === 0
						) {
							throw new Error(`Failed to generate signed URL for ${fileName}`)
						}

						const fileUploadUrl = getSignedUrl.result['cert']['files'][0].url
						const uploadedFilePath = getSignedUrl.result['cert']['files'][0].file
						const fileData = fs.readFileSync(filePath)

						// Upload file to cloud storage
						let cloudUpload = await requests.put(fileUploadUrl, fileData, 'application/multipart/form-data')

						if (!cloudUpload.success) {
							throw {
								statusCode: httpStatusCode.internal_server_error,
								message: 'Failed to upload file to cloud storage',
							}
						}

						currentCertificate = _.omit(currentCertificate, ['id'])
						// Prepare certificate data for database insertion
						const certificateData = {
							...currentCertificate,
							url: uploadedFilePath,
							organization_code: newOrgCode,
							tenant_code: newTenantCode,
							created_by: userId,
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
					} finally {
						//remove file from local
						utils.removeFile(filePath)
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

/**
 * Validates basic query input requirements
 */
function validateQueryInput(data) {
	const rawQuery = data.query?.trim()

	if (!rawQuery || typeof rawQuery !== 'string') {
		throw new Error('Query must be a valid string')
	}

	if (!/^\s*select\b/i.test(rawQuery)) {
		throw new Error('Only SELECT queries are allowed')
	}

	return rawQuery
}

/**
 * Comprehensive security validation for SQL queries
 */
function validateQuerySecurity(query) {
	if (!hasValidQuotes(query)) {
		throw new Error('QUERY_INVALID_OR_UNBALANCED_QUOTES')
	}

	if (hasCriticalInjectionPatterns(query)) {
		throw new Error('QUERY_FORBIDDEN_INJECTION_PATTERNS')
	}

	const normalizedQuery = normalizeQuery(query)

	if (hasForbiddenPatterns(normalizedQuery, query)) {
		throw new Error('QUERY_FORBIDDEN_PATTERNS')
	}
}

/**
 * Calculates pagination parameters with validation
 */
function getPaginationParams(pageNo, pageSize) {
	const validPageNo = Math.max(1, parseInt(pageNo) || 1)
	const validPageSize = Math.min(Math.max(1, parseInt(pageSize) || 100), 1000)
	const offset = (validPageNo - 1) * validPageSize

	return { limit: validPageSize, offset }
}

/**
 * Executes a validated SQL query with pagination
 */
async function executeQuery(query, limit, offset) {
	const paginatedQuery = `${query} LIMIT $1 OFFSET $2`

	return await sequelize.query(paginatedQuery, {
		bind: [limit, offset],
		type: sequelize.QueryTypes.SELECT,
		timeout: 30000,
	})
}

/**
 * Checks for critical injection patterns that immediately disqualify a query
 */
function hasCriticalInjectionPatterns(query) {
	const lowerQuery = query.toLowerCase()
	const criticalPatterns = ['--', ';', '/*', '*/', '#', '\\']

	return criticalPatterns.some((pattern) => lowerQuery.includes(pattern))
}

/**
 * Removes comments and string literals to get clean SQL for pattern analysis
 */
function normalizeQuery(query) {
	return query
		.toLowerCase()
		.replace(/\/\*[\s\S]*?\*\//g, ' ') // Remove /* */ comments
		.replace(/--.*$/gm, ' ') // Remove -- comments
		.replace(/#[^\n]*/g, ' ') // Remove # comments
		.replace(/\$[A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z0-9_]*\$/g, ' ') // Remove dollar quotes
		.replace(/'(?:''|[^'])*'/g, ' ') // Remove single-quoted strings
		.replace(/"(?:\\"|[^"])*"/g, ' ') // Remove double-quoted strings
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
}

/**
 * Checks if the normalized query contains any forbidden operations
 */
function hasForbiddenPatterns(normalizedQuery, originalQuery) {
	// Filter out quote patterns from forbidden patterns - they're handled separately
	const filteredPatterns = queryForbiddenPatterns.filter((pattern) => pattern !== "'" && pattern !== '"')

	// Use original query for certain patterns that might be affected by normalization
	const useOriginalFor = ['||', 'char(', 'chr(', 'concat(']

	return filteredPatterns.some((pattern) => {
		const regex = getCompiledRegex(pattern)
		const testQuery = useOriginalFor.includes(pattern) ? originalQuery.toLowerCase() : normalizedQuery
		return regex.test(testQuery)
	})
}

/**
 * Gets or creates a compiled regex pattern (cached for performance)
 */
function getCompiledRegex(pattern) {
	if (regexCache.has(pattern)) {
		return regexCache.get(pattern)
	}

	const cleanPattern = pattern.toLowerCase().trim()
	let regex

	if (/^[a-z\s]+$/.test(cleanPattern)) {
		// Word-based patterns: use word boundaries and handle spaces
		const escaped = cleanPattern
			.split(/\s+/)
			.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('\\s+')
		regex = new RegExp(`\\b${escaped}\\b`, 'i')
	} else {
		// Literal patterns: escape special characters
		const escaped = cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		regex = new RegExp(escaped, 'i')
	}

	regexCache.set(pattern, regex)
	return regex
}

/**
 * Validates that all quotes in the query are properly balanced and closed
 */
function hasValidQuotes(query) {
	let inSingleQuote = false
	let inDoubleQuote = false

	for (let i = 0; i < query.length; i++) {
		const char = query[i]
		const nextChar = query[i + 1]

		if (!inDoubleQuote && char === "'") {
			if (inSingleQuote) {
				// Check for escaped single quote ('')
				if (nextChar === "'") {
					i++ // Skip the escaped quote
					continue
				}
				inSingleQuote = false
			} else {
				inSingleQuote = true
			}
		} else if (!inSingleQuote && char === '"') {
			if (inDoubleQuote) {
				// Check for escaped double quote ("")
				if (nextChar === '"') {
					i++ // Skip the escaped quote
					continue
				}
				inDoubleQuote = false
			} else {
				inDoubleQuote = true
			}
		}
	}

	// All strings must be properly closed
	return !inSingleQuote && !inDoubleQuote
}
