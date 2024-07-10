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
const utils = require('@generics/utils')

;(async () => {
	try {
		const certificatesArray = [
			{
				code: 'one-logo-one-sign',
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
				},
			},
			{
				code: 'one-logo-two-sign',
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
				},
			},
			{
				code: 'two-logo-one-sign',
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
				},
			},
			{
				code: 'two-logo-two-sign',
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
				organization_id: utils.convertIntToString(process.env.DEFAULT_ORG_ID),
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
