/**
 * name : setupTenant.js
 * author : Priyanka Pradeep
 * created-date : 08-Aug-2025
 * Description : Script to set up a new tenant and organization with default configurations.
 */

require('module-alias/register')
require('dotenv').config()

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
const entityQueries = require('@database/queries/entities')
const entityModelMappingQueries = require('@database/queries/entityModelMapping')
const formQueries = require('@database/queries/form')
const reviewStageQueries = require('@database/queries/reviewStage')
const organizationExtensionQueries = require('@database/queries/organizationExtensions')
const fileService = require('@services/files')
const request = require('request')
const common = require('@constants/common')
const utils = require('@generics/utils')
const certificateQueries = require('../database/queries/certificateBaseTemplate')

const EntityModelMapping = require('@database/models/index').EntityModelMapping
const sequelize = require('@database/models/index').sequelize

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

		// 1. Setup Entity Types and Entities
		await setupEntityTypes(tenant_code, organization_code)

		// 2. Setup Forms
		await setupForms(tenant_code, organization_code)

		// 3. Setup Review Stages
		await setupReviewStages(tenant_code, organization_code)

		// 4. Setup Organization Extension
		await setupOrganizationExtension(tenant_code, organization_code)

		// 5. Setup Certificate Base Templates
		await setupCertificateBaseTemplates(tenant_code, organization_code)

		console.log('Tenant setup completed successfully!')
		process.exit(0)
	} catch (error) {
		console.error('Error during tenant setup:', error)
		process.exit(1)
	}
})()

async function setupEntityTypes(newTenantCode, newOrgCode) {
	console.log('--- Setting up Entity Types and Entities ---')
	const transaction = await sequelize.transaction()
	try {
		// Fetch all entity types from the default organization
		const defaultEntityTypes = await entityTypeQueries.findAllEntityTypes(
			[DEFAULT_ORGANIZATION_CODE],
			DEFAULT_TENANT_CODE
		)

		for (const defaultType of defaultEntityTypes) {
			// Check if the entity type already exists for the new tenant/org
			let newEntityType = await entityTypeQueries.findOneEntityType(
				{
					value: defaultType.value,
					tenant_code: newTenantCode,
					organization_code: newOrgCode,
				},
				{ transaction }
			)

			if (!newEntityType) {
				// If it doesn't exist, create it
				console.log(`Creating entity type: ${defaultType.value}`)
				const newEntityTypeData = {
					..._.omit(defaultType, ['id', 'createdAt', 'updatedAt', 'entity_model_mappings']),
					tenant_code: newTenantCode,
					organization_code: newOrgCode,
					created_by: 0,
					updated_by: 0,
				}
				newEntityType = await entityTypeQueries.createEntityType(newEntityTypeData, { transaction })
			} else {
				console.log(`Entity type already exists: ${defaultType.value}`)
			}

			// Fetch and create model mappings for this type
			const defaultMappings = await EntityModelMapping.findAll({
				where: {
					entity_type_id: defaultType.id,
					tenant_code: DEFAULT_TENANT_CODE,
					organization_code: DEFAULT_ORGANIZATION_CODE,
				},
				raw: true,
				transaction,
			})

			for (const defaultMapping of defaultMappings) {
				const newMapping = await EntityModelMapping.findOne({
					where: {
						model: defaultMapping.model,
						entity_type_id: newEntityType.id,
						tenant_code: newTenantCode,
						organization_code: newOrgCode,
					},
					transaction,
				})

				if (!newMapping) {
					console.log(`	Creating model mapping: ${defaultMapping.model}`)
					await entityModelMappingQueries.create(
						{
							..._.omit(defaultMapping, ['id', 'createdAt', 'updatedAt']),
							entity_type_id: newEntityType.id,
							tenant_code: newTenantCode,
							organization_code: newOrgCode,
						},
						{ transaction }
					)
				}
			}

			// Fetch and create entities for this type
			const defaultEntities = await entityQueries.findAllEntities(
				{
					entity_type_id: defaultType.id,
					organization_code: DEFAULT_ORGANIZATION_CODE,
					tenant_code: DEFAULT_TENANT_CODE,
				},
				{ transaction }
			)

			for (const defaultEntity of defaultEntities) {
				// Check if entity already exists
				const newEntity = await entityQueries.findOne(
					{
						value: defaultEntity.value,
						entity_type_id: newEntityType.id,
						tenant_code: newTenantCode,
						organization_code: newOrgCode,
					},
					{ transaction }
				)

				if (!newEntity) {
					console.log(`	Creating entity: ${defaultEntity.label}`)
					await entityQueries.createEntity(
						{
							..._.omit(defaultEntity, ['id', 'created_at', 'updated_at']),
							entity_type_id: newEntityType.id,
							tenant_code: newTenantCode,
							organization_code: newOrgCode,
							created_by: 0,
							updated_by: 0,
						},
						{ transaction }
					)
				}
			}
		}
		await transaction.commit()
		console.log('--- Entity Types and Entities setup completed successfully ---')
	} catch (error) {
		await transaction.rollback()
		console.error('Error during entity types setup:', error)
		throw error
	}
}

async function setupForms(newTenantCode, newOrgCode) {
	console.log('--- Setting up Forms ---')
	const defaultForms = await formQueries.findAll({
		tenant_code: DEFAULT_TENANT_CODE,
		organization_code: DEFAULT_ORGANIZATION_CODE,
	})
	for (const defaultForm of defaultForms) {
		const newForm = await formQueries.findOne({
			type: defaultForm.type,
			sub_type: defaultForm.sub_type,
			tenant_code: newTenantCode,
			organization_code: newOrgCode,
		})

		if (!newForm) {
			console.log(`Creating form: ${defaultForm.type} - ${defaultForm.sub_type}`)
			await formQueries.create({
				..._.omit(defaultForm, ['id', 'created_at', 'updated_at']),
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
				created_by: 0,
				updated_by: 0,
			})
		}
	}
}

async function setupReviewStages(newTenantCode, newOrgCode) {
	console.log('--- Setting up Review Stages ---')
	const defaultReviewStages = await reviewStageQueries.findAll({
		tenant_code: DEFAULT_TENANT_CODE,
		organization_code: DEFAULT_ORGANIZATION_CODE,
	})
	for (const defaultStage of defaultReviewStages) {
		const newStage = await reviewStageQueries.findOne({
			role: defaultStage.role,
			level: defaultStage.level,
			resource_type: defaultStage.resource_type,
			tenant_code: newTenantCode,
			organization_code: newOrgCode,
		})

		if (!newStage) {
			console.log(`Creating review stage: ${defaultStage.resource_type}`)
			await reviewStageQueries.create({
				..._.omit(defaultStage, ['id', 'created_at', 'updated_at']),
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
				created_by: 0,
				updated_by: 0,
			})
		}
	}
}

async function setupOrganizationExtension(newTenantCode, newOrgCode) {
	console.log('--- Setting up Organization Extension ---')
	const defaultExtensions = await organizationExtensionQueries.findMany({
		tenant_code: DEFAULT_TENANT_CODE,
		organization_code: DEFAULT_ORGANIZATION_CODE,
	})

	for (const defaultExt of defaultExtensions) {
		const newExt = await organizationExtensionQueries.findOne({
			tenant_code: newTenantCode,
			organization_code: newOrgCode,
			resource_type: defaultExt.resource_type,
		})

		if (!newExt) {
			console.log(`Creating organization extension ${defaultExt.resource_type}`)
			await organizationExtensionQueries.create({
				..._.omit(defaultExt, ['id', 'created_at', 'updated_at']),
				tenant_code: newTenantCode,
				organization_code: newOrgCode,
				created_by: 0,
				updated_by: 0,
			})
		}
	}
}

async function setupCertificateBaseTemplates(newTenantCode, newOrgCode) {
	console.log('--- Setting up Certificate Base Templates ---')

	const certificatesArray = [
		{
			code: 'one_logo_one_sign',
			name: 'One Logo One Signature',
			meta: {
				logos: {
					no_of_logos: 1,
					stateLogo1: null,
				},
				signature: {
					no_of_signature: 1,
					signatureImg1: null,
				},
				signatureTitleName1: 'Name',
				signatureTitleDesignation1: 'Designation',
				QrCode: null,
			},
		},
		{
			code: 'one_logo_two_sign',
			name: 'One Logo Two Signature',
			meta: {
				logos: {
					no_of_logos: 1,
					stateLogo1: null,
				},
				signature: {
					no_of_signature: 2,
					signatureImg1: null,
					signatureImg2: null,
				},
				signatureTitleName1: 'Name',
				signatureTitleDesignation1: 'Designation',
				signatureTitleName2: 'Name',
				signatureTitleDesignation2: 'Designation',
				QrCode: null,
			},
		},
		{
			code: 'two_logo_one_sign',
			name: 'Two Logo One Signature',
			meta: {
				logos: {
					no_of_logos: 2,
					stateLogo1: null,
					stateLogo2: null,
				},
				signature: {
					no_of_signature: 1,
					signatureImg1: null,
				},
				signatureTitleName1: 'Name',
				signatureTitleDesignation1: 'Designation',
				QrCode: null,
			},
		},
		{
			code: 'two_logo_two_sign',
			name: 'Two Logo Two Signature',
			meta: {
				logos: {
					no_of_logos: 2,
					stateLogo1: null,
					stateLogo2: null,
				},
				signature: {
					no_of_signature: 2,
					signatureImg1: null,
					signatureImg2: null,
				},
				signatureTitleName1: 'Name',
				signatureTitleDesignation1: 'Designation',
				signatureTitleName2: 'Name',
				signatureTitleDesignation2: 'Designation',
				QrCode: null,
			},
		},
	]

	for (let certPointer = 0; certPointer < certificatesArray.length; certPointer++) {
		let currentPointerArray = certificatesArray[certPointer]

		let fileName = currentPointerArray.code + '.svg'
		let filePath = path.join(__dirname, '../public/assets/certificate/', fileName)
		//check file exist
		fs.access(filePath, fs.constants.F_OK, (err) => {
			if (err) {
				console.error('The file does not exist in the folder.')
			} else {
				console.log('The file exists in the folder.')
			}
		})

		let payloadData = {
			cert: {
				files: [fileName],
			},
			ref: common.CERTIFICATE,
		}

		const getSignedUrl = await fileService.getSignedUrl(payloadData, 'BASE_TEMPLATE', 'system', false)
		if (!getSignedUrl.result) {
			throw new Error('FAILED_TO_GENERATE_SIGNED_URL')
		}

		if (!getSignedUrl.result) {
			throw new Error('FAILED_TO_GENERATE_SIGNED_URL')
		}

		const fileUploadUrl = getSignedUrl.result['cert']['files'][0].url
		let uploadedFilePath = getSignedUrl.result['cert']['files'][0].file
		const fileData = fs.readFileSync(filePath)
		//upload file
		await request({
			url: fileUploadUrl,
			method: 'put',
			headers: {
				'Content-Type': 'application/multipart/form-data',
			},
			body: fileData,
		})

		// skip if template already exists
		const existingTemplate = await certificateQueries.findOne({
			code: currentPointerArray.code,
			tenant_code: utils.convertToString(newTenantCode),
			organization_code: utils.convertToString(newOrgCode),
			resource_type: common.PROJECT,
		})

		if (existingTemplate) {
			console.log(`Certificate template "${currentPointerArray.code}" already exists. Skipping.`)
			continue
		}

		const certificateData = {
			...currentPointerArray,
			url: uploadedFilePath,
			organization_code: utils.convertToString(newOrgCode),
			tenant_code: utils.convertToString(newTenantCode),
			resource_type: common.PROJECT,
			created_by: common.CREATED_BY_SYSTEM,
			created_at: new Date(),
			updated_at: new Date(),
		}

		let certificate = await certificateQueries.create(certificateData)
		if (!certificate.id) {
			throw new Error('FAILED_TO_CREATE_CERTIFICATE_TEMPLATE')
		}
	}
}
