/**
 * name : addDefaultTargeting.js
 * author : Adithya Dinesh
 * created-date : 10-SEP-2025
 * Description : script to upload default targeting
 */
require('module-alias/register')

const fs = require('fs')
const utils = require('@generics/utils')
const path = require('path')
const organizationConfigQueries = require('@database/queries/organizationConfig')

// find the path of src folder in the structure
const srcPath = `${path.sep}${utils.pathFinder(__dirname, 'src')}`
// find the path of .env file
const envPath = `${path.sep}${path.join(srcPath, '.env')}`

// load .env file
require('dotenv').config({ path: envPath })

// find the default tenant and org code from env file
const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
	? process.env.DEFAULT_TENANT_CODE.toString()
	: (() => {
			throw new Error('DEFAULT_TENANT_CODE is not defined in env')
	  })()
const defaultOrgCode = process.env.DEFAULT_ORGANISATION_CODE
	? process.env.DEFAULT_ORGANISATION_CODE.toString()
	: (() => {
			throw new Error('DEFAULT_TENANT_CODE is not defined in env')
	  })()

// function to read a json file from the file system
const readJsonFile = (filePath) => {
	try {
		// Read the file content
		const data = fs.readFileSync(filePath)
		// Parse JSON data
		const jsonData = JSON.parse(data)
		return jsonData
	} catch (error) {
		console.error('Error reading or parsing JSON file:', error)
		throw error
	}
}
// check if auth file config is defined
if (!process?.env?.AUTH_CONFIG_FILE_PATH) throw new Error('AUTH_CONFIG_FILE_PATH is not defined in env')
// find path to auth config file
let filePath = path.join(srcPath, process.env.AUTH_CONFIG_FILE_PATH)
// read the config file
const config = readJsonFile(filePath)
// fetch targeting criteria from config
const targetingCriteria = { targeting_criteria: config?.targeting_criteria }

;(async () => {
	try {
		// create the given config in organization config table for default org and tenant
		await organizationConfigQueries
			.create({
				organization_code: defaultOrgCode,
				tenant_code: defaultTenantCode,
				meta: targetingCriteria,
			})
			.then((response) => {
				console.log('Default Targeting added successfully')
				process.exit(0)
			})
			.catch((err) => {
				console.log(err)
				process.exit(1)
			})
	} catch (error) {
		console.log(error)
	}
})().catch((err) => console.error(err))
