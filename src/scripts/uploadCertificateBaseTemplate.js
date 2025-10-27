/**
 * name : uploadBaseTemplate.js
 * author : Priyanka Pradeep
 * created-date : 29-May-2024
 * Description : script to upload the certificate base templates.
 */
require('module-alias/register')
const fs = require('fs')
require('dotenv').config({ path: '../.env' })
const path = require('path')
const fileService = require('../services/files')
const request = require('request')
const certificateQueries = require('../database/queries/certificateBaseTemplate')
const common = require('../constants/common')
const utils = require('../generics/utils')
const organizationCode = process.env.DEFAULT_ORGANIZATION_CODE || null
const tenantCode = process.env.DEFAULT_TENANT_CODE || null

;(async () => {
	try {
		if (!organizationCode) {
			throw new Error('DEFAULT_ORGANIZATION_CODE must be set')
		}
		if (!tenantCode) {
			throw new Error('DEFAULT_TENANT_CODE must be set')
		}
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

			const getSignedUrl = await fileService.getSignedUrl(
				payloadData,
				organizationCode,
				tenantCode,
				'BASE_TEMPLATE',
				'system',
				false
			)
			if (!getSignedUrl.result) {
				throw new Error('FAILED_TO_GENERATE_SIGNED_URL')
			}

			if (!getSignedUrl.result) {
				throw new Error('FAILED_TO_GENERATE_SIGNED_URL')
			}

			const fileUploadUrl = getSignedUrl.result['cert']['files'][0].url
			console.log(fileUploadUrl, 'fileUploadUrl')
			let uploadedFilePath = getSignedUrl.result['cert']['files'][0].file
			console.log(uploadedFilePath, 'uploadedFilePath')
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

			const certificateData = {
				...currentPointerArray,
				url: uploadedFilePath,
				organization_code: utils.convertToString(organizationCode),
				tenant_code: utils.convertToString(tenantCode),
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

		console.log('completed')
	} catch (error) {
		console.log(error)
	}
})().catch((err) => console.error(err))
