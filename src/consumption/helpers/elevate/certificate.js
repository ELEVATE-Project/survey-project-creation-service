/**
 * name : certificate.js
 * author : Priyanka Pradeep
 * Date : 18-NOV-2025
 * Description : Helper functions for certificate template operations
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')
const utils = require('@generics/utils')
const common = require('@constants/common')

// Socket management for axios requests
let socketInUse = false

/**
 * Wait for socket availability before making a request
 * @name waitForSocketAvailability
 * @returns {Promise} - Resolves when socket is available
 */
async function waitForSocketAvailability() {
	return new Promise((resolve) => {
		const checkInterval = setInterval(() => {
			if (!socketInUse) {
				clearInterval(checkInterval)
				resolve()
			}
		}, 1000) // Check every second
	})
}

/**
 * Function to fetch data information from cloud using downloadable URL
 * @name getBaseTemplate
 * @param {String} templateUrl - Cloud path to download
 * @returns {Object} - Response with success status and template data
 */
async function getBaseTemplate(templateUrl) {
	try {
		// Validate input
		if (!templateUrl || typeof templateUrl !== 'string') {
			throw new Error('Invalid template URL provided')
		}

		// Mark socket as engaged
		socketInUse = true

		const response = await axios.get(templateUrl, {
			timeout: 120000, // 2 minutes timeout
			headers: {
				Connection: 'close', // Ensures the socket is closed after the request
			},
		})

		// Mark socket as free
		socketInUse = false

		if (response.status === 200) {
			return {
				success: true,
				result: response.data,
			}
		} else {
			throw new Error(`Unexpected response status: ${response.status}`)
		}
	} catch (error) {
		// Mark socket as free in case of error
		socketInUse = false

		// Enhanced error handling
		if (error.response) {
			// Server responded with error status
			return Promise.reject(
				new Error(
					`Failed to fetch base template: Server responded with status ${error.response.status} - ${
						error.response.statusText || 'Unknown error'
					}`
				)
			)
		} else if (error.request) {
			// Request was made but no response received
			return Promise.reject(
				new Error(`Failed to fetch base template: No response received from server - ${error.message}`)
			)
		} else {
			// Error in request setup
			return Promise.reject(new Error(`Failed to fetch base template: ${error.message}`))
		}
	}
}

/**
 * Download file from cloud and convert it into base64
 * @name downloadAndConvertToBase64
 * @param {String} url - Cloud path to download
 * @returns {String} - Base64 data URL
 */
async function downloadAndConvertToBase64(url) {
	try {
		// Validate input
		if (!url || typeof url !== 'string') {
			throw new Error('Invalid URL provided')
		}

		// Wait if the socket is in use
		if (socketInUse) {
			console.log('Socket is in use. Waiting for 1 minute...')
			await new Promise((resolve) => setTimeout(resolve, 60000)) // Wait for 1 minute
		}

		// Mark socket as in use
		socketInUse = true

		// Download the image file as a binary buffer
		const response = await axios({
			url,
			method: 'GET',
			responseType: 'arraybuffer', // Ensures we receive raw binary data
			timeout: 120000,
			headers: {
				Connection: 'close', // Ensures the socket is closed after the request
			},
		})

		// Convert the binary data to a Base64 string
		const base64 = Buffer.from(response.data, 'binary').toString('base64')

		// Create the Base64 Data URL
		const base64DataUrl = `data:image/png;base64,${base64}`

		// Mark socket as free
		socketInUse = false

		return base64DataUrl
	} catch (error) {
		console.error('Error downloading or converting file:', error.message)
		// Mark socket as free
		socketInUse = false
		throw error
	}
}

/**
 * Generate presigned URL for file upload in consumption service
 * @name generatePresignedUrlInConsumption
 * @param {String} url - API endpoint URL
 * @param {Object} body - Request body
 * @param {Object} headers - Request headers
 * @returns {Object} - Response with success status, file path and upload URL
 */
async function generatePresignedUrlInConsumption(url, body, headers) {
	try {
		const response = await axios.post(url, body, { headers, timeout: 6000 })
		let result = { success: false }
		if (response.status === 200) {
			const files = response?.data?.result?.[common.CERTIFICATE]?.files

			if (Array.isArray(files) && files.length > 0) {
				result.file = files[0]?.payload?.sourcePath || null
				result.url = files[0]?.url || null
				result.success = true
			} else {
				console.error('Files array is missing or empty:', files)
			}
		} else {
			console.error('Unexpected response status:', response.status)
		}

		return result
	} catch (error) {
		console.error('Error generating consumption presigned URL:', error.message)
		throw error // Rethrow the error to be handled by the caller
	}
}

/**
 * Upload file to signed URL
 * @name uploadFile
 * @param {String} dirPath - Directory path where file is located
 * @param {String} fileName - Name of the file to upload
 * @param {String} fileUploadUrl - Presigned URL for upload
 * @returns {Promise} - Resolves when upload is complete
 */
async function uploadFile(dirPath, fileName, fileUploadUrl) {
	try {
		// Read the file data
		const fileData = fs.readFileSync(path.join(dirPath, fileName))

		const headers = {
			'Content-Type': 'multipart/form-data',
		}

		// Perform the PUT request
		const fileUploadToSignedUrl = await axios.put(fileUploadUrl, fileData, { headers })

		// Check the response status
		if (fileUploadToSignedUrl.status === 200) {
			console.log('File uploaded successfully!')
			console.log('Response status:', fileUploadToSignedUrl.status)
		} else {
			console.error('Unexpected response:', fileUploadToSignedUrl.status)
		}
	} catch (error) {
		console.error('Error uploading file:', error.message)
		if (error.response) {
			console.error('Response status:', error.response.status)
			console.error('Response data:', error.response.data)
		}
	}
}

/**
 * Create SVG template by editing base template
 * @name createSvg
 * @param {Object} certificateData - Certificate data for upload
 * @param {String} loggedInUserId - ID of logged in user
 * @param {String} userToken - User authentication token
 * @returns {Promise} - Resolves with file path and success message
 */
async function createSvg(certificateData, loggedInUserId, userToken) {
	return new Promise(async (resolve, reject) => {
		try {
			// fetch base template from cloud
			let baseTemplate = await getBaseTemplate(certificateData?.base_template_url)
			if (!baseTemplate.success) {
				throw new Error('Base template download failed.')
			}

			// Load SVG template using Cheerio with XML mode
			const $ = cheerio.load(baseTemplate.result, { xmlMode: true })

			// set issuer name
			const issuerNameTag = 'stateTitle'
			const issuerNameElement = $(`#${issuerNameTag}`)
			issuerNameElement.text(utils.escapeXml(certificateData.issuer))

			// update signature
			for (let index = 1; index <= certificateData.signature.no_of_signature; index++) {
				const signatureNameTag = `signatureTitle${index}a`
				const signatureDesignationTag = `signatureTitleDesignation${index}`
				const signatureImgTag = `signatureImg${index}`
				await waitForSocketAvailability() // check and wait for axios socket availability
				const imageData = await downloadAndConvertToBase64(certificateData.signature[signatureImgTag])
				const signatureNameElement = $(`#${signatureNameTag}`)
				const signatureImgElement = $(`#${signatureImgTag}`)
				signatureImgElement.attr('xlink:href', utils.escapeXml(imageData))
				signatureNameElement.text(
					`${utils.escapeXml(certificateData.signature[`signatureTitleName${index}`])} , ${utils.escapeXml(
						certificateData.signature[signatureDesignationTag]
					)}`
				)
			}

			// update logos
			for (let index = 1; index <= certificateData.logos.no_of_logos; index++) {
				const logoTag = `stateLogo${index}`
				await waitForSocketAvailability() // check and wait for axios socket availability
				const imageData = await downloadAndConvertToBase64(certificateData.logos[logoTag])
				const logoElement = $(`#${logoTag}`)
				logoElement.attr('xlink:href', utils.escapeXml(imageData))
			}

			// updated svg
			let updatedSvg = $.xml()

			// replace quote escape charecters with "
			updatedSvg = updatedSvg.replace(/&quot;/g, '"')

			const uniqueId = utils.generateUniqueId() //generate a unique id for folder
			let fileName = `${uniqueId}.svg` //create a unique file name
			const mainPath = path.join(__dirname, '../../temp/certificate/') //temporary folder path for certificate template
			let dirPath = path.join(mainPath, `${uniqueId}/`) //create a directory path
			fs.mkdirSync(dirPath, { recursive: true }) //create directory
			fs.writeFileSync(path.join(dirPath, fileName), updatedSvg, { encoding: 'utf8' }) //create file

			// create a file upload payload
			let payloadData = {
				request: {
					[common.CERTIFICATE]: {
						files: [fileName],
					},
				},
			}
			// generate signed url
			const headers = {
				'X-auth-token': userToken.replace(/^bearer\s+/i, ''),
			}
			const getSignedUrl = await generatePresignedUrlInConsumption(
				process.env.INTERFACE_SERVICE_HOST +
					process.env.PROJECT_SERVICE_BASE_URL +
					process.env.CONSUMPTION_SERVICE_PRESIGNED_URL,
				payloadData,
				headers
			)
			if (!getSignedUrl.success) {
				throw new Error('FAILED_TO_GENERATE_SIGNED_URL')
			}

			const fileUploadUrl = getSignedUrl.url
			let uploadedFilePath = getSignedUrl.file
			await uploadFile(dirPath, fileName, fileUploadUrl)
			// delete folder after upload
			await deleteFolderRecursive(path.join(mainPath, uniqueId))

			resolve({
				message: 'Template edited successfully',
				filePath: uploadedFilePath,
			})
		} catch (error) {
			reject(error)
		}
	})
}

/**
 * Recursively delete folder and its contents
 * @name deleteFolderRecursive
 * @param {String} folderPath - Path of folder to delete
 * @returns {Promise} - Resolves when folder is deleted
 */
async function deleteFolderRecursive(folderPath) {
	// Check if the folder exists
	if (fs.existsSync(folderPath)) {
		// Get all files and subdirectories in the folder
		fs.readdirSync(folderPath).forEach((file) => {
			const currentPath = path.join(folderPath, file)

			// If the item is a directory, recursively delete its contents
			if (fs.lstatSync(currentPath).isDirectory()) {
				deleteFolderRecursive(currentPath)
			} else {
				// Otherwise, delete the file
				fs.unlinkSync(currentPath)
			}
		})
		// Delete the empty folder
		fs.rmdirSync(folderPath)
		console.log(`Folder and its contents deleted: ${folderPath}`)
	} else {
		console.log('Folder does not exist:', folderPath)
	}
}

module.exports = {
	getBaseTemplate,
	downloadAndConvertToBase64,
	waitForSocketAvailability,
	generatePresignedUrlInConsumption,
	uploadFile,
	createSvg,
	deleteFolderRecursive,
}
